

# --- CELL 1 ---
import os
import sys

# 1. Check Python version
print("=== Python Version ===")
print(sys.version)
print()

# 2. Check RAM & Storage (using standard shell tools via python)
print("=== System Resources ===")
try:
    # Get RAM info
    with open('/proc/meminfo', 'r') as f:
        mem_lines = f.readlines()[:3]
        for line in mem_lines:
            print(line.strip())
except Exception as e:
    print(f"Could not retrieve memory info: {e}")

try:
    # Get Disk info
    stat = os.statvfs('/')
    free_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)
    total_gb = (stat.f_blocks * stat.f_frsize) / (1024**3)
    print(f"Disk Space: {free_gb:.2f} GB free of {total_gb:.2f} GB total")
except Exception as e:
    print(f"Could not retrieve disk info: {e}")
print()

# 3 & 4. List and calculate sizes of files in working directory
print("=== Uploaded M5 Dataset Files ===")
working_dir = '/content'
expected_files = [
    'sales_train_validation.csv',
    'calendar.csv',
    'sell_prices.csv',
    'sales_train_evaluation.csv',
    'sample_submission.csv'
]

detected_files = {}
all_items = os.listdir(working_dir)

for item in all_items:
    item_path = os.path.join(working_dir, item)
    if os.path.isfile(item_path):
        size_bytes = os.path.getsize(item_path)
        size_mb = size_bytes / (1024 * 1024)
        detected_files[item] = size_mb
        print(f"File: {item} | Size: {size_mb:.2f} MB")
print()

# 5. Check presence of expected files
print("=== Target File Verification ===")
verification_results = {}
for file in expected_files:
    is_present = file in detected_files
    verification_results[file] = is_present
    print(f"- {file}: {'DETECTED' if is_present else 'MISSING'}")
print()

# 6. Verify if it corresponds to the official M5 dataset
is_official_m5 = all(verification_results.values())
print(f"Official Walmart M5 dataset signature match: {is_official_m5}")

# --- CELL 4 ---
import pandas as pd
import numpy as np

print("=== Loading Datasets with Memory Optimization ===")

# 1. Optimize data types for calendar.csv
calendar_dtypes = {
    'wm_yr_wk': 'int16',
    'wday': 'int8',
    'month': 'int8',
    'year': 'int16',
    'snap_CA': 'int8',
    'snap_TX': 'int8',
    'snap_WI': 'int8'
}
calendar_df = pd.read_csv('/content/calendar.csv', dtype=calendar_dtypes, parse_dates=['date'])
print(f"Loaded calendar.csv successfully. Shape: {calendar_df.shape}")

# 2. Optimize data types for sales_train_validation.csv
# Most columns are daily counts (d_1 to d_1913) which fit easily in int16
sales_dtypes = {
    'id': 'category',
    'item_id': 'category',
    'dept_id': 'category',
    'cat_id': 'category',
    'store_id': 'category',
    'state_id': 'category'
}
for i in range(1, 1914):
    sales_dtypes[f'd_{i}'] = 'int16'

sales_df = pd.read_csv('/content/sales_train_validation.csv', dtype=sales_dtypes)
print(f"Loaded sales_train_validation.csv successfully. Shape: {sales_df.shape}")

# 3. Optimize data types for sell_prices.csv
prices_dtypes = {
    'store_id': 'category',
    'item_id': 'category',
    'wm_yr_wk': 'int16',
    'sell_price': 'float32'
}
sell_prices_df = pd.read_csv('/content/sell_prices.csv', dtype=prices_dtypes)
print(f"Loaded sell_prices.csv successfully. Shape: {sell_prices_df.shape}")

# --- CELL 5 ---
# Helper function to validate DataFrame properties
def validate_dataframe(df, name):
    print(f"\n{'='*15} Validation for: {name} {'='*15}")
    print(f"Number of Rows: {df.shape[0]:,}")
    print(f"Number of Columns: {df.shape[1]:,}")

    # Dtypes & Missing values
    missing_count = df.isnull().sum().sum()
    print(f"Total Missing Values: {missing_count} ({ (missing_count/df.size)*100:.2f}% of total cells)")

    # Check duplicate records
    duplicate_count = df.duplicated().sum()
    print(f"Duplicate Records: {duplicate_count}")

    print("\nFirst 5 Rows:")
    display(df.head())

    print("\nData Types Summary (First 15 Columns):")
    display(df.dtypes.head(15))

# Run validation on each of the loaded tables
validate_dataframe(calendar_df, "Calendar DataFrame")
validate_dataframe(sales_df, "Sales Train Validation DataFrame")
validate_dataframe(sell_prices_df, "Sell Prices DataFrame")

# --- CELL 6 ---
print("=== Analytical Profile of M5 Dataset ===")

# Extracting distinct elements from sales dataset
unique_products = sales_df['item_id'].nunique()
unique_stores = sales_df['store_id'].nunique()
unique_departments = sales_df['dept_id'].nunique()
unique_categories = sales_df['cat_id'].nunique()
unique_states = sales_df['state_id'].nunique()

# Extracting temporal range
min_date = calendar_df['date'].min().strftime('%Y-%m-%d')
max_date = calendar_df['date'].max().strftime('%Y-%m-%d')
total_days = calendar_df['date'].nunique()

print(f"- Unique Products (item_id): {unique_products:,}")
print(f"- Unique Stores (store_id): {unique_stores}")
print(f"- Unique Departments (dept_id): {unique_departments}")
print(f"- Unique Categories (cat_id): {unique_categories}")
print(f"- Unique States (state_id): {unique_states}")
print(f"- Temporal Coverage: {min_date} to {max_date} ({total_days} total days)")

# --- CELL 7 ---
print("=== Missing or Unusual Values Check ===")

# 1. Investigate missing values specifically in Calendar
cal_missing = calendar_df.isnull().sum()
print("Missing values per column in Calendar:")
print(cal_missing[cal_missing > 0])
print()

# 2. Check sell prices statistics
print("Sell Price Statistics:")
display(sell_prices_df['sell_price'].describe())

# 3. Check for negative prices or zero prices
anomalous_prices = (sell_prices_df['sell_price'] <= 0).sum()
print(f"Anomalous prices (<= 0): {anomalous_prices}")

# --- CELL 10 ---
# Configuration Variables
SELECTED_STORE = 'CA_1'
NUMBER_OF_PRODUCTS = 15
FORECAST_HORIZON = 30

# --- CELL 11 ---
print(f"Analyzing products within store: {SELECTED_STORE}...")

# 1. Filter sales dataset for the selected store
store_sales = sales_df[sales_df['store_id'] == SELECTED_STORE].copy()

# Calculate activity statistics for each product to find non-sparse series
d_cols = [f'd_{i}' for i in range(1, 1914)]

# Convert to numpy for extremely fast row-wise operations
sales_matrix = store_sales[d_cols].values

# Calculate metrics per product series
total_sales_per_item = sales_matrix.sum(axis=1)
non_zero_days_per_item = (sales_matrix > 0).sum(axis=1)

# Attach metrics to our temporary tracking DataFrame
store_sales['total_sales'] = total_sales_per_item
store_sales['non_zero_days'] = non_zero_days_per_item
store_sales['avg_daily_sales'] = store_sales['total_sales'] / len(d_cols)

# 2. Select top active products (ranking by non-zero days to ensure a continuous sales signal)
top_active_products = store_sales.sort_values(by='non_zero_days', ascending=False).head(NUMBER_OF_PRODUCTS)

# 3. Create our active subset
selected_product_ids = top_active_products['item_id'].tolist()
subset_sales_df = store_sales[store_sales['item_id'].isin(selected_product_ids)].copy()

print(f"Successfully selected {len(subset_sales_df)} products from {SELECTED_STORE}.")

# --- CELL 12 ---
print("=== Selected Products Catalog Info ===")
catalog_columns = ['item_id', 'dept_id', 'cat_id', 'store_id', 'state_id']
display(subset_sales_df[catalog_columns])

# --- CELL 13 ---
print("=== Selected Products Historical Sales Statistics ===")

# Compute row-level descriptive statistics on the historical sales days
stats_list = []
for idx, row in subset_sales_df.iterrows():
    item_sales = row[d_cols].values.astype(int)
    stats_list.append({
        'item_id': row['item_id'],
        'total_sales': item_sales.sum(),
        'avg_daily_sales': round(item_sales.mean(), 4),
        'non_zero_days': (item_sales > 0).sum(),
        'min_sales': item_sales.min(),
        'max_sales': item_sales.max()
    })

stats_df = pd.DataFrame(stats_list)
display(stats_df)

# --- CELL 16 ---
print("=== Step 1: Reshaping Sales Data (Wide to Long) ===")

# Identify ID variables versus daily count variables
id_vars = ['id', 'item_id', 'dept_id', 'cat_id', 'store_id', 'state_id']

# Melt the wide DataFrame into a tidy long format
sales_long_df = pd.melt(
    subset_sales_df,
    id_vars=id_vars,
    value_vars=d_cols,
    var_name='d',
    value_name='sales'
)

# Downcast 'sales' immediately to save RAM
sales_long_df['sales'] = sales_long_df['sales'].astype('int16')
sales_long_df['d'] = sales_long_df['d'].astype('category')

print(f"Reshaped shape: {sales_long_df.shape}")
display(sales_long_df.head())

# --- CELL 17 ---
print("=== Step 2: Merging Calendar Dataset ===")

# Keep only useful calendar fields
calendar_cols_to_keep = [
    'date', 'd', 'weekday', 'month', 'year', 'wm_yr_wk',
    'event_name_1', 'event_name_2', 'snap_CA', 'snap_TX', 'snap_WI'
]
calendar_subset_df = calendar_df[calendar_cols_to_keep].copy()

# Set datatypes for join efficiency
calendar_subset_df['d'] = calendar_subset_df['d'].astype('category')

