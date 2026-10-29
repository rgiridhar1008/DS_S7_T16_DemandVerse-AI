"""
Unit + Validation tests for ml.financial.financial_impact
=========================================================
Run with:  python -m ml.tests.test_financial_impact   (from project root)
"""

import os
import sys
import unittest
import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.financial.financial_impact import (
    calculate_financial_impact,
    calculate_financial_impact_batch,
    extract_unit_prices,
)
from ml.scenarios.what_if import analyze_scenarios_batch
from ml.config import HOLDING_COST_RATE_MONTHLY, OUTPUTS_DIR, CLEAN_SALES_PATH


# ====================================================================
# 1.  Pure unit tests — deterministic arithmetic, no data files
# ====================================================================
class TestCalculateFinancialImpact(unittest.TestCase):
    """Verify the single-row formula calculations."""

    def test_forecasted_revenue(self):
        """Revenue = Scenario Demand × Unit Price."""
        row = {
            'Scenario_Forecasted_Demand': 100.0,
            'Shortage_Quantity': 0.0,
            'Current_Simulated_Stock': 200.0,
            'Required_Stock': 100.0,
        }
        res = calculate_financial_impact(row, unit_price=2.50)
        self.assertEqual(res['Forecasted_Revenue'], 250.0)

    def test_revenue_at_risk(self):
        """Revenue at Risk = Shortage × Unit Price."""
        row = {
            'Scenario_Forecasted_Demand': 100.0,
            'Shortage_Quantity': 40.0,
            'Current_Simulated_Stock': 60.0,
            'Required_Stock': 110.0,
        }
        res = calculate_financial_impact(row, unit_price=3.00)
        self.assertEqual(res['Revenue_at_Risk'], 120.0)  # 40 × 3

    def test_no_shortage_means_zero_risk(self):
        """When shortage = 0, revenue at risk = 0."""
        row = {
            'Scenario_Forecasted_Demand': 100.0,
            'Shortage_Quantity': 0.0,
            'Current_Simulated_Stock': 500.0,
            'Required_Stock': 110.0,
        }
        res = calculate_financial_impact(row, unit_price=1.68)
        self.assertEqual(res['Revenue_at_Risk'], 0.0)

    def test_overstock_quantity_positive(self):
        """When current stock > required, overstock = current − required."""
        row = {
            'Scenario_Forecasted_Demand': 100.0,
            'Shortage_Quantity': 0.0,
            'Current_Simulated_Stock': 300.0,
            'Required_Stock': 200.0,
        }
        res = calculate_financial_impact(row, unit_price=1.68)
        self.assertEqual(res['Overstock_Quantity'], 100.0)

    def test_overstock_quantity_zero_when_understocked(self):
        """When current stock < required, overstock = 0."""
        row = {
            'Scenario_Forecasted_Demand': 100.0,
            'Shortage_Quantity': 50.0,
            'Current_Simulated_Stock': 60.0,
            'Required_Stock': 110.0,
        }
        res = calculate_financial_impact(row, unit_price=1.68)
        self.assertEqual(res['Overstock_Quantity'], 0.0)

    def test_holding_cost_formula(self):
        """Holding cost = Overstock Qty × Price × HOLDING_COST_RATE_MONTHLY."""
        row = {
            'Scenario_Forecasted_Demand': 100.0,
            'Shortage_Quantity': 0.0,
            'Current_Simulated_Stock': 200.0,
            'Required_Stock': 100.0,
        }
        price = 2.00
        res = calculate_financial_impact(row, unit_price=price)
        # Overstock = 200 - 100 = 100.  Holding = 100 × 2.00 × 0.0125 = 2.5
        self.assertEqual(res['Overstock_Holding_Cost'], 2.5)

    def test_holding_cost_zero_when_no_overstock(self):
        row = {
            'Scenario_Forecasted_Demand': 100.0,
            'Shortage_Quantity': 20.0,
            'Current_Simulated_Stock': 80.0,
            'Required_Stock': 110.0,
        }
        res = calculate_financial_impact(row, unit_price=5.00)
        self.assertEqual(res['Overstock_Holding_Cost'], 0.0)

    def test_output_keys(self):
        row = {
            'Scenario_Forecasted_Demand': 50.0,
            'Shortage_Quantity': 10.0,
            'Current_Simulated_Stock': 40.0,
            'Required_Stock': 60.0,
        }
        res = calculate_financial_impact(row, unit_price=1.0)
        expected = {'Forecasted_Revenue', 'Revenue_at_Risk',
                    'Overstock_Quantity', 'Overstock_Holding_Cost'}
        self.assertEqual(set(res.keys()), expected)

    def test_zero_price_means_zero_everything(self):
        row = {
            'Scenario_Forecasted_Demand': 100.0,
            'Shortage_Quantity': 50.0,
            'Current_Simulated_Stock': 200.0,
            'Required_Stock': 100.0,
        }
        res = calculate_financial_impact(row, unit_price=0.0)
        self.assertEqual(res['Forecasted_Revenue'], 0.0)
        self.assertEqual(res['Revenue_at_Risk'], 0.0)
        self.assertEqual(res['Overstock_Holding_Cost'], 0.0)


