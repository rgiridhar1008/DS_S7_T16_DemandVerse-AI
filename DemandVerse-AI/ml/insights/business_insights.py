"""
Business Insights Module
========================
Generates product-level insights and explanations using actual calculated values.
No generic AI statements are generated.

Inputs:
    - Inventory recommendations DataFrame
    - Financial impact DataFrame (filtered for Normal Demand scenario, or combined)

Outputs:
    - Structured product insights (Product, Store, Selected Model, 30-Day Forecast,
      Inventory Status, Reorder Quantity, Potential Revenue at Risk, Reason)
"""

import os
import pandas as pd
from typing import Optional

from ..config import OUTPUTS_DIR

def _generate_reason(row: pd.Series) -> str:
    """
    Generate dynamic explanatory text from calculated values.
    """
    status = row.get('inventory_status', '')
    sim_stock = row.get('simulated_current_stock', 0.0)
    req_stock = row.get('required_stock', 0.0)
    reorder = row.get('reorder_quantity', 0.0)
    rev_risk = row.get('Revenue_at_Risk', 0.0)
    
    if status == 'STOCKOUT RISK':
        return f"Critical deficit. Current stock of {sim_stock:.1f} units is below the required safety threshold of {req_stock:.1f} units. Place urgent reorder of {reorder:.1f} units to mitigate a ${rev_risk:.2f} revenue risk."
    elif status == 'OVERSTOCK':
        return f"Overallocated capital. Simulated stock ({sim_stock:.1f} units) exceeds the necessary safety and forecast buffer limit ({req_stock:.1f} units). Stop replenishment orders immediately."
    else:
        return f"Optimized balance. Holdings are stable and satisfy standard sales thresholds."

def generate_product_insights(inventory_df: pd.DataFrame, financial_df: pd.DataFrame) -> pd.DataFrame:
    """
    Generates a DataFrame of product-level insights based on inventory recommendations
    and financial impact data.
    
    Parameters
    ----------
    inventory_df : pd.DataFrame
        Must contain columns: item_id, store_id, selected_model, forecasted_demand,
        inventory_status, reorder_quantity, simulated_current_stock, required_stock
    financial_df : pd.DataFrame
        Must contain columns: item_id, Scenario, Revenue_at_Risk
        (Will filter for 'Normal Demand' scenario)
        
    Returns
    -------
    pd.DataFrame
        Columns: Product, Store, Selected Model, 30-Day Forecast, Inventory Status,
        Reorder Quantity, Potential Revenue at Risk, Reason
    """
    if 'Scenario' in financial_df.columns:
        normal_fin = financial_df[financial_df['Scenario'] == 'Normal Demand'].copy()
    else:
        normal_fin = financial_df.copy()
        
    # Standardize column names for merge if needed
    fin_merge_col = 'item_id' if 'item_id' in normal_fin.columns else 'product_id'
        
    merged = pd.merge(
        inventory_df,
        normal_fin[[fin_merge_col, 'Revenue_at_Risk']],
        left_on='item_id',
        right_on=fin_merge_col,
        how='left'
    )
    
    # Generate the reasons
    merged['Reason'] = merged.apply(_generate_reason, axis=1)
    
    # Format the final DataFrame
    insights = pd.DataFrame({
        'Product': merged['item_id'],
        'Store': merged['store_id'],
        'Selected Model': merged['selected_model'],
        '30-Day Forecast': merged['forecasted_demand'].round(2),
        'Inventory Status': merged['inventory_status'],
        'Reorder Quantity': merged['reorder_quantity'].round(2),
        'Potential Revenue at Risk': merged['Revenue_at_Risk'].round(2),
        'Reason': merged['Reason']
    })
    
    return insights

def run_and_save_insights(inventory_df: pd.DataFrame, financial_df: pd.DataFrame, output_path: Optional[str] = None) -> pd.DataFrame:
    """
    End-to-end: generate insights and save to outputs/product_insights.csv.
    """
    if output_path is None:
        output_dir = os.path.join(OUTPUTS_DIR, '..', 'outputs')
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, 'product_insights.csv')
        
    insights = generate_product_insights(inventory_df, financial_df)
    insights.to_csv(output_path, index=False)
    return insights

# Kept for backward compatibility with earlier pipeline code
def generate_business_insights(inventory_df: pd.DataFrame, financial_df: pd.DataFrame) -> dict:
    """
    Generates macro-level portfolio health statistics.
    """
    insights = {}
    
    # Portfolio Health
    status_counts = inventory_df['inventory_status'].value_counts()
    insights['stockout_risk_count'] = int(status_counts.get('STOCKOUT RISK', 0))
    insights['healthy_stock_count'] = int(status_counts.get('HEALTHY STOCK', 0))
    insights['overstock_count'] = int(status_counts.get('OVERSTOCK', 0))
    insights['total_reorder_qty'] = float(inventory_df['reorder_quantity'].sum())
    
    # Financials (Normal Demand)
    if 'Scenario' in financial_df.columns:
        normal_fin = financial_df[financial_df['Scenario'] == 'Normal Demand']
    else:
        normal_fin = financial_df
        
    insights['total_forecasted_demand'] = float(normal_fin['Scenario_Forecasted_Demand'].sum())
    insights['total_forecasted_revenue'] = float(normal_fin['Forecasted_Revenue'].sum())
    insights['total_rev_at_risk'] = float(normal_fin['Revenue_at_Risk'].sum())
    
    return insights
