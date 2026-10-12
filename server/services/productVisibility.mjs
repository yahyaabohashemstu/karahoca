/**
 * The one definition of "a visitor may see this product": not soft-deleted,
 * and published — or scheduled with its publish time already passed (the
 * per-minute scheduler flips the status shortly after, this covers the gap).
 *
 * Same predicate as the public catalogue in public-data.mjs and the sitemap.
 * Every other public surface (share pages, OG images, the AI assistant's
 * catalogue and product search) must use it too, or drafts leak: they were
 * filtered on `active = 1` only, so a draft product could be found by the
 * chat assistant, shared, and unfurled with its photo before launch.
 *
 * @param {string} [alias] table alias, e.g. 'p' for `FROM products p`
 * @returns {string} SQL boolean expression (no leading AND)
 */
export const publicProductWhere = (alias = '') => {
  const c = alias ? `${alias}.` : '';
  return `(${c}active = 1 AND (${c}status = 'published'`
    + ` OR (${c}status = 'scheduled' AND ${c}publish_at IS NOT NULL`
    + ` AND datetime(${c}publish_at) <= datetime('now'))))`;
};