# Merge onto the long sales dataframe
sales_merged_df = pd.merge(sales_long_df, calendar_subset_df, on='d', how='left')
print(f"Merged with calendar. Shape: {sales_merged_df.shape}")

# --- CELL 18 ---
print("=== Step 3: Merging Sell Prices ===")

# Merge prices using natural composite keys: store_id, item_id, and wm_yr_wk
sales_enriched_df = pd.merge(
    sales_merged_df,
    sell_prices_df,
    on=['store_id', 'item_id', 'wm_yr_wk'],
    how='left'
)

print(f"Enriched with prices. Shape: {sales_enriched_df.shape}")

# --- CELL 19 ---
print("=== Step 4 & 5: Cleaning, Missing Value & Duplicate Audits ===")

# Check for duplicate records
duplicates = sales_enriched_df.duplicated(subset=['date', 'store_id', 'item_id']).sum()
print(f"Duplicate records based on primary composite keys: {duplicates}")
if duplicates > 0:
    sales_enriched_df = sales_enriched_df.drop_duplicates(subset=['date', 'store_id', 'item_id'])

# Check for invalid/negative sales values
negative_sales = (sales_enriched_df['sales'] < 0).sum()
print(f"Anomalous negative sales found: {negative_sales}")

# Missing value summary
print("\nMissing values count per column:")
print(sales_enriched_df.isnull().sum())

# --- CELL 20 ---
print("=== Step 6: Final Missing Value Preprocessing Decisions ===")

# 1. Fill missing event names with 'None' (meaning no promotional event occurred on that day)
sales_enriched_df['event_name_1'] = sales_enriched_df['event_name_1'].fillna('None').astype('category')
sales_enriched_df['event_name_2'] = sales_enriched_df['event_name_2'].fillna('None').astype('category')

# 2. For items with missing price (since pricing is recorded only when active on shelves), fill with mean item price
sales_enriched_df['sell_price'] = sales_enriched_df.groupby('item_id')['sell_price'].transform(lambda x: x.fillna(x.mean()))

# Confirm cleanup
print("Post-cleanup missing values:")
print(sales_enriched_df.isnull().sum())
print(f"Final clean shape: {sales_enriched_df.shape}")

# --- CELL 21 ---
print("=== Step 7: Saving the Cleaned Dataset ===")

# Drop helper column 'd'
final_df = sales_enriched_df.drop(columns=['d'])

# Save to working directory
output_filename = '/content/clean_sales.csv'
final_df.to_csv(output_filename, index=False)
print(f"Successfully saved clean dataset to: {output_filename}")

# --- CELL 24 ---
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Set plotting styling
sns.set_theme(style="whitegrid")
plt.rcParams["figure.figsize"] = (12, 6)

# Load the clean dataset
df = pd.read_csv('/content/clean_sales.csv', parse_dates=['date'])
print(f"Loaded dataset for analysis. Shape: {df.shape}")

# --- CELL 25 ---
print("=== Overall Global Metrics for Store CA_1 (Subset) ===")
overall_stats = df['sales'].describe()
display(overall_stats)

total_units_sold = df['sales'].sum()
print(f"Total units sold across all selected products: {total_units_sold:,} units")

# --- CELL 26 ---
print("=== Product-Wise Sales Performance Rankings ===")

product_perf = df.groupby('item_id').agg(
    total_sales=('sales', 'sum'),
    avg_daily_sales=('sales', 'mean'),
    max_daily_sales=('sales', 'max'),
    std_dev=('sales', 'std')
).reset_index().sort_values(by='total_sales', ascending=False)

display(product_perf)

# Identify top and bottom performers
top_3 = product_perf.head(3)['item_id'].tolist()
bottom_3 = product_perf.tail(3)['item_id'].tolist()

print(f"Top-performing products: {top_3}")
print(f"Bottom-performing products: {bottom_3}")

# --- CELL 27 ---
print("=== Temporal Analysis (Weekly & Monthly Seasonality) ===")

# Extract temporal categories
df['day_of_week'] = df['date'].dt.day_name()
df['month_name'] = df['date'].dt.strftime('%B')

# Weekly patterns
weekly_pattern = df.groupby('day_of_week')['sales'].mean().reindex([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
])
print("\nAverage Sales by Day of Week:")
print(weekly_pattern)

# Monthly patterns
monthly_pattern = df.groupby('month_name')['sales'].mean().reindex([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
])
print("\nAverage Sales by Month:")
print(monthly_pattern)

# --- CELL 28 ---
print("=== Promotional & Event Analysis ===")

# 1. Compare standard days with promotional Event days dynamically
# This avoids ValueError if only one type of day is present in our subset
event_effect = df.groupby(df['event_name_1'] != 'None')['sales'].mean()
event_effect.index = event_effect.index.map({False: 'Regular Day', True: 'Event Day'})
print("Average sales on Event Days vs Regular Days:")
print(event_effect)

# 2. Analyze SNAP program impact for California (Store CA_1 is in California)
snap_effect = df.groupby('snap_CA')['sales'].mean()
snap_effect.index = snap_effect.index.map({0: 'No SNAP Benefits', 1: 'SNAP Benefits Days'})
print("\nAverage sales during SNAP benefits window vs non-SNAP:")
print(snap_effect)

# --- CELL 29 ---
print("=== Visualizing Historical Sales Trends ===")

# Plot daily aggregated sales over time to verify overall growth/trend
daily_sales = df.groupby('date')['sales'].sum()

plt.figure(figsize=(14, 5))
plt.plot(daily_sales.index, daily_sales.values, label='Daily Aggregate Sales', alpha=0.6, color='blue')
plt.plot(daily_sales.rolling(window=30).mean().index, daily_sales.rolling(window=30).mean().values,
         label='30-Day Moving Average', color='red', linewidth=2)
plt.title('Overall Sales Trend for Selected Products in Store CA_1')
plt.xlabel('Date')
plt.ylabel('Units Sold')
plt.legend()
plt.show()

# --- CELL 32 ---
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# Configure visual standards
sns.set_theme(style="whitegrid")
plt.rcParams["figure.figsize"] = (12, 6)
plt.rcParams["font.size"] = 11

# Ensure dataset is cleanly loaded
df = pd.read_csv('/content/clean_sales.csv', parse_dates=['date'])
print(f"Dataset verified for visual generation. Record count: {len(df):,}")

# --- CELL 34 ---
# Aggregate daily sales
daily_sales = df.groupby('date')['sales'].sum().reset_index()
daily_sales['rolling_30'] = daily_sales['sales'].rolling(window=30, min_periods=1).mean()

fig = go.Figure()
fig.add_trace(go.Scatter(x=daily_sales['date'], y=daily_sales['sales'], mode='lines',
                         name='Daily Actual Sales', opacity=0.4, line=dict(color='#1f77b4')))
fig.add_trace(go.Scatter(x=daily_sales['date'], y=daily_sales['rolling_30'], mode='lines',
                         name='30-Day Moving Average', line=dict(color='#d62728', width=2)))

fig.update_layout(
    title="<b>Overall Daily Sales Trend & Smooth Velocity</b><br><sup>Subset representing top CA_1 active products</sup>",
    xaxis_title="Timeline",
    yaxis_title="Total Units Sold",
    legend_title="Metrics",
    hovermode="x unified",
    template="plotly_white"
)
fig.show()

# --- CELL 36 ---
# Prepare monthly aggregated product sales
df['year_month'] = df['date'].dt.to_period('M').astype(str)
monthly_product_sales = df.groupby(['year_month', 'item_id'])['sales'].sum().reset_index()

fig_monthly = px.bar(
    monthly_product_sales,
    x='year_month',
    y='sales',
    color='item_id',
    title="<b>Monthly Sales Trend & Product Portfolio Contribution</b>",
    labels={'year_month': 'Calendar Month', 'sales': 'Units Sold', 'item_id': 'Product ID'},
    template="plotly_white"
)
fig_monthly.update_layout(barmode='stack', xaxis={'categoryorder':'category ascending'})
fig_monthly.show()

# --- CELL 38 ---
product_totals = df.groupby('item_id')['sales'].sum().reset_index().sort_values(by='sales', ascending=False)

fig_ranks = px.bar(
    product_totals,
    x='sales',
    y='item_id',
    orientation='h',
    color='sales',
    color_continuous_scale='Viridis',
    title="<b>Total Product-Wise Sales Performance Rankings</b>",
    labels={'sales': 'Cumulative Units Sold', 'item_id': 'Product SKU'},
    template="plotly_white"
)
fig_ranks.update_layout(yaxis={'categoryorder':'total ascending'}, coloraxis_showscale=False)
fig_ranks.show()

# --- CELL 40 ---
# Re-extract datetime parts to ensure they are available in the reloaded dataframe
df['day_of_week'] = df['date'].dt.day_name()
df['month_name'] = df['date'].dt.strftime('%B')

# Ensure ordering
order_weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
order_months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

fig, axes = plt.subplots(1, 2, figsize=(20, 7))

# Weekday demand pattern
sns.boxplot(data=df, x='day_of_week', y='sales', order=order_weekdays, ax=axes[0], hue='day_of_week', legend=False, palette='Blues')
axes[0].set_title('Sales Distribution by Day of Week', fontsize=14, fontweight='bold')
axes[0].set_xlabel('Day of Week')
axes[0].set_ylabel('Daily Units Sold per Item')
axes[0].tick_params(axis='x', rotation=30)

# Monthly seasonality pattern
sns.boxplot(data=df, x='month_name', y='sales', order=order_months, ax=axes[1], hue='month_name', legend=False, palette='Oranges')
axes[1].set_title('Sales Distribution by Calendar Month', fontsize=14, fontweight='bold')
axes[1].set_xlabel('Month')
axes[1].set_ylabel('Daily Units Sold per Item')
axes[1].tick_params(axis='x', rotation=45)

plt.tight_layout()
plt.show()

# --- CELL 42 ---
# 1. Compute average daily sales grouped by Month and Day of Week
pivot_df = df.groupby(['month_name', 'day_of_week'])['sales'].mean().reset_index()

