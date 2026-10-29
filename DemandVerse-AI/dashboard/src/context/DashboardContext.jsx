import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStores, getProducts, subscribeToNetworkStatus } from '../services/api';
import { useToast } from './ToastContext';

const DashboardContext = createContext();

export const DEMO_PRESETS = {
  stockout: {
    key: 'stockout',
    label: 'Stockout Risk',
    badge: 'Critical',
    store: 'CA_1',
    product: 'FOODS_3_586',
    description: 'High demand product with severe inventory deficit and immediate reorder required'
  },
  overstock: {
    key: 'overstock',
    label: 'Overstock',
    badge: 'Warning',
    store: 'CA_1',
    product: 'FOODS_3_080',
    description: 'Saturated stock holding exceeding safety limits, incurring holding cost'
  },
  healthy: {
    key: 'healthy',
    label: 'Healthy Stock',
    badge: 'Optimal',
    store: 'CA_1',
    product: 'FOODS_1_085',
    description: 'Balanced inventory meeting 30-day forecast buffer with optimal turnover'
  }
};

export const DashboardProvider = ({ children }) => {
  const { addToast } = useToast();
  
  const [storeOptions, setStoreOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  
  // Global Filters
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [horizon, setHorizon] = useState(30);
  const [scenario, setScenario] = useState('Normal Demand');
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState('synced');
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Layout state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  // Listen to network status
  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((status) => {
      setSyncStatus(status);
      if (status === 'synced') {
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    });
    return unsubscribe;
  }, []);

  // Fetch initial dropdown options
  useEffect(() => {
    let isMounted = true;
    const fetchStores = async () => {
      try {
        const stores = await getStores();
        if (isMounted) {
          setStoreOptions(stores);
          if (stores.length > 0 && !selectedStore) {
            setSelectedStore(stores[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching stores:", error);
      }
    };
    fetchStores();
    return () => { isMounted = false; };
  }, [selectedStore]);

  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        const products = await getProducts(selectedStore || undefined);
        if (isMounted) {
          setProductOptions(products);
          if (products.length > 0 && (!selectedProduct || !products.includes(selectedProduct))) {
            setSelectedProduct(products[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    if (selectedStore) {
      fetchProducts();
    }
    return () => { isMounted = false; };
  }, [selectedStore, selectedProduct]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const resetFilters = useCallback(() => {
    if (storeOptions.length > 0) setSelectedStore(storeOptions[0]);
    if (productOptions.length > 0) setSelectedProduct(productOptions[0]);
    setHorizon(30);
    setScenario('Normal Demand');
    triggerRefresh();
    addToast('Filters reset to default', 'info');
  }, [storeOptions, productOptions, triggerRefresh, addToast]);

  const setDemoPreset = useCallback((presetKey) => {
    const preset = DEMO_PRESETS[presetKey];
    if (preset) {
      if (storeOptions.includes(preset.store)) {
        setSelectedStore(preset.store);
      }
      setSelectedProduct(preset.product);
      setScenario('Normal Demand');
      triggerRefresh();
      
      const type = presetKey === 'stockout' ? 'error' : presetKey === 'overstock' ? 'warning' : 'success';
      addToast(`Loaded ${preset.label} scenario: ${preset.description}`, type, 5000);
    }
  }, [storeOptions, triggerRefresh, addToast]);

  const value = {
    storeOptions,
    productOptions,
    selectedStore,
    setSelectedStore,
    selectedProduct,
    setSelectedProduct,
    horizon,
    setHorizon,
    scenario,
    setScenario,
    resetFilters,
    setDemoPreset,
    syncStatus,
    lastSyncTime,
    refreshKey,
    triggerRefresh,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    DEMO_PRESETS
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboardContext = () => useContext(DashboardContext);