class TestBatchFinancialImpact(unittest.TestCase):
    """Verify the batch DataFrame processing."""

    def setUp(self):
        self.what_if_df = pd.DataFrame([
            {'item_id': 'A', 'Scenario': 'Normal Demand',
             'Scenario_Forecasted_Demand': 100.0, 'Shortage_Quantity': 20.0,
             'Current_Simulated_Stock': 80.0, 'Required_Stock': 110.0,
             'store_id': 'S1', 'selected_model': 'ARIMA'},
            {'item_id': 'B', 'Scenario': 'Normal Demand',
             'Scenario_Forecasted_Demand': 200.0, 'Shortage_Quantity': 0.0,
             'Current_Simulated_Stock': 300.0, 'Required_Stock': 210.0,
             'store_id': 'S1', 'selected_model': 'Prophet'},
        ])
        self.prices_df = pd.DataFrame([
            {'item_id': 'A', 'unit_price': 2.0},
            {'item_id': 'B', 'unit_price': 3.0},
        ])

    def test_output_has_financial_columns(self):
        result = calculate_financial_impact_batch(self.what_if_df, prices_df=self.prices_df)
        for col in ['Forecasted_Revenue', 'Revenue_at_Risk',
                     'Overstock_Quantity', 'Overstock_Holding_Cost', 'unit_price']:
            self.assertIn(col, result.columns)

    def test_row_count_preserved(self):
        result = calculate_financial_impact_batch(self.what_if_df, prices_df=self.prices_df)
        self.assertEqual(len(result), 2)

    def test_revenue_calculation_vectorised(self):
        result = calculate_financial_impact_batch(self.what_if_df, prices_df=self.prices_df)
        a = result[result['item_id'] == 'A'].iloc[0]
        b = result[result['item_id'] == 'B'].iloc[0]
        self.assertEqual(a['Forecasted_Revenue'], 200.0)   # 100 × 2
        self.assertEqual(b['Forecasted_Revenue'], 600.0)   # 200 × 3

    def test_risk_calculation_vectorised(self):
        result = calculate_financial_impact_batch(self.what_if_df, prices_df=self.prices_df)
        a = result[result['item_id'] == 'A'].iloc[0]
        b = result[result['item_id'] == 'B'].iloc[0]
        self.assertEqual(a['Revenue_at_Risk'], 40.0)  # 20 × 2
        self.assertEqual(b['Revenue_at_Risk'], 0.0)   # 0 × 3

    def test_overstock_calculation_vectorised(self):
        result = calculate_financial_impact_batch(self.what_if_df, prices_df=self.prices_df)
        a = result[result['item_id'] == 'A'].iloc[0]
        b = result[result['item_id'] == 'B'].iloc[0]
        self.assertEqual(a['Overstock_Quantity'], 0.0)   # 80 < 110
        self.assertEqual(b['Overstock_Quantity'], 90.0)  # 300 − 210


