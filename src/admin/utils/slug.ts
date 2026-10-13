// URL slug normaliser for news posts, blog posts and blog categories.
// Keep in step with server/services/slug.mjs, which applies the same rules
// on save (the server is the authority; this copy only shapes the input).
//
// Slugs used to be stored exactly as typed: "Spring Sale!" or "a/b?c"
// produced URLs that broke or 404'd. Unicode letters and digits are kept
// so an Arabic or Russian slug still works (the public routes decode it).

export const SLUG_MAX_LENGTH = 120;

/**
 * lowercase, letters/digits in any script kept, everything else → "-",
 * runs of dashes collapsed and trimmed, at most SLUG_MAX_LENGTH chars.
 *
 * `partial` keeps ONE trailing dash, for use while the admin types: trimming
 * it on every keystroke made "my slug" impossible to type (the space turned
 * into a dash and vanished before the next letter arrived).
 */
export const normalizeSlug = (input: string | null | undefined, { partial = false } = {}): string => {
  const dashed = String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    // Combining marks (Arabic harakat, a stray accent) are dropped rather
    // than turned into dashes, which would split a word in two.
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+/, '');
  const capped = Array.from(dashed).slice(0, SLUG_MAX_LENGTH).join('');
  return partial ? capped : capped.replace(/-+$/, '');
};
