from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import products, sales, forecasting, inventory, insights

app = FastAPI(
    title="DemandVerse AI API",
    description="API for accessing DemandVerse pre-calculated machine learning outputs and business insights.",
    version="1.0.0"
)

# Allow CORS for local development (dashboard integration)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(products.router, prefix="/api", tags=["Core Data"])
app.include_router(sales.router, prefix="/api", tags=["Core Data"])
app.include_router(forecasting.router, prefix="/api", tags=["Forecasting"])
app.include_router(inventory.router, prefix="/api", tags=["Inventory & Scenarios"])
app.include_router(insights.router, prefix="/api", tags=["Financials & Insights"])

@app.get("/")
def root():
    return {"message": "Welcome to DemandVerse AI API. Visit /docs for documentation."}

@app.get("/health", tags=["System"])
def health_check():
    """
    Backend system health check for Kubernetes / Docker Compose readiness probes.
    """
    return {
        "status": "ok",
        "service": "demandverse-api",
        "version": "1.0.0"
    }
