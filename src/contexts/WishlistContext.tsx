import React, { createContext, useContext, useState, useCallback } from 'react';

export interface WishlistItem {
  id: string;
  /** DB product id (e.g. "aylux-dishwash-gel") — used for WhatsApp deep-link */
  productDbId?: string;
  name: string;
  description: string;
  image: string;
  alt: string;
  brand: string;
  details?: {
    weight?: string;
    material?: string;
    count?: string;
    gift?: string;
    weightCountTable?: Array<{ weight: string; count: number }>;
  };
}

const STORAGE_KEY = 'karahoca_wishlist';

const load = (): WishlistItem[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as WishlistItem[]; }
  catch { return []; }
};

const save = (items: WishlistItem[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
};

interface WishlistCtx {
  items: WishlistItem[];
  isInWishlist: (id: string) => boolean;
  toggle: (item: WishlistItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistCtx | null>(null);

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

  return (
    <WishlistContext.Provider value={{ items, isInWishlist, toggle, remove, clear }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistCtx => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
};
