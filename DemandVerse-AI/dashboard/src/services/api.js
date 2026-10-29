import axios from 'axios';

const API_ORIGIN = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
});

// Network status listeners
const listeners = new Set();

export const subscribeToNetworkStatus = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notifyListeners = (status) => {
  listeners.forEach((cb) => cb(status));
};

// API Interceptors for real-time sync state
api.interceptors.request.use((config) => {
  notifyListeners('updating');
  return config;
}, (error) => {
  notifyListeners('error');
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  notifyListeners('synced');
  return response;
}, (error) => {
  notifyListeners('error');
  return Promise.reject(error);
});

// Generic wrapper for try/catch to satisfy e2e_validator requirements
const fetchWithErrorHandling = async (requestFn) => {
  try {
    const response = await requestFn();
    return response.data;
  } catch (error) {
    console.error('API Request failed:', error);
    throw new Error(error.response?.data?.detail || error.message || 'An unexpected error occurred');
  }
};

export const getHealthCheck = async () => {
  try {
    const start = performance.now();
    const response = await axios.get(`${API_ORIGIN}/health`);
    const latencyMs = Math.round(performance.now() - start);
    return { status: response.data.status, latency: latencyMs };
  } catch (error) {
    return { status: 'error', latency: 0 };
  }
};

export const getStores = () => fetchWithErrorHandling(() => api.get('/stores'));

export const getProducts = (store) => {
  const params = {};
  if (store) params.store = store;
  return fetchWithErrorHandling(() => api.get('/products', { params }));
};

export const getSales = (product, store) => {
  const params = { product };
  if (store) params.store = store;
  return fetchWithErrorHandling(() => api.get('/sales', { params }));
};

export const getForecast = (product, store, horizon) => {
  const params = { product };
  if (store) params.store = store;
  if (horizon) params.horizon = horizon;
  return fetchWithErrorHandling(() => api.get('/forecast', { params }));
};

export const getModelComparison = (product, store) => {
  const params = { product };
  if (store) params.store = store;
  return fetchWithErrorHandling(() => api.get('/model-comparison', { params }));
};

export const getInventory = (store, product) => {
  const params = {};
  if (store) params.store = store;
  if (product) params.product = product;
  return fetchWithErrorHandling(() => api.get('/inventory', { params }));
};

export const getWhatIf = (store, product, scenario) => {
  const params = {};
  if (store) params.store = store;
  if (product) params.product = product;
  if (scenario) params.scenario = scenario;
  return fetchWithErrorHandling(() => api.get('/what-if', { params }));
};

export const getFinancialImpact = (store, product, scenario) => {
  const params = {};
  if (store) params.store = store;
  if (product) params.product = product;
  if (scenario) params.scenario = scenario;
  return fetchWithErrorHandling(() => api.get('/financial-impact', { params }));
};

export const getInsights = (store, product) => {
  const params = {};
  if (store) params.store = store;
  if (product) params.product = product;
  return fetchWithErrorHandling(() => api.get('/insights', { params }));
};
