import math
import numpy as np
import pandas as pd

def sanitize_data(data):
    """
    Recursively traverse dicts/lists and convert:
    - NaN, NaT, Inf -> None
    - numpy scalars -> native python types
    """
    if isinstance(data, dict):
        return {k: sanitize_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_data(v) for v in data]
    elif isinstance(data, (float, np.floating)):
        if pd.isna(data) or math.isinf(data):
            return None
        return float(data)
    elif isinstance(data, (int, np.integer)):
        return int(data)
    elif isinstance(data, np.bool_):
        return bool(data)
    elif pd.isna(data): # Catch NaT or other pandas/numpy null types
        return None
    elif data is None:
        return None
    else:
        return data

def normalize_what_if_record(row: dict) -> dict:
    """
    Ensures every row contains canonical names and aliases to avoid undefined values.
    """
    res = dict(row)
    
    # Map common fields
    res['scenario_demand'] = row.get('Scenario_Forecasted_Demand', row.get('scenario_demand', row.get('forecasted_demand')))
    res['Scenario_Forecasted_Demand'] = res['scenario_demand']
    res['forecasted_demand'] = res['scenario_demand']
    
    res['simulated_current_stock'] = row.get('Current_Simulated_Stock', row.get('simulated_current_stock', row.get('current_stock')))
    res['Current_Simulated_Stock'] = res['simulated_current_stock']
    res['current_stock'] = res['simulated_current_stock']
    
    res['required_stock'] = row.get('Required_Stock', row.get('required_stock'))
    res['Required_Stock'] = res['required_stock']
    
    res['shortage_quantity'] = row.get('Shortage_Quantity', row.get('shortage_quantity', row.get('shortage')))
    res['Shortage_Quantity'] = res['shortage_quantity']
    res['shortage'] = res['shortage_quantity']
    
    res['reorder_quantity'] = row.get('Reorder_Quantity', row.get('reorder_quantity', row.get('reorder')))
    res['Reorder_Quantity'] = res['reorder_quantity']
    res['reorder'] = res['reorder_quantity']
    
    res['safety_stock'] = row.get('Safety_Stock', row.get('safety_stock'))
    res['Safety_Stock'] = res['safety_stock']
    
    res['base_forecasted_demand'] = row.get('Base_Forecasted_Demand', row.get('base_forecasted_demand'))
    res['Base_Forecasted_Demand'] = res['base_forecasted_demand']
    
    # Identifier mapping
    if 'item_id' in row:
        res['product_id'] = row['item_id']
    elif 'product_id' in row:
        res['item_id'] = row['product_id']
        
    return res

def normalize_financial_record(row: dict) -> dict:
    """
    Ensures financial records have canonical aliases and calculates
    financial impact explicitly if unit_price is available.
    """
    res = dict(row)
    
    if 'item_id' in row:
        res['product_id'] = row['item_id']
    elif 'product_id' in row:
        res['item_id'] = row['product_id']
        
    unit_price = row.get('unit_price', row.get('sell_price', row.get('price')))
    res['unit_price'] = unit_price
    res['sell_price'] = unit_price
    res['price'] = unit_price
    
    scenario_demand = row.get('Scenario_Forecasted_Demand', row.get('scenario_demand', row.get('forecasted_demand', 0)))
    shortage_qty = row.get('Shortage_Quantity', row.get('shortage_quantity', row.get('shortage', 0)))
    current_stock = row.get('Current_Simulated_Stock', row.get('simulated_current_stock', row.get('current_stock', 0)))
    required_stock = row.get('Required_Stock', row.get('required_stock', 0))
    
    # Financial consistency checks
    if unit_price is not None and not pd.isna(unit_price) and unit_price > 0:
        res['Forecasted_Revenue'] = round(scenario_demand * unit_price, 2) if scenario_demand is not None else None
        res['Revenue_at_Risk'] = round(shortage_qty * unit_price, 2) if shortage_qty is not None else None
        if current_stock is not None and required_stock is not None:
            overstock_qty = max(0.0, current_stock - required_stock)
            res['Overstock_Holding_Cost'] = round(overstock_qty * unit_price * 0.0125, 4)
        else:
            res['Overstock_Holding_Cost'] = None
    else:
        res['unit_price'] = None
        res['sell_price'] = None
        res['price'] = None
        res['Forecasted_Revenue'] = None
        res['Revenue_at_Risk'] = None
        res['Overstock_Holding_Cost'] = None
        
    res['forecasted_revenue'] = res['Forecasted_Revenue']
    res['revenue_at_risk'] = res['Revenue_at_Risk']
    res['projected_holding_cost'] = res['Overstock_Holding_Cost']
    res['holding_cost'] = res['Overstock_Holding_Cost']
    
    return res
