/**
 * URL slug normaliser for news posts, blog posts and blog categories.
 * The admin editors run the same rules (src/admin/utils/slug.ts) while the
 * admin types; this copy is the authority applied on every save.
 *
 * Slugs used to be stored exactly as sent: "Spring Sale!" or "a/b?c"
 * produced public URLs that broke or 404'd. Unicode letters and digits are
 * kept so Arabic / Russian slugs still work (the public routes decode them).
 */

export const SLUG_MAX_LENGTH = 120;

/**
 * lowercase, letters/digits in any script kept, everything else → "-",
 * runs of dashes collapsed and trimmed, at most SLUG_MAX_LENGTH chars.
 * Returns '' when nothing usable is left — callers reject that with a 400.
 */
export const normalizeSlug = (input) => {
  const dashed = String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    // Combining marks (Arabic harakat, a stray accent) are dropped rather
    // than turned into dashes, which would split a word in two.
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+/, '');
  return Array.from(dashed).slice(0, SLUG_MAX_LENGTH).join('').replace(/-+$/, '');
};

export const EMPTY_SLUG_ERROR = 'The slug must contain at least one letter or digit.';

/** SQLite unique-index violation (e.g. a duplicate slug). */
export const isUniqueViolation = (err) => err?.code === 'SQLITE_CONSTRAINT_UNIQUE';
