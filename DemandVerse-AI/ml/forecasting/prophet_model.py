import logging
import warnings

import numpy as np
from prophet import Prophet

logging.getLogger('prophet').setLevel(logging.ERROR)
warnings.filterwarnings("ignore")


def train_and_forecast_prophet(train_df, test_df=None, forecast_len=30):
    try:
        model = Prophet(
            growth='linear',
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False
        )
        model.fit(train_df)

        future = model.make_future_dataframe(periods=forecast_len, freq='D')
        forecast_raw = model.predict(future)
        forecast_test = forecast_raw.tail(forecast_len).copy()

        pred_y = np.clip(forecast_test['yhat'].values, 0, None)
        lower_b = np.clip(forecast_test['yhat_lower'].values, 0, None)
        upper_b = np.clip(forecast_test['yhat_upper'].values, 0, None)
    except Exception as e:
        print(f"Prophet fit failed: {e}")
        mean_val = train_df['y'].mean() if len(train_df) > 0 else 0
        pred_y = np.full(forecast_len, mean_val)
        lower_b = np.full(forecast_len, mean_val * 0.5)
        upper_b = np.full(forecast_len, mean_val * 1.5)

    metrics = None
    if test_df is not None and len(test_df) == forecast_len:
        actuals = test_df['y'].values
        mae = np.mean(np.abs(actuals - pred_y))
        rmse = np.sqrt(np.mean((actuals - pred_y) ** 2))
        non_zero_mask = actuals > 0
        if non_zero_mask.sum() > 0:
            act_nz = actuals[non_zero_mask]
            pred_nz = pred_y[non_zero_mask]
            mape = np.mean(np.abs(act_nz - pred_nz) / act_nz) * 100
        else:
            mape = 0.0
        metrics = {
            'MAE': round(float(mae), 4),
            'RMSE': round(float(rmse), 4),
            'MAPE': round(float(mape), 2)
        }

    return pred_y, lower_b, upper_b, metrics
