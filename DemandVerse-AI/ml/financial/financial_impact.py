"""
Financial Impact Analysis Module
=================================
Calculates revenue projections and risk exposure for each demand scenario
using **actual M5 selling prices** from the clean_sales dataset.

Core formulas:
    Forecasted Revenue     = Scenario Demand × Unit Price
    Revenue at Risk        = Shortage Quantity × Unit Price

Additionally computes overstock metrics:
    Overstock Quantity      = max(0, Current Simulated Stock − Required Stock)
    Overstock Holding Cost  = Overstock Qty × Unit Price × Monthly Holding Rate

ASSUMPTIONS (explicitly labelled):
    - ASSUMPTION: Overstock holding cost uses an industry-standard proxy of
      15% annual carrying rate ÷ 12 = 1.25% monthly rate.
      This is a general retail logistics assumption, NOT an actual
      Walmart financial parameter.
    - ASSUMPTION: Unit price is the most recent M5 sell_price observed for
      each product.  The M5 dataset provides real Walmart shelf prices,
      but they may not reflect the current price at the time of forecast.
    - ASSUMPTION: Inventory quantities are SIMULATED / ASSUMED.
      The M5 dataset does NOT provide actual current inventory.

Inputs:
    - What-If scenario DataFrame (from ml.scenarios.what_if)
    - Unit prices extracted from clean_sales.csv (actual M5 data)

Outputs per row:
    product_id, store_id, scenario, predicted_demand, unit_price,
    forecasted_revenue, simulated_current_stock, shortage_quantity,
    potential_revenue_at_risk, overstock_quantity, overstock_holding_cost
"""

import os
import pandas as pd
import numpy as np
from typing import Dict, Optional

from ..config import HOLDING_COST_RATE_MONTHLY, CLEAN_SALES_PATH, OUTPUTS_DIR


# ---------------------------------------------------------------------------
# Price extraction — uses actual M5 sell_price data
# ---------------------------------------------------------------------------

def extract_unit_prices(clean_sales_path: str = CLEAN_SALES_PATH) -> pd.DataFrame:
    """
    Extract the most recent unit price for each product from the M5
    clean_sales dataset.

    Returns
    -------
    pd.DataFrame with columns: item_id, unit_price
    """
    df = pd.read_csv(clean_sales_path, usecols=['item_id', 'date', 'sell_price'],
                     parse_dates=['date'])
    recent_prices = (
        df.sort_values('date')
        .groupby('item_id', observed=True)
        .last()[['sell_price']]
        .reset_index()
        .rename(columns={'sell_price': 'unit_price'})
    )
    return recent_prices


# ---------------------------------------------------------------------------
# Single-row calculation (backward compatible with pipeline.py)
# ---------------------------------------------------------------------------

def calculate_financial_impact(scenario_row: dict, unit_price: float) -> dict:
    """
    Compute financial metrics for a single (product × scenario) row.

    Parameters
    ----------
    scenario_row : dict
        Must contain: Scenario_Forecasted_Demand, Shortage_Quantity,
        Current_Simulated_Stock, Required_Stock
    unit_price : float
        Actual M5 selling price for the product.

    Returns
    -------
    dict with keys: Forecasted_Revenue, Revenue_at_Risk,
    Overstock_Quantity, Overstock_Holding_Cost
    """
    demand = scenario_row['Scenario_Forecasted_Demand']
    shortage = scenario_row['Shortage_Quantity']
    current = scenario_row['Current_Simulated_Stock']
    required = scenario_row['Required_Stock']

    forecasted_rev = round(demand * unit_price, 2)
    rev_at_risk = round(shortage * unit_price, 2)

    overstock_qty = max(0.0, round(current - required, 2))
    # ASSUMPTION: 15% annual / 12 months = 1.25% monthly holding cost rate
    holding_cost = round(overstock_qty * (unit_price * HOLDING_COST_RATE_MONTHLY), 4)

    return {
        'Forecasted_Revenue': forecasted_rev,
        'Revenue_at_Risk': rev_at_risk,
        'Overstock_Quantity': overstock_qty,
        'Overstock_Holding_Cost': holding_cost,
    }


# ---------------------------------------------------------------------------
# Batch processing — operates on the full What-If DataFrame
# ---------------------------------------------------------------------------

def calculate_financial_impact_batch(
    what_if_df: pd.DataFrame,
    prices_df: Optional[pd.DataFrame] = None,
    clean_sales_path: str = CLEAN_SALES_PATH,
) -> pd.DataFrame:
    """
    Attach financial columns to every row of a What-If scenario DataFrame.

    Parameters
    ----------
    what_if_df : pd.DataFrame
        Output of ``analyze_scenarios_batch`` (from ml.scenarios.what_if).
        Must contain columns: item_id, Scenario_Forecasted_Demand,
        Shortage_Quantity, Current_Simulated_Stock, Required_Stock.
    prices_df : pd.DataFrame, optional
        Pre-computed prices (columns: item_id, unit_price).
        If None, prices are extracted from ``clean_sales_path``.
    clean_sales_path : str
        Path to clean_sales.csv (used only if ``prices_df`` is None).

    Returns
    -------
    pd.DataFrame with all original columns plus:
        unit_price, Forecasted_Revenue, Revenue_at_Risk,
        Overstock_Quantity, Overstock_Holding_Cost
    """
    if prices_df is None:
        prices_df = extract_unit_prices(clean_sales_path)

    # Merge prices using item_id
    fin_df = what_if_df.merge(prices_df, on='item_id', how='left')

    # Vectorised financial calculations
    fin_df['Forecasted_Revenue'] = (
        fin_df['Scenario_Forecasted_Demand'] * fin_df['unit_price']
    ).round(2)

    fin_df['Revenue_at_Risk'] = (
        fin_df['Shortage_Quantity'] * fin_df['unit_price']
    ).round(2)

    fin_df['Overstock_Quantity'] = (
        (fin_df['Current_Simulated_Stock'] - fin_df['Required_Stock'])
        .clip(lower=0.0)
        .round(2)
    )

    # ASSUMPTION: 15% annual / 12 = 1.25% monthly holding cost rate
    fin_df['Overstock_Holding_Cost'] = (
        fin_df['Overstock_Quantity'] * fin_df['unit_price'] * HOLDING_COST_RATE_MONTHLY
    ).round(4)

    return fin_df


# ---------------------------------------------------------------------------
# Convenience: run the full chain and save to CSV
# ---------------------------------------------------------------------------

def run_and_save(
    what_if_df: pd.DataFrame,
    output_path: Optional[str] = None,
    clean_sales_path: str = CLEAN_SALES_PATH,
) -> pd.DataFrame:
    """
    End-to-end: attach financials and write to ``outputs/financial_impact.csv``.

    Returns the enriched DataFrame.
    """
    if output_path is None:
        output_dir = os.path.join(OUTPUTS_DIR, '..', 'outputs')
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, 'financial_impact.csv')

    result = calculate_financial_impact_batch(what_if_df, clean_sales_path=clean_sales_path)
    result.to_csv(output_path, index=False)
    return result
