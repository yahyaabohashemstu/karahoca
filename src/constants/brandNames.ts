/**
 * Brand name variants — single source of truth for SEO + structured data.
 *
 * The Arabic search market uses a wide range of transliterations for
 * "Karahoca" because the Turkish 'c' (which sounds like English 'j')
 * has no direct Arabic equivalent. Different communities settle on
 * different conventions:
 *
 *   - "قره خوجة"  ★ traditional Ottoman-Turkish transliteration; the
 *                   form most Arabic speakers familiar with Turkish
 *                   chemical / industrial brands use.
 *   - "قرة خوجة"  Modern standard Arabic punctuation (tāʾ marbūṭa).
 *   - "قرا هوجا"  Phonetic transliteration popular in the Levant.
 *
 * Other phonetic spellings exist (e.g. كاراهوكا / كاراهوجا — direct
 * borrowings from Turkish "karahoca") but we deliberately don't use
 * them as display aliases; per brand directive the canonical Arabic
 * display form everywhere on the site is the Ottoman "قره خوجة".
 *
 * A buyer searching for the Aleppo cleaning supplier may type any of
 * these. The site previously only ranked for the Latin "KARAHOCA" and
 * a couple of phonetic Arabic forms — searches for "قره خوجة" returned
 * the unrelated Syrian competitor `industrysy.com` instead.
 *
 * Every SEO surface that names the company (titles, descriptions,
 * Open Graph, JSON-LD `alternateName`, hero subtitle, footer, About
 * page disambiguation) imports from this constants file so the variant
 * list stays in lock-step everywhere.
 */

/** The legal Latin name as it appears on incorporation papers. */
export const BRAND_LATIN_OFFICIAL = 'KARAHOCA';

/** The most common Arabic search form — the one we want to rank #1 on. */
export const BRAND_ARABIC_PRIMARY = 'قره خوجة';

/**
 * All Arabic variants we want indexed. Order matters: the FIRST entry
 * is the canonical search target; everything after is supporting
 * coverage for less-common spellings. Keep this list focused — bloating
 * it with near-duplicates dilutes the search signal.
 *
 * Editorial policy (per brand directive): the spelling "كاراهوكا" is
 * NOT included anywhere visible — neither as a displayed alias nor in
 * SEO keyword targets. We rank on the canonical Ottoman form
 * "قره خوجة" plus the punctuation / phonetic variants below.
 */
export const BRAND_ARABIC_VARIANTS = [
  'قره خوجة',  // ★ primary
  'قرة خوجة',
  'قره خوجه',
  'قرا خوجة',
  'قرا هوجا',
  'كرا هوجا',
] as const;

/**
 * Latin spellings that show up in industry directories and English-
 * language listings. KARAHOCA is the canonical capitalised legal form;
 * the rest cover competitor confusion (Karahoja, Kara Hoca, etc.).
 */
export const BRAND_LATIN_VARIANTS = [
  'KARAHOCA',           // ★ official
  'KARAHOCA KIMYA',     // legal entity
  'Karahoca',
  'Kara Hoca',
  'Karahoja',
] as const;

/**
 * The full alternateName array passed to schema.org Organization /
 * Place / Brand nodes. Order: Latin official first, then Arabic
 * primary, then variants (Arabic before Latin to nudge the algorithm
 * toward Arabic relevance for the underserved query cluster).
 */
export const BRAND_ALTERNATE_NAMES: ReadonlyArray<string> = [
  ...BRAND_LATIN_VARIANTS,
  ...BRAND_ARABIC_VARIANTS,
];

/**
 * Bilingual compact display for hero subtitle / footer.
 *
 * Format: `KARAHOCA · قره خوجة`
 *   - Latin official first (legal name)
 *   - Traditional Ottoman Arabic form (the canonical we rank on)
 *
 * Note: this string deliberately omits "كاراهوكا" per the brand
 * directive — we don't want the same name shown twice in two Arabic
 * spellings; "قره خوجة" is the single canonical Arabic display form.
 */
export const BRAND_DISPLAY_TRILINGUAL =
  `${BRAND_LATIN_OFFICIAL} · ${BRAND_ARABIC_PRIMARY}`;

/**
 * Used for HTML `alt` attributes on the brand logo, in search-engine-
 * targeted meta keywords, and inside `<meta name="application-name">`.
 * Crawlers parse alt text as image description AND as a weak text
 * signal — including the Arabic name here lets image search find the
 * logo via Arabic queries too.
 */
export const BRAND_LOGO_ALT_TEXT =
  `${BRAND_LATIN_OFFICIAL} — ${BRAND_ARABIC_PRIMARY}`;