# 2. Pivot the table for the heatmap configuration
pivot_table = pivot_df.pivot(index='month_name', columns='day_of_week', values='sales')

# 3. Sort indices to ensure chronological order on both axes
order_weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
order_months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
pivot_table = pivot_table.reindex(index=order_months, columns=order_weekdays)

# 4. Render using Seaborn
plt.figure(figsize=(12, 8))
sns.heatmap(
    pivot_table,
    annot=True,
    fmt=".2f",
    cmap="YlOrRd",
    linewidths=0.5,
    cbar_kws={'label': 'Average Units Sold per Day'}
)
plt.title("Demand Density Matrix: Month vs. Day-of-Week Sales", fontsize=14, fontweight='bold')
plt.xlabel("Day of Week")
plt.ylabel("Month")
plt.tight_layout()
plt.show()

# --- CELL 44 ---
fig, axes = plt.subplots(1, 2, figsize=(20, 6))

# Standard Density
sns.histplot(df['sales'], kde=True, ax=axes[0], color='teal', bins=30)
axes[0].set_title('Daily Unit Sales Distribution', fontsize=14, fontweight='bold')
axes[0].set_xlabel('Units Sold')
axes[0].set_ylabel('Frequency')

# Log-transformed Density (adding 1 to handle potential zeros)
sns.histplot(np.log1p(df['sales']), kde=True, ax=axes[1], color='indigo', bins=30)
axes[1].set_title('Log-Transformed Daily Sales [log(x + 1)]', fontsize=14, fontweight='bold')
axes[1].set_xlabel('Log Units')
axes[1].set_ylabel('Frequency')

plt.tight_layout()
plt.show()

# --- CELL 46 ---
target_items = ['FOODS_3_586', 'FOODS_3_252', 'FOODS_3_477']
filtered_subset = df[df['item_id'].isin(target_items)].copy()

fig_timelines = px.line(
    filtered_subset,
    x='date',
    y='sales',
    color='item_id',
    facet_col='item_id',
    facet_col_wrap=1,
    title="<b>Historical Timelines of Key High- and Low-Performing Products</b>",
    labels={'date': 'Timeline', 'sales': 'Daily Units Sold', 'item_id': 'Product'},
    template="plotly_white"
)
fig_timelines.update_yaxes(matches=None)
fig_timelines.show()

# --- CELL 48 ---
# Calculate mean daily sales across price points for each product
price_elasticity = df.groupby(['item_id', 'sell_price'])['sales'].mean().reset_index()

fig_elasticity = px.scatter(
    price_elasticity,
    x='sell_price',
    y='sales',
    color='item_id',
    size='sales',
    title="<b>Average Units Sold vs. Item Retail Price Points</b>",
    labels={'sell_price': 'Retail Sell Price ($)', 'sales': 'Avg Daily Units Sold', 'item_id': 'Product'},
    template="plotly_white"
)
fig_elasticity.show()

# --- CELL 50 ---
fig, axes = plt.subplots(1, 2, figsize=(20, 6))

# 1. SNAP CA Welfare Benefits lift
sns.barplot(data=df, x='snap_CA', y='sales', ax=axes[0], errorbar=None, palette='Set2')
axes[0].set_title('Welfare Impact: Average Sales with California SNAP', fontsize=14, fontweight='bold')
axes[0].set_xticklabels(['No SNAP Benefits', 'Active SNAP Benefit Window'])
axes[0].set_ylabel('Average Units Sold')
axes[0].set_xlabel('')

# 2. Top Events impact
event_sales = df[df['event_name_1'] != 'None'].groupby('event_name_1')['sales'].mean().reset_index()
top_events = event_sales.sort_values(by='sales', ascending=False).head(10)

sns.barplot(data=top_events, x='sales', y='event_name_1', ax=axes[1], palette='coolwarm')
axes[1].set_title('Top 10 Calendar Event Impact on Mean Sales', fontsize=14, fontweight='bold')
axes[1].set_xlabel('Average Units Sold')
axes[1].set_ylabel('Event Name')

plt.tight_layout()
plt.show()

# --- CELL 52 ---
import pandas as pd
import numpy as np

print("=== Starting Phase 6: Feature Engineering ===")

# 1. Load our cleaned dataset
feature_df = pd.read_csv('/content/clean_sales.csv', parse_dates=['date'])

# Sort chronologically by product and date to guarantee correct lag calculations
feature_df = feature_df.sort_values(by=['item_id', 'date']).reset_index(drop=True)

# ==========================================
# A. Calendar & Temporal Features
# ==========================================
print("Generating Calendar Features...")
feature_df['day'] = feature_df['date'].dt.day.astype('int8')
feature_df['month'] = feature_df['date'].dt.month.astype('int8')
feature_df['year'] = feature_df['date'].dt.year.astype('int16')
feature_df['weekday'] = feature_df['date'].dt.dayofweek.astype('int8')
feature_df['week_number'] = feature_df['date'].dt.isocalendar().week.astype('int8')
feature_df['is_weekend'] = feature_df['weekday'].isin([5, 6]).astype('int8')

# ==========================================
# B. Autoregressive (Lag) Features
# ==========================================
# We group by item_id so that lags do not spill over from one product into another
print("Generating Autoregressive Lag Features...")
for lag in [1, 7, 14, 28]:
    feature_df[f'lag_{lag}'] = feature_df.groupby('item_id')['sales'].shift(lag).astype('float32')

# ==========================================
# C. Rolling Statistics Features
# ==========================================
# To avoid data leakage, rolling means MUST be calculated on shifted sales (using lag_1 as the anchor)
# This ensures that at any time step T, the rolling window only looks at observations from T-1 and prior.
print("Generating Rolling Statistics Features (Shifted to Avoid Leakage)...")
feature_df['rolling_mean_7'] = feature_df.groupby('item_id')['sales'].transform(lambda x: x.shift(1).rolling(window=7).mean()).astype('float32')
feature_df['rolling_mean_28'] = feature_df.groupby('item_id')['sales'].transform(lambda x: x.shift(1).rolling(window=28).mean()).astype('float32')

# ==========================================
# D. Events & Pricing Features
# ==========================================
print("Structuring Promotional and Pricing features...")
# Convert event presence to a binary indicator (1 if an event exists, 0 otherwise)
feature_df['is_event_day'] = (feature_df['event_name_1'] != 'None').astype('int8')

# Keep existing SNAP and pricing columns, confirming types
feature_df['snap_CA'] = feature_df['snap_CA'].astype('int8')
feature_df['sell_price'] = feature_df['sell_price'].astype('float32')

# ==========================================
# E. Handle Missing Values created by Lags/Rolling windows
# ==========================================
print("\n--- Auditing Missing Values Generated by Lags/Rolling Windows ---")
lag_rolling_cols = ['lag_1', 'lag_7', 'lag_14', 'lag_28', 'rolling_mean_7', 'rolling_mean_28']
missing_counts = feature_df[lag_rolling_cols].isnull().sum()
print("Missing counts in newly engineered features:")
print(missing_counts)

# Fill NaNs in lag/rolling features with the historical mean of that specific item
# This retains baseline structure without dropping rows or causing sequence misalignment
for col in lag_rolling_cols:
    feature_df[col] = feature_df.groupby('item_id')[col].transform(lambda x: x.fillna(x.mean()))

# Double check cleanup
remaining_missing = feature_df[lag_rolling_cols].isnull().sum().sum()
print(f"\nRemaining missing values post-imputation: {remaining_missing}")

# ==========================================
# F. Save and Display
# ==========================================
output_feature_path = '/content/featured_sales.csv'
feature_df.to_csv(output_feature_path, index=False)
print(f"Enriched dataset successfully saved to: {output_feature_path}")

print("\n=== Enriched Feature Dataset Preview ===")
display(feature_df.head(10))

# --- CELL 54 ---
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

print("=== Starting Phase 7: Time-Series Train/Test Split ===\n")

# 1. Load our engineered feature dataset
feat_df = pd.read_csv('/content/featured_sales.csv', parse_dates=['date'])

# 2. Define the split function
def chronological_train_test_split(df, train_ratio=0.8):
    """
    Performs a strict chronological, group-by-product train/test split.
    """
    train_list = []
    test_list = []

    # Store temporal metadata per item for inspection
    split_metadata = []

    # Group by product to split each series independently
    for item_id, group in df.groupby('item_id'):
        # Ensure sorting chronologically
        group_sorted = group.sort_values('date').reset_index(drop=True)

        # Compute split index
        n_obs = len(group_sorted)
        split_idx = int(n_obs * train_ratio)

        # Slice data chronologically
        train_sub = group_sorted.iloc[:split_idx]
        test_sub = group_sorted.iloc[split_idx:]

        train_list.append(train_sub)
        test_list.append(test_sub)

        # Append metadata info
        split_metadata.append({
            'item_id': item_id,
            'train_start': train_sub['date'].min().strftime('%Y-%m-%d'),
            'train_end': train_sub['date'].max().strftime('%Y-%m-%d'),
            'test_start': test_sub['date'].min().strftime('%Y-%m-%d'),
            'test_end': test_sub['date'].max().strftime('%Y-%m-%d'),
            'total_obs': n_obs,
            'train_obs': len(train_sub),
            'test_obs': len(test_sub)
        })

    # Concatenate sub-tables
    df_train = pd.concat(train_list, ignore_index=True)
    df_test = pd.concat(test_list, ignore_index=True)

    metadata_df = pd.DataFrame(split_metadata)
    return df_train, df_test, metadata_df

# 3. Apply the split
train_df, test_df, meta_df = chronological_train_test_split(feat_df, train_ratio=0.8)

# 4. Save splits to content folder
train_df.to_csv('/content/train_sales.csv', index=False)
test_df.to_csv('/content/test_sales.csv', index=False)
print("Splits successfully saved to '/content/train_sales.csv' and '/content/test_sales.csv'.\n")

