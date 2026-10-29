from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from ..dependencies import get_final_forecasts, get_model_comparison
from ..utils import sanitize_data
router = APIRouter()

@router.get("/forecast", response_model=List[Dict[str, Any]])
def get_forecast(
    product: str = Query(..., description="Product ID to retrieve forecast for"),
    store: Optional[str] = Query(None, description="Filter by store ID"),
    horizon: Optional[int] = Query(30, description="Number of days to return (max 30)")
):
    """Returns the forecasted sales for the next N days."""
    if horizon is not None and (horizon <= 0 or horizon > 30):
        raise HTTPException(status_code=400, detail="Horizon must be between 1 and 30 days.")

    df = get_final_forecasts()
    
    # Check if product exists
    if product not in df['product_id'].unique():
        raise HTTPException(status_code=404, detail=f"Product '{product}' not found in forecasts.")
        
    filtered = df[df['product_id'] == product]
    
    if store:
        if 'store_id' in df.columns:
            if store not in df['store_id'].unique():
                raise HTTPException(status_code=404, detail=f"Store '{store}' not found in forecasts.")
            filtered = filtered[filtered['store_id'] == store]
        
    filtered = filtered.sort_values('date')
    
    # Limit horizon
    if horizon and horizon > 0:
        filtered = filtered.head(horizon)
        
    records = filtered.to_dict(orient='records')
    return sanitize_data(records)

@router.get("/model-comparison", response_model=Dict[str, Any])
def get_model_comparison_metrics(
    product: str = Query(..., description="Product ID to retrieve model metrics for"),
    store: Optional[str] = Query(None, description="Optional filter by store ID")
):
    """Returns ARIMA and Prophet evaluation metrics for a specific product and store."""
    df = get_model_comparison()
    
    if product not in df['product_id'].unique():
        raise HTTPException(status_code=404, detail=f"Product '{product}' not found in model metrics.")
    
    filtered = df[df['product_id'] == product]
    
    if store:
        if 'store_id' in df.columns:
            if store not in df['store_id'].unique():
                raise HTTPException(status_code=404, detail=f"Store '{store}' not found in model metrics.")
            filtered = filtered[filtered['store_id'] == store]
            if filtered.empty:
                raise HTTPException(status_code=404, detail=f"Product '{product}' not found for store '{store}'.")

    row = filtered.iloc[0]
    record = row.to_dict()
    return sanitize_data(record)
