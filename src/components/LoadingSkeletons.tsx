import React from 'react';
import './LoadingSkeletons.css';

// Skeleton للكروت العامة
export const CardSkeleton: React.FC = () => (
  <div className="skeleton-card">
    <div className="skeleton-media"></div>
    <div className="skeleton-content">
      <div className="skeleton-title"></div>
      <div className="skeleton-text"></div>
      <div className="skeleton-text short"></div>
    </div>
  </div>
);

// Skeleton للمنتجات (flip cards)
export const ProductSkeleton: React.FC = () => (
  <div className="skeleton-product">
    <div className="skeleton-product-image"></div>
    <div className="skeleton-product-name"></div>
    <div className="skeleton-product-desc"></div>
  </div>
);

// Skeleton للـ Hero Section
export const HeroSkeleton: React.FC = () => (
  <div className="skeleton-hero">
    <div className="skeleton-hero-text">
      <div className="skeleton-title large"></div>
      <div className="skeleton-text"></div>
      <div className="skeleton-text"></div>
      <div className="skeleton-buttons">
        <div className="skeleton-button"></div>
        <div className="skeleton-button"></div>
      </div>
    </div>
    <div className="skeleton-hero-image"></div>
  </div>
);

// Skeleton Grid للمنتجات
export const ProductsGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="products-grid">
    {Array.from({ length: count }).map((_, index) => (
      <ProductSkeleton key={index} />
    ))}
  </div>
);

// Page Loading Overlay
export const PageLoader: React.FC = () => (
  <div className="page-loader">
    <div className="loader-spinner"></div>
    <p className="loader-text">جاري التحميل...</p>
  </div>
);

// Inline Loading Spinner
export const InlineLoader: React.FC<{ size?: 'small' | 'medium' | 'large' }> = ({ 
  size = 'medium' 
}) => (
  <div className={`inline-loader inline-loader--${size}`}>
    <div className="spinner"></div>
  </div>
);