# 5. Display boundary metrics
print("=== Train / Test Temporal Boundaries per Product ===")
display(meta_df)

# --- CELL 55 ---
# 6. Visualize chronological separation for an example product
sample_item = 'FOODS_3_586'  # Representative high-performing product

sample_train = train_df[train_df['item_id'] == sample_item].sort_values('date')
sample_test = test_df[test_df['item_id'] == sample_item].sort_values('date')

plt.figure(figsize=(15, 6))
plt.plot(sample_train['date'], sample_train['sales'], label='Training Period (First 80%)', color='#1f77b4', alpha=0.8)
plt.plot(sample_test['date'], sample_test['sales'], label='Testing Period (Remaining 20%)', color='#ff7f0e', alpha=0.8)

# Add visual boundary line
plt.axvline(x=sample_train['date'].max(), color='red', linestyle='--', linewidth=2, label='Split Boundary Line')

plt.title(f"Chronological Train/Test Split Visualization - Product: {sample_item}", fontsize=14, fontweight='bold')
plt.xlabel("Timeline (Date)")
plt.ylabel("Units Sold")
plt.legend(loc='upper left')
plt.grid(True, linestyle='--', alpha=0.5)
plt.tight_layout()
plt.show()

# --- CELL 57 ---
import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
import warnings
import matplotlib.pyplot as plt

# Suppress Convergence and User warnings from statsmodels fitting iterations
warnings.filterwarnings("ignore")

print("=== Starting Phase 8: ARIMA Forecasting ===\n")

# 1. Load splits
train_df = pd.read_csv('/content/train_sales.csv', parse_dates=['date'])
test_df = pd.read_csv('/content/test_sales.csv', parse_dates=['date'])

# Extract unique products and metadata
unique_items = train_df['item_id'].unique()
store_id = train_df['store_id'].iloc[0]  # CA_1
forecast_len = 383  # Match the exact test period length

results_list = []
forecasts_dict = {}  # Store predictions for visualization

print(f"Fitting ARIMA(1,1,1) models to {len(unique_items)} products...")

for item in unique_items:
    # Filter training and testing sets for this item
    train_series = train_df[train_df['item_id'] == item].sort_values('date')['sales'].values
    test_series = test_df[test_df['item_id'] == item].sort_values('date')['sales'].values

    # Train the ARIMA model
    try:
        model = ARIMA(train_series, order=(1, 1, 1))
        model_fit = model.fit()

        # Forecast next 383 days
        forecast = model_fit.forecast(steps=forecast_len)
        # Clip negative forecasts to zero (sales cannot be negative)
        forecast = np.clip(forecast, 0, None)
    except Exception as e:
        # Fallback to naive constant baseline if fit fails
        print(f"Fitting failed for {item}: {e}. Falling back to historical mean.")
        forecast = np.full(forecast_len, train_series.mean())

    forecasts_dict[item] = forecast

    # Evaluate Metrics
    mae = np.mean(np.abs(test_series - forecast))
    rmse = np.sqrt(np.mean((test_series - forecast) ** 2))

    # Handle zero sales in MAPE computation
    non_zero_mask = test_series > 0
    if non_zero_mask.sum() > 0:
        mape = np.mean(np.abs(test_series[non_zero_mask] - forecast[non_zero_mask]) / test_series[non_zero_mask]) * 100
    else:
        mape = 0.0

    results_list.append({
        'product_id': item,
        'store_id': store_id,
        'ARIMA_MAE': round(float(mae), 4),
        'ARIMA_RMSE': round(float(rmse), 4),
        'ARIMA_MAPE': round(float(mape), 2)
    })

# 2. Build results DataFrame
arima_results_df = pd.DataFrame(results_list)
arima_results_df.to_csv('/content/arima_metrics.csv', index=False)

print("\n=== Product-Level ARIMA Evaluation Metrics ===")
display(arima_results_df)

# --- CELL 58 ---
# 3. Create Actual vs ARIMA Forecast Comparative Plot
sample_product = 'FOODS_3_586'

sample_train = train_df[train_df['item_id'] == sample_product].sort_values('date')
sample_test = test_df[test_df['item_id'] == sample_product].sort_values('date')
sample_forecast = forecasts_dict[sample_product]

plt.figure(figsize=(15, 6))
plt.plot(sample_train['date'], sample_train['sales'], label='Historical Train Sales', color='#1f77b4', alpha=0.4)
plt.plot(sample_test['date'], sample_test['sales'], label='Actual Test Sales', color='#ff7f0e', alpha=0.7)
plt.plot(sample_test['date'], sample_forecast, label='ARIMA(1,1,1) Forecast', color='#2ca02c', linewidth=2.5, linestyle='--')

plt.axvline(x=sample_train['date'].max(), color='red', linestyle=':', label='Split Boundary')
plt.title(f"ARIMA Forecast Performance vs. Actuals for SKU: {sample_product}", fontsize=14, fontweight='bold')
plt.xlabel("Date")
plt.ylabel("Units Sold")
plt.legend(loc='upper left')
plt.grid(True, linestyle='--', alpha=0.5)
plt.tight_layout()
plt.show()

# --- CELL 61 ---
# 1. Install prophet if not present (usually pre-installed in Colab, but let's verify or update silently)
!pip install -q prophet

# --- CELL 62 ---
import pandas as pd
import numpy as np
from prophet import Prophet
import warnings
import logging
import matplotlib.pyplot as plt

# Suppress Prophet's verbose fitting output
logging.getLogger('prophet').setLevel(logging.ERROR)
warnings.filterwarnings("ignore")

print("=== Starting Phase 9: Prophet Forecasting ===\n")

# 2. Load splits from Phase 7
train_df = pd.read_csv('/content/train_sales.csv', parse_dates=['date'])
test_df = pd.read_csv('/content/test_sales.csv', parse_dates=['date'])

unique_items = train_df['item_id'].unique()
store_id = train_df['store_id'].iloc[0]
forecast_len = 383  # Total days in the test set

prophet_results_list = []
prophet_forecasts_dict = {}  # Store predictions for plotting

print(f"Fitting Prophet models to {len(unique_items)} products...")

for item in unique_items:
    # Prepare training dataframe for Prophet (requires columns 'ds' and 'y')
    item_train = train_df[train_df['item_id'] == item][['date', 'sales']].rename(columns={'date': 'ds', 'sales': 'y'})
    item_test = test_df[test_df['item_id'] == item][['date', 'sales']].rename(columns={'date': 'ds', 'sales': 'y'})

    # Sort chronologically to preserve integrity
    item_train = item_train.sort_values('ds').reset_index(drop=True)
    item_test = item_test.sort_values('ds').reset_index(drop=True)

    # Initialize Prophet Model
    # Retail sales typically exhibit clear weekly and yearly seasonality patterns
    model = Prophet(
        growth='linear',
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False
    )

    try:
        # Fit the model
        model.fit(item_train)

        # Create future dataframe for the 383 test days
        future = model.make_future_dataframe(periods=forecast_len, freq='D')
        forecast_raw = model.predict(future)

        # Slice forecast to match test period length (last 383 rows)
        forecast_test = forecast_raw.tail(forecast_len).copy()

        # Post-process: Clip negative values to zero
        forecast_test['yhat'] = np.clip(forecast_test['yhat'].values, 0, None)
        forecast_test['yhat_lower'] = np.clip(forecast_test['yhat_lower'].values, 0, None)
        forecast_test['yhat_upper'] = np.clip(forecast_test['yhat_upper'].values, 0, None)

    except Exception as e:
        print(f"Prophet fit failed for {item}: {e}. Falling back to baseline mean.")
        # Robust fallback dataframe structure in case of fit failure
        fallback_val = item_train['y'].mean()
        forecast_test = pd.DataFrame({
            'ds': item_test['ds'].values,
            'yhat': np.full(forecast_len, fallback_val),
            'yhat_lower': np.full(forecast_len, fallback_val * 0.5),
            'yhat_upper': np.full(forecast_len, fallback_val * 1.5)
        })

    # Store forecasts for analysis and plotting
    prophet_forecasts_dict[item] = forecast_test

    # Evaluate Metrics against Actuals
    actuals = item_test['y'].values
    predicted = forecast_test['yhat'].values

    mae = np.mean(np.abs(actuals - predicted))
    rmse = np.sqrt(np.mean((actuals - predicted) ** 2))

    # Safe MAPE formulation (filtering out days with zero actual sales)
    non_zero_mask = actuals > 0
    if non_zero_mask.sum() > 0:
        mape = np.mean(np.abs(actuals[non_zero_mask] - predicted[non_zero_mask]) / actuals[non_zero_mask]) * 100
    else:
        mape = 0.0

    prophet_results_list.append({
        'product_id': item,
        'store_id': store_id,
        'Prophet_MAE': round(float(mae), 4),
        'Prophet_RMSE': round(float(rmse), 4),
        'Prophet_MAPE': round(float(mape), 2)
    })

# 3. Build and save metrics
prophet_results_df = pd.DataFrame(prophet_results_list)
prophet_results_df.to_csv('/content/prophet_metrics.csv', index=False)

print("\n=== Product-Level Prophet Evaluation Metrics ===")
display(prophet_results_df)

# --- CELL 63 ---
# 4. Actual vs. Prophet Forecast Comparative Plot with Uncertainty Intervals
sample_product = 'FOODS_3_586'

sample_train = train_df[train_df['item_id'] == sample_product].sort_values('date')
sample_test = test_df[test_df['item_id'] == sample_product].sort_values('date')
sample_forecast = prophet_forecasts_dict[sample_product]

plt.figure(figsize=(15, 6))
# Plot training history as a light reference
plt.plot(sample_train['date'], sample_train['sales'], label='Historical Train Sales', color='#1f77b4', alpha=0.3)

# Plot actual sales during test period
plt.plot(sample_test['date'], sample_test['sales'], label='Actual Test Sales', color='#ff7f0e', alpha=0.7)

