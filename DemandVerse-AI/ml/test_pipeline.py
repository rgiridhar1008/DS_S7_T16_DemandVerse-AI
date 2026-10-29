import os
import pandas as pd
from .pipeline import run_pipeline_for_product
from .config import OUTPUTS_DIR

def test_pipeline():
    print("Loading data...")
    clean_path = os.path.join(OUTPUTS_DIR, 'data', 'clean_sales.csv')
    clean_df = pd.read_csv(clean_path, parse_dates=['date'])
    
    # Generate train/test splits dynamically since they were not included in the outputs zip
    train_list = []
    test_list = []
    for item_id, group in clean_df.groupby('item_id'):
        group_sorted = group.sort_values('date').reset_index(drop=True)
        split_idx = int(len(group_sorted) * 0.8)
        train_list.append(group_sorted.iloc[:split_idx])
        test_list.append(group_sorted.iloc[split_idx:])
    
    train_df = pd.concat(train_list, ignore_index=True)
    test_df = pd.concat(test_list, ignore_index=True)

    # Test product from the colab outputs
    test_item = 'FOODS_3_586'
    
    # Fetch simulated current stock from colab outputs to match exact scenario testing
    inv_colab_df = pd.read_csv(os.path.join(OUTPUTS_DIR, 'inventory', 'inventory_recommendations.csv'))
    item_inv_colab = inv_colab_df[inv_colab_df['item_id'] == test_item].iloc[0]
    simulated_stock = item_inv_colab['simulated_current_stock']
    
    print(f"Running pipeline for {test_item}...")
    results = run_pipeline_for_product(test_item, train_df, test_df, clean_df, simulated_current_stock=simulated_stock)
    
    print("\n--- PIPELINE RESULTS VS COLAB OUTPUTS ---")
    
    # Compare Metrics (Colab saved all metrics in model_comparison.csv)
    model_comp = pd.read_csv(os.path.join(OUTPUTS_DIR, 'forecasts', 'model_comparison.csv'))
    m_colab = model_comp[model_comp['product_id'] == test_item].iloc[0]
    print(f"ARIMA MAE: Pipeline={results['arima_metrics']['MAE']}, Colab={m_colab['ARIMA_MAE']}")
    print(f"Prophet MAE: Pipeline={results['prophet_metrics']['MAE']}, Colab={m_colab['Prophet_MAE']}")
    
    # Model Selection
    print(f"Selected Model: Pipeline={results['selected_model']}, Colab={item_inv_colab['selected_model']}")
    
    # Inventory
    print(f"Forecasted Demand: Pipeline={results['inventory']['forecasted_demand']:.2f}, Colab={item_inv_colab['forecasted_demand']:.2f}")
    print(f"Required Stock: Pipeline={results['inventory']['required_stock']}, Colab={item_inv_colab['required_stock']}")
    print(f"Inventory Status: Pipeline={results['inventory']['inventory_status']}, Colab={item_inv_colab['inventory_status']}")

if __name__ == "__main__":
    test_pipeline()
