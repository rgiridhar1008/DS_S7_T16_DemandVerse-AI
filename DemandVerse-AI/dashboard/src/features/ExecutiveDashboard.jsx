import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardContext } from '../context/DashboardContext';
import { getSales, getForecast, getFinancialImpact, getInventory } from '../services/api';
import { safeNumber, safeCurrency, safePercentage } from '../utils/formatters';
import { 
  DollarSign, TrendingUp, AlertTriangle, PackageX, PackageCheck, Activity, 
  ArrowUpRight, ArrowDownRight, Archive, ShieldAlert, CheckCircle2, RefreshCw
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { KPISkeleton, SummarySkeleton } from '../components/SkeletonLoader';

const KPICard = ({ title, value, icon: Icon, colorClass, route, trend, sparklineData, tooltip, subtitle }) => {
  const navigate = useNavigate();
  
  return (
    <div 
      className="glass-card kpi-interactive" 
      onClick={() => route && navigate(route)}
      style={{ cursor: route ? 'pointer' : 'default', position: 'relative', transition: 'all 0.2s ease' }}
      title={tooltip}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 className="kpi-title">{title}</h3>
          <div className="kpi-value">{value}</div>
          {subtitle && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {subtitle}
            </div>
          )}
          
          {trend && (
            <div style={{ 
              display: 'flex', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.85rem',
              color: trend.isPositive ? 'var(--status-success)' : (trend.isNeutral ? 'var(--text-secondary)' : 'var(--status-danger)') 
            }}>
              {trend.isPositive && !trend.isNeutral ? <ArrowUpRight size={16} style={{ marginRight: '0.25rem' }} /> : null}
              {!trend.isPositive && !trend.isNeutral ? <ArrowDownRight size={16} style={{ marginRight: '0.25rem' }} /> : null}
              <span>{trend.text}</span>
            </div>
          )}
        </div>
        
        <div className={`badge ${colorClass}`} style={{ padding: '0.5rem', borderRadius: '50%' }}>
          <Icon size={22} />
        </div>
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div style={{ height: '36px', width: '100%', marginTop: '0.75rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={`var(--status-${colorClass === 'info' ? 'primary' : colorClass})`} 
                strokeWidth={2} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const ExecutiveDashboard = () => {
  const { selectedStore, selectedProduct, refreshKey } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [metrics, setMetrics] = useState(null);

  const fetchMetrics = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch dependent endpoints concurrently with correct argument ordering
      const [sales, forecast, financials, productInventory, allStoreInventory] = await Promise.all([
        getSales(selectedProduct, selectedStore),
        getForecast(selectedProduct, selectedStore, 30),
        getFinancialImpact(selectedStore, selectedProduct, 'Normal Demand'),
        getInventory(selectedStore, selectedProduct),
        getInventory(selectedStore)
      ]);

      const totalSales = (sales || []).reduce((acc, curr) => acc + (curr.sales || 0), 0);
      const price = sales && sales.length > 0 ? (sales[sales.length - 1].sell_price || 0) : 0;
      const totalRevenue = totalSales * price;

      const forecastedDemand = (forecast || []).reduce((acc, curr) => acc + (curr.predicted_demand || 0), 0);
      
      const finRow = financials && financials.length > 0 ? financials[0] : null;
      const revAtRisk = finRow ? Number(finRow.Revenue_at_Risk || 0) : 0;
      const forecastedRevenue = finRow ? Number(finRow.Forecasted_Revenue || 0) : (forecastedDemand * price);

      const invRow = productInventory && productInventory.length > 0 ? productInventory[0] : null;
      const invStatus = invRow ? invRow.inventory_status : 'HEALTHY STOCK';
      const reorderQty = invRow ? Number(invRow.reorder_quantity || 0) : 0;
      const stockoutRisk = invStatus === 'STOCKOUT RISK';
      const overstockRisk = invStatus === 'OVERSTOCK';

      // Store-level context
      const storeStockoutsCount = (allStoreInventory || []).filter(i => i.inventory_status === 'STOCKOUT RISK').length;
      const storeOverstockCount = (allStoreInventory || []).filter(i => i.inventory_status === 'OVERSTOCK').length;

      // Trends & Sparklines
      const histDailyAvg = sales && sales.length > 0 ? (totalSales / sales.length) : 0;
      const forecastDailyAvg = forecast && forecast.length > 0 ? (forecastedDemand / forecast.length) : 0;
      
      let demandTrendPct = 0;
      if (histDailyAvg > 0) {
        demandTrendPct = ((forecastDailyAvg - histDailyAvg) / histDailyAvg) * 100;
      }

      const salesSpark = (sales || []).slice(-30).map(s => ({ value: s.sales }));
      const forecastSpark = (forecast || []).slice(0, 30).map(s => ({ value: s.predicted_demand }));
      const selectedModel = (forecast && forecast.length > 0 ? forecast[0].selected_model : 'ML Pipeline');

      // Narrative Summary
      let summary = `For SKU ${selectedProduct} in store ${selectedStore}, `;
      if (demandTrendPct > 5) {
        summary += `demand is projected to rise by ${safeNumber(demandTrendPct)}% over the next 30 days compared to historical pace. `;
      } else if (demandTrendPct < -5) {
        summary += `demand is projected to contract by ${safeNumber(Math.abs(demandTrendPct))}% over the next 30 days. `;
      } else {
        summary += `demand is projected to remain stable (within ±5% baseline) over the next 30 days. `;
      }

      if (stockoutRisk) {
        summary += `Inventory is at critical STOCKOUT RISK. Recommended reorder is ${safeNumber(reorderQty, 0)} units to safeguard ${safeCurrency(revAtRisk)} in potential sales.`;
      } else if (overstockRisk) {
        summary += `Inventory is in OVERSTOCK condition. Reorders should be paused to control holding charges.`;
      } else {
        summary += `Inventory balance is currently HEALTHY, maintaining sufficient safety stock.`;
      }

      setMetrics({
        totalSales,
        totalRevenue,
        forecastedDemand,
        forecastedRevenue,
        revenueAtRisk: revAtRisk,
        stockoutRisk,
        overstockRisk,
        storeStockoutsCount,
        storeOverstockCount,
        reorderQuantity: reorderQty,
        demandTrendPct,
        invStatus,
        selectedModel,
        salesSpark,
        forecastSpark,
        summary
      });
      
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error("Error fetching executive metrics:", err);
      setError(err?.response?.data?.detail || err?.message || "Failed to load executive metrics");
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, selectedStore]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics, refreshKey]);

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="skeleton-box shimmer" style={{ height: '32px', width: '280px', marginBottom: '0.5rem' }} />
            <div className="skeleton-box shimmer" style={{ height: '16px', width: '360px' }} />
          </div>
          <div className="skeleton-box shimmer" style={{ height: '18px', width: '140px' }} />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <SummarySkeleton />
        </div>

        <div className="grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error State with Retry Button
  if (error || !metrics) {
    return (
      <div className="page-container">
        <div className="error-card">
          <AlertTriangle size={36} style={{ color: 'var(--status-danger)' }} />
          <h3 className="error-title">Executive Dashboard Unavailable</h3>
          <p className="error-message">{error || "Could not retrieve metrics for the selected product and store."}</p>
          <button className="btn btn-retry" onClick={fetchMetrics}>
            <RefreshCw size={14} /> Retry Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Executive Retail Intelligence</h1>
          <p className="page-subtitle">
            AI-powered demand, inventory and financial intelligence for <strong>{selectedProduct}</strong> at <strong>{selectedStore}</strong>
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Synchronized: {lastUpdated}
        </div>
      </div>

      {/* Retail Health Summary Banner */}
      <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 className="kpi-title" style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>
            Executive Retail Health Summary
          </h3>
          <span className="badge info">Model: {metrics.selectedModel}</span>
        </div>
        <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
          {metrics.summary}
        </p>

        {/* Compact Retail Health Indicators */}
        <div className="retail-health-grid">
          <div className="retail-health-card">
            <span className="retail-health-label">Demand Status</span>
            <span className="retail-health-val" style={{ 
              color: metrics.demandTrendPct > 0 ? 'var(--status-success)' : (metrics.demandTrendPct < 0 ? 'var(--status-warning)' : 'var(--text-secondary)')
            }}>
              {metrics.demandTrendPct > 0 ? <TrendingUp size={16} /> : null}
              {metrics.demandTrendPct > 5 ? 'Surging' : (metrics.demandTrendPct < -5 ? 'Contraction' : 'Stable')} ({safePercentage(metrics.demandTrendPct)})
            </span>
          </div>

          <div className="retail-health-card">
            <span className="retail-health-label">Inventory Status</span>
            <span className="retail-health-val" style={{ 
              color: metrics.stockoutRisk ? 'var(--status-danger)' : (metrics.overstockRisk ? 'var(--status-warning)' : 'var(--status-success)')
            }}>
              {metrics.stockoutRisk ? <PackageX size={16} /> : (metrics.overstockRisk ? <PackageCheck size={16} /> : <CheckCircle2 size={16} />)}
              {metrics.invStatus}
            </span>
          </div>

          <div className="retail-health-card">
            <span className="retail-health-label">Forecast Status</span>
            <span className="retail-health-val" style={{ color: 'var(--accent-primary)' }}>
              <Activity size={16} />
              Active (30-Day {metrics.selectedModel})
            </span>
          </div>

          <div className="retail-health-card">
            <span className="retail-health-label">Financial Risk Status</span>
            <span className="retail-health-val" style={{ color: metrics.revenueAtRisk > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
              {metrics.revenueAtRisk > 0 ? <AlertTriangle size={16} /> : <ShieldAlert size={16} />}
              {metrics.revenueAtRisk > 0 ? `${safeCurrency(metrics.revenueAtRisk)} at Risk` : 'Fully Protected'}
            </span>
          </div>
        </div>
      </div>

      {/* 8 Required Meaningful KPIs Grid */}
      <div className="grid-cols-4">
        {/* 1. Historical Sales */}
        <KPICard 
          title="Historical Sales" 
          value={safeNumber(metrics.totalSales, 0)} 
          subtitle="Cumulative units sold"
          icon={Activity} 
          colorClass="info"
          route="/sales"
          tooltip="View Historical Sales Analytics"
          sparklineData={metrics.salesSpark}
        />

        {/* 2. Historical Revenue */}
        <KPICard 
          title="Historical Revenue" 
          value={safeCurrency(metrics.totalRevenue)} 
          subtitle="Realized sales revenue"
          icon={DollarSign} 
          colorClass="success"
          route="/sales"
          tooltip="View Historical Revenue Breakdown"
        />

        {/* 3. Forecasted 30-Day Demand */}
        <KPICard 
          title="30-Day Demand" 
          value={safeNumber(metrics.forecastedDemand, 0)} 
          subtitle="Projected units required"
          icon={TrendingUp} 
          colorClass="primary"
          route="/forecast"
          tooltip="View Machine Learning Forecast Horizon"
          sparklineData={metrics.forecastSpark}
          trend={{
            isPositive: metrics.demandTrendPct > 0,
            isNeutral: Math.abs(metrics.demandTrendPct) < 1,
            text: `${safeNumber(Math.abs(metrics.demandTrendPct))}% vs historical pace`
          }}
        />

        {/* 4. Forecasted Revenue */}
        <KPICard 
          title="Forecasted Revenue" 
          value={safeCurrency(metrics.forecastedRevenue)} 
          subtitle="Projected 30-day gross value"
          icon={DollarSign} 
          colorClass="success"
          route="/financial"
          tooltip="View 30-Day Forecasted Revenue Potential"
        />

        {/* 5. Revenue at Risk */}
        <KPICard 
          title="Revenue at Risk" 
          value={safeCurrency(metrics.revenueAtRisk)} 
          subtitle="Unmet demand value"
          icon={AlertTriangle} 
          colorClass={metrics.revenueAtRisk > 0 ? "danger" : "success"}
          route="/financial"
          tooltip="View Financial Scenario Risk Analysis"
        />

        {/* 6. Stockout Risk */}
        <KPICard 
          title="Stockout Risk" 
          value={metrics.stockoutRisk ? "YES" : "NO"} 
          subtitle={`Store Portfolio: ${metrics.storeStockoutsCount} at risk`}
          icon={PackageX} 
          colorClass={metrics.stockoutRisk ? "danger" : "success"}
          route="/inventory"
          tooltip="View Inventory Stockout Vulnerability"
        />

        {/* 7. Overstock Status */}
        <KPICard 
          title="Overstock Status" 
          value={metrics.overstockRisk ? "YES" : "OPTIMAL"} 
          subtitle={`Store Portfolio: ${metrics.storeOverstockCount} overstocked`}
          icon={PackageCheck} 
          colorClass={metrics.overstockRisk ? "warning" : "success"}
          route="/inventory"
          tooltip="View Inventory Holding Optimization"
        />

        {/* 8. Recommended Reorder */}
        <KPICard 
          title="Recommended Reorder" 
          value={safeNumber(metrics.reorderQuantity, 0)} 
          subtitle="Units required to restore safety buffer"
          icon={Archive} 
          colorClass="info"
          route="/inventory"
          tooltip="View Automated Reorder Recommendations"
        />
      </div>
      
      <style>{`
        .kpi-interactive:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          border-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};

export default ExecutiveDashboard;