# Plot Prophet predicted curve
plt.plot(sample_forecast['ds'], sample_forecast['yhat'], label='Prophet Forecast (yhat)', color='#9467bd', linewidth=2.5)

# Plot confidence boundaries representing uncertainty intervals
plt.fill_between(
    sample_forecast['ds'],
    sample_forecast['yhat_lower'],
    sample_forecast['yhat_upper'],
    color='#9467bd',
    alpha=0.2,
    label='80% Uncertainty Interval'
)

plt.axvline(x=sample_train['date'].max(), color='red', linestyle=':', label='Split Boundary')
plt.title(f"Prophet Forecast with Uncertainty Intervals vs. Actuals for SKU: {sample_product}", fontsize=14, fontweight='bold')
plt.xlabel("Date")
plt.ylabel("Units Sold")
plt.legend(loc='upper left')
plt.grid(True, linestyle='--', alpha=0.5)
plt.tight_layout()
plt.show()

# --- CELL 65 ---
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

print("=== Starting Phase 10: Automatic Model Selection ===\n")

# 1. Load baseline metrics
arima_df = pd.read_csv('/content/arima_metrics.csv')
prophet_df = pd.read_csv('/content/prophet_metrics.csv')

# 2. Merge metrics on product/store composite keys
merged_metrics = pd.merge(
    arima_df,
    prophet_df,
    on=['product_id', 'store_id'],
    how='inner'
)

# 3. Apply Decision Selection Logic Rule-by-Rule
def select_best_model(row):
    # Rule 1: Compare MAPE
    if row['ARIMA_MAPE'] < row['Prophet_MAPE']:
        return 'ARIMA'
    elif row['Prophet_MAPE'] < row['ARIMA_MAPE']:
        return 'Prophet'

    # Rule 2 (Tie-breaker 1): Compare MAE
    if row['ARIMA_MAE'] < row['Prophet_MAE']:
        return 'ARIMA'
    elif row['Prophet_MAE'] < row['ARIMA_MAE']:
        return 'Prophet'

    # Rule 3 (Tie-breaker 2): Compare RMSE
    if row['ARIMA_RMSE'] < row['Prophet_RMSE']:
        return 'ARIMA'
    else:
        return 'Prophet'

merged_metrics['Selected_Model'] = merged_metrics.apply(select_best_model, axis=1)

# Save the model selections
merged_metrics.to_csv('/content/model_selections.csv', index=False)

print("=== AUTOMATIC ARIMA–PROPHET MODEL SELECTION TABLE ===")
columns_order = [
    'product_id', 'store_id',
    'ARIMA_MAE', 'Prophet_MAE',
    'ARIMA_RMSE', 'Prophet_RMSE',
    'ARIMA_MAPE', 'Prophet_MAPE',
    'Selected_Model'
]
display(merged_metrics[columns_order])

# --- CELL 66 ---
# 4. Comparative Visualizations: ARIMA vs Prophet Metrics
fig, axes = plt.subplots(1, 3, figsize=(22, 6))

x_indexes = np.arange(len(merged_metrics))
bar_width = 0.35

# Chart 1: MAPE Comparison
axes[0].bar(x_indexes - bar_width/2, merged_metrics['ARIMA_MAPE'], bar_width, label='ARIMA MAPE', color='#1f77b4')
axes[0].bar(x_indexes + bar_width/2, merged_metrics['Prophet_MAPE'], bar_width, label='Prophet MAPE', color='#9467bd')
axes[0].set_title('MAPE Comparison (Lower is Better)', fontsize=12, fontweight='bold')
axes[0].set_xticks(x_indexes)
axes[0].set_xticklabels(merged_metrics['product_id'], rotation=90)
axes[0].set_ylabel('MAPE (%)')
axes[0].legend()
axes[0].grid(True, linestyle='--', alpha=0.5)

# Chart 2: MAE Comparison
axes[1].bar(x_indexes - bar_width/2, merged_metrics['ARIMA_MAE'], bar_width, label='ARIMA MAE', color='#2ca02c')
axes[1].bar(x_indexes + bar_width/2, merged_metrics['Prophet_MAE'], bar_width, label='Prophet MAE', color='#e377c2')
axes[1].set_title('MAE Comparison (Lower is Better)', fontsize=12, fontweight='bold')
axes[1].set_xticks(x_indexes)
axes[1].set_xticklabels(merged_metrics['product_id'], rotation=90)
axes[1].set_ylabel('MAE')
axes[1].legend()
axes[1].grid(True, linestyle='--', alpha=0.5)

# Chart 3: RMSE Comparison
axes[2].bar(x_indexes - bar_width/2, merged_metrics['ARIMA_RMSE'], bar_width, label='ARIMA RMSE', color='#ff7f0e')
axes[2].bar(x_indexes + bar_width/2, merged_metrics['Prophet_RMSE'], bar_width, label='Prophet RMSE', color='#bcbd22')
axes[2].set_title('RMSE Comparison (Lower is Better)', fontsize=12, fontweight='bold')
axes[2].set_xticks(x_indexes)
axes[2].set_xticklabels(merged_metrics['product_id'], rotation=90)
axes[2].set_ylabel('RMSE')
axes[2].legend()
axes[2].grid(True, linestyle='--', alpha=0.5)

plt.suptitle('ARIMA vs Prophet Performance Across Products', fontsize=16, fontweight='bold')
plt.tight_layout()
plt.show()

# --- CELL 67 ---
# 5. Selected Model Distribution & Product-level Selected Model Summary
plt.figure(figsize=(10, 5))
sns.countplot(data=merged_metrics, x='Selected_Model', hue='Selected_Model', palette='Set2', legend=False)
plt.title('Selected Model Distribution (Optimal Selections)', fontsize=14, fontweight='bold')
plt.xlabel('Forecasting Engine')
plt.ylabel('Count of Products')
plt.grid(axis='y', linestyle='--', alpha=0.5)
plt.show()

# Print summary statistics
selection_counts = merged_metrics['Selected_Model'].value_counts()
print("=== Engine Selection Summary ===")
for model_name, count in selection_counts.items():
    pct = (count / len(merged_metrics)) * 100
    print(f"- {model_name}: {count} products ({pct:.2f}%)")

# --- CELL 70 ---
import pandas as pd
import numpy as np
from prophet import Prophet
from statsmodels.tsa.arima.model import ARIMA
import warnings
import logging
import matplotlib.pyplot as plt

# Suppress logs and warnings
logging.getLogger('prophet').setLevel(logging.ERROR)
warnings.filterwarnings("ignore")

print("=== Starting Phase 11: Final Demand Forecast ===\n")

# 1. Load historical clean dataset & model selections
full_hist_df = pd.read_csv('/content/clean_sales.csv', parse_dates=['date'])
model_selections_df = pd.read_csv('/content/model_selections.csv')

# Extract unique products
unique_products = full_hist_df['item_id'].unique()
store_id = full_hist_df['store_id'].iloc[0]

# Target horizon
FUTURE_HORIZON = 30

# Determine the forecast start date (day after the last historical date)
last_historical_date = full_hist_df['date'].max()
future_dates = pd.date_range(start=last_historical_date + pd.Timedelta(days=1), periods=FUTURE_HORIZON, freq='D')

print(f"Last historical day: {last_historical_date.strftime('%Y-%m-%d')}")
print(f"Forecast horizon: {future_dates[0].strftime('%Y-%m-%d')} to {future_dates[-1].strftime('%Y-%m-%d')} ({FUTURE_HORIZON} days)\n")

all_forecast_records = []

for product in unique_products:
    # Find selected model
    selected_model = model_selections_df[model_selections_df['product_id'] == product]['Selected_Model'].values[0]

    # Slice and sort full history for this product
    product_df = full_hist_df[full_hist_df['item_id'] == product].sort_values('date').reset_index(drop=True)
    y_historical = product_df['sales'].values

    print(f"Retraining {selected_model} for {product} using all {len(y_historical)} observations...")

    if selected_model == 'Prophet':
        # Prepare Prophet data structure
        prophet_train = product_df[['date', 'sales']].rename(columns={'date': 'ds', 'sales': 'y'})

        model = Prophet(
            growth='linear',
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False
        )

        model.fit(prophet_train)

        # Forecast future horizon
        future_df = model.make_future_dataframe(periods=FUTURE_HORIZON, freq='D')
        forecast_raw = model.predict(future_df)
        future_forecast = forecast_raw.tail(FUTURE_HORIZON).copy()

        # Process outputs (80% default confidence boundaries from Prophet)
        pred_y = np.clip(future_forecast['yhat'].values, 0, None)
        lower_b = np.clip(future_forecast['yhat_lower'].values, 0, None)
        upper_b = np.clip(future_forecast['yhat_upper'].values, 0, None)

    else:  # ARIMA
        try:
            model = ARIMA(y_historical, order=(1, 1, 1))
            model_fit = model.fit()

            # Forecast next 30 days and extract standard errors
            forecast_res = model_fit.get_forecast(steps=FUTURE_HORIZON)
            pred_y = forecast_res.predicted_mean
            stderr = forecast_res.se_mean

            # Construct standard 80% confidence interval
            z_val = 1.28155
            lower_b = pred_y - z_val * stderr
            upper_b = pred_y + z_val * stderr

            # Post-process clipping
            pred_y = np.clip(pred_y, 0, None)
            lower_b = np.clip(lower_b, 0, None)
            upper_b = np.clip(upper_b, 0, None)

        except Exception as e:
            print(f"  [Warning] ARIMA retraining failed for {product}: {e}. Falling back to historical mean.")
            mean_val = y_historical.mean()
            pred_y = np.full(FUTURE_HORIZON, mean_val)
            lower_b = np.full(FUTURE_HORIZON, mean_val * 0.5)
            upper_b = np.full(FUTURE_HORIZON, mean_val * 1.5)

    # Store results
    for idx, dt in enumerate(future_dates):
        all_forecast_records.append({
            'date': dt,
            'product_id': product,
            'store_id': store_id,
            'selected_model': selected_model,
            'predicted_demand': float(pred_y[idx]),
            'lower_bound': float(lower_b[idx]),
            'upper_bound': float(upper_b[idx])
        })

