import { toBrandId } from '../constants/brandNames';
import type { WishlistItem } from './wishlist-store';

/**
 * Wishlist entry identity: v1 → v2.
 *
 * v1 entries were keyed `${brandWordmark}-${localisedProductName}`
 * ("AYLUX-AYLUX Sıvı Sabun"), which broke in three ways:
 *   • Size / formula variants share a display name (the 3 L and 400 ML
 *     liquid soaps), so they shared ONE id: hearting either hearted both,
 *     and only one of them could ever be saved.
 *   • The id was in the UI language, so an item saved in Turkish showed as
 *     not saved in Arabic.
 *   • Since the DİOX rename, `brand` was stored as the wordmark 'DİOX', not
 *     the identifier 'DIOX' WishlistPage compares against — DİOX items got
 *     AYLUX colours, dropped out of the DİOX filter and shared /aylux links.
 *
 * v2: `id` is the product's DB id ("aylux-liquid-soap1") and `brand` the
 * identifier. A v1 entry resolves through its `productDbId` (saved whenever
 * the product came from the API) or, failing that, its image looked up in
 * the static catalog. Entries that resolve to nothing keep their v1 id:
 * still listed, and removable, on the wishlist page.
 */

const LEGACY_IMAGE_DIRS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/diox\//, '/diox-images/'],
  [/^\/aylux\//, '/aylux-images/'],
];

const normaliseImagePath = (image: string): string => {
  let path = image;
  try { path = decodeURIComponent(path); } catch { /* keep as stored */ }
  for (const [legacyDir, currentDir] of LEGACY_IMAGE_DIRS) path = path.replace(legacyDir, currentDir);
  return path;
};

const isWishlistItem = (value: unknown): value is WishlistItem =>
  typeof value === 'object' && value !== null &&
  typeof (value as WishlistItem).id === 'string' &&
  typeof (value as WishlistItem).name === 'string';

/** True while some entry has no product id — worth loading the catalog for. */
export const hasUnresolvedWishlistItems = (items: readonly WishlistItem[]): boolean =>
  items.some((item) => !item.productDbId);

/**
 * Bring stored entries to v2 and drop duplicates (the same product saved
 * twice, e.g. once per language), keeping the first. Returns the SAME array
 * when nothing changed, so callers can skip the save and the re-render.
 */
export const migrateWishlistItems = (
  stored: unknown,
  productIdsByImage?: ReadonlyMap<string, string>,
): WishlistItem[] => {
  if (!Array.isArray(stored)) return [];

  const seen = new Set<string>();
  const migrated: WishlistItem[] = [];
  let changed = false;

  for (const entry of stored) {
    if (!isWishlistItem(entry)) { changed = true; continue; }

    const productId = entry.productDbId
      ?? (entry.image ? productIdsByImage?.get(normaliseImagePath(entry.image)) : undefined);
    const next: WishlistItem = {
      ...entry,
      brand: toBrandId(entry.brand),
      ...(productId ? { id: productId, productDbId: productId } : {}),
    };

    if (seen.has(next.id)) { changed = true; continue; }
    seen.add(next.id);
    if (next.id !== entry.id || next.brand !== entry.brand || next.productDbId !== entry.productDbId) {
      changed = true;
    }
    migrated.push(next);
  }

  return changed ? migrated : (stored as WishlistItem[]);
};
