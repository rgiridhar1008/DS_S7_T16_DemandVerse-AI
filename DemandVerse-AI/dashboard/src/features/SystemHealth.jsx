import React, { useEffect, useState } from 'react';
import { Activity, Database, Server, Clock, CheckCircle, XCircle, Terminal, Info } from 'lucide-react';
import { useDashboardContext } from '../context/DashboardContext';
import { KPISkeleton } from '../components/SkeletonLoader';

const SystemHealth = () => {
  const { lastSyncTime } = useDashboardContext();
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('http://localhost:8000/health');
        if (response.ok) {
          const data = await response.json();
          setHealthData(data);
        } else {
          setHealthData({ status: 'error', error: 'Failed to connect to API' });
        }
      } catch (err) {
        setHealthData({ status: 'error', error: err.message });
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">System Health & Lineage</h1>
          <p className="page-subtitle">Platform operational status and metadata traceability</p>
        </div>
        <div className="badge primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          <Activity size={16} />
          <span>Platform Status</span>
        </div>
      </div>

      <div className="grid-cols-2" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Terminal size={18} style={{ color: 'var(--text-secondary)' }} />
            <h3 className="kpi-title" style={{ margin: 0 }}>Backend Service Connectivity</h3>
          </div>
          
          <div style={{ padding: '1.5rem' }}>
            {loading ? (
              <div className="skeleton-box shimmer" style={{ height: '60px', borderRadius: 'var(--radius-md)' }} />
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem', 
                padding: '1rem', 
                backgroundColor: 'var(--bg-app)', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-color)',
                fontFamily: 'monospace'
              }}>
                {healthData?.status === 'ok' ? (
                  <CheckCircle size={24} style={{ color: 'var(--status-success)' }} />
                ) : (
                  <XCircle size={24} style={{ color: 'var(--status-danger)' }} />
                )}
                <div>
                  <div style={{ fontWeight: 600, color: healthData?.status === 'ok' ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    {healthData?.status === 'ok' ? 'STATUS: OPERATIONAL' : 'STATUS: DEGRADED / OFFLINE'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    &gt; _SERVICE: {healthData?.service || 'demandverse-ml-core'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    &gt; _VERSION: {healthData?.version || 'v2.1.0-stable'}
                  </div>
                  {healthData?.error && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--status-danger)', marginTop: '0.25rem' }}>
                      &gt; _ERROR: {healthData.error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Database size={18} style={{ color: 'var(--text-secondary)' }} />
            <h3 className="kpi-title" style={{ margin: 0 }}>Client Synchronization</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1rem', 
              backgroundColor: 'var(--bg-app)', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              fontFamily: 'monospace'
            }}>
              <Clock size={24} style={{ color: 'var(--status-info)' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  &gt; _CACHE_STATE: ACTIVE
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  &gt; _LAST_SYNC: {lastSyncTime}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  &gt; _POLLING: MUTATION_OBSERVER
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Info size={20} style={{ color: 'var(--accent-primary)' }} />
          <h3 className="kpi-title" style={{ margin: 0 }}>Data Methodology & Architecture Lineage</h3>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div style={{ padding: '1.25rem', backgroundColor: 'rgba(255, 255, 255, 0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-primary)' }}>01.</span> Forecasting Engine
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7', margin: 0 }}>
              Demand predictions are generated using an automated model selection pipeline that backtests ARIMA against Facebook Prophet. The model with the lowest Mean Absolute Percentage Error (MAPE) on a validation holdout set is promoted to production for each individual item-store combination.
            </p>
          </div>
          
          <div style={{ padding: '1.25rem', backgroundColor: 'rgba(255, 255, 255, 0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-primary)' }}>02.</span> Inventory Simulation
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7', margin: 0 }}>
              As the original M5 dataset does not contain point-in-time stock levels, current inventory is procedurally simulated based on a normal distribution anchored to the 30-day historical mean sales. Safety stock is calculated dynamically based on historical volatility (Z-score 1.65).
            </p>
          </div>

          <div style={{ padding: '1.25rem', backgroundColor: 'rgba(255, 255, 255, 0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-primary)' }}>03.</span> Financial Modeling
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7', margin: 0 }}>
              Revenues are projected by multiplying forecasted unit demand by the active sell price. Holding costs assume an annualized inventory carry rate of 20%, prorated to a 30-day window. Revenue at Risk isolates the opportunity cost incurred specifically from projected stockouts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