# Create final forecasts DataFrame
final_forecasts = pd.DataFrame(all_forecast_records)

# Save to disk
final_forecasts.to_csv('/content/final_forecasts.csv', index=False)
print("\nSuccessfully generated and saved final forecasts to: /content/final_forecasts.csv")

# --- CELL 71 ---
# Calculate total predicted demand summaries
print("=== Summary of Total Projected Future Demand (30-Day Window) ===")
summary_demand = final_forecasts.groupby(['product_id', 'selected_model']).agg(
    total_predicted_units=('predicted_demand', 'sum'),
    avg_daily_demand=('predicted_demand', 'mean'),
    max_daily_demand=('predicted_demand', 'max')
).reset_index().sort_values(by='total_predicted_units', ascending=False)

display(summary_demand)

# --- CELL 72 ---
# 6 & 7. Historical + Forecast Transition Visualizations
# We will plot three sample products showing different behaviors (e.g., Prophet-selected vs ARIMA-selected)

sample_items_to_plot = ['FOODS_3_586', 'FOODS_3_080', 'FOODS_3_226']

for product_id in sample_items_to_plot:
    # Historical series (slice last 90 days for better visual readability)
    hist_series = full_hist_df[full_hist_df['item_id'] == product_id].sort_values('date').tail(90)
    # Future forecast
    fut_series = final_forecasts[final_forecasts['product_id'] == product_id].sort_values('date')

    engine_used = fut_series['selected_model'].iloc[0]

    plt.figure(figsize=(15, 5))
    plt.plot(hist_series['date'], hist_series['sales'], label='Historical Sales (Last 90 days)', color='#1f77b4', alpha=0.8)
    plt.plot(fut_series['date'], fut_series['predicted_demand'], label=f'Future Projection ({engine_used})', color='#ff7f0e', linewidth=2.5)

    # Uncertainty intervals
    plt.fill_between(
        fut_series['date'],
        fut_series['lower_bound'],
        fut_series['upper_bound'],
        color='#ff7f0e',
        alpha=0.2,
        label='80% Forecast Uncertainty Interval'
    )

    plt.axvline(x=last_historical_date, color='red', linestyle='--', label='Historical / Forecast Boundary')
    plt.title(f"Complete Transition Visualization: {product_id} (Engine: {engine_used})", fontsize=13, fontweight='bold')
    plt.xlabel('Timeline')
    plt.ylabel('Units')
    plt.legend(loc='upper left')
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.tight_layout()
    plt.show()

# --- CELL 73 ---
# Display sample final forecast frame
print("=== Sample Forecast (First 15 records) ===")
display(final_forecasts.head(15))

# --- CELL 75 ---
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import warnings

warnings.filterwarnings("ignore")
sns.set_theme(style="whitegrid")

print("=== Starting Phase 12: Forecast-Based Inventory Recommendations ===\n")

# 1. Load historical dataset and final forecasts
hist_df = pd.read_csv('/content/clean_sales.csv', parse_dates=['date'])
forecasts_df = pd.read_csv('/content/final_forecasts.csv', parse_dates=['date'])

# 2. Compute historical daily standard deviation for each product
hist_std = hist_df.groupby('item_id')['sales'].std().reset_index().rename(columns={'sales': 'historical_std'})

# 3. Calculate 30-day forecasted demand sum per product
forecast_sum = forecasts_df.groupby(['product_id', 'store_id', 'selected_model'])['predicted_demand'].sum().reset_index()
forecast_sum = forecast_sum.rename(columns={'product_id': 'item_id', 'predicted_demand': 'forecasted_demand'})

# Merge historical standard deviation
inventory_df = pd.merge(forecast_sum, hist_std, on='item_id', how='left')

# 4. Apply Safety Stock formulation
LEAD_TIME_DAYS = 7
Z_SCORE = 1.645
inventory_df['safety_stock'] = (Z_SCORE * inventory_df['historical_std'] * np.sqrt(LEAD_TIME_DAYS)).round(2)

# 5. Compute Required Stock
inventory_df['required_stock'] = (inventory_df['forecasted_demand'] + inventory_df['safety_stock']).round(2)

# 6. Generate SIMULATED CURRENT STOCK
# To demonstrate various stock scenarios, we inject controlled randomness into simulated stock relative to required stock
np.random.seed(42)
random_multipliers = np.random.uniform(0.1, 1.4, size=len(inventory_df))
inventory_df['simulated_current_stock'] = (inventory_df['required_stock'] * random_multipliers).round(2)

# 7. Calculate Reorder Quantity
inventory_df['reorder_quantity'] = inventory_df.apply(
    lambda row: max(0.0, round(row['required_stock'] - row['simulated_current_stock'], 2)),
    axis=1
)

# 8. Classify Inventory Status
def classify_status(row):
    curr = row['simulated_current_stock']
    req = row['required_stock']
    if curr < 0.3 * req:
        return 'STOCKOUT RISK'
    elif curr > 1.1 * req:
        return 'OVERSTOCK'
    else:
        return 'HEALTHY STOCK'

inventory_df['inventory_status'] = inventory_df.apply(classify_status, axis=1)

# Rearrange columns for clarity
final_cols = [
    'item_id', 'store_id', 'selected_model', 'forecasted_demand',
    'safety_stock', 'required_stock', 'simulated_current_stock',
    'reorder_quantity', 'inventory_status'
]
inventory_recommendations = inventory_df[final_cols].copy()

# Save to csv
inventory_recommendations.to_csv('/content/inventory_recommendations.csv', index=False)
print("Saved inventory recommendations and simulated ledger to: /content/inventory_recommendations.csv\n")

# Display full recommendation table
display(inventory_recommendations)

# --- CELL 77 ---
# --- 1. Current Stock vs Required Stock Comparison ---
plt.figure(figsize=(15, 6))
x_indices = np.arange(len(inventory_recommendations))
bar_width = 0.35

plt.bar(x_indices - bar_width/2, inventory_recommendations['simulated_current_stock'],
        width=bar_width, label='Simulated Current Stock', color='#3498db', alpha=0.9)
plt.bar(x_indices + bar_width/2, inventory_recommendations['required_stock'],
        width=bar_width, label='Required Stock (Demand + Safety)', color='#e74c3c', alpha=0.9)

plt.title('Operational Comparison: Simulated Current Stock vs. Required Stock (Store CA_1)', fontsize=14, fontweight='bold')
plt.xticks(x_indices, inventory_recommendations['item_id'], rotation=90)
plt.xlabel('Product SKU')
plt.ylabel('Units')
plt.legend()
plt.tight_layout()
plt.show()

# --- CELL 78 ---
# --- 2. Reorder Quantity Needed per SKU ---
reorders_sorted = inventory_recommendations.sort_values(by='reorder_quantity', ascending=False)

plt.figure(figsize=(14, 5))
sns.barplot(data=reorders_sorted, x='item_id', y='reorder_quantity', palette='Reds_r', hue='item_id', legend=False)
plt.title('Automated Reorder Recommendations (Lead Time = 7 Days)', fontsize=14, fontweight='bold')
plt.xticks(rotation=90)
plt.xlabel('Product SKU')
plt.ylabel('Reorder Quantity (Units)')
plt.tight_layout()
plt.show()

# --- CELL 79 ---
# --- 3. Inventory Status Distribution Grouping ---
plt.figure(figsize=(10, 5))
status_colors = {
    'STOCKOUT RISK': '#e74c3c',
    'HEALTHY STOCK': '#2ecc71',
    'OVERSTOCK': '#f1c40f'
}

sns.countplot(data=inventory_recommendations, x='inventory_status',
              palette=status_colors, order=['STOCKOUT RISK', 'HEALTHY STOCK', 'OVERSTOCK'],
              hue='inventory_status', legend=False)

plt.title('Store CA_1 Portfolio Health Distribution', fontsize=14, fontweight='bold')
plt.xlabel('Inventory Health Category')
plt.ylabel('SKU Count')
plt.grid(axis='y', linestyle='--', alpha=0.5)
plt.tight_layout()
plt.show()

# Print summarycounts
print("=== Inventory Catalog Diagnosis Summary ===")
print(inventory_recommendations['inventory_status'].value_counts())

# --- CELL 81 ---
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

print("=== Starting Phase 13: What-If Demand Scenario Analysis ===\n")

# 1. Load active inventory ledger from Phase 12
inv_ledger = pd.read_csv('/content/inventory_recommendations.csv')

# Define scenarios
scenarios = {
    'Low Demand (-10%)': 0.90,
    'Normal Demand': 1.00,
    'High Demand (+10%)': 1.10
}

scenario_records = []

for name, factor in scenarios.items():
    for _, row in inv_ledger.iterrows():
        base_demand = row['forecasted_demand']
        safety = row['safety_stock']
        current_stock = row['simulated_current_stock']

        # Scenario calculations
        scen_demand = round(base_demand * factor, 2)
        req_stock = round(scen_demand + safety, 2)

        # Shortage occurs if current physical stock is less than required stock
        shortage = round(max(0.0, req_stock - current_stock), 2)
        reorder = shortage # Recommended reorder matches the gap to required stock

        scenario_records.append({
            'Scenario': name,
            'item_id': row['item_id'],
            'store_id': row['store_id'],
            'selected_model': row['selected_model'],
            'Base_Forecasted_Demand': base_demand,
            'Scenario_Forecasted_Demand': scen_demand,
            'Safety_Stock': safety,
            'Current_Simulated_Stock': current_stock,
            'Required_Stock': req_stock,
            'Shortage_Quantity': shortage,
            'Reorder_Quantity': reorder
        })

# 2. Build multi-scenario DataFrame
what_if_df = pd.DataFrame(scenario_records)

