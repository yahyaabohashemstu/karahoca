/**
 * AI function-calling tools — what Karo can DO on behalf of the visitor.
 *
 * The chat used to be "Karo describes products in prose". Now Karo can
 * actually search the live SQLite catalogue and return product records
 * the frontend renders as interactive cards. This module:
 *
 *   1. Declares the tool schemas in the OpenAI/OpenRouter function-calling
 *      shape (`TOOLS` const). The model receives this as part of every
 *      `chat/completions` request and chooses when to invoke them.
 *
 *   2. Exposes `executeTool(name, args, lang)` — the dispatcher the
 *      agent loop in aiChat.mjs calls when the model emits a tool_call.
 *      Each tool returns:
 *        { result: <serialisable for the model>, attachments?: <ui hints> }
 *      The `result` half is what we feed back to the model as the
 *      tool-message; `attachments` (when present) is what the frontend
 *      will surface as inline product cards in Phase 4.
 *
 * Defensive throughout:
 *   - Arguments are validated and clamped (string length, integer range)
 *     so a malformed model emission can't crash the server or run a
 *     pathological SQL query.
 *   - All searches use prepared statements with bound parameters — never
 *     string interpolation — so the tool surface is SQL-injection-safe
 *     even if a future model decides to inject SQL keywords into the
 *     query argument.
 *   - On DB failure: return an empty result + a soft error string in the
 *     tool message rather than throwing. The model gracefully says "I
 *     couldn't search the catalogue right now" instead of the whole
 *     chat erroring out.
 */
import { getDb } from './db.mjs';
import { logger } from '../utils/logger.mjs';

const SUPPORTED_LANGS = new Set(['ar', 'en', 'tr', 'ru']);
const normaliseLang = (lang) => (SUPPORTED_LANGS.has(lang) ? lang : 'ar');

// ── Tool schemas ────────────────────────────────────────────────────────────
// These are exactly the JSON shape OpenRouter (and OpenAI) expect under
// the request's top-level `tools` key. Names and descriptions are
// written for the model — terse, action-oriented, naming the trigger
// condition. The model picks tool calls based on these texts.

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description:
        'Search the KARAHOCA product catalog. Returns up to 10 matching products with name, brand, image, weight, and a deep-link URL to the brand catalog page. Use this WHENEVER the customer asks about specific products, mentions a product category (laundry, dishwashing, cleaning, soap, etc.), or asks "what do you have?" / "ما هي منتجاتكم؟" / etc. Always prefer this tool over guessing from prior knowledge — the database is the source of truth.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Free-text search keywords in any language (Arabic, English, Turkish, Russian). Matches against product name, description, category title. Pass an empty string "" to list everything in the chosen brand without filtering.',
          },
          brand: {
            type: 'string',
            enum: ['DIOX', 'AYLUX'],
            description:
              'Optional: restrict to one brand. Omit (or pass null) to search both brands. Use this only when the customer explicitly mentions DIOX or AYLUX by name.',
          },
          limit: {
            type: 'integer',
            description:
              'Maximum products to return (1-10). Default 5. Use 3 for "show me a couple of options", 8-10 for "show me everything".',
            minimum: 1,
            maximum: 10,
          },
        },
        required: ['query'],
      },
    },
  },
];

// ── Tool implementations ────────────────────────────────────────────────────

/**
 * Map a raw DB product row to the public-facing shape we expose to BOTH
 * the model (as the tool message) and the frontend (as a card attachment).
 *
 * The shape is deliberately compact:
 *   - `name`, `description` are pre-localised (server picks the column
 *     matching the visitor's language). Saves the model from having to
 *     translate.
 *   - `image` and `url` are absolute paths from the SPA root — the chat
 *     renderer prefixes them as-needed.
 *   - `id` is included so the frontend can de-duplicate if the same
 *     product appears in two consecutive tool calls.
 *
 * `weight` and `count` are passed as their raw strings (already
 * localised by category convention — these columns are not language-
 * specific in the schema).
 *
 * `primary` (optional) is the visual-hierarchy flag set by the word-
 * overlap scorer when the query has a clear single winner. The chat
 * renderer treats `primary: true` products as a featured card and the
 * rest as a "similar products" strip below.
 */
