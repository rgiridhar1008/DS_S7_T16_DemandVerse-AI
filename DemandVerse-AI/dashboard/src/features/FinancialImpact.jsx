import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import { getFinancialImpact } from '../services/api';
import { safeCurrency, safeNumber, isValidNumber } from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';
import { KPISkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { DollarSign, AlertOctagon, Info, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';

const FinancialImpact = () => {
  const { selectedStore, selectedProduct, scenario, setScenario, refreshKey } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allFinances, setAllFinances] = useState([]);
  const [showCalculationInfo, setShowCalculationInfo] = useState(true);

  const fetchFinance = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      const allData = await getFinancialImpact(selectedStore, selectedProduct, null);
      setAllFinances(allData || []);
    } catch (err) {
      console.error("Error fetching financial data:", err);
      setError(err?.message || "Failed to load financial impact models");
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, selectedStore]);

  useEffect(() => {
    fetchFinance();
  }, [fetchFinance, refreshKey]);

  const { financeData, chartData, analysisContext, hasPrice } = useMemo(() => {
    if (!allFinances || allFinances.length === 0) {
      return { financeData: null, chartData: [], analysisContext: null, hasPrice: false };
    }

    // Filter to only the 3 contractual scenarios to align with Topbar
    const validScenarios = ['Low Demand (-10%)', 'Normal Demand', 'High Demand (+10%)'];
    const filteredScenarios = allFinances.filter(s => validScenarios.includes(s.Scenario));
    const workingScenarios = filteredScenarios.length > 0 ? filteredScenarios : allFinances;

    const current = workingScenarios.find(d => d.Scenario === scenario) || workingScenarios[0];
    const normal = workingScenarios.find(d => d.Scenario === 'Normal Demand' || d.Scenario === 'Normal') || current;
    
    const unitPrice = current?.unit_price ?? current?.sell_price ?? current?.price;
    const priceValid = isValidNumber(unitPrice) && Number(unitPrice) > 0;

    // Filter to only compare baseline vs alternative (if not baseline)
    const compareScenarios = scenario === normal.Scenario ? [normal] : [normal, current];

    const cData = compareScenarios.map(s => {
      let shortName = 'Normal';
      if (s.Scenario.includes('Low')) shortName = 'Low (-10%)';
      else if (s.Scenario.includes('High')) shortName = 'High (+10%)';

      const sRev = s.Forecasted_Revenue ?? s.forecasted_revenue ?? 0;
      const sRisk = s.Revenue_at_Risk ?? s.revenue_at_risk ?? 0;
      const sHold = s.Overstock_Holding_Cost ?? s.projected_holding_cost ?? s.holding_cost ?? 0;

      return {
        name: shortName,
        'Projected Revenue': Number(sRev),
        'Revenue Lost to Stockout': Number(sRisk),
        'Capital Bound in Overstock': Number(sHold)
      };
    });

    const revAtRisk = Number(current?.Revenue_at_Risk ?? current?.revenue_at_risk ?? 0);
    const holdingCost = Number(current?.Overstock_Holding_Cost ?? current?.projected_holding_cost ?? current?.holding_cost ?? 0);
    const totalRev = Number(current?.Forecasted_Revenue ?? current?.forecasted_revenue ?? 0);

    let text = '';
    let Icon = DollarSign;
    let color = 'var(--accent-primary)';

    if (!priceValid) {
      text = `Active shelf price is not recorded for this SKU. Revenue projections and financial risk assessments cannot be computed without verified pricing data.`;
      Icon = Info;
      color = 'var(--text-secondary)';
    } else if (revAtRisk > 0 && holdingCost === 0) {
      text = `To fully realize the ${safeCurrency(totalRev)} in projected revenue under the ${scenario} scenario, emergency replenishment is required. Delaying purchase orders exposes ${safeCurrency(revAtRisk)} in potential sales loss due to stockouts.`;
      Icon = AlertOctagon;
      color = 'var(--status-danger)';
    } else if (holdingCost > 0 && revAtRisk === 0) {
      text = `Revenue potential of ${safeCurrency(totalRev)} is fully protected under the ${scenario} scenario. However, current excess stock will accumulate ${safeCurrency(holdingCost)} in warehouse holding costs. Reorder freeze is recommended.`;
      Icon = Info;
      color = 'var(--status-warning)';
    } else if (revAtRisk > 0 && holdingCost > 0) {
      text = `Critical inventory imbalance detected under ${scenario}. Projected operations incur ${safeCurrency(revAtRisk)} in Revenue at Risk alongside ${safeCurrency(holdingCost)} in dead-stock holding costs.`;
      Icon = AlertOctagon;
      color = 'var(--status-danger)';
    } else {
      text = `Working capital allocation is optimal under ${scenario}. The forecasted revenue of ${safeCurrency(totalRev)} is protected with $0.00 Revenue at Risk and zero surplus holding drag.`;
      Icon = DollarSign;
      color = 'var(--status-success)';
    }

    return {
      financeData: {
        ...current,
        _unitPrice: unitPrice,
        _forecastedRev: totalRev,
        _revAtRisk: revAtRisk,
        _holdingCost: holdingCost
      },
      chartData: cData,
      analysisContext: { text, Icon, color },
      hasPrice: priceValid
    };
  }, [allFinances, scenario]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="skeleton-box shimmer" style={{ height: '32px', width: '320px', marginBottom: '0.5rem' }} />
            <div className="skeleton-box shimmer" style={{ height: '16px', width: '380px' }} />
          </div>
          <div className="skeleton-box shimmer" style={{ height: '36px', width: '240px' }} />
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
          <h3 className="error-title">Financial Impact Ledger Unavailable</h3>
          <p className="error-message">{error}</p>
          <button className="btn btn-retry" onClick={fetchFinance}>
            <RefreshCw size={14} /> Retry Request
          </button>
        </div>
      </div>
    );
  }

  if (!financeData) {
    return (
      <div className="page-container">
        <div className="empty-state glass-card">
          <DollarSign size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No Financial Ledger Found</h3>
          <p>No financial projections are recorded for {selectedProduct} at {selectedStore}.</p>
        </div>
      </div>
    );
  }

  const { Icon, color, text } = analysisContext;

  return (
    <div className="page-container">
      {/* Header with Scenario Switching */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Financial Impact Analysis</h1>
          <p className="page-subtitle">
            Monetary upside, revenue at risk, and capital holding drag for <strong>{selectedProduct}</strong> in <strong>{selectedStore}</strong>
          </p>
        </div>

        {/* Scenario Pills */}
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

      {/* Business Case Narrative Banner */}
      <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: `4px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
          <Icon size={18} style={{ color }} />
          <h3 className="kpi-title" style={{ margin: 0, color }}>
            {scenario} Financial Exposure
          </h3>
        </div>
        <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.95rem', margin: 0 }}>
          {text}
        </p>
      </div>

      {/* 4 Financial KPIs */}
      <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
        <div className="glass-card">
          <h3 className="kpi-title">Unit Shelf Price</h3>
          <div className="kpi-value mono-number">
            {hasPrice ? safeCurrency(financeData._unitPrice) : 'Price data unavailable'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Latest recorded sell price
          </div>
        </div>

        <div className="glass-card" style={{ borderColor: 'var(--accent-primary)' }}>
          <h3 className="kpi-title" style={{ color: 'var(--accent-primary)' }}>Projected Baseline Revenue</h3>
          <div className="kpi-value mono-number">
            {hasPrice ? safeCurrency(financeData._forecastedRev) : 'Price data unavailable'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Gross 30-day top-line potential
          </div>
        </div>

        <div className="glass-card" style={{ borderColor: financeData._revAtRisk > 0 ? 'var(--status-danger)' : 'var(--border-color)' }}>
          <h3 className="kpi-title" style={{ color: financeData._revAtRisk > 0 ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
            Revenue Lost to Stockout
          </h3>
          <div className="kpi-value mono-number" style={{ color: financeData._revAtRisk > 0 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
            {hasPrice ? safeCurrency(financeData._revAtRisk) : 'Price data unavailable'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Unmet customer demand value
          </div>
        </div>

        <div className="glass-card" style={{ borderColor: financeData._holdingCost > 0 ? 'var(--status-warning)' : 'var(--border-color)' }}>
          <h3 className="kpi-title" style={{ color: financeData._holdingCost > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
            Capital Bound in Overstock
          </h3>
          <div className="kpi-value mono-number" style={{ color: financeData._holdingCost > 0 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
            {hasPrice ? safeCurrency(financeData._holdingCost) : 'Price data unavailable'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Monthly carrying penalty (1.25%)
          </div>
        </div>
      </div>

      {/* Multi-Scenario Financial Comparison Chart */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 className="kpi-title" style={{ margin: 0, marginBottom: '0.25rem' }}>Baseline vs Alternative Financial Velocity</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Comparing potential cash inflow vs. stockout risk across economic environments
          </p>
        </div>

        <div className="chart-container" style={{ height: '360px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis 
                stroke="var(--text-secondary)" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<ChartTooltip currency={true} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="Projected Revenue" fill="var(--status-success)" radius={[4, 4, 0, 0]} maxBarSize={60} />
              <Bar dataKey="Revenue Lost to Stockout" fill="var(--status-danger)" radius={[4, 4, 0, 0]} maxBarSize={60} />
              <Bar dataKey="Capital Bound in Overstock" fill="var(--status-warning)" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* "How This is Calculated" Explanation Section */}
      <div className="glass-card" style={{ borderLeft: '4px solid var(--text-secondary)' }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowCalculationInfo(prev => !prev)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HelpCircle size={18} style={{ color: 'var(--text-secondary)' }} />
            <h3 className="kpi-title" style={{ margin: 0, color: 'var(--text-primary)' }}>
              How This is Calculated (Mathematical Lineage)
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {showCalculationInfo ? 'Collapse ▲' : 'Expand ▼'}
          </span>
        </div>

        {showCalculationInfo && (
          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', fontSize: '0.85rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--status-success)', marginBottom: '0.5rem' }}>Projected Baseline Revenue</div>
              <code style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem', background: 'var(--bg-app)', padding: '0.4rem', borderRadius: '4px' }}>Scenario Demand × Unit Price</code>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
                Reflects expected gross revenue if 100% of customer demand is fulfilled during the 30-day forecast horizon.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--status-danger)', marginBottom: '0.5rem' }}>Revenue Lost to Stockout</div>
              <code style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem', background: 'var(--bg-app)', padding: '0.4rem', borderRadius: '4px' }}>Shortage Quantity × Unit Price</code>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
                Value of customer orders that cannot be met due to physical inventory falling below required buffer targets.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--status-warning)', marginBottom: '0.5rem' }}>Capital Bound in Overstock</div>
              <code style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem', background: 'var(--bg-app)', padding: '0.4rem', borderRadius: '4px' }}>Overstock Qty × Unit Price × 1.25%</code>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
                Industry-standard monthly carrying proxy (15% annual rate ÷ 12 months = 1.25%/month) on dead stock.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialImpact;