# Save to disk as requested
what_if_df.to_csv('/content/what_if_analysis.csv', index=False)
print("Saved scenario matrix successfully to: /content/what_if_analysis.csv\n")

# Display sample slice comparing scenarios for a few products
sample_items = ['FOODS_3_586', 'FOODS_3_226', 'FOODS_3_080']
display_slice = what_if_df[what_if_df['item_id'].isin(sample_items)].sort_values(by=['item_id', 'Scenario'])
print("=== Scenario Stress Test Comparison (Selected SKUs) ===")
display(display_slice[['item_id', 'Scenario', 'Scenario_Forecasted_Demand', 'Current_Simulated_Stock', 'Required_Stock', 'Shortage_Quantity', 'Reorder_Quantity']])

# --- CELL 82 ---
# --- Interactive Dashboard representing scenario differences ---
# Aggregating metrics at the Scenario level to see macro impact
scenario_summary = what_if_df.groupby('Scenario').agg({
    'Scenario_Forecasted_Demand': 'sum',
    'Required_Stock': 'sum',
    'Shortage_Quantity': 'sum',
    'Reorder_Quantity': 'sum'
}).reset_index()

print("=== Portfolio-Level Multi-Scenario Operational Impact ===")
display(scenario_summary)

# Create a multi-bar chart comparing metrics across scenarios
fig = go.Figure()

# Add trace for Forecasted Demand
fig.add_trace(go.Bar(
    x=scenario_summary['Scenario'],
    y=scenario_summary['Scenario_Forecasted_Demand'],
    name='Aggregate Forecasted Demand',
    marker_color='#3498db'
))

# Add trace for Required Stock
fig.add_trace(go.Bar(
    x=scenario_summary['Scenario'],
    y=scenario_summary['Required_Stock'],
    name='Aggregate Required Stock (Demand + Safety)',
    marker_color='#2ecc71'
))

# Add trace for Shortages
fig.add_trace(go.Bar(
    x=scenario_summary['Scenario'],
    y=scenario_summary['Shortage_Quantity'],
    name='Aggregate Reorder / Shortage Vol.',
    marker_color='#e74c3c'
))

fig.update_layout(
    title="<b>What-If Demand Scenario Analysis: Macro Portfolio Impact</b><br><sup>Evaluating the effect of -10% vs Normal vs +10% demand shifts on inventory health</sup>",
    xaxis_title="Demand Scenario",
    yaxis_title="Units",
    barmode='group',
    template='plotly_white',
    hovermode='x unified'
)
fig.show()

# --- CELL 84 ---
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

print("=== Starting Phase 14: Financial Impact Analysis ===\n")

# 1. Load active dataframes
what_if_df = pd.read_csv('/content/what_if_analysis.csv')
clean_sales_df = pd.read_csv('/content/clean_sales.csv')

# Ensure correct column naming alignment (what_if_df has 'item_id', we rename to 'product_id')
if 'item_id' in what_if_df.columns:
    what_if_df = what_if_df.rename(columns={'item_id': 'product_id'})

# Extract the most recent unit price for each product in store CA_1 to represent active shelf prices
recent_prices = clean_sales_df.sort_values(by='date').groupby('item_id').last()[['sell_price']].reset_index()
recent_prices = recent_prices.rename(columns={'item_id': 'product_id', 'sell_price': 'unit_price'})

# 2. Merge pricing with our scenario matrix
financial_df = pd.merge(what_if_df, recent_prices, on='product_id', how='left')

# 3. Apply financial formulations
financial_df['Forecasted_Revenue'] = (financial_df['Scenario_Forecasted_Demand'] * financial_df['unit_price']).round(2)
financial_df['Revenue_at_Risk'] = (financial_df['Shortage_Quantity'] * financial_df['unit_price']).round(2)

# Calculate overstock quantity
financial_df['Overstock_Quantity'] = financial_df.apply(
    lambda row: max(0.0, round(row['Current_Simulated_Stock'] - row['Required_Stock'], 2)),
    axis=1
)

# Standard industry holding cost proxy assumption (15% annual rate / 12 months = 1.25% monthly rate)
HOLDING_COST_RATE_MONTHLY = 0.0125
financial_df['Overstock_Holding_Cost'] = (financial_df['Overstock_Quantity'] * (financial_df['unit_price'] * HOLDING_COST_RATE_MONTHLY)).round(4)

# 4. Save metrics as requested
financial_df.to_csv('/content/financial_impact.csv', index=False)
print("Financial matrix saved successfully to: /content/financial_impact.csv\n")

# Rearrange columns to match user table structure specification
table_columns = [
    'product_id', 'store_id', 'Scenario', 'Scenario_Forecasted_Demand',
    'unit_price', 'Forecasted_Revenue', 'Current_Simulated_Stock',
    'Shortage_Quantity', 'Revenue_at_Risk', 'Overstock_Holding_Cost'
]

# Display summary slice for top SKUs
print("=== Financial Impact Table (Selected SKUs) ===")
sample_items = ['FOODS_3_586', 'FOODS_3_226', 'FOODS_3_080']
display(financial_df[financial_df['product_id'].isin(sample_items)][table_columns].sort_values(by=['product_id', 'Scenario']))

# --- CELL 85 ---
# --- Macro Financial Scenario Comparisons ---
fin_summary = financial_df.groupby('Scenario').agg({
    'Forecasted_Revenue': 'sum',
    'Revenue_at_Risk': 'sum',
    'Overstock_Holding_Cost': 'sum'
}).reset_index()

print("=== Macro-Level Portfolio Financial Analysis ===")
display(fin_summary)

# 1. Visualization: Scenario Revenue & Risk comparison
import plotly.graph_objects as go

fig = go.Figure()
fig.add_trace(go.Bar(
    x=fin_summary['Scenario'],
    y=fin_summary['Forecasted_Revenue'],
    name='Portfolio Forecasted Revenue ($)',
    marker_color='#2ecc71'
))

fig.add_trace(go.Bar(
    x=fin_summary['Scenario'],
    y=fin_summary['Revenue_at_Risk'],
    name='Portfolio Revenue at Risk ($)',
    marker_color='#e74c3c'
))

fig.update_layout(
    title="<b>Portfolio Financial Comparison: Forecasted Revenue vs. Risk</b><br><sup>Evaluating cash velocity against stockout risks across scenario boundaries</sup>",
    xaxis_title="Scenario",
    yaxis_title="USD ($)",
    barmode='group',
    template='plotly_white'
)
fig.show()

# --- CELL 86 ---
# 2. Product-Level Revenue at Risk under High Demand (+10%) Scenario
import pandas as pd
import plotly.express as px

# Fallback check to ensure the dataframe is loaded even if the kernel restarted
if 'financial_df' not in globals():
    print("Loading financial dataset from disk...")
    financial_df = pd.read_csv('/content/financial_impact.csv')

high_demand_df = financial_df[financial_df['Scenario'] == 'High Demand (+10%)'].sort_values(by='Revenue_at_Risk', ascending=False)

fig_risk = px.bar(
    high_demand_df,
    x='product_id',
    y='Revenue_at_Risk',
    color='Revenue_at_Risk',
    title="<b>High Demand Scenario (+10%): Product-wise Revenue at Risk</b><br><sup>Identify SKUs that require urgent stock replenishment to prevent severe sales loss</sup>",
    labels={'product_id': 'Product SKU', 'Revenue_at_Risk': 'Revenue at Risk ($)'},
    color_continuous_scale='Reds',
    template='plotly_white'
)
fig_risk.show()

# --- CELL 88 ---
import os
import shutil
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

print("=== Starting Phase 16: Save and Verify All Outputs ===\n")

# 1. Define clean folder structure directories
BASE_OUTPUT_DIR = '/content/outputs'
SUB_DIRS = {
    'data': os.path.join(BASE_OUTPUT_DIR, 'data'),
    'forecasts': os.path.join(BASE_OUTPUT_DIR, 'forecasts'),
    'inventory': os.path.join(BASE_OUTPUT_DIR, 'inventory'),
    'financial': os.path.join(BASE_OUTPUT_DIR, 'financial'),
    'visualizations': os.path.join(BASE_OUTPUT_DIR, 'visualizations')
}

# Create directory hierarchy
for dir_path in SUB_DIRS.values():
    os.makedirs(dir_path, exist_ok=True)
print("✔ Clean output folder structure initialized successfully.")

# ==========================================
# 2. Compile and save 'product_insights.csv'
# ==========================================
rec_df = pd.read_csv('/content/inventory_recommendations.csv')
fin_df = pd.read_csv('/content/financial_impact.csv')
normal_fin = fin_df[fin_df['Scenario'] == 'Normal Demand'].copy()

insights_df = pd.merge(
    rec_df,
    normal_fin[['product_id', 'unit_price', 'Revenue_at_Risk', 'Forecasted_Revenue']],
    left_on='item_id',
    right_on='product_id',
    how='left'
)

# Add dynamic reason descriptions programmatically for Streamlit ingest
def get_reason_text(row):
    if row['inventory_status'] == 'STOCKOUT RISK':
        return f"Critical deficit. Current stock of {row['simulated_current_stock']:.1f} units is below the required safety threshold of {row['required_stock']:.1f} units. Place urgent reorder of {row['reorder_quantity']:.1f} units to mitigate a ${row['Revenue_at_Risk']:.2f} revenue risk."
    elif row['inventory_status'] == 'OVERSTOCK':
        return f"Overallocated capital. Simulated stock ({row['simulated_current_stock']:.1f} units) exceeds the necessary safety and forecast buffer limit ({row['required_stock']:.1f} units). Stop replenishment orders immediately."
    else:
        return f"Optimized balance. Holdings are stable and satisfy standard sales thresholds."

insights_df['Reasoning'] = insights_df.apply(get_reason_text, axis=1)
insights_df = insights_df.drop(columns=['product_id'])
insights_df.to_csv('/content/product_insights.csv', index=False)
print("✔ Dynamic product_insights.csv compiled successfully.")

