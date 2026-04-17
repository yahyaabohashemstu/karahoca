import { useContext } from 'react';
import { WishlistContext } from '../contexts/wishlist-store';

export type { WishlistItem } from '../contexts/wishlist-store';

export const useWishlist = () => {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }

  return context;
};
