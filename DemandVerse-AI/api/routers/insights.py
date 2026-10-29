from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from ..dependencies import get_financial_impact, get_product_insights
from ..utils import sanitize_data, normalize_financial_record
router = APIRouter()

@router.get("/financial-impact", response_model=List[Dict[str, Any]])
def get_financial_impact_data(
    store: Optional[str] = Query(None, description="Filter by store ID"),
    product: Optional[str] = Query(None, description="Filter by product ID"),
    scenario: Optional[str] = Query(None, description="Filter by scenario")
):
    """Returns financial projections including revenue at risk and overstock holding costs."""
    df = get_financial_impact()
    
    prod_col = 'item_id' if 'item_id' in df.columns else 'product_id'
    
    if store:
        if 'store_id' in df.columns:
            if store not in df['store_id'].unique():
                raise HTTPException(status_code=404, detail=f"Store '{store}' not found in financial data.")
            df = df[df['store_id'] == store]
            
    if product:
        if product not in df[prod_col].unique():
            raise HTTPException(status_code=404, detail=f"Product '{product}' not found in financial data.")
        df = df[df[prod_col] == product]
        
    if scenario:
        if scenario not in df['Scenario'].unique():
            valid_scenarios = df['Scenario'].unique().tolist()
            raise HTTPException(status_code=400, detail=f"Invalid scenario '{scenario}'. Valid scenarios are: {valid_scenarios}")
        df = df[df['Scenario'] == scenario]
        
    records = df.to_dict(orient='records')
    records = sanitize_data(records)
    return [normalize_financial_record(row) for row in records]

@router.get("/insights", response_model=List[Dict[str, Any]])
def get_business_insights(
    store: Optional[str] = Query(None, description="Filter by store ID"),
    product: Optional[str] = Query(None, description="Filter by product ID")
):
    """Returns generated text-based business insights and action recommendations."""
    df = get_product_insights()
    
    if store:
        store_col = 'Store' if 'Store' in df.columns else ('store_id' if 'store_id' in df.columns else None)
        if store_col:
            if store not in df[store_col].unique():
                raise HTTPException(status_code=404, detail=f"Store '{store}' not found in insights.")
            df = df[df[store_col] == store]
            
    if product:
        prod_col = 'Product' if 'Product' in df.columns else ('product_id' if 'product_id' in df.columns else 'item_id')
        if product not in df[prod_col].unique():
            raise HTTPException(status_code=404, detail=f"Product '{product}' not found in insights.")
        df = df[df[prod_col] == product]
        
    records = df.to_dict(orient='records')
    return sanitize_data(records)