# ====================================================================
# 2.  Extract unit prices from actual M5 clean_sales.csv
# ====================================================================
class TestExtractUnitPrices(unittest.TestCase):
    """Verify price extraction from the real M5 dataset."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(CLEAN_SALES_PATH):
            raise unittest.SkipTest('clean_sales.csv not found')
        cls.prices = extract_unit_prices(CLEAN_SALES_PATH)

    def test_returns_dataframe(self):
        self.assertIsInstance(self.prices, pd.DataFrame)

    def test_has_required_columns(self):
        self.assertIn('item_id', self.prices.columns)
        self.assertIn('unit_price', self.prices.columns)

    def test_no_missing_prices(self):
        self.assertEqual(self.prices['unit_price'].isna().sum(), 0)

    def test_prices_are_positive(self):
        self.assertTrue((self.prices['unit_price'] > 0).all())

    def test_known_product_price(self):
        """Spot-check: FOODS_3_697 should have price 3.0 per Colab output."""
        row = self.prices[self.prices['item_id'] == 'FOODS_3_697']
        self.assertEqual(len(row), 1)
        self.assertAlmostEqual(row.iloc[0]['unit_price'], 3.0, places=2)


# ====================================================================
# 3.  End-to-end validation against Colab financial_impact.csv
# ====================================================================
class TestColabValidation(unittest.TestCase):
    """
    Load actual Colab inventory_recommendations, run the full
    what_if → financial chain, and compare with Colab financial_impact.csv.
    """

    @classmethod
    def setUpClass(cls):
        inv_path = os.path.join(OUTPUTS_DIR, 'inventory', 'inventory_recommendations.csv')
        fin_path = os.path.join(OUTPUTS_DIR, 'financial', 'financial_impact.csv')

        if not os.path.exists(inv_path) or not os.path.exists(fin_path):
            raise unittest.SkipTest('Colab CSV outputs not found')

        # Run the full chain: inventory → what-if → financial
        inv_df = pd.read_csv(inv_path)
        what_if_df = analyze_scenarios_batch(inv_df)
        cls.pipeline_fin = calculate_financial_impact_batch(what_if_df)

        cls.colab_fin = pd.read_csv(fin_path)
        # Colab uses 'product_id', pipeline uses 'item_id'
        if 'product_id' in cls.colab_fin.columns and 'item_id' not in cls.colab_fin.columns:
            cls.colab_fin = cls.colab_fin.rename(columns={'product_id': 'item_id'})

    def test_row_count_matches(self):
        self.assertEqual(len(self.pipeline_fin), len(self.colab_fin))

    def test_forecasted_revenue_matches(self):
        merged = self._merge()
        diff = (merged['Forecasted_Revenue_pipe'] - merged['Forecasted_Revenue_colab']).abs()
        max_diff = diff.max()
        print(f"\n  Max Forecasted_Revenue difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.02)

    def test_revenue_at_risk_matches(self):
        merged = self._merge()
        diff = (merged['Revenue_at_Risk_pipe'] - merged['Revenue_at_Risk_colab']).abs()
        max_diff = diff.max()
        print(f"  Max Revenue_at_Risk difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.02)

    def test_unit_prices_match(self):
        merged = self._merge()
        diff = (merged['unit_price_pipe'] - merged['unit_price_colab']).abs()
        max_diff = diff.max()
        print(f"  Max unit_price difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.01)

    def test_overstock_quantity_matches(self):
        merged = self._merge()
        diff = (merged['Overstock_Quantity_pipe'] - merged['Overstock_Quantity_colab']).abs()
        max_diff = diff.max()
        print(f"  Max Overstock_Quantity difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.02)

    def test_overstock_holding_cost_matches(self):
        merged = self._merge()
        diff = (merged['Overstock_Holding_Cost_pipe'] - merged['Overstock_Holding_Cost_colab']).abs()
        max_diff = diff.max()
        print(f"  Max Overstock_Holding_Cost difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.01)

    # --- helper ---
    def _merge(self):
        return self.pipeline_fin.merge(
            self.colab_fin,
            on=['Scenario', 'item_id'],
            suffixes=('_pipe', '_colab'),
        )


# ====================================================================
if __name__ == '__main__':
    unittest.main(verbosity=2)
