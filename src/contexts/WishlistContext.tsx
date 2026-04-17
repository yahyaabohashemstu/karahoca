import React, { useState, useCallback, useMemo } from 'react';
import { WishlistContext, type WishlistItem } from './wishlist-store';

const STORAGE_KEY = 'karahoca_wishlist';

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
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as WishlistItem[];
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

  const isInWishlist = useCallback((id: string) => items.some(i => i.id === id), [items]);

  const toggle = useCallback((item: WishlistItem) => {
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
    () => ({ items, isInWishlist, toggle, remove, clear }),
    [items, isInWishlist, toggle, remove, clear],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};
