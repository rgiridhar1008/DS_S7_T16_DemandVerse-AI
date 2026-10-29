"""
What-If Demand Scenario Analysis Module
========================================
Evaluates the impact of demand fluctuations (-10%, Normal, +10%) on
inventory requirements, shortage quantities, and reorder recommendations.

All inventory quantities in the output are SIMULATED / ASSUMED —
the M5 dataset does not provide actual current inventory.

Inputs:
    - Base forecasted demand (from the ML forecasting pipeline)
    - Safety stock (from the inventory optimizer)
    - Simulated current stock (generated assumption)

Outputs per scenario:
    - Scenario demand
    - Simulated current stock (carried through, unchanged)
    - Required stock (scenario demand + safety stock)
    - Shortage quantity (max(0, required − current))
    - Reorder quantity (equal to shortage; gap to fill)
"""

import pandas as pd
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Scenario definitions — the three contractual scenarios
# ---------------------------------------------------------------------------
SCENARIOS: Dict[str, float] = {
    'Low Demand (-10%)': 0.90,
    'Normal Demand': 1.00,
    'High Demand (+10%)': 1.10,
}


def run_what_if_scenario(
    base_demand: float,
    safety_stock: float,
    current_stock: float,
    factor: float,
) -> dict:
    """
    Compute a single what-if scenario for one product.

    Parameters
    ----------
    base_demand : float
        Total forecasted demand over the forecast horizon (e.g. 30-day sum).
    safety_stock : float
        Pre-computed safety stock from the inventory optimizer.
    current_stock : float
        Simulated / assumed current stock level.
    factor : float
        Demand multiplier (0.90, 1.00, or 1.10).

    Returns
    -------
    dict with keys:
        Scenario_Forecasted_Demand, Safety_Stock, Current_Simulated_Stock,
        Required_Stock, Shortage_Quantity, Reorder_Quantity
    """
    scen_demand = round(base_demand * factor, 2)
    req_stock = round(scen_demand + safety_stock, 2)
    shortage = max(0.0, round(req_stock - current_stock, 2))

    return {
        'Scenario_Forecasted_Demand': scen_demand,
        'Safety_Stock': safety_stock,
        'Current_Simulated_Stock': current_stock,
        'Required_Stock': req_stock,
        'Shortage_Quantity': shortage,
        'Reorder_Quantity': shortage,  # reorder exactly covers the gap
    }


def analyze_scenarios(inventory_row: dict) -> List[dict]:
    """
    Run all three demand scenarios for a single product.

    Parameters
    ----------
    inventory_row : dict
        Must contain at minimum:
            forecasted_demand, safety_stock, simulated_current_stock

    Returns
    -------
    List of dicts, one per scenario, each containing the scenario name
    plus all fields from ``run_what_if_scenario``.
    """
    results: List[dict] = []
    base_demand = inventory_row['forecasted_demand']
    safety = inventory_row['safety_stock']
    current = inventory_row['simulated_current_stock']

    for name, factor in SCENARIOS.items():
        res = run_what_if_scenario(base_demand, safety, current, factor)
        res['Scenario'] = name
        res['Base_Forecasted_Demand'] = base_demand
        results.append(res)

    return results


def analyze_scenarios_batch(inventory_df: pd.DataFrame) -> pd.DataFrame:
    """
    Run all three scenarios across every product in an inventory DataFrame.

    Parameters
    ----------
    inventory_df : pd.DataFrame
        Columns required: item_id, store_id, selected_model,
        forecasted_demand, safety_stock, simulated_current_stock

    Returns
    -------
    pd.DataFrame  — one row per (product × scenario), ready for API
    serialisation or CSV export.  Columns match the Colab output schema:
        Scenario, item_id, store_id, selected_model,
        Base_Forecasted_Demand, Scenario_Forecasted_Demand, Safety_Stock,
        Current_Simulated_Stock, Required_Stock, Shortage_Quantity,
        Reorder_Quantity
    """
    all_records: List[dict] = []

    for _, row in inventory_df.iterrows():
        scenarios = analyze_scenarios(row.to_dict())
        for s in scenarios:
            s['item_id'] = row['item_id']
            s['store_id'] = row['store_id']
            s['selected_model'] = row['selected_model']
            all_records.append(s)

    result_df = pd.DataFrame(all_records)

    # Reorder columns to match the Colab output schema
    col_order = [
        'Scenario', 'item_id', 'store_id', 'selected_model',
        'Base_Forecasted_Demand', 'Scenario_Forecasted_Demand',
        'Safety_Stock', 'Current_Simulated_Stock', 'Required_Stock',
        'Shortage_Quantity', 'Reorder_Quantity',
    ]
    return result_df[col_order]
