def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "DemandVerse AI API" in response.json()["message"]

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_get_stores(client):
    response = client.get("/api/stores")
    assert response.status_code == 200
    stores = response.json()
    assert isinstance(stores, list)
    assert "CA_1" in stores

def test_get_products(client):
    response = client.get("/api/products")
    assert response.status_code == 200
    products = response.json()
    assert isinstance(products, list)
    assert len(products) > 0
    # Test valid store filter
    response = client.get("/api/products?store=CA_1")
    assert response.status_code == 200
    # Test invalid store
    response = client.get("/api/products?store=INVALID_STORE")
    assert response.status_code == 404

def test_get_sales(client):
    # Missing required product parameter
    response = client.get("/api/sales")
    assert response.status_code == 422

    # Valid product
    response = client.get("/api/sales?product=FOODS_3_586")
    assert response.status_code == 200
    sales = response.json()
    assert isinstance(sales, list)
    if len(sales) > 0:
        assert "date" in sales[0]
        assert "sales" in sales[0]

    # Valid product and valid store
    response = client.get("/api/sales?product=FOODS_3_586&store=CA_1")
    assert response.status_code == 200

    # Non-existent product
    response = client.get("/api/sales?product=NON_EXISTENT_PRODUCT")
    assert response.status_code == 404

    # Invalid store
    response = client.get("/api/sales?product=FOODS_3_586&store=INVALID_STORE")
    assert response.status_code == 404

def test_get_forecast(client):
    # Valid forecast
    response = client.get("/api/forecast?product=FOODS_3_586")
    assert response.status_code == 200
    forecast = response.json()
    assert isinstance(forecast, list)
    assert len(forecast) == 30
    assert "predicted_demand" in forecast[0]

    # Horizons: 7, 14, 30
    r7 = client.get("/api/forecast?product=FOODS_3_586&horizon=7")
    assert r7.status_code == 200
    assert len(r7.json()) == 7

    r14 = client.get("/api/forecast?product=FOODS_3_586&horizon=14")
    assert r14.status_code == 200
    assert len(r14.json()) == 14

    # Invalid horizon (< 1 or > 30)
    assert client.get("/api/forecast?product=FOODS_3_586&horizon=0").status_code == 400
    assert client.get("/api/forecast?product=FOODS_3_586&horizon=31").status_code == 400
    assert client.get("/api/forecast?product=FOODS_3_586&horizon=-5").status_code == 400

    # Invalid product
    assert client.get("/api/forecast?product=NON_EXISTENT").status_code == 404

    # Valid store filter
    r_store = client.get("/api/forecast?product=FOODS_3_586&store=CA_1")
    assert r_store.status_code == 200

    # Invalid store
    assert client.get("/api/forecast?product=FOODS_3_586&store=INVALID_STORE").status_code == 404

def test_get_model_comparison(client):
    response = client.get("/api/model-comparison?product=FOODS_3_586")
    assert response.status_code == 200
    metrics = response.json()
    assert "product_id" in metrics
    assert "ARIMA_MAE" in metrics
    assert "Prophet_MAE" in metrics
    assert "Selected_Model" in metrics

    # Optional store filter
    r_store = client.get("/api/model-comparison?product=FOODS_3_586&store=CA_1")
    assert r_store.status_code == 200

    # Invalid product
    assert client.get("/api/model-comparison?product=NON_EXISTENT").status_code == 404

    # Invalid store
    assert client.get("/api/model-comparison?product=FOODS_3_586&store=INVALID_STORE").status_code == 404

def test_get_inventory(client):
    response = client.get("/api/inventory")
    assert response.status_code == 200
    inv = response.json()
    assert isinstance(inv, list)
    
    response = client.get("/api/inventory?product=FOODS_3_586")
    assert response.status_code == 200
    assert len(response.json()) == 1

    # Valid store
    response = client.get("/api/inventory?store=CA_1&product=FOODS_3_586")
    assert response.status_code == 200

    # Invalid store
    assert client.get("/api/inventory?store=INVALID_STORE").status_code == 404

    # Invalid product
    assert client.get("/api/inventory?product=NON_EXISTENT").status_code == 404

