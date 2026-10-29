import warnings

import numpy as np
from statsmodels.tsa.arima.model import ARIMA

warnings.filterwarnings("ignore")


def train_and_forecast_arima(train_series, test_series=None, forecast_len=30):
    try:
        model = ARIMA(train_series, order=(1, 1, 1))
        model_fit = model.fit()

        # Forecast
        forecast_res = model_fit.get_forecast(steps=forecast_len)
        pred_y = forecast_res.predicted_mean
        stderr = forecast_res.se_mean

        z_val = 1.28155
        lower_b = pred_y - z_val * stderr
        upper_b = pred_y + z_val * stderr

        pred_y = np.clip(pred_y, 0, None)
        lower_b = np.clip(lower_b, 0, None)
        upper_b = np.clip(upper_b, 0, None)
    except Exception as e:
        print(f"ARIMA fit failed: {e}")
        mean_val = train_series.mean() if len(train_series) > 0 else 0
        pred_y = np.full(forecast_len, mean_val)
        lower_b = np.full(forecast_len, mean_val * 0.5)
        upper_b = np.full(forecast_len, mean_val * 1.5)

    metrics = None
    if test_series is not None and len(test_series) == forecast_len:
        mae = np.mean(np.abs(test_series - pred_y))
        rmse = np.sqrt(np.mean((test_series - pred_y) ** 2))
        non_zero_mask = test_series > 0
        if non_zero_mask.sum() > 0:
            test_nz = test_series[non_zero_mask]
            pred_nz = pred_y[non_zero_mask]
            mape = np.mean(np.abs(test_nz - pred_nz) / test_nz) * 100
        else:
            mape = 0.0
        metrics = {
            'MAE': round(float(mae), 4),
            'RMSE': round(float(rmse), 4),
            'MAPE': round(float(mape), 2)
        }

    return pred_y, lower_b, upper_b, metrics
