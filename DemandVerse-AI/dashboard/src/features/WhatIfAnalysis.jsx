import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import { getWhatIf, getSales } from '../services/api';
import { safeNumber, safePercentage, safeCurrency } from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';
import { KPISkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Activity, TrendingUp, TrendingDown, Crosshair, AlertCircle, RefreshCw, Layers, DollarSign, AlertOctagon, ShoppingCart } from 'lucide-react';

const WhatIfAnalysis = () => {
  const { selectedStore, selectedProduct, scenario, setScenario, refreshKey } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allScenarios, setAllScenarios] = useState([]);
  const [price, setPrice] = useState(0);

  const fetchWhatIf = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      const [allData, salesData] = await Promise.all([
        getWhatIf(selectedStore, selectedProduct, null),
        getSales(selectedProduct, selectedStore)
      ]);
      setAllScenarios(allData || []);
      
      if (salesData && salesData.length > 0) {
        setPrice(Number(salesData[salesData.length - 1].sell_price || 0));
      } else {
        setPrice(0);
      }
    } catch (err) {
      console.error("Error fetching what-if data:", err);
      setError(err?.message || "Failed to load what-if scenario simulations");
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, selectedStore]);

  useEffect(() => {
    fetchWhatIf();
  }, [fetchWhatIf, refreshKey]);

  const { scenarioData, chartData, analysisContext, deltas } = useMemo(() => {
    if (!allScenarios || allScenarios.length === 0) {
      return { scenarioData: null, chartData: [], analysisContext: null, deltas: null };
    }

    // Filter to only the 3 contractual scenarios to align with Topbar
    const validScenarios = ['Low Demand (-10%)', 'Normal Demand', 'High Demand (+10%)'];
    const filteredScenarios = allScenarios.filter(s => validScenarios.includes(s.Scenario));
    // If backend returns data not in validScenarios, but doesn't have validScenarios, fallback to allScenarios
    const workingScenarios = filteredScenarios.length > 0 ? filteredScenarios : allScenarios;

    // Find the data for the currently selected global scenario
    const currentData = workingScenarios.find(d => d.Scenario === scenario) || workingScenarios[0];
    
    // Determine baseline normal for comparative delta
    const normalData = workingScenarios.find(d => d.Scenario === 'Normal Demand' || d.Scenario === 'Normal') || currentData;

    const cData = workingScenarios.map(s => {
      let shortName = 'Normal';
      if (s.Scenario.includes('Very Low')) shortName = 'V. Low (-20%)';
      else if (s.Scenario.includes('Low')) shortName = 'Low (-10%)';
      else if (s.Scenario.includes('Very High')) shortName = 'V. High (+20%)';
      else if (s.Scenario.includes('High')) shortName = 'High (+10%)';

      const sDemand = s.Scenario_Forecasted_Demand ?? s.scenario_demand ?? s.forecasted_demand ?? 0;
      const sRequired = s.Required_Stock ?? s.required_stock ?? 0;
      const sCurrent = s.Current_Simulated_Stock ?? s.simulated_current_stock ?? s.current_stock ?? 0;

      return {
        name: shortName,
        Demand: Number(sDemand),
        Required: Number(sRequired),
        Current: Number(sCurrent)
      };
    });

    const scenarioDemand = Number(currentData?.Scenario_Forecasted_Demand ?? currentData?.scenario_demand ?? currentData?.forecasted_demand ?? 0);
    const currentStock = Number(currentData?.Current_Simulated_Stock ?? currentData?.simulated_current_stock ?? currentData?.current_stock ?? 0);
    const shortage = Number(currentData?.Shortage_Quantity ?? currentData?.shortage_quantity ?? currentData?.shortage ?? 0);
    const reorder = Number(currentData?.Reorder_Quantity ?? currentData?.reorder_quantity ?? currentData?.reorder ?? 0);
    
    const normalDemandNum = Number(normalData?.Scenario_Forecasted_Demand ?? normalData?.scenario_demand ?? normalData?.forecasted_demand ?? 0);
    
    // Calculate Deltas against Normal baseline
    const demandDiff = scenarioDemand - normalDemandNum;
    const revenueDiff = demandDiff * price;
    const isNormal = currentData.Scenario === normalData.Scenario;
    const revenueDiffPct = normalDemandNum > 0 ? (demandDiff / normalDemandNum) * 100 : 0;

    const deltasData = {
      demandDiff,
      revenueDiff,
      revenueDiffPct,
      isNormal
    };

    // Build Narrative Analysis
    let text = '';
    let Icon = Activity;
    let color = 'var(--status-info)';

    if (scenario.includes('High')) {
      Icon = TrendingUp;
      color = 'var(--status-success)';
      if (shortage > 0) {
        text = `Under the active High Demand (+10%) stress test, projected volume expands by +${safeNumber(Math.abs(demandDiff), 1)} units above normal. This creates an unbuffered shortage of ${safeNumber(shortage, 1)} units. An immediate order placement of ${safeNumber(reorder, 0)} units is recommended to prevent stockouts during peak velocity.`;
      } else {
        text = `Under the active High Demand (+10%) stress test, projected volume expands by +${safeNumber(Math.abs(demandDiff), 1)} units. Current inventory holds sufficient coverage to absorb this spike without incurring an operational stockout.`;
      }
    } else if (scenario.includes('Low')) {
      Icon = TrendingDown;
      color = 'var(--status-warning)';
      if (reorder > 0) {
        text = `Under the active Low Demand (-10%) stress test, demand retracts by -${safeNumber(Math.abs(demandDiff), 1)} units. Even in this depressed environment, existing stock remains inadequate, requiring a reorder of ${safeNumber(reorder, 0)} units to maintain baseline safety thresholds.`;
      } else {
        text = `Under the active Low Demand (-10%) stress test, demand retracts by -${safeNumber(Math.abs(demandDiff), 1)} units. Current inventory is in surplus. Reorders should be immediately frozen to limit capital depreciation and warehouse holding fees.`;
      }
    } else {
      Icon = Crosshair;
      color = 'var(--accent-primary)';
      if (shortage > 0) {
        text = `Under baseline Normal Demand, existing inventory shows a projected shortage of ${safeNumber(shortage, 1)} units. Executing a standard reorder of ${safeNumber(reorder, 0)} units ensures stability.`;
      } else {
        text = `Under baseline Normal Demand, current holdings fully satisfy the projected demand horizon plus standard safety stock buffer. No urgent purchase order is required.`;
      }
    }

    return {
      scenarioData: {
        ...currentData,
        _scenarioDemand: scenarioDemand,
        _currentStock: currentStock,
        _shortage: shortage,
        _reorder: reorder
      },
      chartData: cData,
      analysisContext: { text, Icon, color },
      deltas: deltasData
    };
  }, [allScenarios, scenario, price]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="skeleton-box shimmer" style={{ height: '32px', width: '320px', marginBottom: '0.5rem' }} />
            <div className="skeleton-box shimmer" style={{ height: '16px', width: '380px' }} />
          </div>
          <div className="skeleton-box shimmer" style={{ height: '36px', width: '260px' }} />
        </div>

        <div className="skeleton-box skeleton-card shimmer" style={{ height: '90px', marginBottom: '2rem' }} />

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
          <AlertCircle size={36} style={{ color: 'var(--status-danger)' }} />
          <h3 className="error-title">What-If Simulation Unavailable</h3>
          <p className="error-message">{error}</p>
          <button className="btn btn-retry" onClick={fetchWhatIf}>
            <RefreshCw size={14} /> Retry Request
          </button>
        </div>
      </div>
    );
  }

  if (!scenarioData) {
    return (
      <div className="page-container">
        <div className="empty-state glass-card">
          <Activity size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No Scenario Ledger Available</h3>
          <p>No what-if stress tests were found for {selectedProduct} at {selectedStore}.</p>
        </div>
      </div>
    );
  }

  const { Icon, color, text } = analysisContext;

  const renderDelta = (value, unit, isPercentage = false) => {
    if (deltas.isNormal) return <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Baseline (0 Delta)</span>;
    const isPositive = value > 0;
    const colorClass = isPositive ? 'var(--status-success)' : 'var(--status-danger)';
    const prefix = isPositive ? '+' : '';
    const formatted = isPercentage ? `${prefix}${value.toFixed(1)}%` : `${prefix}${safeNumber(value, 1)}`;
    return (
      <span style={{ color: colorClass, fontWeight: 600, fontSize: '0.85rem' }}>
        {formatted} {unit && !isPercentage ? unit : ''} vs Normal
      </span>
    );
  };

  return (
    <div className="page-container">
      {/* Header with In-Page Scenario Switcher */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">What-If Demand Analysis</h1>
          <p className="page-subtitle">
            Macroeconomic demand sensitivity simulation for <strong>{selectedProduct}</strong> at <strong>{selectedStore}</strong>
          </p>
        </div>

        {/* Quick Scenario Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          {[
            { label: '-10%', val: 'Low Demand (-10%)' },
            { label: 'Normal', val: 'Normal Demand' },
            { label: '+10%', val: 'High Demand (+10%)' }
          ].map(s => (
            <button
              key={s.val}
              className={`btn ${scenario === s.val ? 'btn' : 'btn-outline'}`}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setScenario(s.val)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Narrative Stress Test Insight Banner */}
      <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: `4px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
          <Icon size={18} style={{ color }} />
          <h3 className="kpi-title" style={{ margin: 0, color }}>
            {scenario} Sensitivity Stress Test
          </h3>
        </div>
        <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.95rem', margin: 0 }}>
          {text}
        </p>
      </div>

      {/* Scenario Metric Cards */}
      <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ borderColor: color, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="kpi-title" style={{ color }}>Scenario Demand</h3>
              <div className="kpi-value mono-number">{safeNumber(scenarioData._scenarioDemand, 0)}</div>
            </div>
            <div className="badge info" style={{ padding: '0.5rem', borderRadius: '50%' }}>
              <Activity size={22} />
            </div>
          </div>
          <div style={{ marginTop: '0.25rem' }}>
            {renderDelta(deltas.demandDiff, 'Units')}
          </div>
        </div>

        <div className="glass-card" style={{ borderColor: color, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="kpi-title" style={{ color }}>Simulated Revenue Impact</h3>
              <div className="kpi-value mono-number">{safeCurrency(scenarioData._scenarioDemand * price)}</div>
            </div>
            <div className="badge primary" style={{ padding: '0.5rem', borderRadius: '50%' }}>
              <DollarSign size={22} />
            </div>
          </div>
          <div style={{ marginTop: '0.25rem' }}>
            {renderDelta(deltas.revenueDiffPct, null, true)}
          </div>
        </div>

        <div className="glass-card" style={{ borderColor: scenarioData._shortage > 0 ? 'var(--status-danger)' : 'var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="kpi-title" style={{ color: scenarioData._shortage > 0 ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
                Projected Shortage
              </h3>
              <div className="kpi-value mono-number" style={{ color: scenarioData._shortage > 0 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                {safeNumber(scenarioData._shortage, 0)}
              </div>
            </div>
            <div className={`badge ${scenarioData._shortage > 0 ? 'danger' : 'info'}`} style={{ padding: '0.5rem', borderRadius: '50%' }}>
              <AlertOctagon size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {scenarioData._shortage > 0 ? 'Stockout volume gap' : 'Zero shortage'}
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="kpi-title">Scenario Reorder</h3>
              <div className="kpi-value mono-number" style={{ color: scenarioData._reorder > 0 ? 'var(--status-info)' : 'var(--text-primary)' }}>
                {safeNumber(scenarioData._reorder, 0)}
              </div>
            </div>
            <div className="badge warning" style={{ padding: '0.5rem', borderRadius: '50%' }}>
              <ShoppingCart size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            To restore safety target
          </div>
        </div>
      </div>

      {/* Cross-Scenario Supply Threshold Chart */}
      <div className="glass-card">
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 className="kpi-title" style={{ margin: 0, marginBottom: '0.25rem' }}>Cross-Scenario Supply Threshold Comparison</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Evaluating demand volatility across economic states. If the Required Target bar exceeds the yellow Current Stock line, an operational stockout will occur.
          </p>
        </div>

        <div className="chart-container" style={{ height: '360px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              
              <Bar dataKey="Demand" name="Scenario Forecast Demand" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} maxBarSize={55} />
              <Bar dataKey="Required" name="Required Target (Demand + Buffer)" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} maxBarSize={55} />
              
              <Line 
                type="step" 
                dataKey="Current" 
                name="Current Physical Stock"
                stroke="var(--status-warning)" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default WhatIfAnalysis;