# ==========================================
# 3. Create 'model_comparison.csv' as requested
# ==========================================
model_sel = pd.read_csv('/content/model_selections.csv')
model_sel.to_csv('/content/model_comparison.csv', index=False)
print("✔ model_comparison.csv verified.")

# ==========================================
# 4. Map files to their destination directories
# ==========================================
files_to_copy = {
    '/content/clean_sales.csv': os.path.join(SUB_DIRS['data'], 'clean_sales.csv'),
    '/content/model_comparison.csv': os.path.join(SUB_DIRS['forecasts'], 'model_comparison.csv'),
    '/content/final_forecasts.csv': os.path.join(SUB_DIRS['forecasts'], 'final_forecasts.csv'),
    '/content/inventory_recommendations.csv': os.path.join(SUB_DIRS['inventory'], 'inventory_recommendations.csv'),
    '/content/product_insights.csv': os.path.join(SUB_DIRS['inventory'], 'product_insights.csv'),
    '/content/what_if_analysis.csv': os.path.join(SUB_DIRS['financial'], 'what_if_analysis.csv'),
    '/content/financial_impact.csv': os.path.join(SUB_DIRS['financial'], 'financial_impact.csv')
}

for src, dest in files_to_copy.items():
    if os.path.exists(src):
        # Safely copy to keep both source and outputs tree structured
        shutil.copy2(src, dest)
        print(f"✔ Copied: {os.path.basename(src)} ➔ {os.path.relpath(dest, '/content')}")
    else:
        print(f"✖ [Error] Missing source file: {src}")

# ==========================================
# 5. Export key Static Visualization Charts
# ==========================================
sns.set_theme(style="whitegrid")

# Chart 1: Global Day of Week and Month Distribution
df_sales = pd.read_csv('/content/clean_sales.csv', parse_dates=['date'])
df_sales['day_of_week'] = df_sales['date'].dt.day_name()
df_sales['month_name'] = df_sales['date'].dt.strftime('%B')
order_weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

plt.figure(figsize=(12, 5))
sns.boxplot(data=df_sales, x='day_of_week', y='sales', order=order_weekdays, hue='day_of_week', legend=False, palette='Blues')
plt.title('Daily Sales Distribution by Weekday', fontsize=12, fontweight='bold')
plt.xlabel('Weekday')
plt.ylabel('Units Sold')
plt.tight_layout()
plt.savefig(os.path.join(SUB_DIRS['visualizations'], 'weekday_sales_distribution.png'), dpi=150)
plt.close()

# Chart 2: Inventory Status counts
plt.figure(figsize=(8, 4))
sns.countplot(data=rec_df, x='inventory_status', hue='inventory_status', palette={'STOCKOUT RISK': '#e74c3c', 'HEALTHY STOCK': '#2ecc71', 'OVERSTOCK': '#f1c40f'}, legend=False)
plt.title('Portfolio Stock Health Status count', fontsize=12, fontweight='bold')
plt.xlabel('Inventory Health status')
plt.ylabel('Count of SKUs')
plt.tight_layout()
plt.savefig(os.path.join(SUB_DIRS['visualizations'], 'inventory_status_breakdown.png'), dpi=150)
plt.close()
print("✔ Visualizations saved to the outputs/visualizations/ folder.\n")

# ==========================================
# 6. Audit and verification listing
# ==========================================
print("=== Programmatic Outputs Audit Ledger ===")
audited_records = []

for category, dir_path in SUB_DIRS.items():
    for file in os.listdir(dir_path):
        file_path = os.path.join(dir_path, file)
        if os.path.isfile(file_path):
            size_kb = os.path.getsize(file_path) / 1024

            # If it is a CSV, verify rows and structural shape
            if file.endswith('.csv'):
                try:
                    temp_df = pd.read_csv(file_path)
                    row_count = len(temp_df)
                    col_count = len(temp_df.columns)
                    status = "SUCCESS"
                except Exception as e:
                    row_count = "N/A"
                    col_count = "N/A"
                    status = f"FAILED READ: {e}"
            else:
                row_count = "N/A (Image)"
                col_count = "N/A"
                status = "SUCCESS"

            audited_records.append({
                'Category': category,
                'Filename': file,
                'Size (KB)': f"{size_kb:.2f} KB",
                'Row Count': row_count,
                'Col Count': col_count,
                'Integrity Status': status
            })

audit_summary_df = pd.DataFrame(audited_records)
display(audit_summary_df)

# --- CELL 89 ---
from google.colab import drive
drive.mount('/content/drive')

# --- CELL 90 ---
import pandas as pd
import numpy as np

# 1. Load actual files to guarantee non-fabricated metrics
df_clean = pd.read_csv('/content/clean_sales.csv', parse_dates=['date'])
df_models = pd.read_csv('/content/model_selections.csv')
df_inv = pd.read_csv('/content/inventory_recommendations.csv')
df_fin = pd.read_csv('/content/financial_impact.csv')
df_scenarios = pd.read_csv('/content/what_if_analysis.csv')

# --- Calculations ---
# Dataset
dataset_name = "Walmart M5 (Foods Subset for Store CA_1)"
num_stores = df_clean['store_id'].nunique()
num_products = df_clean['item_id'].nunique()
hist_start = df_clean['date'].min().strftime('%Y-%m-%d')
hist_end = df_clean['date'].max().strftime('%Y-%m-%d')

# Forecasting Baselines
avg_arima_mae = df_models['ARIMA_MAE'].mean()
avg_arima_rmse = df_models['ARIMA_RMSE'].mean()
avg_arima_mape = df_models['ARIMA_MAPE'].mean()

avg_prophet_mae = df_models['Prophet_MAE'].mean()
avg_prophet_rmse = df_models['Prophet_RMSE'].mean()
avg_prophet_mape = df_models['Prophet_MAPE'].mean()

# Model Selection
num_arima_selected = (df_models['Selected_Model'] == 'ARIMA').sum()
num_prophet_selected = (df_models['Selected_Model'] == 'Prophet').sum()

# Inventory (Simulated Inventory Assumptions)
status_counts = df_inv['inventory_status'].value_counts()
stockout_risk_count = status_counts.get('STOCKOUT RISK', 0)
healthy_stock_count = status_counts.get('HEALTHY STOCK', 0)
overstock_count = status_counts.get('OVERSTOCK', 0)
total_reorder_qty = df_inv['reorder_quantity'].sum()

# Financials & Revenue (Normal Demand Scenario)
normal_fin = df_fin[df_fin['Scenario'] == 'Normal Demand']
total_forecasted_demand = normal_fin['Scenario_Forecasted_Demand'].sum()
total_forecasted_revenue = normal_fin['Forecasted_Revenue'].sum()
total_rev_at_risk = normal_fin['Revenue_at_Risk'].sum()

# What-If Demand (Scenario summaries)
what_if_summary = df_fin.groupby('Scenario').agg({
    'Scenario_Forecasted_Demand': 'sum',
    'Forecasted_Revenue': 'sum',
    'Revenue_at_Risk': 'sum',
    'Overstock_Holding_Cost': 'sum'
}).reset_index()

# Create a clean formatted printout of our final results summary
summary_text = f"""
========================================================================
                 DEMANDVERSE AI: FINAL PROJECT RESULTS SUMMARY
========================================================================

[ACTUAL M5 DATASET PROFILE]
- Dataset Name:             {dataset_name}
- Representative Store:     CA_1 (California 1)
- Unique Products Modeled:  {num_products} high-signal FOODS SKUs
- Historical Period Covered: {hist_start} to {hist_end} ({df_clean['date'].nunique()} days)
- Target Forecast Horizon:  30 Days

[MODEL FORECASTING PERFORMANCE EVALUATION]
* ARIMA(1,1,1) Baseline:
  - Average MAE:            {avg_arima_mae:.4f}
  - Average RMSE:           {avg_arima_rmse:.4f}
  - Average MAPE:           {avg_arima_mape:.2f}%
* Prophet Additive Seasonality Baseline:
  - Average MAE:            {avg_prophet_mae:.4f}
  - Average RMSE:           {avg_prophet_rmse:.4f}
  - Average MAPE:           {avg_prophet_mape:.2f}%

[AUTOMATED MODEL SELECTION ENGINE SUMMARY]
- Products utilizing ARIMA: {num_arima_selected} ({ (num_arima_selected/num_products)*100:.1f}% of catalog)
- Products utilizing Prophet: {num_prophet_selected} ({ (num_prophet_selected/num_products)*100:.1f}% of catalog)

[OPERATIONAL INVENTORY HEALTH DIAGNOSIS (SIMULATED STOCK ASSUMPTIONS)]
- Stockout Risk Products:   {stockout_risk_count} (Immediate replenishment needed)
- Healthy Stock Products:    {healthy_stock_count} (Balanced inventory profile)
- Overstock Products:        {overstock_count} (Excess inventory capital risk)
- Total Recommended Reorder Quantity: {total_reorder_qty:,.2f} units

[PORTFOLIO FINANCIAL PERFORMANCE (NORMAL DEMAND SCENARIO - MODEL PREDICTIONS)]
- Total Projected Demand Volume:       {total_forecasted_demand:,.2f} units
- Total Forecasted Portfolio Revenue:   ${total_forecasted_revenue:,.2f}
- Potential Portfolio Revenue at Risk:  ${total_rev_at_risk:,.2f}

[WHAT-IF SCENARIO STRESS-TESTING METRICS]
"""
print(summary_text)
print(what_if_summary.to_string(index=False))


# --- CELL 92 ---
import shutil
from google.colab import files

# Define paths
output_folder = '/content/outputs'
zip_destination = '/content/demandverse_ai_outputs'

print("Compressing output directory...")
# Create a zip archive of the output directory
archive_path = shutil.make_archive(zip_destination, 'zip', output_folder)
print(f"✔ Archive successfully created at: {archive_path}")

# Trigger browser download of the zip file
print("Initiating download...")
files.download(archive_path)