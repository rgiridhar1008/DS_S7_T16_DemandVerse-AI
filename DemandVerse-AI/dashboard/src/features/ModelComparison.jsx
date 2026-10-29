import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import { getModelComparison } from '../services/api';
import { safeNumber, safePercentage } from '../utils/formatters';
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
  Legend,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { Cpu, Zap, Activity, AlertCircle, RefreshCw, Trophy, Award, CheckCircle2 } from 'lucide-react';

const MetricCard = ({ title, arima, prophet, highlight, unit = '' }) => {
  const formattedArima = safeNumber(arima, 2);
  const formattedProphet = safeNumber(prophet, 2);
  const arimaDisplay = formattedArima === 'Data unavailable' ? formattedArima : `${formattedArima}${unit}`;
  const prophetDisplay = formattedProphet === 'Data unavailable' ? formattedProphet : `${formattedProphet}${unit}`;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: `4px solid ${highlight ? 'var(--status-success)' : 'var(--border-color)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="kpi-title" style={{ margin: 0 }}>{title}</h3>
        {highlight && (
          <span className="badge success" style={{ fontSize: '0.7rem' }}>
            Winner: {highlight}
          </span>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
        <div style={{ 
          padding: '0.75rem', 
          borderRadius: 'var(--radius-sm)', 
          backgroundColor: highlight === 'ARIMA' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
          border: highlight === 'ARIMA' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>ARIMA</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: highlight === 'ARIMA' ? 'var(--status-success)' : 'var(--text-primary)' }}>
            {arimaDisplay}
          </div>
        </div>

        <div style={{ 
          padding: '0.75rem', 
          borderRadius: 'var(--radius-sm)', 
          backgroundColor: highlight === 'Prophet' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
          border: highlight === 'Prophet' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Prophet</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: highlight === 'Prophet' ? 'var(--status-success)' : 'var(--text-primary)' }}>
            {prophetDisplay}
          </div>
        </div>
      </div>
    </div>
  );
};

const ModelComparison = () => {
  const { selectedProduct, selectedStore, refreshKey } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState([]);

  const fetchMetrics = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      const data = await getModelComparison(selectedProduct);
      setRawData(Array.isArray(data) ? data : [data]);
    } catch (err) {
      console.error("Error fetching model comparison:", err);
      setError(err?.message || "Failed to load model comparison metrics");
    } finally {
      setLoading(false);
    }
  }, [selectedProduct]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics, refreshKey]);

  const { metrics, radarData, mapeData, analysisText } = useMemo(() => {
    if (!rawData || rawData.length === 0) return {};

    const activeMetrics = rawData.find(d => String(d.store_id) === String(selectedStore)) || rawData[0];
    if (!activeMetrics) return {};

    const arimaMae = Number(activeMetrics.ARIMA_MAE || 0);
    const prophetMae = Number(activeMetrics.Prophet_MAE || 0);
    const arimaRmse = Number(activeMetrics.ARIMA_RMSE || 0);
    const prophetRmse = Number(activeMetrics.Prophet_RMSE || 0);
    const arimaMape = Number(activeMetrics.ARIMA_MAPE || 0);
    const prophetMape = Number(activeMetrics.Prophet_MAPE || 0);

    const winner = activeMetrics.Selected_Model || (arimaMape < prophetMape ? 'ARIMA' : 'Prophet');
    const loser = winner === 'ARIMA' ? 'Prophet' : 'ARIMA';
    
    const winningMape = winner === 'ARIMA' ? arimaMape : prophetMape;
    const losingMape = winner === 'ARIMA' ? prophetMape : arimaMape;
    
    const absoluteDiff = Math.abs(losingMape - winningMape).toFixed(2);
    const relativePct = losingMape > 0 ? (((losingMape - winningMape) / losingMape) * 100).toFixed(1) : '0.0';

    const text = `DemandVerse AI evaluates both forecasting models without data leakage and selects the model with better validation performance for the selected product/store. For ${selectedProduct} in ${selectedStore}, ${winner} demonstrated superior accuracy with a validation MAPE of ${winningMape.toFixed(2)}% (${absoluteDiff}% lower absolute error than ${loser}'s ${losingMape.toFixed(2)}%), yielding a ${relativePct}% relative accuracy edge.`;

    // Radar Data - Inverse scale (lower error = higher score)
    const maxMae = Math.max(arimaMae, prophetMae) || 1;
    const maxRmse = Math.max(arimaRmse, prophetRmse) || 1;
    const maxMape = Math.max(arimaMape, prophetMape) || 1;

    const rData = [
      { 
        subject: 'MAE Accuracy', 
        ARIMA: 100 - ((arimaMae / maxMae) * 100) + 10, // +10 to ensure it doesn't hit 0 in the chart
        Prophet: 100 - ((prophetMae / maxMae) * 100) + 10,
        fullMark: 110
      },
      { 
        subject: 'RMSE Accuracy', 
        ARIMA: 100 - ((arimaRmse / maxRmse) * 100) + 10, 
        Prophet: 100 - ((prophetRmse / maxRmse) * 100) + 10,
        fullMark: 110
      },
      { 
        subject: 'MAPE Accuracy', 
        ARIMA: 100 - ((arimaMape / maxMape) * 100) + 10, 
        Prophet: 100 - ((prophetMape / maxMape) * 100) + 10,
        fullMark: 110
      }
    ];

    const mData = [
      { name: 'MAPE %', ARIMA: arimaMape, Prophet: prophetMape }
    ];

    return { 
      metrics: activeMetrics, 
      radarData: rData, 
      mapeData: mData,
      analysisText: text
    };
  }, [rawData, selectedStore, selectedProduct]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="skeleton-box shimmer" style={{ height: '32px', width: '280px', marginBottom: '0.5rem' }} />
            <div className="skeleton-box shimmer" style={{ height: '16px', width: '360px' }} />
          </div>
          <div className="skeleton-box shimmer" style={{ height: '36px', width: '180px' }} />
        </div>

        <div className="skeleton-box skeleton-card shimmer" style={{ height: '80px', marginBottom: '2rem' }} />

        <div className="grid-cols-3" style={{ marginBottom: '2rem' }}>
          {[...Array(3)].map((_, i) => <KPISkeleton key={i} />)}
        </div>

        <div className="grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-card">
          <AlertCircle size={36} style={{ color: 'var(--status-danger)' }} />
          <h3 className="error-title">Model Evaluation Unavailable</h3>
          <p className="error-message">{error}</p>
          <button className="btn btn-retry" onClick={fetchMetrics}>
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
          <Cpu size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No Evaluation Metrics Recorded</h3>
          <p>No model validation results are available for {selectedProduct} at {selectedStore}.</p>
        </div>
      </div>
    );
  }

  const winner = metrics.Selected_Model || (metrics.ARIMA_MAPE < metrics.Prophet_MAPE ? 'ARIMA' : 'Prophet');

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Model Comparison & Evaluation</h1>
          <p className="page-subtitle">
            Backtested validation shootout without data leakage comparing ARIMA vs. Prophet for <strong>{selectedProduct}</strong> in <strong>{selectedStore}</strong>
          </p>
        </div>
        <div className="badge success" style={{ padding: '0.6rem 1.25rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={16} />
          Current Pipeline Winner: <strong>{winner}</strong>
        </div>
      </div>

      {/* Novelty Explanation Card */}
      <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--status-success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Award size={18} style={{ color: 'var(--status-success)' }} />
          <h3 className="kpi-title" style={{ margin: 0, color: 'var(--status-success)' }}>
            Evaluation Integrity
          </h3>
        </div>
        <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.95rem', margin: 0 }}>
          {analysisText}
        </p>
      </div>

      {/* Side-by-Side Metric Cards */}
      <div className="grid-cols-3" style={{ marginBottom: '2rem' }}>
        <MetricCard 
          title="MAE (Mean Absolute Error)" 
          arima={metrics.ARIMA_MAE} 
          prophet={metrics.Prophet_MAE} 
          highlight={metrics.ARIMA_MAE < metrics.Prophet_MAE ? 'ARIMA' : 'Prophet'}
          unit=" units"
        />
        <MetricCard 
          title="RMSE (Root Mean Square Error)" 
          arima={metrics.ARIMA_RMSE} 
          prophet={metrics.Prophet_RMSE} 
          highlight={metrics.ARIMA_RMSE < metrics.Prophet_RMSE ? 'ARIMA' : 'Prophet'}
          unit=" units"
        />
        <MetricCard 
          title="MAPE (Mean Absolute % Error)" 
          arima={metrics.ARIMA_MAPE} 
          prophet={metrics.Prophet_MAPE} 
          highlight={metrics.ARIMA_MAPE < metrics.Prophet_MAPE ? 'ARIMA' : 'Prophet'}
          unit="%"
        />
      </div>

      {/* Comparison Visualizations */}
      <div className="grid-cols-2">
        {/* Relative Performance Radar */}
        <div className="glass-card">
          <h3 className="kpi-title" style={{ marginBottom: '1rem' }}>Relative Accuracy Profile (Higher is Better)</h3>
          <div className="chart-container" style={{ height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="var(--border-color)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 110]} tick={false} axisLine={false} />
                <Radar name="ARIMA" dataKey="ARIMA" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.3} />
                <Radar name="Prophet" dataKey="Prophet" stroke="var(--accent-secondary)" fill="var(--accent-secondary)" fillOpacity={0.3} />
                <Legend verticalAlign="top" height={36} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MAPE Percentage Chart */}
        <div className="glass-card">
          <h3 className="kpi-title" style={{ marginBottom: '1rem' }}>Absolute MAPE Error (Lower is Better)</h3>
          <div className="chart-container" style={{ height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mapeData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip 
                  formatter={(val) => [`${safeNumber(val, 2)}%`, '']}
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '0.5rem', boxShadow: 'var(--shadow-md)' }} 
                />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="ARIMA" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey="Prophet" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelComparison;
