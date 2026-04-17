import { getDb } from '../services/db.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { logger } from '../utils/logger.mjs';

/**
 * GET /api/ai/context
 *
 * Serves the static portion of the AI assistant's knowledge to the client —
 * specifically the seven "base knowledge" sections (company identity, brand
 * descriptions, quality policy, contact channels, pricing/shipping policy)
 * and the tone/system-prompt guidelines.
 *
 * This exists because Phase 3 extracts that content out of
 * `src/data/aiKnowledge.ts` (deleted) and into SQLite so ops can edit the
 * base knowledge through the admin panel without a redeploy.
 *
 * The dynamic portion of the knowledge (i18n-driven website section summaries,
 * catalog entries, news matching) is still built client-side because it
 * depends on react-i18next translations and live catalog data that already
 * live there.
 *
 * Payload is cached for 1 hour via Cache-Control. The sections rarely
 * change; admins can invalidate by rebuilding / restarting the server.
 */
export const handleAiContext = (req, res, ctx = {}) => {
  const origin = ctx.origin || '';

  try {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT id, title, content, tags
         FROM ai_knowledge_sections
         WHERE active = 1
         ORDER BY display_order ASC, id ASC`,
      )
      .all();

    const sections = rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tags: typeof row.tags === 'string' && row.tags.length > 0
        ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [],
    }));

    const toneRow = db
      .prepare('SELECT value FROM ai_assistant_config WHERE key = ?')
      .get('tone_guidelines');
    const toneGuidelines = typeof toneRow?.value === 'string' ? toneRow.value : '';

    res.setHeader('Cache-Control', 'public, max-age=3600');
    sendJson(res, 200, { success: true, sections, toneGuidelines }, origin);
  } catch (err) {
    logger.error({ err }, '[api-ai-context] failed');
    sendJson(
      res,
      500,
      { success: false, error: 'Failed to load AI context.' },
      origin,
    );
  }
};
