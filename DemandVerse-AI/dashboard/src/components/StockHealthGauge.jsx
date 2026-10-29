import React from 'react';
import { safeCompactNumber } from '../utils/formatters';

export const StockHealthGauge = ({ currentStock, safetyStock, requiredStock }) => {
  const stock = Number(currentStock) || 0;
  const safe = Number(safetyStock) || 0;
  const req = Number(requiredStock) || 0;
  
  // Calculate total capacity for the bar (let's say 1.2 * max of current or required)
  const maxCapacity = Math.max(stock, req + safe) * 1.2 || 100;
  
  const getPercentage = (val) => Math.min(100, Math.max(0, (val / maxCapacity) * 100));
  
  const currentPct = getPercentage(stock);
  const requiredPct = getPercentage(req);
  const safetyPct = getPercentage(safe);
  
  // Determine color based on health
  let color = 'var(--status-success)'; // Healthy
  if (stock < req) color = 'var(--status-danger)'; // Stockout risk
  else if (stock > req * 1.5) color = 'var(--status-warning)'; // Overstock
  
  return (
    <div className="stock-health-gauge" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <span>0</span>
        <span>Target: {safeCompactNumber(req)}</span>
        <span>Capacity: {safeCompactNumber(maxCapacity)}</span>
      </div>
      
      <div style={{ 
        position: 'relative', 
        height: '24px', 
        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Safety Stock Buffer Zone */}
        <div style={{
          position: 'absolute',
          left: 0,
          width: `${getPercentage(req)}%`,
          height: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRight: '1px dashed rgba(255,255,255,0.2)'
        }} />
        
        {/* Current Stock Bar */}
        <div style={{
          position: 'absolute',
          left: 0,
          width: `${currentPct}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: '12px',
          boxShadow: `0 0 10px ${color}80`,
          transition: 'width 0.5s ease-out, background-color 0.3s'
        }} />
        
        {/* Target Marker */}
        <div style={{
          position: 'absolute',
          left: `${requiredPct}%`,
          top: 0,
          bottom: 0,
          width: '2px',
          backgroundColor: 'var(--text-primary)',
          boxShadow: '0 0 4px rgba(0,0,0,0.5)',
          zIndex: 2
        }} />
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Current Stock: {safeCompactNumber(stock)} units
        </span>
      </div>
    </div>
  );
};
