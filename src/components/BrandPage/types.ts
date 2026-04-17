export interface ProductInfo {
  /** DB product ID — used for the deep-link hash (`/aylux#aylux-dishwash-gel`). */
  id?: string;
  name: string;
  description: string;
  image: string;
  alt: string;
  details?: {
    weight?: string;
    material?: string;
    package?: string;
    count?: string;
    gift?: string;
    weightCountTable?: Array<{ weight: string; count: number }>;
  };
  gallery?: string[];
  imageScale?: number;
}

export interface CategoryData {
  title: string;
  products: ProductInfo[];
}
