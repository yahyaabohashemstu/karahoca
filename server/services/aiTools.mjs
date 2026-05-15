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
 */
const formatProduct = (row, lang) => {
  const l = normaliseLang(lang);
  const brandPath = row.brand === 'DIOX' ? 'diox' : 'aylux';
  return {
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
 * search_products tool. Walks the active products table and ranks rows
 * by:
 *   1. The query matches (case-insensitive) the localised name column.
 *   2. Then the localised description column.
 *   3. Then the category title (joined from product_categories).
 *
 * An empty query is treated as "any product" — useful when the model
 * just wants to list the brand. Limit clamps to 1..10 (default 5).
 */
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
  const like = toLikePattern(safeQuery);

  try {
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

    const products = rows.map((row) => formatProduct(row, l));

    // The "result" half is fed back to the model as the tool message.
    // We deliberately keep it COMPACT (no full descriptions, no images)
    // so it doesn't blow up the token budget on the follow-up generation.
    // The frontend gets the rich version via the `attachments` half.
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
