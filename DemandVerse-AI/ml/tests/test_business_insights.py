"""
Unit + Validation tests for ml.insights.business_insights
=========================================================
Run with:  python -m ml.tests.test_business_insights   (from project root)
"""

import os
import sys
import unittest
import pandas as pd

# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.insights.business_insights import (
    _generate_reason,
    generate_product_insights,
)

class TestBusinessInsights(unittest.TestCase):
    
    def setUp(self):
        self.inventory_data = pd.DataFrame([
            {
                'item_id': 'FOODS_3_586',
                'store_id': 'CA_1',
                'selected_model': 'Prophet',
                'forecasted_demand': 1132.59,
                'inventory_status': 'STOCKOUT RISK',
                'reorder_quantity': 1051.35,
                'simulated_current_stock': 152.62,
                'required_stock': 1203.97
            },
            {
                'item_id': 'FOODS_3_252',
                'store_id': 'CA_1',
                'selected_model': 'Prophet',
                'forecasted_demand': 1070.80,
                'inventory_status': 'HEALTHY STOCK',
                'reorder_quantity': 803.35,
                'simulated_current_stock': 348.94,
                'required_stock': 1152.29
            },
            {
                'item_id': 'FOODS_3_389',
                'store_id': 'CA_1',
                'selected_model': 'Prophet',
                'forecasted_demand': 157.21,
                'inventory_status': 'OVERSTOCK',
                'reorder_quantity': 0.00,
                'simulated_current_stock': 220.87,
                'required_stock': 180.15
            }
        ])
        
        self.financial_data = pd.DataFrame([
            {
                'item_id': 'FOODS_3_586',
                'Scenario': 'Normal Demand',
                'Revenue_at_Risk': 1766.27
            },
            {
                'item_id': 'FOODS_3_252',
                'Scenario': 'Normal Demand',
                'Revenue_at_Risk': 1269.29
            },
            {
                'item_id': 'FOODS_3_389',
                'Scenario': 'Normal Demand',
                'Revenue_at_Risk': 0.00
            }
        ])

    def test_reason_generation_stockout(self):
        row = self.inventory_data.iloc[0].copy()
        row['Revenue_at_Risk'] = self.financial_data.iloc[0]['Revenue_at_Risk']
        reason = _generate_reason(row)
        self.assertIn("Critical deficit", reason)
        self.assertIn("152.6 units", reason)
        self.assertIn("1204.0 units", reason)
        self.assertIn("1051.3 units", reason)
        self.assertIn("$1766.27", reason)
        
    def test_reason_generation_overstock(self):
        row = self.inventory_data.iloc[2].copy()
        row['Revenue_at_Risk'] = self.financial_data.iloc[2]['Revenue_at_Risk']
        reason = _generate_reason(row)
        self.assertIn("Overallocated capital", reason)
        self.assertIn("220.9 units", reason)
        self.assertIn("180.2 units", reason)
        self.assertIn("Stop replenishment", reason)
        
    def test_reason_generation_healthy(self):
        row = self.inventory_data.iloc[1].copy()
        row['Revenue_at_Risk'] = self.financial_data.iloc[1]['Revenue_at_Risk']
        reason = _generate_reason(row)
        self.assertIn("Optimized balance", reason)
        
    def test_generate_product_insights_columns(self):
        insights = generate_product_insights(self.inventory_data, self.financial_data)
        expected_cols = [
            'Product', 'Store', 'Selected Model', '30-Day Forecast',
            'Inventory Status', 'Reorder Quantity', 'Potential Revenue at Risk', 'Reason'
        ]
        self.assertListEqual(list(insights.columns), expected_cols)
        
    def test_generate_product_insights_values(self):
        insights = generate_product_insights(self.inventory_data, self.financial_data)
        self.assertEqual(len(insights), 3)
        self.assertEqual(insights.iloc[0]['Product'], 'FOODS_3_586')
        self.assertEqual(insights.iloc[0]['Potential Revenue at Risk'], 1766.27)
        self.assertIn("Critical deficit", insights.iloc[0]['Reason'])

if __name__ == '__main__':
    unittest.main(verbosity=2)
