import React from 'react';
import './Skeleton.css';

// Base Skeleton component
interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    width,
    height,
    borderRadius,
    style = {},
}) => {
    return (
        <div
            className={`skeleton ${className}`}
            style={{
                width,
                height,
                borderRadius,
                ...style,
            }}
        />
    );
};

// Text Skeleton
interface SkeletonTextProps {
    lines?: number;
    width?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 1, width = '100%' }) => {
    return (
        <>
            {Array.from({ length: lines }).map((_, index) => (
                <div
                    key={index}
                    className="skeleton skeleton-text"
                    style={{
                        width: index === lines - 1 && lines > 1 ? '70%' : width,
                    }}
                />
            ))}
        </>
    );
};

// Card Skeleton
interface SkeletonCardProps {
    height?: string | number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ height = 200 }) => {
    return <div className="skeleton skeleton-card" style={{ height }} />;
};

// Image Skeleton
interface SkeletonImageProps {
    aspectRatio?: string;
}

export const SkeletonImage: React.FC<SkeletonImageProps> = ({ aspectRatio = '16/9' }) => {
    return <div className="skeleton skeleton-image" style={{ aspectRatio }} />;
};

// Circle Skeleton (for avatars, icons)
interface SkeletonCircleProps {
    size?: number;
}

export const SkeletonCircle: React.FC<SkeletonCircleProps> = ({ size = 48 }) => {
    return (
        <div
            className="skeleton skeleton-circle"
            style={{ width: size, height: size }}
        />
    );
};

// Button Skeleton
interface SkeletonButtonProps {
    width?: string | number;
}

export const SkeletonButton: React.FC<SkeletonButtonProps> = ({ width = 140 }) => {
    return <div className="skeleton skeleton-button" style={{ width }} />;
};

// Export all components
export default Skeleton;
