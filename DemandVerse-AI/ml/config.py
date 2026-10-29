import os

# Base paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUTPUTS_DIR = os.path.join(BASE_DIR, 'demandverse_ai_outputs')

# Store and product configuration
STORE_ID = 'CA_1'
FORECAST_HORIZON = 30
LEAD_TIME_DAYS = 7
Z_SCORE = 1.645
HOLDING_COST_RATE_MONTHLY = 0.0125

# Input files (assuming preprocessed data is available in the outputs directory)
CLEAN_SALES_PATH = os.path.join(OUTPUTS_DIR, 'data', 'clean_sales.csv')

# Output paths
PIPELINE_OUTPUTS_DIR = os.path.join(BASE_DIR, 'ml_pipeline_results')
