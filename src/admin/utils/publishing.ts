// Publishing guards shared by the product, news and blog editors.

/**
 * Public pages are pre-rendered when the site is deployed. The SPA reads
 * the API, so visitors see an edit (or an unpublish / delete) at once, but
 * search engines, link previews and no-JS visitors get the pre-rendered
 * HTML until the next deploy. Shown once, next to the status control.
 */
export const PRERENDER_NOTE =
  'Visitors see changes right away; the pre-rendered copy that search engines and link previews read updates on the next deploy.';

/**
 * "Scheduled" with a time that has already passed is released by the
 * scheduler straight away — the item goes public on save, which is easy to
 * miss when the date was set days ago and never moved. Returns false when
 * the admin cancels.
 */
export const confirmPastSchedule = (status: string | null | undefined, publishAt: string | null | undefined): boolean => {
  if (status !== 'scheduled' || !publishAt) return true;
  const at = Date.parse(publishAt);
  if (Number.isNaN(at) || at > Date.now()) return true;
  return window.confirm(
    'The scheduled time is already in the past, so this will go public as soon as it is saved.\n\nSave anyway?',
  );
};

/**
 * A live item's slug is its URL: changing it breaks every link already
 * shared or indexed. Returns false when the admin cancels.
 */
export const confirmSlugChange = (
  noun: string,
  wasLive: boolean,
  oldSlug: string | null | undefined,
  newSlug: string,
): boolean => {
  if (!wasLive || !oldSlug || oldSlug === newSlug) return true;
  return window.confirm(
    `This ${noun} is published. Existing links to it (…/${oldSlug}) will stop working once the slug changes to "${newSlug || '(auto-generated)'}".\n\nChange it anyway?`,
  );
};
