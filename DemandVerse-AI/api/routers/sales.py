from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from ..dependencies import get_clean_sales
from ..utils import sanitize_data
router = APIRouter()

@router.get("/sales", response_model=List[Dict[str, Any]])
def get_sales(
    product: str = Query(..., description="Product ID to retrieve sales for"),
    store: Optional[str] = Query(None, description="Filter by store ID")
):
    """Returns historical sales data for a given product."""
    df = get_clean_sales()
    
    # Check if product exists
    if product not in df['item_id'].unique():
        raise HTTPException(status_code=404, detail=f"Product '{product}' not found.")
        
    filtered = df[df['item_id'] == product]
    
    if store:
        if store not in df['store_id'].unique():
            raise HTTPException(status_code=404, detail=f"Store '{store}' not found.")
        filtered = filtered[filtered['store_id'] == store]
        
    # Sort by date chronologically
    filtered = filtered.sort_values('date')
    
    # Return as list of dictionaries
    records = filtered.to_dict(orient='records')
    return sanitize_data(records)
