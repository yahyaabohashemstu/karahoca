import React from 'react';
import { Skeleton, SkeletonText, SkeletonCard, SkeletonButton, SkeletonCircle } from './Skeleton';

interface PageLoaderProps {
    hiding?: boolean;
}

const PageLoader: React.FC<PageLoaderProps> = ({ hiding = false }) => {
    return (
        <div className={`page-loader ${hiding ? 'page-loader--hiding' : ''}`}>
            {/* Header Skeleton */}
            <div className="page-loader__header">
                <Skeleton width={150} height={48} borderRadius={12} />
                <div style={{ display: 'flex', gap: 16 }}>
                    <Skeleton width={80} height={32} borderRadius={8} />
                    <Skeleton width={80} height={32} borderRadius={8} />
                    <Skeleton width={80} height={32} borderRadius={8} />
                </div>
                <SkeletonCircle size={40} />
            </div>

            {/* Hero Section Skeleton */}
            <div className="page-loader__hero">
                <div className="page-loader__badges">
                    <Skeleton width={100} height={28} borderRadius={14} />
                    <Skeleton width={120} height={28} borderRadius={14} />
                    <Skeleton width={90} height={28} borderRadius={14} />
                </div>
                <Skeleton width="50%" height={48} borderRadius={12} className="skeleton-text--title" />
                <SkeletonText lines={2} width="80%" />
                <div className="page-loader__cta-row">
                    <SkeletonButton width={160} />
                    <SkeletonButton width={140} />
                </div>
                <Skeleton width="100%" height={300} borderRadius={16} style={{ marginTop: '1rem' }} />
            </div>

            {/* Brand Cards Skeleton */}
            <div className="page-loader__section">
                <Skeleton width={200} height={32} borderRadius={8} style={{ margin: '0 auto' }} />
                <Skeleton width={300} height={20} borderRadius={6} style={{ margin: '0 auto' }} />
                <div className="page-loader__cards">
                    <SkeletonCard height={180} />
                    <SkeletonCard height={180} />
                </div>
            </div>

            {/* Stats Section Skeleton */}
            <div className="page-loader__section">
                <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <Skeleton width={80} height={48} borderRadius={8} style={{ margin: '0 auto 8px' }} />
                            <Skeleton width={100} height={16} borderRadius={4} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PageLoader;
