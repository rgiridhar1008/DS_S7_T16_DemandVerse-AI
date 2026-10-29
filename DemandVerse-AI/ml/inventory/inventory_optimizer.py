import numpy as np
import pandas as pd
from ..config import LEAD_TIME_DAYS, Z_SCORE

def optimize_inventory(forecasted_demand, historical_std, current_stock_simulated=None):
    safety_stock = round(Z_SCORE * historical_std * np.sqrt(LEAD_TIME_DAYS), 2)
    required_stock = round(forecasted_demand + safety_stock, 2)
    
    if current_stock_simulated is None:
        multiplier = np.random.uniform(0.1, 1.4)
        current_stock = round(required_stock * multiplier, 2)
    else:
        current_stock = current_stock_simulated
        
    reorder_quantity = max(0.0, round(required_stock - current_stock, 2))
    
    if current_stock < 0.3 * required_stock:
        status = 'STOCKOUT RISK'
    elif current_stock > 1.1 * required_stock:
        status = 'OVERSTOCK'
    else:
        status = 'HEALTHY STOCK'
        
    return {
        'forecasted_demand': forecasted_demand,
        'safety_stock': safety_stock,
        'required_stock': required_stock,
        'simulated_current_stock': current_stock,
        'reorder_quantity': reorder_quantity,
        'inventory_status': status
    }
