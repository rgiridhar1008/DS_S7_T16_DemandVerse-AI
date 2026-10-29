import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardProvider, useDashboardContext } from './context/DashboardContext';
import { ToastProvider } from './context/ToastContext';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

// Pages/Features
import ExecutiveDashboard from './features/ExecutiveDashboard';
import SalesAnalytics from './features/SalesAnalytics';
import DemandForecast from './features/DemandForecast';
import ModelComparison from './features/ModelComparison';
import InventoryIntelligence from './features/InventoryIntelligence';
import WhatIfAnalysis from './features/WhatIfAnalysis';
import FinancialImpact from './features/FinancialImpact';
import BusinessInsights from './features/BusinessInsights';
import SystemHealth from './features/SystemHealth';

const AppLayout = () => {
  const { sidebarCollapsed } = useDashboardContext();
  
  return (
    <div className="app-container">
      <Sidebar />
      <main className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        <Topbar />
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Navigate to="/executive" replace />} />
            <Route path="/dashboard" element={<Navigate to="/executive" replace />} />
            <Route path="/executive" element={<ExecutiveDashboard />} />
            <Route path="/sales" element={<SalesAnalytics />} />
            <Route path="/forecast" element={<DemandForecast />} />
            <Route path="/model-comparison" element={<ModelComparison />} />
            <Route path="/inventory" element={<InventoryIntelligence />} />
            <Route path="/what-if" element={<WhatIfAnalysis />} />
            <Route path="/financial" element={<FinancialImpact />} />
            <Route path="/insights" element={<BusinessInsights />} />
            <Route path="/system-health" element={<SystemHealth />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <ToastProvider>
      <DashboardProvider>
        <Router>
          <AppLayout />
        </Router>
      </DashboardProvider>
    </ToastProvider>
  );
}

export default App;