def test_get_what_if(client):
    response = client.get("/api/what-if")
    assert response.status_code == 200
    scenarios = response.json()
    assert isinstance(scenarios, list)

    response = client.get("/api/what-if?scenario=Normal Demand")
    assert response.status_code == 200
    scenarios = response.json()
    for s in scenarios:
        assert s["Scenario"] == "Normal Demand"

    response = client.get("/api/what-if?scenario=INVALID")
    assert response.status_code == 400

    # Valid product and store
    r_prod = client.get("/api/what-if?product=FOODS_3_586&store=CA_1")
    assert r_prod.status_code == 200

    # Invalid store
    assert client.get("/api/what-if?store=INVALID_STORE").status_code == 404

def test_get_financial_impact(client):
    response = client.get("/api/financial-impact")
    assert response.status_code == 200
    financials = response.json()
    assert isinstance(financials, list)
    if len(financials) > 0:
        assert "Forecasted_Revenue" in financials[0]

    # Specific product and scenario
    r_spec = client.get("/api/financial-impact?product=FOODS_3_586&scenario=Normal Demand&store=CA_1")
    assert r_spec.status_code == 200
    assert len(r_spec.json()) == 1

    # Invalid scenario
    assert client.get("/api/financial-impact?scenario=INVALID").status_code == 400

    # Invalid store
    assert client.get("/api/financial-impact?store=INVALID_STORE").status_code == 404

def test_get_insights(client):
    response = client.get("/api/insights")
    assert response.status_code == 200
    insights = response.json()
    assert isinstance(insights, list)
    if len(insights) > 0:
        assert "Reason" in insights[0] or "reason" in insights[0]

    # Specific product and store
    r_spec = client.get("/api/insights?product=FOODS_3_586&store=CA_1")
    assert r_spec.status_code == 200

    # Invalid store
    assert client.get("/api/insights?store=INVALID_STORE").status_code == 404

    # Invalid product
    assert client.get("/api/insights?product=NON_EXISTENT").status_code == 404

def test_zero_nan_or_inf_across_all_endpoints(client):
    endpoints = ["/api/sales?product=FOODS_3_586", "/api/forecast?product=FOODS_3_586", 
                 "/api/inventory?product=FOODS_3_586", "/api/what-if?product=FOODS_3_586", 
                 "/api/financial-impact?product=FOODS_3_586", "/api/model-comparison?product=FOODS_3_586",
                 "/api/insights?product=FOODS_3_586"]
    
    def check_for_nan(obj):
        if isinstance(obj, dict):
            for v in obj.values():
                check_for_nan(v)
        elif isinstance(obj, list):
            for v in obj:
                check_for_nan(v)
        elif isinstance(obj, str):
            assert obj.lower() not in ["nan", "infinity", "-infinity"]
        elif isinstance(obj, float):
            import math
            assert not math.isnan(obj)
            assert not math.isinf(obj)

    for ep in endpoints:
        resp = client.get(ep)
        if resp.status_code == 200:
            check_for_nan(resp.json())

def test_what_if_all_scenarios_mathematical_consistency(client):
    resp = client.get("/api/what-if?product=FOODS_3_586")
    scenarios = resp.json()
    if not scenarios: return

    for s in scenarios:
        demand = s.get('Scenario_Forecasted_Demand', 0)
        req = s.get('Required_Stock', 0)
        curr = s.get('Current_Simulated_Stock', 0)
        shortage = s.get('Shortage_Quantity', 0)
        reorder = s.get('Reorder_Quantity', 0)

        # Reorder quantity should be equal to shortage
        assert reorder == shortage
        # Shortage is max(0, req - curr)
        expected_shortage = max(0, req - curr)
        assert abs(shortage - expected_shortage) < 1.0

def test_financial_impact_mathematical_consistency(client):
    resp = client.get("/api/financial-impact?product=FOODS_3_586")
    financials = resp.json()
    if not financials: return
    
    for f in financials:
        unit_price = f.get('unit_price')
        if unit_price is None:
            assert f.get('Forecasted_Revenue') is None
            assert f.get('Revenue_at_Risk') is None
            assert f.get('Overstock_Holding_Cost') is None
        else:
            scenario_demand = f.get('Scenario_Forecasted_Demand', f.get('scenario_demand', 0))
            shortage = f.get('Shortage_Quantity', f.get('shortage', 0))
            
            exp_rev = round(scenario_demand * unit_price, 2)
            exp_risk = round(shortage * unit_price, 2)
            
            # Using a small tolerance due to float rounding issues in DB
            assert abs(f.get('Forecasted_Revenue', 0) - exp_rev) < 2.0
            assert abs(f.get('Revenue_at_Risk', 0) - exp_risk) < 2.0

