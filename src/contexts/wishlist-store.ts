import { createContext } from 'react';

export interface WishlistItem {
  id: string;
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

export interface WishlistContextValue {
  items: WishlistItem[];
  isInWishlist: (id: string) => boolean;
  toggle: (item: WishlistItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const WishlistContext = createContext<WishlistContextValue | null>(null);
