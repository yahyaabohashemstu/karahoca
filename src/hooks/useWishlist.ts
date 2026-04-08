import { useState, useCallback } from 'react';

export interface WishlistItem {
  id: string;       // unique key: brand + name
  name: string;
  description: string;
  image: string;
  alt: string;
  brand: string;
  details?: {
    weight?: string;
    material?: string;
    count?: string;
  };
}

const STORAGE_KEY = 'karahoca_wishlist';

const loadFromStorage = (): WishlistItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (items: WishlistItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* quota exceeded — ignore */ }
};

export const useWishlist = () => {
  const [items, setItems] = useState<WishlistItem[]>(loadFromStorage);

  const isInWishlist = useCallback(
    (id: string) => items.some(i => i.id === id),
    [items],
  );

  const toggle = useCallback((item: WishlistItem) => {
    setItems(prev => {
      const next = prev.some(i => i.id === item.id)
        ? prev.filter(i => i.id !== item.id)
        : [...prev, item];
      saveToStorage(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    saveToStorage([]);
  }, []);

  return { items, isInWishlist, toggle, remove, clear };
};
