import React from 'react';
import { safeNumber, safeCurrency } from '../utils/formatters';

export const ChartTooltip = ({ active, payload, label, formatterType = 'number', valuePrefix = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '1rem',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        minWidth: '200px'
      }}>
        <p style={{ 
          margin: '0 0 0.5rem 0', 
          fontWeight: 600, 
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '0.5rem'
        }}>
          {label}
        </p>
        
        {payload.map((entry, index) => {
          let displayValue = entry.value;
          
          if (Array.isArray(entry.value)) {
            const lower = formatterType === 'currency' ? safeCurrency(entry.value[0]) : safeNumber(entry.value[0], 1);
            const upper = formatterType === 'currency' ? safeCurrency(entry.value[1]) : safeNumber(entry.value[1], 1);
            displayValue = `${lower} - ${upper}`;
          } else {
            if (formatterType === 'currency') {
              displayValue = safeCurrency(entry.value);
            } else {
              displayValue = safeNumber(entry.value, 1);
            }
          }
          
          return (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.25rem 0', gap: '1.5rem' }}>
              <span style={{ 
                color: entry.color || 'var(--text-secondary)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }}></span>
                {entry.name}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-mono, monospace)' }}>
                {valuePrefix}{displayValue}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};
