import React from 'react';

export const KPISkeleton = () => {
  return (
    <div className="glass-card skeleton-card">
      <div className="skeleton-box shimmer" style={{ width: '40%', height: '1rem', marginBottom: '1rem' }}></div>
      <div className="skeleton-box shimmer" style={{ width: '70%', height: '2.5rem', marginBottom: '0.5rem' }}></div>
      <div className="skeleton-box shimmer" style={{ width: '30%', height: '0.75rem' }}></div>
    </div>
  );
};

export const ChartSkeleton = () => {
  return (
    <div className="glass-card skeleton-chart" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="skeleton-box shimmer" style={{ width: '30%', height: '1.25rem' }}></div>
        <div className="skeleton-box shimmer" style={{ width: '15%', height: '1.25rem' }}></div>
      </div>
      <div className="skeleton-box shimmer" style={{ flex: 1, width: '100%', borderRadius: 'var(--radius-sm)' }}></div>
    </div>
  );
};

export const SummarySkeleton = () => {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="skeleton-box shimmer" style={{ width: '200px', height: '1.5rem', marginBottom: '1rem' }}></div>
      <div className="retail-health-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="retail-health-card">
             <div className="skeleton-box shimmer" style={{ width: '60%', height: '0.75rem', marginBottom: '0.5rem' }}></div>
             <div className="skeleton-box shimmer" style={{ width: '80%', height: '1.25rem' }}></div>
          </div>
        ))}
      </div>
      <div className="skeleton-box shimmer" style={{ width: '100%', height: '4rem', marginTop: '1rem' }}></div>
    </div>
  );
};

export const TableSkeleton = ({ rows = 5 }) => {
  return (
    <div className="glass-card">
       <div className="skeleton-box shimmer" style={{ width: '30%', height: '1.5rem', marginBottom: '1.5rem' }}></div>
       <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
         <div className="skeleton-box shimmer" style={{ width: '100%', height: '2rem' }}></div>
         {Array.from({ length: rows }).map((_, i) => (
           <div key={i} className="skeleton-box shimmer" style={{ width: '100%', height: '3rem' }}></div>
         ))}
       </div>
    </div>
  );
};