const formatProduct = (row, lang, extras = {}) => {
  const l = normaliseLang(lang);
  const brandPath = row.brand === 'DIOX' ? 'diox' : 'aylux';
  const out = {
    id: row.id,
    brand: row.brand,
    name: row[`name_${l}`] || row.name_en || row.id,
    description: row[`description_${l}`] || row.description_en || '',
    image: row.image || '',
    weight: row.weight || '',
    material: row[`material_${l}`] || '',
    count: row[`count_${l}`] || '',
    url: `/${l}/${brandPath}#${row.id}`,
  };
  if (extras.primary === true) out.primary = true;
  return out;
};

// ── Multi-word relevance scoring ──────────────────────────────────────────
//
// The 3-tier LIKE query below works for SINGLE-keyword searches but
// degrades sharply when the visitor types a multi-word phrase like
// "مسحوق غسيل عادي" — the LIKE pattern looks for that FULL string as
// a substring, which almost no product name contains verbatim. Result:
// every laundry powder shows up via tier-3 category matching, none
// ranked above the others by user intent.
//
// `scoreProductByOverlap` tokenises the query and awards points for
// each token that lands in name (3), description (2), or category (1)
// of the product. So "DIOX مسحوق غسيل عادي 5kg" scores 9 against the
// query "مسحوق غسيل عادي" (all 3 tokens in name) while "DIOX مسحوق
// غسيل أوتوماتيك 3kg" scores 6 (2 of 3 tokens in name). The chat
// renderer uses the score gap to pick a `primary` (featured) card.
//
// Tokenisation rules:
//   - Lowercased + stripped of punctuation
//   - Minimum length 2 (drops Arabic prepositions like "في", "من" and
//     similar 1-2 char stopwords in EN/TR/RU)
//   - Words longer than 30 chars are dropped (defensive against
//     accidentally pasting a URL into the chat)

const tokeniseQuery = (raw) => {
  if (typeof raw !== 'string') return [];
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter((t) => t.length >= 2 && t.length <= 30);
};

