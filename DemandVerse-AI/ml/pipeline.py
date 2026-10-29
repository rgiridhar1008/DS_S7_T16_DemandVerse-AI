import os
import pandas as pd
import numpy as np

from .config import OUTPUTS_DIR, STORE_ID, FORECAST_HORIZON
from .forecasting.arima_model import train_and_forecast_arima
from .forecasting.prophet_model import train_and_forecast_prophet
from .forecasting.model_selector import select_best_model
from .inventory.inventory_optimizer import optimize_inventory
from .scenarios.what_if import analyze_scenarios
from .financial.financial_impact import calculate_financial_impact
from .insights.business_insights import generate_business_insights

def run_pipeline_for_product(item_id, train_df, test_df, clean_df, simulated_current_stock=None):
    # 1. Forecasting & Evaluation
    train_item = train_df[train_df['item_id'] == item_id].sort_values('date')
    test_item = test_df[test_df['item_id'] == item_id].sort_values('date')
    
    # ARIMA
    train_series = train_item['sales'].values
    test_series = test_item['sales'].values
    _, _, _, arima_metrics = train_and_forecast_arima(train_series, test_series, forecast_len=len(test_series))
    
    # Prophet
    train_p = train_item[['date', 'sales']].rename(columns={'date': 'ds', 'sales': 'y'})
    test_p = test_item[['date', 'sales']].rename(columns={'date': 'ds', 'sales': 'y'})
    _, _, _, prophet_metrics = train_and_forecast_prophet(train_p, test_p, forecast_len=len(test_p))
    
    # 2. Model Selection
    selected_model = select_best_model(arima_metrics, prophet_metrics)
    
    # 3. Final Forecast (Retrain on all data)
    full_item = clean_df[clean_df['item_id'] == item_id].sort_values('date')
    if selected_model == 'ARIMA':
        pred_y, _, _, _ = train_and_forecast_arima(full_item['sales'].values, forecast_len=FORECAST_HORIZON)
    else:
        full_p = full_item[['date', 'sales']].rename(columns={'date': 'ds', 'sales': 'y'})
        pred_y, _, _, _ = train_and_forecast_prophet(full_p, forecast_len=FORECAST_HORIZON)
        
    forecasted_demand = float(pred_y.sum())
    
    # 4. Inventory Optimization
    hist_std = full_item['sales'].std()
    inventory_res = optimize_inventory(forecasted_demand, hist_std, current_stock_simulated=simulated_current_stock)
    inventory_res['item_id'] = item_id
    inventory_res['store_id'] = STORE_ID
    inventory_res['selected_model'] = selected_model
    
    # 5. What-If Scenarios
    scenarios = analyze_scenarios(inventory_res)
    
    # 6. Financial Impact
    unit_price = full_item['sell_price'].iloc[-1]
    financials = []
    for s in scenarios:
        # Build the input expected by calculate_financial_impact
        s_input = {
            'Scenario_Forecasted_Demand': s['Scenario_Forecasted_Demand'],
            'Shortage_Quantity': s['Shortage_Quantity'],
            'Current_Simulated_Stock': inventory_res['simulated_current_stock'],
            'Required_Stock': s['Required_Stock']
        }
        fin = calculate_financial_impact(s_input, unit_price)
        s.update(fin)
        s['item_id'] = item_id
        s['unit_price'] = unit_price
        financials.append(s)
        
    return {
        'arima_metrics': arima_metrics,
        'prophet_metrics': prophet_metrics,
        'selected_model': selected_model,
        'inventory': inventory_res,
        'financials': financials
    }
