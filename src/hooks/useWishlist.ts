// Re-export from WishlistContext so all components share one global state.
// The old local-useState approach caused separate instances per component;
// the context approach ensures the Header count and BrandPage stay in sync.
export { useWishlist, WishlistProvider } from '../contexts/WishlistContext';
export type { WishlistItem } from '../contexts/WishlistContext';
