import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import { getForecast, getSales, getModelComparison } from '../services/api';
import { safeNumber, safePercentage } from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';
import { KPISkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { TrendingUp, Maximize2, Minimize2, Activity, Cpu, AlertCircle, RefreshCw, Calendar, Layers } from 'lucide-react';

const KPICard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h3 className="kpi-title">{title}</h3>
        <div className="kpi-value mono-number">{value}</div>
      </div>
      <div className={`badge ${colorClass}`} style={{ padding: '0.5rem', borderRadius: '50%' }}>
        <Icon size={22} />
      </div>
    </div>
    {subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{subtitle}</div>}
  </div>
);

const DemandForecast = () => {
  const { selectedStore, selectedProduct, horizon, setHorizon, refreshKey } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [forecastDataRaw, setForecastDataRaw] = useState([]);
  const [comparisonStats, setComparisonStats] = useState(null);

  const fetchData = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      const [sales, forecast, comp] = await Promise.all([
        getSales(selectedProduct, selectedStore),
        getForecast(selectedProduct, selectedStore, 30),
        getModelComparison(selectedProduct)
      ]);
      setSalesData(sales || []);
      setForecastDataRaw(forecast || []);
      // Handle both Object or Array return format safely
      const parsedComp = Array.isArray(comp) ? (comp[0] || null) : (comp || null);
      setComparisonStats(parsedComp);
    } catch (err) {
      console.error("Error fetching forecast data:", err);
      setError(err?.message || "Failed to retrieve forecast data");
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, selectedStore]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const { chartData, metrics, mlInsight } = useMemo(() => {
    if (!forecastDataRaw || forecastDataRaw.length === 0) {
      return { chartData: [], metrics: null, mlInsight: null };
    }

    const activeForecast = forecastDataRaw.slice(0, horizon);
    const recentSales = (salesData || []).slice(-30);

    let totalForecast = 0;

    activeForecast.forEach(f => {
      totalForecast += Number(f.predicted_demand || 0);
    });

    const avgPred = activeForecast.length > 0 ? totalForecast / activeForecast.length : 0;

    // Stitch historical and forecasted datasets for seamless time-series chart
    const stitched = [];
    
    // Add recent historical sales
    recentSales.forEach(s => {
      stitched.push({
        date: s.date,
        historical: Number(s.sales || 0),
        predicted: null,
        lowerBound: null,
        upperBound: null,
        range: null
      });
    });

    // Anchor point connecting history to prediction
    if (recentSales.length > 0 && activeForecast.length > 0) {
      const lastHist = recentSales[recentSales.length - 1];
      stitched.push({
        date: lastHist.date,
        historical: null,
        predicted: Number(lastHist.sales || 0),
        lowerBound: Number(lastHist.sales || 0),
        upperBound: Number(lastHist.sales || 0),
        range: [Number(lastHist.sales || 0), Number(lastHist.sales || 0)]
      });
    }

    // Add forecast horizon points with confidence interval
    activeForecast.forEach(f => {
      const pred = Number(f.predicted_demand || 0);
      const lower = Number(f.lower_bound ?? pred);
      const upper = Number(f.upper_bound ?? pred);
      stitched.push({
        date: f.date,
        historical: null,
        predicted: pred,
        lowerBound: lower,
        upperBound: upper,
        range: [lower, upper] // Used for Recharts Area
      });
    });

    // Determine winning model and build explainable narrative
    let modelUsed = activeForecast[0]?.selected_model || comparisonStats?.Selected_Model || 'ML Pipeline';
    let explanation = `The DemandVerse pipeline projected volume for the next ${horizon} days using ${modelUsed}.`;

    if (comparisonStats) {
      modelUsed = comparisonStats.Selected_Model || modelUsed;
      const arimaMape = Number(comparisonStats.ARIMA_MAPE || 0);
      const prophetMape = Number(comparisonStats.Prophet_MAPE || 0);
      const winningMape = modelUsed === 'Prophet' ? prophetMape : arimaMape;
      const losingModel = modelUsed === 'Prophet' ? 'ARIMA' : 'Prophet';
      const losingMape = modelUsed === 'Prophet' ? arimaMape : prophetMape;

      explanation = `Forecast generated using ${modelUsed} based on validation performance. DemandVerse AI evaluated both time-series architectures against backtested validation actuals. ${modelUsed} achieved superior precision (MAPE: ${safePercentage(winningMape, 2)} vs ${losingModel}: ${safePercentage(losingMape, 2)}) and was automatically designated as the production forecast model for ${selectedProduct} at ${selectedStore}.`;
    }

    return {
      chartData: stitched,
      metrics: {
        totalForecast,
        avgPred,
        modelUsed
      },
      mlInsight: explanation
    };
  }, [forecastDataRaw, salesData, horizon, comparisonStats, selectedProduct, selectedStore]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="skeleton-box shimmer" style={{ height: '32px', width: '280px', marginBottom: '0.5rem' }} />
            <div className="skeleton-box shimmer" style={{ height: '16px', width: '380px' }} />
          </div>
          <div className="skeleton-box shimmer" style={{ height: '36px', width: '200px' }} />
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
          <AlertCircle size={36} style={{ color: 'var(--status-danger)' }} />
          <h3 className="error-title">Demand Forecast Unavailable</h3>
          <p className="error-message">{error}</p>
          <button className="btn btn-retry" onClick={fetchData}>
            <RefreshCw size={14} /> Retry Request
          </button>
        </div>
      </div>
    );
  }

  if (!metrics || chartData.length === 0) {
    return (
      <div className="page-container">
        <div className="empty-state glass-card">
          <TrendingUp size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No Forecast Output Found</h3>
          <p>No machine learning forecast is recorded for {selectedProduct} at {selectedStore}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Demand Forecasting</h1>
            <span className={`badge ${metrics.modelUsed === 'Prophet' ? 'primary' : 'info'}`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
              Selected Model: {metrics.modelUsed}
            </span>
          </div>
          <p className="page-subtitle">
            Forward projection with uncertainty intervals for <strong>{selectedProduct}</strong> in <strong>{selectedStore}</strong>
          </p>
        </div>

        {/* Horizon Quick Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>Horizon:</span>
          {[7, 14, 30].map(h => (
            <button
              key={h}
              className={`btn ${horizon === h ? 'btn' : 'btn-outline'}`}
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setHorizon(h)}
            >
              {h} Days
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection Explanation Banner */}
      <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
          <h3 className="kpi-title" style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
            Automated Model Selection Insight
          </h3>
        </div>
        <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
          {mlInsight}
        </p>
      </div>

      {/* Forecast Metric Cards */}
      <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
        <KPICard 
          title="Forecast Model" 
          value={metrics.modelUsed} 
          icon={Cpu} 
          colorClass={metrics.modelUsed === 'Prophet' ? 'primary' : 'info'} 
          subtitle="Selected dynamically"
        />
        <KPICard 
          title="Forecast Horizon" 
          value={`${horizon} Days`} 
          icon={Calendar} 
          colorClass="warning" 
          subtitle="Forward projection window"
        />
        <KPICard 
          title="Total Forecast Demand" 
          value={safeNumber(metrics.totalForecast, 0)} 
          icon={TrendingUp} 
          colorClass="success" 
          subtitle={`Cumulative units over ${horizon}D`}
        />
        <KPICard 
          title="Average Daily Demand" 
          value={safeNumber(metrics.avgPred, 1)} 
          icon={Activity} 
          colorClass="primary" 
          subtitle="Expected daily run-rate"
        />
      </div>

      {/* Forecasting Chart */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 className="kpi-title" style={{ margin: 0 }}>Historical Actuals vs. ML Projection</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Includes shaded 95% confidence intervals
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--text-secondary)', display: 'inline-block', borderRadius: '2px' }}></span> Historical Sales
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--accent-primary)', display: 'inline-block', borderRadius: '2px' }}></span> {metrics.modelUsed} Projection
            </span>
          </div>
        </div>

        <div className="chart-container" style={{ height: '480px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="var(--text-secondary)" 
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                tickLine={false}
                minTickGap={25}
              />
              <YAxis 
                stroke="var(--text-secondary)" 
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ opacity: 0 }} /> {/* Visually hide recharts legend but keep space */}
              
              {/* Reference line between history and forecast */}
              {salesData.length > 0 && (
                <ReferenceLine 
                  x={salesData[salesData.length - 1].date} 
                  stroke="rgba(255, 255, 255, 0.3)" 
                  strokeDasharray="4 4" 
                  label={{ position: 'top', value: 'Forecast Split', fill: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }} 
                />
              )}

              {/* Shaded Confidence Interval */}
              <Area 
                type="monotone" 
                dataKey="range" 
                stroke="none" 
                fill="url(#colorConfidence)" 
                name="95% Confidence Interval"
                connectNulls
              />

              {/* Historical actuals */}
              <Line 
                type="monotone" 
                dataKey="historical" 
                stroke="var(--text-secondary)" 
                strokeWidth={2} 
                dot={false} 
                name="Historical Actuals" 
              />

              {/* Predicted Forecast */}
              <Line 
                type="monotone" 
                dataKey="predicted" 
                stroke="var(--accent-primary)" 
                strokeWidth={2.5} 
                dot={{ r: 3, fill: 'var(--bg-card)', stroke: 'var(--accent-primary)', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: 'var(--accent-primary)' }}
                name={`Projected Demand`} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DemandForecast;
