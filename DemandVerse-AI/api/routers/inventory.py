from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from ..dependencies import get_inventory_recommendations, get_what_if_analysis
from ..utils import sanitize_data, normalize_what_if_record
router = APIRouter()

@router.get("/inventory", response_model=List[Dict[str, Any]])
def get_inventory(
    store: Optional[str] = Query(None, description="Filter by store ID"),
    product: Optional[str] = Query(None, description="Filter by product ID")
):
    """Returns inventory recommendations, including simulated stock and required safety levels."""
    df = get_inventory_recommendations()
    
    if store:
        if 'store_id' in df.columns:
            if store not in df['store_id'].unique():
                raise HTTPException(status_code=404, detail=f"Store '{store}' not found in inventory recommendations.")
            df = df[df['store_id'] == store]
        
    if product:
        if product not in df['item_id'].unique():
            raise HTTPException(status_code=404, detail=f"Product '{product}' not found in inventory recommendations.")
        df = df[df['item_id'] == product]
        
    records = df.to_dict(orient='records')
    records = sanitize_data(records)
    return [normalize_what_if_record(row) for row in records]

@router.get("/what-if", response_model=List[Dict[str, Any]])
def get_what_if(
    store: Optional[str] = Query(None, description="Filter by store ID"),
    product: Optional[str] = Query(None, description="Filter by product ID"),
    scenario: Optional[str] = Query(None, description="Filter by scenario (e.g., 'Normal Demand', 'Low Demand (-10%)')")
):
    """Returns what-if analysis data for demand scenarios."""
    df = get_what_if_analysis()
    
    # Handle either product_id or item_id in the output
    prod_col = 'item_id' if 'item_id' in df.columns else 'product_id'
    
    if store:
        if 'store_id' in df.columns:
            if store not in df['store_id'].unique():
                raise HTTPException(status_code=404, detail=f"Store '{store}' not found in what-if analysis.")
            df = df[df['store_id'] == store]
            
    if product:
        if product not in df[prod_col].unique():
            raise HTTPException(status_code=404, detail=f"Product '{product}' not found in what-if analysis.")
        df = df[df[prod_col] == product]
        
    if scenario:
        if scenario not in df['Scenario'].unique():
            valid_scenarios = df['Scenario'].unique().tolist()
            raise HTTPException(status_code=400, detail=f"Invalid scenario '{scenario}'. Valid scenarios are: {valid_scenarios}")
        df = df[df['Scenario'] == scenario]
        
    records = df.to_dict(orient='records')
    records = sanitize_data(records)
    return [normalize_what_if_record(row) for row in records]
