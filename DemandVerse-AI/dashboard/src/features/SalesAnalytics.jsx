import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import { getSales } from '../services/api';
import { safeNumber, safeCurrency, safePercentage } from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';
import { KPISkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Brush
} from 'recharts';
import { Download, Activity, TrendingUp, Calendar, AlertCircle, RefreshCw, TrendingDown, Clock } from 'lucide-react';

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

const SalesAnalytics = () => {
  const { selectedStore, selectedProduct, refreshKey } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [aggregation, setAggregation] = useState('Daily');
  const [timeRange, setTimeRange] = useState('180D');

  const fetchSales = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      const data = await getSales(selectedProduct, selectedStore);
      setRawData(data || []);
    } catch (err) {
      console.error("Error fetching sales analytics:", err);
      setError(err?.message || "Failed to load sales data");
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, selectedStore]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales, refreshKey]);

  // Aggregation & Metric Calculation
  const { chartData, metrics } = useMemo(() => {
    if (!rawData || rawData.length === 0) return { chartData: [], metrics: null };

    // 1. Filter by Time Range first
    let filteredData = [...rawData];
    if (timeRange !== 'All') {
      const days = parseInt(timeRange.replace('D', '').replace('Y', '')) * (timeRange.includes('Y') ? 365 : 1);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Assume data is ordered, or we can just slice from the end if it's daily series
      // Since M5 data dates might be relative, let's just take the last N items for simplicity
      // (assuming 1 item = 1 day for daily data).
      if (days < filteredData.length) {
        filteredData = filteredData.slice(filteredData.length - days);
      }
    }

    // 2. Aggregate Data
    const grouped = {};
    filteredData.forEach(d => {
      let key = d.date;
      let displayDate = d.date;

      if (aggregation === 'Weekly') {
        key = `Wk-${d.wm_yr_wk}`;
        displayDate = key;
      } else if (aggregation === 'Monthly') {
        key = d.date ? d.date.substring(0, 7) : 'Unknown';
        displayDate = key;
      }

      if (!grouped[key]) {
        grouped[key] = { name: displayDate, sales: 0, revenue: 0, count: 0 };
      }
      grouped[key].sales += (d.sales || 0);
      grouped[key].revenue += ((d.sales || 0) * (d.sell_price || 0));
      grouped[key].count += 1;
    });

    const aggregatedArray = Object.values(grouped);

    // 3. Calculate 7-period moving average & Extrema
    let totalSalesGlobal = 0;
    let peakDay = { name: '-', sales: -1 };
    let lowestDay = { name: '-', sales: null };
    const salesArr = [];

    const finalChartData = aggregatedArray.map((item, index, arr) => {
      let maSum = 0;
      let maCount = 0;
      for (let i = Math.max(0, index - 6); i <= index; i++) {
        maSum += arr[i].sales;
        maCount++;
      }
      
      const ma = maSum / maCount;
      totalSalesGlobal += item.sales;
      salesArr.push(item.sales);

      if (item.sales > peakDay.sales) peakDay = { name: item.name, sales: item.sales };
      if (lowestDay.sales === null || item.sales < lowestDay.sales) lowestDay = { name: item.name, sales: item.sales };

      return {
        ...item,
        movingAvg: Number(ma.toFixed(1))
      };
    });

    const avgDemand = aggregatedArray.length > 0 ? totalSalesGlobal / aggregatedArray.length : 0;
    
    // Volatility (Standard Deviation)
    const variance = salesArr.length > 0 
      ? salesArr.reduce((acc, val) => acc + Math.pow(val - avgDemand, 2), 0) / salesArr.length 
      : 0;
    const stdDev = Math.sqrt(variance);
    const volatilityPct = avgDemand > 0 ? (stdDev / avgDemand) * 100 : 0;
    
    // Trend direction for summary
    let trendDesc = "stable";
    if (salesArr.length >= 14) {
      const recentAvg = salesArr.slice(-7).reduce((a,b)=>a+b,0)/7;
      const olderAvg = salesArr.slice(-14, -7).reduce((a,b)=>a+b,0)/7;
      if (recentAvg > olderAvg * 1.05) trendDesc = "increasing";
      if (recentAvg < olderAvg * 0.95) trendDesc = "decreasing";
    }

    return {
      chartData: finalChartData,
      metrics: {
        totalSales: totalSalesGlobal,
        avgDemand,
        peak: peakDay,
        lowest: lowestDay.sales !== null ? lowestDay : { name: '-', sales: 0 },
        volatility: volatilityPct,
        trendDesc
      }
    };
  }, [rawData, aggregation, timeRange]);

  const exportCSV = () => {
    if (chartData.length === 0) return;
    
    const headers = ["Period", "Units Sold", "Revenue ($)", "7-Period Moving Avg"];
    const csvContent = [
      headers.join(","),
      ...chartData.map(row => `"${row.name}",${row.sales},${row.revenue.toFixed(2)},${row.movingAvg}`)
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedProduct}_${selectedStore}_Sales_${aggregation}_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="skeleton-box shimmer" style={{ height: '32px', width: '320px', marginBottom: '0.5rem' }} />
            <div className="skeleton-box shimmer" style={{ height: '16px', width: '380px' }} />
          </div>
          <div className="skeleton-box shimmer" style={{ height: '36px', width: '220px' }} />
        </div>

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
          <h3 className="error-title">Failed to Load Sales Analytics</h3>
          <p className="error-message">{error}</p>
          <button className="btn btn-retry" onClick={fetchSales}>
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
          <Activity size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No Historical Sales Records</h3>
          <p>No sales history was found for SKU {selectedProduct} in store {selectedStore}.</p>
        </div>
      </div>
    );
  }

  const rangeOptions = ['30D', '90D', '180D', '1Y', 'All'];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Sales Analytics</h1>
          <p className="page-subtitle">
            Historical demand trajectory and moving averages for <strong>{selectedProduct}</strong> in <strong>{selectedStore}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Time Range Pills */}
          <div className="demo-pills-list">
            {rangeOptions.map(r => (
              <button
                key={r}
                type="button"
                className={`demo-pill ${timeRange === r ? 'active-pill' : ''}`}
                style={{
                  backgroundColor: timeRange === r ? 'rgba(59, 130, 246, 0.15)' : '',
                  borderColor: timeRange === r ? 'rgba(59, 130, 246, 0.5)' : '',
                  color: timeRange === r ? 'var(--accent-primary)' : ''
                }}
                onClick={() => setTimeRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
          
          <select 
            className="filter-select"
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value)}
          >
            <option value="Daily">Daily Aggregation</option>
            <option value="Weekly">Weekly Aggregation</option>
            <option value="Monthly">Monthly Aggregation</option>
          </select>
          
          <button className="btn btn-outline" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Key Trend Summary */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
          <Clock size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Velocity Key Trend</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Over the selected {timeRange} horizon, sales have been <strong>{metrics.trendDesc}</strong>, averaging <strong>{safeNumber(metrics.avgDemand, 1)}</strong> units per period with a volatility of <strong>{safePercentage(metrics.volatility, 1)}</strong>.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
        <KPICard 
          title="Average Daily Sales" 
          value={safeNumber(metrics.avgDemand, 1)} 
          icon={Activity} 
          colorClass="info" 
          subtitle={`Units per ${aggregation.toLowerCase().replace('ly', '')}`}
        />
        <KPICard 
          title="Peak Sales Period" 
          value={safeNumber(metrics.peak.sales, 0)} 
          icon={TrendingUp} 
          colorClass="success" 
          subtitle={metrics.peak.name}
        />
        <KPICard 
          title="Minimum Sales Period" 
          value={safeNumber(metrics.lowest.sales, 0)} 
          icon={TrendingDown} 
          colorClass="danger" 
          subtitle={metrics.lowest.name}
        />
        <KPICard 
          title="Sales Volatility" 
          value={safePercentage(metrics.volatility, 1)} 
          icon={AlertCircle} 
          colorClass={metrics.volatility > 50 ? "danger" : "warning"} 
          subtitle="Relative Std Deviation"
        />
      </div>

      {/* Composed Chart */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 className="kpi-title" style={{ margin: 0 }}>Sales & Revenue Trajectory</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Drag bottom slider to zoom into specific date intervals
          </span>
        </div>

        <div className="chart-container" style={{ height: '480px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="var(--text-secondary)" 
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                tickLine={false}
                minTickGap={30}
              />
              <YAxis 
                yAxisId="left"
                stroke="var(--text-secondary)" 
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="var(--status-success)" 
                tick={{ fill: 'var(--status-success)', fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              
              {/* Externalized Tooltip */}
              <Tooltip content={<ChartTooltip />} />
              
              <Legend verticalAlign="top" height={36}/>
              
              <ReferenceLine 
                yAxisId="left" 
                y={metrics.avgDemand} 
                stroke="rgba(255,255,255,0.25)" 
                strokeDasharray="4 4" 
                label={{ position: 'top', value: 'Historical Mean', fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} 
              />
              
              <Area yAxisId="left" type="monotone" dataKey="sales" fill="url(#colorSales)" stroke="none" name="Units Sold" />
              <Bar yAxisId="left" dataKey="sales" fill="var(--accent-primary)" name="Volume" maxBarSize={22} radius={[2, 2, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="var(--status-success)" strokeWidth={2} dot={false} name="Revenue" />
              <Line yAxisId="left" type="monotone" dataKey="movingAvg" stroke="var(--status-warning)" strokeWidth={2} dot={false} name="7-Period Moving Avg" />
              
              <Brush dataKey="name" height={28} stroke="var(--border-color)" fill="var(--bg-surface)" tickFormatter={() => ''} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SalesAnalytics;
