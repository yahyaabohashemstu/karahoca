import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { WishlistContext, type WishlistItem } from './wishlist-store';
import { hasUnresolvedWishlistItems, migrateWishlistItems } from './wishlistMigration';
import { track } from '../utils/track';
import { useHydratedTransition } from '../hooks/useHydrated';

const STORAGE_KEY = 'karahoca_wishlist';
const NO_ITEMS: WishlistItem[] = [];

const logStorageError = (action: 'load' | 'save', error: unknown) => {
  if (import.meta.env.DEV) {
    console.warn(`Wishlist ${action} failed.`, error);
  }
};

const load = (): WishlistItem[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    // Upgrade v1 entries to product-id keys (see wishlistMigration.ts).
    // Entries that need the static catalog are finished asynchronously by
    // the provider below.
    const items = migrateWishlistItems(stored);
    if (items !== stored) save(items);
    return items;
  } catch (error) {
    logStorageError('load', error);
    return [];
  }
};

const save = (items: WishlistItem[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    logStorageError('save', error);
  }
};

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<WishlistItem[]>(load);

  // Old entries without a product id are resolved by image against the
  // static catalog. That chunk is lazy (brand pages only), so it is fetched
  // here only when such an entry actually exists — normally never. Entries
  // it can't resolve stay as they are, and the effect doesn't re-run for
  // them because `hasUnresolved` stays true.
  const hasUnresolved = hasUnresolvedWishlistItems(items);
  useEffect(() => {
    if (!hasUnresolved) return;
    let cancelled = false;
    import('../data/brandCatalog')
      .then(({ getStaticProductIdsByImage }) => {
        if (cancelled) return;
        const productIdsByImage = getStaticProductIdsByImage();
        setItems(prev => {
          const next = migrateWishlistItems(prev, productIdsByImage);
          if (next !== prev) save(next);
          return next;
        });
      })
      .catch(() => { /* offline / chunk error — entries keep working as-is */ });
    return () => { cancelled = true; };
  }, [hasUnresolved]);

  // The saved wishlist is per visitor, so a prerendered page was rendered
  // with an empty one. Consumers see it only once the page has hydrated
  // (filled hearts, the header count…) — otherwise the first render would
  // differ from the HTML and React would throw the snapshot away.
  const hydrated = useHydratedTransition();
  const visibleItems = hydrated ? items : NO_ITEMS;

  const isInWishlist = useCallback((id: string) => visibleItems.some(i => i.id === id), [visibleItems]);

  // Read outside the state updater (updaters must stay pure — StrictMode
  // runs them twice), so the add/remove event is sent exactly once.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const toggle = useCallback((item: WishlistItem) => {
    const adding = !itemsRef.current.some(i => i.id === item.id);
    track({
      event_type: adding ? 'wishlist_add' : 'wishlist_remove',
      product_id: item.productDbId ?? item.id,
      payload: { brand: item.brand, product_name: item.name },
    });
    setItems(prev => {
      const next = prev.some(i => i.id === item.id)
        ? prev.filter(i => i.id !== item.id)
        : [...prev, item];
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    save([]);
  }, []);

  // Memoize the context value so consumers only re-render when `items`
  // actually changes. Without this, every parent re-render (e.g. a router
  // navigation or a language switch) creates a NEW object literal here,
  // React's Object.is check fails, and every wishlist consumer (Header,
  // BrandPageTemplate, WishlistPage) re-renders for nothing.
  //
  // `toggle`, `remove`, `clear` are already stable via useCallback([]);
  // `isInWishlist` depends on `items`, so it's already captured in deps.
  const value = useMemo(
    () => ({ items: visibleItems, isInWishlist, toggle, remove, clear }),
    [visibleItems, isInWishlist, toggle, remove, clear],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};
