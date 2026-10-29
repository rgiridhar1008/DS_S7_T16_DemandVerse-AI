import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import { getInventory, getSales } from '../services/api';
import { safeNumber, safeCurrency } from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';
import { KPISkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import { StockHealthGauge } from '../components/StockHealthGauge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { 
  Package, ShieldAlert, AlertTriangle, CheckCircle2, 
  ArrowRight, RefreshCw, AlertOctagon, DollarSign
} from 'lucide-react';

const InventoryIntelligence = () => {
  const { selectedStore, selectedProduct, refreshKey } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [price, setPrice] = useState(0);

  const fetchData = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      const [invData, salesData] = await Promise.all([
        getInventory(selectedStore, selectedProduct),
        getSales(selectedProduct, selectedStore)
      ]);
      
      if (invData && invData.length > 0) {
        setInventory(invData[0]);
      } else {
        setInventory(null);
      }
      
      if (salesData && salesData.length > 0) {
        setPrice(Number(salesData[salesData.length - 1].sell_price || 0));
      } else {
        setPrice(0);
      }
    } catch (err) {
      console.error("Error fetching inventory data:", err);
      setError(err?.message || "Failed to load inventory intelligence");
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, selectedStore]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const { metrics, chartData, actionStrategy } = useMemo(() => {
    if (!inventory) return { metrics: null, chartData: [], actionStrategy: null };

    const current = Number(inventory.simulated_current_stock || 0);
    const forecast = Number(inventory.forecasted_demand || 0);
    const safety = Number(inventory.safety_stock || 0);
    const required = Number(inventory.required_stock || 0);
    const reorder = Number(inventory.reorder_quantity || 0);
    const status = inventory.inventory_status || 'HEALTHY STOCK';

    // Calculate depletion dynamics
    const dailyRunRate = forecast > 0 ? (forecast / 30) : 0;
    const daysUntilStockout = dailyRunRate > 0 ? (current / dailyRunRate) : null;
    
    // Capital metrics
    const capitalHeld = current * price;

    // Plain English guidance for non-technical retail operators
    let strategyText = '';
    let strategyIcon = CheckCircle2;
    let strategyColor = 'var(--status-success)';
    
    if (status === 'STOCKOUT RISK') {
      const daysStr = daysUntilStockout !== null ? `${daysUntilStockout.toFixed(1)} days` : 'No projected demand';
      strategyText = `Critical Deficit Alert: Current stock of ${safeNumber(current, 0)} units will be fully depleted in approximately ${daysStr} at the expected daily demand pace of ${safeNumber(dailyRunRate, 1)} units/day. Place an emergency supplier reorder for ${safeNumber(reorder, 0)} units to restore your safety threshold.`;
      strategyIcon = AlertTriangle;
      strategyColor = 'var(--status-danger)';
    } else if (status === 'OVERSTOCK') {
      const excess = Math.max(0, current - required);
      strategyText = `Capital Over-Allocation: Physical stock (${safeNumber(current, 0)} units) exceeds your 30-day forecast and safety buffer by ${safeNumber(excess, 0)} units. Reorder orders must be frozen to minimize warehouse holding fees.`;
      strategyIcon = ShieldAlert;
      strategyColor = 'var(--status-warning)';
    } else {
      strategyText = `Optimized Holding: Current inventory of ${safeNumber(current, 0)} units satisfies the 30-day demand forecast plus safety cushion. Turnover pace is healthy; no manual procurement intervention required.`;
      strategyIcon = CheckCircle2;
      strategyColor = 'var(--status-success)';
    }

    const cData = [
      {
        name: 'Current Stock',
        Current: current,
        Forecast: 0,
        SafetyBuffer: 0,
      },
      {
        name: 'Required Target',
        Current: 0,
        Forecast: forecast,
        SafetyBuffer: safety,
      }
    ];

    return {
      metrics: { current, forecast, safety, required, reorder, status, daysUntilStockout, dailyRunRate, capitalHeld },
      chartData: cData,
      actionStrategy: { text: strategyText, icon: strategyIcon, color: strategyColor }
    };
  }, [inventory, price]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="skeleton-box shimmer" style={{ height: '32px', width: '300px', marginBottom: '0.5rem' }} />
            <div className="skeleton-box shimmer" style={{ height: '16px', width: '380px' }} />
          </div>
          <div className="skeleton-box shimmer" style={{ height: '36px', width: '180px' }} />
        </div>

        <div className="skeleton-box skeleton-card shimmer" style={{ height: '80px', marginBottom: '2rem' }} />

        <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
          {[...Array(4)].map((_, i) => <KPISkeleton key={i} />)}
        </div>

        <ChartSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-card">
          <AlertTriangle size={36} style={{ color: 'var(--status-danger)' }} />
          <h3 className="error-title">Inventory Data Unavailable</h3>
          <p className="error-message">{error}</p>
          <button className="btn btn-retry" onClick={fetchData}>
            <RefreshCw size={14} /> Retry Request
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="page-container">
        <div className="empty-state glass-card">
          <Package size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No Inventory Ledger Records</h3>
          <p>No inventory calculations exist for {selectedProduct} at {selectedStore}.</p>
        </div>
      </div>
    );
  }

  const StrategyIcon = actionStrategy.icon;

  const getStatusBadge = (status) => {
    if (status === 'STOCKOUT RISK') {
      return (
        <span className="badge danger" style={{ fontSize: '0.9rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <AlertOctagon size={16} /> Critical Stockout Risk
        </span>
      );
    }
    if (status === 'OVERSTOCK') {
      return (
        <span className="badge warning" style={{ fontSize: '0.9rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldAlert size={16} /> Overstock Detected
        </span>
      );
    }
    return (
      <span className="badge success" style={{ fontSize: '0.9rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <CheckCircle2 size={16} /> Healthy Stock Level
      </span>
    );
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Inventory Intelligence</h1>
          <p className="page-subtitle">
            Safety stock buffers, reorder thresholds, and depletion velocity for <strong>{selectedProduct}</strong> in <strong>{selectedStore}</strong>
          </p>
        </div>
        <div>
          {getStatusBadge(metrics.status)}
        </div>
      </div>

      {/* Threshold Status Banner (Action Strategy) */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', borderLeft: `4px solid ${actionStrategy.color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
          <StrategyIcon size={18} style={{ color: actionStrategy.color }} />
          <h3 className="kpi-title" style={{ margin: 0, color: actionStrategy.color }}>
            Procurement Action Recommendation
          </h3>
        </div>
        <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.95rem', margin: 0 }}>
          {actionStrategy.text}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Visual Gauge */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 className="kpi-title" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Stock Health Overview</h3>
          <StockHealthGauge 
            currentStock={metrics.current} 
            requiredStock={metrics.required} 
            safetyStock={metrics.safety} 
          />
        </div>
        
        {/* Capital Held KPI & Depletion Velocity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 className="kpi-title">Capital Held in Inventory</h3>
                <div className="kpi-value mono-number">{safeCurrency(metrics.capitalHeld)}</div>
              </div>
              <div className="badge primary" style={{ padding: '0.5rem', borderRadius: '50%' }}>
                <DollarSign size={22} />
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Current stock ({safeNumber(metrics.current, 0)}) × Unit Price ({safeCurrency(price)})
            </div>
          </div>
          
          <div className="glass-card" style={{ flex: 1, borderColor: metrics.status === 'STOCKOUT RISK' ? 'var(--status-danger)' : 'var(--border-color)' }}>
            <h3 className="kpi-title" style={{ color: metrics.status === 'STOCKOUT RISK' ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
              Days Until Stockout
            </h3>
            <div className="kpi-value mono-number" style={{ color: metrics.status === 'STOCKOUT RISK' ? 'var(--status-danger)' : 'var(--text-primary)' }}>
              {metrics.daysUntilStockout !== null ? safeNumber(metrics.daysUntilStockout, 1) : 'Ample'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              At run-rate of {safeNumber(metrics.dailyRunRate, 1)} units/day
            </div>
          </div>
        </div>
      </div>

      {/* Tabular Display & Chart Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Reorder Calculation Breakdown Table */}
        <div className="glass-card">
          <h3 className="kpi-title" style={{ marginBottom: '1.5rem' }}>Reorder Calculation Breakdown</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Base 30-Day Demand Forecast:</span>
              <span className="mono-number font-semibold">{safeNumber(metrics.forecast, 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Safety Stock Buffer (Z-score 1.645):</span>
              <span className="mono-number font-semibold">{safeNumber(metrics.safety, 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Required Target:</span>
              <span className="mono-number font-bold text-accent-primary">{safeNumber(metrics.required, 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Current Physical Stock:</span>
              <span className="mono-number font-semibold">{safeNumber(metrics.current, 0)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              paddingTop: '0.5rem',
              color: metrics.reorder > 0 ? 'var(--status-danger)' : 'var(--status-success)'
            }}>
              <span style={{ fontWeight: 600 }}>Recommended Purchase Order:</span>
              <span className="mono-number" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {safeNumber(metrics.reorder, 0)} units
              </span>
            </div>
          </div>
        </div>

        {/* Stock Composition Chart */}
        <div className="glass-card">
          <h3 className="kpi-title" style={{ marginBottom: '1.5rem' }}>Stock Composition Chart</h3>
          <div className="chart-container" style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barSize={70}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ paddingTop: '15px' }} />
                
                <Bar dataKey="Current" stackId="a" fill="var(--status-success)" name="Current Physical Stock" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={metrics.status === 'STOCKOUT RISK' && index === 0 ? 'var(--status-danger)' : 'var(--status-success)'} 
                    />
                  ))}
                </Bar>
                <Bar dataKey="Forecast" stackId="b" fill="var(--accent-primary)" name="Base 30-Day Demand" />
                <Bar dataKey="SafetyBuffer" stackId="b" fill="var(--status-info)" name="Safety Stock Buffer" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryIntelligence;
