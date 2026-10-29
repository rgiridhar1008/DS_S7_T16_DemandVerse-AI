import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import { 
  getInsights, 
  getInventory, 
  getForecast, 
  getFinancialImpact, 
  getSales, 
  getModelComparison 
} from '../services/api';
import { safeNumber, safeCurrency, safePercentage } from '../utils/formatters';
import { KPISkeleton } from '../components/SkeletonLoader';
import { 
  Lightbulb, TrendingUp, Cpu, Package, AlertTriangle, 
  DollarSign, Activity, AlertCircle, RefreshCw, ShieldAlert, CheckCircle2 
} from 'lucide-react';

const BusinessInsights = () => {
  const { selectedStore, selectedProduct, refreshKey } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bundleData, setBundleData] = useState(null);

  const fetchAllContext = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      const [insights, inventory, forecast, finances, sales, modelComp] = await Promise.all([
        getInsights(selectedStore, selectedProduct),
        getInventory(selectedStore, selectedProduct),
        getForecast(selectedProduct, selectedStore, 30),
        getFinancialImpact(selectedStore, selectedProduct, 'Normal Demand'),
        getSales(selectedProduct, selectedStore),
        getModelComparison(selectedProduct)
      ]);

      setBundleData({
        insight: insights && insights.length > 0 ? insights[0] : null,
        inventory: inventory && inventory.length > 0 ? inventory[0] : null,
        forecast: forecast || [],
        finances: finances && finances.length > 0 ? finances[0] : null,
        sales: sales || [],
        modelComp: Array.isArray(modelComp) ? modelComp[0] : modelComp
      });
    } catch (err) {
      console.error("Error fetching business decision insights:", err);
      setError(err?.message || "Failed to compile business decision insights");
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, selectedStore]);

  useEffect(() => {
    fetchAllContext();
  }, [fetchAllContext, refreshKey]);

  const insightsList = useMemo(() => {
    if (!bundleData) return [];
    const { inventory, forecast, finances, sales, modelComp } = bundleData;

    // 1. Demand Trend
    const totalSales = sales.reduce((acc, curr) => acc + (curr.sales || 0), 0);
    const histDailyAvg = sales.length > 0 ? totalSales / sales.length : 0;
    const totalForecast = forecast.reduce((acc, curr) => acc + (curr.predicted_demand || 0), 0);
    const forecastDailyAvg = forecast.length > 0 ? totalForecast / forecast.length : 0;
    const trendShift = histDailyAvg > 0 ? ((forecastDailyAvg - histDailyAvg) / histDailyAvg) * 100 : 0;

    // 2. Model Selection
    const selectedModel = forecast[0]?.selected_model || modelComp?.Selected_Model || 'ML Pipeline';
    const arimaMape = Number(modelComp?.ARIMA_MAPE || 0);
    const prophetMape = Number(modelComp?.Prophet_MAPE || 0);
    const winningMape = selectedModel === 'Prophet' ? prophetMape : arimaMape;
    const losingModel = selectedModel === 'Prophet' ? 'ARIMA' : 'Prophet';
    const losingMape = selectedModel === 'Prophet' ? arimaMape : prophetMape;

    // 3. Inventory Status
    const currStock = Number(inventory?.simulated_current_stock || 0);
    const reqStock = Number(inventory?.required_stock || 0);
    const status = inventory?.inventory_status || 'HEALTHY STOCK';

    // 4. Reorder Requirement
    const reorderQty = Number(inventory?.reorder_quantity || 0);
    const dailyRun = forecastDailyAvg > 0 ? forecastDailyAvg : 1;
    const daysDepletion = currStock / dailyRun;

    // 5. Revenue Risk
    const revAtRisk = Number(finances?.Revenue_at_Risk || 0);
    const grossForecastRev = Number(finances?.Forecasted_Revenue || 0);

    // 6. Scenario Impact
    const highDemandShock = totalForecast * 1.1;

    return [
      {
        id: 'demand-trend',
        title: 'Demand Trend Velocity',
        icon: TrendingUp,
        color: trendShift > 5 ? 'var(--status-success)' : (trendShift < -5 ? 'var(--status-warning)' : 'var(--status-info)'),
        badge: `${trendShift > 0 ? '+' : ''}${trendShift.toFixed(1)}% Velocity`,
        observation: `Historical pace averaged ${safeNumber(histDailyAvg, 1)} units/day, whereas the 30-day forward projection forecasts ${safeNumber(forecastDailyAvg, 1)} units/day (${trendShift >= 0 ? '+' : ''}${safeNumber(trendShift, 1)}% shift).`,
        implication: trendShift > 5 
          ? `Demand is accelerating noticeably. Store shelves will experience faster turnover than previous sales periods.`
          : (trendShift < -5 
            ? `Demand is contracting. Shelf clearance will proceed slower than historical baseline.`
            : `Demand velocity remains stable and closely adheres to standard historical purchasing habits.`),
        action: trendShift > 5
          ? `Increase replenishment scheduling frequency and verify warehouse replenishment pipeline throughput.`
          : (trendShift < -5 
            ? `Moderate safety buffers to avoid excessive capital lock-in during low velocity cycles.`
            : `Maintain standard procurement replenishment cadence.`)
      },
      {
        id: 'model-selection',
        title: 'Forecasting Model Selection',
        icon: Cpu,
        color: 'var(--accent-primary)',
        badge: `${selectedModel} Selected`,
        observation: `Auto-selection chose ${selectedModel} (Validation MAPE: ${safePercentage(winningMape, 2)}) over ${losingModel} (MAPE: ${safePercentage(losingMape, 2)}).`,
        implication: `${selectedModel} minimized residual prediction variance on this specific SKU's seasonal fluctuations by ${safeNumber(Math.abs(losingMape - winningMape), 2)} percentage points.`,
        action: `Use the ${selectedModel} upper and lower confidence intervals for monthly supply chain commitments.`
      },
      {
        id: 'inventory-status',
        title: 'Inventory Health Assessment',
        icon: Package,
        color: status === 'STOCKOUT RISK' ? 'var(--status-danger)' : (status === 'OVERSTOCK' ? 'var(--status-warning)' : 'var(--status-success)'),
        badge: status,
        observation: `Current physical stock of ${safeNumber(currStock, 0)} units is evaluated against the required safety target of ${safeNumber(reqStock, 0)} units.`,
        implication: status === 'STOCKOUT RISK'
          ? `Current inventory is severely below the 30% safety threshold. A stockout is imminent without rapid intervention.`
          : (status === 'OVERSTOCK'
            ? `Current holdings exceed the necessary 110% buffer. Surplus stock is sitting idle on shelves.`
            : `Inventory is optimally balanced, satisfying customer demand expectations and safety margins.`),
        action: status === 'STOCKOUT RISK'
          ? `Trigger an expedited supplier purchase order immediately.`
          : (status === 'OVERSTOCK'
            ? `Institute an immediate purchasing freeze and evaluate promotional markdown campaigns.`
            : `No operational intervention required. Continue monitoring standard depletion rates.`)
      },
      {
        id: 'reorder-requirement',
        title: 'Procurement Reorder Requirement',
        icon: Activity,
        color: reorderQty > 0 ? 'var(--status-danger)' : 'var(--status-success)',
        badge: reorderQty > 0 ? `${safeNumber(reorderQty, 0)} Units Required` : '0 Units Needed',
        observation: `Calculated reorder quantity sits at ${safeNumber(reorderQty, 0)} units based on a 7-day supplier lead time and 95% service level buffer.`,
        implication: reorderQty > 0
          ? `At the current daily consumption rate, shelf inventory will deplete in approximately ${daysDepletion.toFixed(1)} days.`
          : `Existing inventory carries ample buffer to cover lead-time replenishment cycles without stock depletion.`,
        action: reorderQty > 0
          ? `Submit purchase order for ${safeNumber(reorderQty, 0)} units before the current buffer is breached.`
          : `Maintain open allocation capacity for higher-priority deficit SKUs.`
      },
      {
        id: 'revenue-risk',
        title: 'Financial Exposure & Risk',
        icon: DollarSign,
        color: revAtRisk > 0 ? 'var(--status-danger)' : 'var(--status-success)',
        badge: revAtRisk > 0 ? `${safeCurrency(revAtRisk)} at Risk` : 'Protected',
        observation: `Total 30-day gross revenue potential is ${safeCurrency(grossForecastRev)}, with ${safeCurrency(revAtRisk)} identified as Revenue at Risk due to stockout deficit.`,
        implication: revAtRisk > 0
          ? `Unfulfilled customer demand will directly cause top-line sales erosion and potential churn to competing retailers.`
          : `100% of the forecasted top-line sales potential is safeguarded by adequate inventory depth.`,
        action: revAtRisk > 0
          ? `Authorize emergency restocking to secure the ${safeCurrency(revAtRisk)} in vulnerable revenue.`
          : `Audit gross margins and confirm retail sell pricing stability.`
      },
      {
        id: 'scenario-sensitivity',
        title: 'Macro Scenario Volatility',
        icon: AlertTriangle,
        color: 'var(--status-warning)',
        badge: 'Sensitivity Test',
        observation: `Under an economic surge of +10% demand (${safeNumber(highDemandShock, 0)} units), customer pull increases by +${safeNumber(totalForecast * 0.1, 0)} units over baseline.`,
        implication: `Supplier lead time bottlenecks can quickly compound shortages if macro sales spike during seasonal periods.`,
        action: `Establish vendor pre-commitment agreements or secondary source options for peak surge scenarios.`
      }
    ];
  }, [bundleData]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton-box shimmer" style={{ height: '32px', width: '320px', marginBottom: '0.5rem' }} />
          <div className="skeleton-box shimmer" style={{ height: '16px', width: '380px' }} />
        </div>

        <div className="skeleton-box skeleton-card shimmer" style={{ height: '500px', width: '100%' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-card">
          <AlertCircle size={36} style={{ color: 'var(--status-danger)' }} />
          <h3 className="error-title">Business Insights Unavailable</h3>
          <p className="error-message">{error}</p>
          <button className="btn btn-retry" onClick={fetchAllContext}>
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
          <h1 className="page-title">Business Insights & Decision Support</h1>
          <p className="page-subtitle">
            Algorithmic recommendations across 6 analytical domains for <strong>{selectedProduct}</strong> in <strong>{selectedStore}</strong>
          </p>
        </div>
        <div className="badge primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          <Lightbulb size={16} />
          <span>Decision Support Framework</span>
        </div>
      </div>

      {/* Cohesive Table Layout */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', width: '20%' }}>Domain</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', width: '25%' }}>Observation</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', width: '25%' }}>Implication</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', width: '30%' }}>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {insightsList.map((item, index) => {
                const Icon = item.icon;
                return (
                  <tr key={item.id} style={{ borderBottom: index === insightsList.length - 1 ? 'none' : '1px solid var(--border-color)', verticalAlign: 'top' }}>
                    <td style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ padding: '0.4rem', backgroundColor: `${item.color}15`, borderRadius: '6px', color: item.color }}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{item.title}</div>
                          <span className="badge" style={{ backgroundColor: `${item.color}15`, color: item.color, fontSize: '0.7rem' }}>
                            {item.badge}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {item.observation}
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {item.implication}
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>
                      {item.action}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BusinessInsights;
