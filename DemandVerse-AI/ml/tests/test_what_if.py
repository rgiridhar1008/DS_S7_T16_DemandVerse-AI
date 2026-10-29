"""
Unit + Validation tests for ml.scenarios.what_if
=================================================
Run with:  python -m ml.tests.test_what_if   (from project root)
"""

import os
import sys
import unittest
import pandas as pd

# ---------------------------------------------------------------------------
# Ensure the project root is on sys.path so `ml.*` imports resolve when
# this file is executed directly as well as via `python -m`.
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.scenarios.what_if import (
    run_what_if_scenario,
    analyze_scenarios,
    analyze_scenarios_batch,
    SCENARIOS,
)


# ====================================================================
# 1.  Pure unit tests — deterministic arithmetic, no data files
# ====================================================================
class TestRunWhatIfScenario(unittest.TestCase):
    """Verify the core single-scenario calculation."""

    def test_normal_demand_matches_base(self):
        """factor=1.0 ⟹ scenario demand == base demand."""
        res = run_what_if_scenario(
            base_demand=100.0, safety_stock=10.0,
            current_stock=80.0, factor=1.00,
        )
        self.assertEqual(res['Scenario_Forecasted_Demand'], 100.0)
        self.assertEqual(res['Required_Stock'], 110.0)  # 100 + 10
        self.assertEqual(res['Shortage_Quantity'], 30.0)  # 110 - 80
        self.assertEqual(res['Reorder_Quantity'], 30.0)

    def test_low_demand_reduces_demand(self):
        """factor=0.90 ⟹ 10% lower scenario demand."""
        res = run_what_if_scenario(
            base_demand=200.0, safety_stock=20.0,
            current_stock=150.0, factor=0.90,
        )
        self.assertEqual(res['Scenario_Forecasted_Demand'], 180.0)  # 200*0.9
        self.assertEqual(res['Required_Stock'], 200.0)  # 180 + 20
        self.assertEqual(res['Shortage_Quantity'], 50.0)  # 200 - 150

    def test_high_demand_increases_demand(self):
        """factor=1.10 ⟹ 10% higher scenario demand."""
        res = run_what_if_scenario(
            base_demand=200.0, safety_stock=20.0,
            current_stock=300.0, factor=1.10,
        )
        self.assertEqual(res['Scenario_Forecasted_Demand'], 220.0)
        self.assertEqual(res['Required_Stock'], 240.0)
        # Current stock 300 > required 240 ⟹ no shortage
        self.assertEqual(res['Shortage_Quantity'], 0.0)
        self.assertEqual(res['Reorder_Quantity'], 0.0)

    def test_shortage_never_negative(self):
        """Shortage is clamped at 0 when current > required."""
        res = run_what_if_scenario(
            base_demand=50.0, safety_stock=5.0,
            current_stock=999.0, factor=1.10,
        )
        self.assertEqual(res['Shortage_Quantity'], 0.0)
        self.assertEqual(res['Reorder_Quantity'], 0.0)

    def test_zero_base_demand(self):
        """Edge case: base demand is zero."""
        res = run_what_if_scenario(
            base_demand=0.0, safety_stock=10.0,
            current_stock=5.0, factor=1.10,
        )
        self.assertEqual(res['Scenario_Forecasted_Demand'], 0.0)
        self.assertEqual(res['Required_Stock'], 10.0)
        self.assertEqual(res['Shortage_Quantity'], 5.0)

    def test_reorder_equals_shortage(self):
        """Reorder quantity always equals shortage quantity."""
        for factor in [0.90, 1.00, 1.10]:
            res = run_what_if_scenario(100.0, 15.0, 70.0, factor)
            self.assertEqual(res['Reorder_Quantity'], res['Shortage_Quantity'])

    def test_output_keys(self):
        """All expected keys are present in the result."""
        expected_keys = {
            'Scenario_Forecasted_Demand', 'Safety_Stock',
            'Current_Simulated_Stock', 'Required_Stock',
            'Shortage_Quantity', 'Reorder_Quantity',
        }
        res = run_what_if_scenario(100.0, 10.0, 50.0, 1.0)
        self.assertEqual(set(res.keys()), expected_keys)

    def test_safety_stock_and_current_passed_through(self):
        """Safety stock and current stock appear unchanged in the output."""
        res = run_what_if_scenario(100.0, 17.5, 42.3, 1.0)
        self.assertEqual(res['Safety_Stock'], 17.5)
        self.assertEqual(res['Current_Simulated_Stock'], 42.3)


