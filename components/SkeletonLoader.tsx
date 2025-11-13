import React from 'react';

interface SkeletonLoaderProps {
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ count = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            borderRadius: 16,
            padding: 16,
            backgroundColor: '#fff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${index * 0.1}s`,
          }}
        >
          {/* Title skeleton */}
          <div
            style={{
              height: 18,
              backgroundColor: '#e0e0e0',
              borderRadius: 4,
              marginBottom: 12,
              width: '80%',
            }}
          />
          
          {/* Category and time badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                height: 24,
                width: 80,
                backgroundColor: '#e0e0e0',
                borderRadius: 12,
              }}
            />
            <div
              style={{
                height: 24,
                width: 100,
                backgroundColor: '#e0e0e0',
                borderRadius: 12,
              }}
            />
          </div>
          
          {/* Description lines */}
          <div
            style={{
              height: 14,
              backgroundColor: '#e0e0e0',
              borderRadius: 4,
              marginBottom: 8,
              width: '100%',
            }}
          />
          <div
            style={{
              height: 14,
              backgroundColor: '#e0e0e0',
              borderRadius: 4,
              marginBottom: 8,
              width: '90%',
            }}
          />
          
          {/* Footer skeleton */}
          <div
            style={{
              height: 12,
              backgroundColor: '#e0e0e0',
              borderRadius: 4,
              marginTop: 12,
              width: '60%',
            }}
          />
        </div>
      ))}
    </>
  );
};
