def select_best_model(arima_metrics, prophet_metrics):
    if arima_metrics['MAPE'] < prophet_metrics['MAPE']:
        return 'ARIMA'
    if prophet_metrics['MAPE'] < arima_metrics['MAPE']:
        return 'Prophet'

    if arima_metrics['MAE'] < prophet_metrics['MAE']:
        return 'ARIMA'
    if prophet_metrics['MAE'] < arima_metrics['MAE']:
        return 'Prophet'

    if arima_metrics['RMSE'] < prophet_metrics['RMSE']:
        return 'ARIMA'

    return 'Prophet'