const scoreProductByOverlap = (row, tokens, lang) => {
  if (tokens.length === 0) return 0;
  const l = normaliseLang(lang);
  const nameBlob = `${row[`name_${l}`] || ''} ${row.name_en || ''}`.toLowerCase();
  const descBlob = `${row[`description_${l}`] || ''} ${row.description_en || ''}`.toLowerCase();
  const catBlob = `${row.cat_title_l || ''} ${row.cat_title_en || ''}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (nameBlob.includes(t)) score += 3;
    else if (descBlob.includes(t)) score += 2;
    else if (catBlob.includes(t)) score += 1;
  }
  return score;
};

/**
 * SQLite LIKE pattern: surround with `%` and escape `%` / `_` in the
 * user input so the model can pass arbitrary text without breaking the
 * pattern. The escape character is `\` — we set ESCAPE '\' in the SQL.
 */
const toLikePattern = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const escaped = raw.replace(/[\\%_]/g, (c) => '\\' + c);
  return `%${escaped}%`;
};

/**
 * search_products tool. Two ranking strategies depending on the query:
 *
 *   - SINGLE-keyword queries fall through to the legacy 3-tier LIKE
 *     ranking (name → description → category). Preserves the existing
 *     behaviour for any caller that thinks in keyword-search semantics,
 *     including a future tool-capable LLM that emits compact one-word
 *     queries.
 *
 *   - MULTI-word queries activate the word-overlap scorer. This is the
 *     path the server-side intent detector hits when the visitor types
 *     a descriptive phrase ("مسحوق غسيل عادي"). The legacy LIKE pattern
 *     `%مسحوق غسيل عادي%` matches almost no product names verbatim, so
 *     without this code we'd return the same flat grid of every
 *     laundry product — exactly the UX problem this branch is fixing.
 *
 * The top-scored product is tagged with `primary: true` when there's a
 * clear winner (top score is strictly greater than the second AND high
 * enough to indicate at least a name + description match). The chat
 * renderer treats that tag as "this is THE answer; the others are
 * similar options" so the visitor sees one prominent card with a
 * suggestion strip below.
 *
 * An empty query is treated as "any product" — useful when the model
 * just wants to browse the brand. Limit clamps to 1..10 (default 5).
 */

/**
 * Decide if a sorted list of scored candidates has a clear primary
 * winner. Thresholds chosen for the KARAHOCA catalogue size (~50
 * products) and the typical visitor query (2-4 content words):
 *
 *   - The top score must beat the runner-up by an absolute margin of
 *     at least 2 points. Two same-tier hits (e.g. both "غسيل" + "مسحوق"
 *     in name) tie cleanly; one extra distinguishing token tips it.
 *   - The top score itself must be >= 5, which guarantees AT LEAST one
 *     name hit (3) plus any second-tier hit (2). A lonely name match
 *     (score 3) isn't enough — it could be a coincidental category
 *     overlap rather than the visitor's actual intent.
 *
 * Returns `true` ⇒ caller should flag scored[0] with `primary: true`.
 */
const hasClearPrimaryWinner = (scoredSorted) => {
  if (scoredSorted.length < 2) return scoredSorted.length === 1 && scoredSorted[0].score >= 5;
  const top = scoredSorted[0].score;
  const second = scoredSorted[1].score;
  return top >= 5 && top - second >= 2;
};

const searchProducts = ({ query, brand, limit }, lang) => {
  const l = normaliseLang(lang);
  const safeQuery = typeof query === 'string' ? query.trim().slice(0, 200) : '';
  const safeBrand = brand === 'DIOX' || brand === 'AYLUX' ? brand : null;
  const safeLimit = (() => {
    const n = typeof limit === 'number' ? Math.floor(limit) : 5;
    if (!Number.isFinite(n)) return 5;
    return Math.max(1, Math.min(10, n));
  })();

  const db = getDb();
  const tokens = tokeniseQuery(safeQuery);

  try {
    // ── Branch 1: multi-token overlap scoring ────────────────────────
    if (tokens.length >= 2) {
      const brandClause = safeBrand ? 'AND p.brand = ?' : '';
      const params = safeBrand ? [safeBrand] : [];
      const rows = db
        .prepare(
          `
          SELECT
            p.*,
            c.title_${l} AS cat_title_l,
            c.title_en AS cat_title_en
          FROM products p
          LEFT JOIN product_categories c ON c.id = p.category_id
          WHERE p.active = 1 ${brandClause}
        `,
        )
        .all(...params);

      const scored = rows
        .map((row) => ({ row, score: scoreProductByOverlap(row, tokens, l) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score || a.row.display_order - b.row.display_order);

      if (scored.length > 0) {
        const trimmed = scored.slice(0, safeLimit);
        const promote = hasClearPrimaryWinner(trimmed);
        const products = trimmed.map((entry, idx) =>
          formatProduct(entry.row, l, { primary: promote && idx === 0 }),
        );

        const resultForModel = {
          count: products.length,
          products: products.map((p) => ({
            id: p.id,
            brand: p.brand,
            name: p.name,
            weight: p.weight,
            url: p.url,
          })),
        };
        return {
          result: resultForModel,
          attachments: { products },
        };
      }
      // Fall through to LIKE branch if scoring found nothing — covers
      // queries where all tokens are uncommon (we'd rather return
      // SOMETHING via substring match than nothing at all).
    }

    // ── Branch 2: single-keyword 3-tier LIKE (legacy ranking) ───────
    const like = toLikePattern(safeQuery);
    let rows;
    if (like) {
      // Three-tier ranking via UNION ALL of three SELECTs each tagged
      // with a score column. DISTINCT in the outer SELECT keeps the
      // most-relevant occurrence of a given product. ORDER BY score
      // then display_order so within a tier the catalog's curated
      // ordering wins.
      const brandClause = safeBrand ? `AND p.brand = @brand` : '';
      rows = db
        .prepare(
          `
          SELECT * FROM (
            SELECT p.*, 1 AS rank
              FROM products p
             WHERE p.active = 1 ${brandClause}
               AND (p.name_${l} LIKE @like ESCAPE '\\'
                 OR p.name_en LIKE @like ESCAPE '\\')

            UNION ALL

            SELECT p.*, 2 AS rank
              FROM products p
             WHERE p.active = 1 ${brandClause}
               AND (p.description_${l} LIKE @like ESCAPE '\\'
                 OR p.description_en LIKE @like ESCAPE '\\')
               AND NOT (p.name_${l} LIKE @like ESCAPE '\\'
                     OR p.name_en LIKE @like ESCAPE '\\')

            UNION ALL

            SELECT p.*, 3 AS rank
              FROM products p
              JOIN product_categories c ON c.id = p.category_id
             WHERE p.active = 1 ${brandClause}
               AND (c.title_${l} LIKE @like ESCAPE '\\'
                 OR c.title_en LIKE @like ESCAPE '\\')
               AND NOT (p.name_${l} LIKE @like ESCAPE '\\'
                     OR p.name_en LIKE @like ESCAPE '\\'
                     OR p.description_${l} LIKE @like ESCAPE '\\'
                     OR p.description_en LIKE @like ESCAPE '\\')
          )
          ORDER BY rank, display_order
          LIMIT @limit
        `,
        )
        .all({ like, brand: safeBrand, limit: safeLimit });
    } else {
      // Empty query: just list active products from the chosen brand
      // (or both if none specified), ordered by curated display_order.
      const brandClause = safeBrand ? `WHERE active = 1 AND brand = ?` : `WHERE active = 1`;
      const params = safeBrand ? [safeBrand, safeLimit] : [safeLimit];
      rows = db
        .prepare(`SELECT * FROM products ${brandClause} ORDER BY brand, display_order LIMIT ?`)
        .all(...params);
    }

    // Single-keyword path: promote the FIRST result to primary IFF the
    // sole tier-1 hit is unique. With one keyword we can't compare
    // scores numerically, so the heuristic is: if rows[0] has rank 1
    // (name match) and rows[1] either doesn't exist or has rank >= 2,
    // it's the clear winner.
    let promote = false;
    if (like && rows.length > 0 && rows[0].rank === 1) {
      if (rows.length === 1 || rows[1].rank >= 2) promote = true;
    }
    const products = rows.map((row, idx) =>
      formatProduct(row, l, { primary: promote && idx === 0 }),
    );

    const resultForModel = {
      count: products.length,
      products: products.map((p) => ({
        id: p.id,
        brand: p.brand,
        name: p.name,
        weight: p.weight,
        url: p.url,
      })),
    };

    return {
      result: resultForModel,
      attachments: { products },
    };
  } catch (err) {
    logger.error('[ai-tools] search_products failed:', err.message || err);
    return {
      result: { count: 0, products: [], error: 'Catalog search is temporarily unavailable.' },
    };
  }
};

/**
 * Dispatch a tool call by name. The arguments come from OpenRouter as a
 * JSON-stringified payload; we parse here so callers don't have to
 * worry about partial JSON during streaming.
 *
 * Returns `null` for unknown tool names — the agent loop logs a
 * warning and feeds an empty result back to the model so the chat
 * doesn't deadlock on a typo.
 */
export const executeTool = (name, rawArgs, lang) => {
  let args = {};
  if (typeof rawArgs === 'string') {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      args = {};
    }
  } else if (rawArgs && typeof rawArgs === 'object') {
    args = rawArgs;
  }

  switch (name) {
    case 'search_products':
      return searchProducts(args, lang);
    default:
      logger.warn(`[ai-tools] unknown tool: ${name}`);
      return {
        result: { error: `Unknown tool: ${name}` },
      };
  }
};
