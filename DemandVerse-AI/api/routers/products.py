from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from ..dependencies import get_clean_sales

router = APIRouter()

@router.get("/stores", response_model=List[str])
def get_stores():
    """Returns a list of unique store IDs available in the dataset."""
    df = get_clean_sales()
    stores = df['store_id'].unique().tolist()
    return sorted(stores)

@router.get("/products", response_model=List[str])
def get_products(store: Optional[str] = Query(None, description="Filter products by store ID")):
    """Returns a list of unique product IDs, optionally filtered by store."""
    df = get_clean_sales()
    if store:
        if store not in df['store_id'].unique():
            raise HTTPException(status_code=404, detail=f"Store '{store}' not found.")
        df = df[df['store_id'] == store]
        
    products = df['item_id'].unique().tolist()
    return sorted(products)