class TestAnalyzeScenarios(unittest.TestCase):
    """Verify the per-product three-scenario wrapper."""

    def setUp(self):
        self.inventory_row = {
            'forecasted_demand': 500.0,
            'safety_stock': 30.0,
            'simulated_current_stock': 200.0,
        }

    def test_returns_three_scenarios(self):
        results = analyze_scenarios(self.inventory_row)
        self.assertEqual(len(results), 3)

    def test_scenario_names_present(self):
        results = analyze_scenarios(self.inventory_row)
        names = [r['Scenario'] for r in results]
        self.assertIn('Low Demand (-10%)', names)
        self.assertIn('Normal Demand', names)
        self.assertIn('High Demand (+10%)', names)

    def test_base_demand_carried_through(self):
        results = analyze_scenarios(self.inventory_row)
        for r in results:
            self.assertEqual(r['Base_Forecasted_Demand'], 500.0)

    def test_normal_scenario_matches_base(self):
        results = analyze_scenarios(self.inventory_row)
        normal = [r for r in results if r['Scenario'] == 'Normal Demand'][0]
        self.assertEqual(normal['Scenario_Forecasted_Demand'], 500.0)

    def test_low_less_than_normal_less_than_high(self):
        results = analyze_scenarios(self.inventory_row)
        by_name = {r['Scenario']: r for r in results}
        self.assertLess(
            by_name['Low Demand (-10%)']['Scenario_Forecasted_Demand'],
            by_name['Normal Demand']['Scenario_Forecasted_Demand'],
        )
        self.assertLess(
            by_name['Normal Demand']['Scenario_Forecasted_Demand'],
            by_name['High Demand (+10%)']['Scenario_Forecasted_Demand'],
        )


class TestAnalyzeScenariosBatch(unittest.TestCase):
    """Verify the DataFrame-level batch function."""

    def setUp(self):
        self.inv_df = pd.DataFrame([
            {'item_id': 'P1', 'store_id': 'S1', 'selected_model': 'ARIMA',
             'forecasted_demand': 100.0, 'safety_stock': 10.0,
             'simulated_current_stock': 80.0},
            {'item_id': 'P2', 'store_id': 'S1', 'selected_model': 'Prophet',
             'forecasted_demand': 200.0, 'safety_stock': 20.0,
             'simulated_current_stock': 300.0},
        ])

    def test_output_row_count(self):
        """2 products × 3 scenarios = 6 rows."""
        result = analyze_scenarios_batch(self.inv_df)
        self.assertEqual(len(result), 6)

    def test_output_columns(self):
        result = analyze_scenarios_batch(self.inv_df)
        expected_cols = [
            'Scenario', 'item_id', 'store_id', 'selected_model',
            'Base_Forecasted_Demand', 'Scenario_Forecasted_Demand',
            'Safety_Stock', 'Current_Simulated_Stock', 'Required_Stock',
            'Shortage_Quantity', 'Reorder_Quantity',
        ]
        self.assertListEqual(list(result.columns), expected_cols)

    def test_overstock_product_has_no_shortage_on_low(self):
        """P2 has current=300 which exceeds required in all scenarios."""
        result = analyze_scenarios_batch(self.inv_df)
        p2_low = result[
            (result['item_id'] == 'P2') &
            (result['Scenario'] == 'Low Demand (-10%)')
        ].iloc[0]
        self.assertEqual(p2_low['Shortage_Quantity'], 0.0)


# ====================================================================
# 2.  Validation against Colab outputs
# ====================================================================
class TestColabValidation(unittest.TestCase):
    """
    Load the actual Colab inventory_recommendations.csv, feed it through
    analyze_scenarios_batch, and compare row-by-row with the Colab
    what_if_analysis.csv.
    """

    @classmethod
    def setUpClass(cls):
        outputs = os.path.join(PROJECT_ROOT, 'demandverse_ai_outputs')
        inv_path = os.path.join(outputs, 'inventory', 'inventory_recommendations.csv')
        wif_path = os.path.join(outputs, 'financial', 'what_if_analysis.csv')

        if not os.path.exists(inv_path) or not os.path.exists(wif_path):
            raise unittest.SkipTest('Colab output CSVs not found — skipping validation')

        cls.inv_df = pd.read_csv(inv_path)
        cls.colab_wif = pd.read_csv(wif_path)
        cls.pipeline_wif = analyze_scenarios_batch(cls.inv_df)

    def test_row_count_matches(self):
        self.assertEqual(len(self.pipeline_wif), len(self.colab_wif))

    def test_scenario_demand_matches(self):
        """Scenario_Forecasted_Demand should match within rounding tolerance."""
        merged = self._merge()
        diff = (merged['Scenario_Forecasted_Demand_pipe'] - merged['Scenario_Forecasted_Demand_colab']).abs()
        max_diff = diff.max()
        print(f"\n  Max Scenario_Forecasted_Demand difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.02, f"Max diff {max_diff} exceeds 0.02")

    def test_required_stock_matches(self):
        merged = self._merge()
        diff = (merged['Required_Stock_pipe'] - merged['Required_Stock_colab']).abs()
        max_diff = diff.max()
        print(f"  Max Required_Stock difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.02)

    def test_shortage_matches(self):
        merged = self._merge()
        diff = (merged['Shortage_Quantity_pipe'] - merged['Shortage_Quantity_colab']).abs()
        max_diff = diff.max()
        print(f"  Max Shortage_Quantity difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.02)

    def test_reorder_matches(self):
        merged = self._merge()
        diff = (merged['Reorder_Quantity_pipe'] - merged['Reorder_Quantity_colab']).abs()
        max_diff = diff.max()
        print(f"  Max Reorder_Quantity difference: {max_diff:.4f}")
        self.assertLessEqual(max_diff, 0.02)

    # --- helper ---
    def _merge(self):
        pipe = self.pipeline_wif.copy()
        colab = self.colab_wif.copy()
        merged = pipe.merge(
            colab,
            on=['Scenario', 'item_id'],
            suffixes=('_pipe', '_colab'),
        )
        return merged


# ====================================================================
if __name__ == '__main__':
    unittest.main(verbosity=2)
