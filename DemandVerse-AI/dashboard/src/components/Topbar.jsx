import React, { useState, useRef, useEffect } from 'react';
import { useDashboardContext } from '../context/DashboardContext';
import { useLocation } from 'react-router-dom';
import { 
  Search, X, RotateCcw, RefreshCw, Zap, 
  AlertTriangle, PackageCheck, CheckCircle2, ChevronDown,
  Store, Tag, Calendar, SlidersHorizontal, Menu
} from 'lucide-react';

const Topbar = () => {
  const {
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
    lastSyncTime,
    triggerRefresh,
    syncStatus,
    mobileNavOpen,
    setMobileNavOpen
  } = useDashboardContext();

  const location = useLocation();
  const path = location.pathname;

  const showHorizon = path === '/forecast';
  const showScenario = path === '/what-if' || path === '/financial';

  // Product Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);

  const filteredProducts = productOptions.filter(p => 
    p.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
        setSelectedProduct(filteredProducts[highlightedIndex]);
        setSearchQuery('');
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery, isOpen]);

  const renderSyncIndicator = () => {
    if (syncStatus === 'error') {
      return (
        <button type="button" className="sync-status-badge" onClick={triggerRefresh} style={{ borderColor: 'var(--status-danger)', color: 'var(--status-danger)' }}>
          <AlertTriangle size={12} />
          <span>Connection issue</span>
        </button>
      );
    }
    if (syncStatus === 'updating') {
      return (
        <div className="sync-status-badge">
          <RefreshCw size={12} className="sync-icon" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Updating...</span>
        </div>
      );
    }
    return (
      <button type="button" className="sync-status-badge" onClick={triggerRefresh}>
        <span className="sync-pulse-dot" />
        <RefreshCw size={12} className="sync-icon" />
        <span>Synced: {lastSyncTime}</span>
      </button>
    );
  };

  return (
    <header className="topbar">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
      {/* Tier 1: Core Filters & Global Synchronization Status */}
      <div className="topbar-primary-row">
        <div className="filters-group">
          {/* Mobile Menu Toggle */}
          <button 
            className="mobile-menu-btn d-md-none" 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'none' }} 
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          >
            <Menu size={20} />
          </button>
          
          <div className="brand d-md-none" style={{ display: 'none', marginRight: '1rem' }}>DemandVerse AI</div>

          {/* Store Selector */}
          <div className="filter-item">
            <div className="filter-label-group">
              <Store size={13} className="filter-label-icon" />
              <label className="filter-label" htmlFor="global-store-selector">Store</label>
            </div>
            <select 
              className="filter-select"
              value={selectedStore} 
              onChange={(e) => setSelectedStore(e.target.value)}
              id="global-store-selector"
            >
              {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Searchable Product Combobox */}
          <div className="filter-item product-combobox-wrapper" ref={dropdownRef}>
            <div className="filter-label-group">
              <Tag size={13} className="filter-label-icon" />
              <label className="filter-label" htmlFor="global-product-search">Product SKU</label>
            </div>
            <div className="product-search-input-box" onClick={() => setIsOpen(true)}>
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder={selectedProduct || "Search SKU..."}
                value={isOpen ? searchQuery : selectedProduct}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => {
                  setSearchQuery('');
                  setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
                id="global-product-search"
              />
              {selectedProduct && !isOpen && (
                <button 
                  type="button" 
                  className="combobox-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    setIsOpen(true);
                  }}
                >
                  <ChevronDown size={14} />
                </button>
              )}
            </div>

            {isOpen && (
              <div className="product-dropdown-menu">
                <div className="dropdown-header">
                  <span>Available SKUs ({filteredProducts.length})</span>
                  <button 
                    type="button" 
                    className="close-dropdown-btn"
                    onClick={() => setIsOpen(false)}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="dropdown-list">
                  {filteredProducts.length === 0 ? (
                    <div className="dropdown-empty">No products match "{searchQuery}"</div>
                  ) : (
                    filteredProducts.map((p, index) => (
                      <div 
                        key={p}
                        className={`dropdown-option ${p === selectedProduct ? 'active' : ''}`}
                        style={{ backgroundColor: highlightedIndex === index ? 'rgba(255,255,255,0.06)' : undefined }}
                        onClick={() => {
                          setSelectedProduct(p);
                          setSearchQuery('');
                          setIsOpen(false);
                        }}
                      >
                        <span>{p}</span>
                        {p === selectedProduct && <span className="option-active-badge">Active</span>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Forecast Horizon (Conditional) */}
          {showHorizon && (
            <div className="filter-item">
              <div className="filter-label-group">
                <Calendar size={13} className="filter-label-icon" />
                <label className="filter-label" htmlFor="forecast-horizon-selector">Horizon</label>
              </div>
              <select 
                className="filter-select"
                value={horizon} 
                onChange={(e) => setHorizon(Number(e.target.value))}
                id="forecast-horizon-selector"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
          )}

          {/* What-If Scenario (Conditional) */}
          {showScenario && (
            <div className="filter-item">
              <div className="filter-label-group">
                <SlidersHorizontal size={13} className="filter-label-icon" />
                <label className="filter-label" htmlFor="whatif-scenario-selector">Scenario</label>
              </div>
              <select 
                className="filter-select"
                value={scenario} 
                onChange={(e) => setScenario(e.target.value)}
                id="whatif-scenario-selector"
              >
                <option value="Low Demand (-10%)">Low Demand (-10%)</option>
                <option value="Normal Demand">Normal Demand</option>
                <option value="High Demand (+10%)">High Demand (+10%)</option>
              </select>
            </div>
          )}

          {/* Reset Filters */}
          <div className="filter-item action-btn-item">
            <button 
              type="button"
              className="btn-reset" 
              onClick={resetFilters}
              title="Reset to default filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div className="topbar-sync-group">
          {renderSyncIndicator()}
        </div>
      </div>

      {/* Tier 2: Interactive Demo Presets & Active Context */}
      <div className="topbar-secondary-row">
        <div className="demo-presets-cluster">
          <div className="demo-badge-label">
            <Zap size={12} className="demo-badge-icon" />
            <span>Demo Presets</span>
          </div>

          <div className="demo-pills-list">
            <button 
              type="button"
              className={`demo-pill stockout ${selectedProduct === 'FOODS_3_586' ? 'active-pill' : ''}`}
              onClick={() => setDemoPreset('stockout')}
              title="Demonstrate Stockout Risk SKU (FOODS_3_586)"
            >
              <AlertTriangle size={12} />
              <span>Stockout Risk</span>
              {selectedProduct === 'FOODS_3_586' && <span className="active-dot" />}
            </button>

            <button 
              type="button"
              className={`demo-pill overstock ${selectedProduct === 'FOODS_3_080' ? 'active-pill' : ''}`}
              onClick={() => setDemoPreset('overstock')}
              title="Demonstrate Overstock SKU (FOODS_3_080)"
            >
              <PackageCheck size={12} />
              <span>Overstock</span>
              {selectedProduct === 'FOODS_3_080' && <span className="active-dot" />}
            </button>

            <button 
              type="button"
              className={`demo-pill healthy ${selectedProduct === 'FOODS_1_085' ? 'active-pill' : ''}`}
              onClick={() => setDemoPreset('healthy')}
              title="Demonstrate Healthy balanced inventory portfolio (FOODS_1_085)"
            >
              <CheckCircle2 size={12} />
              <span>Healthy</span>
              {selectedProduct === 'FOODS_1_085' && <span className="active-dot" />}
            </button>
          </div>
        </div>

        <div className="topbar-context-tag">
          <span className="context-label">Active:</span>
          <span className="context-chip store-chip">{selectedStore}</span>
          <span className="context-divider">/</span>
          <span className="context-chip product-chip">{selectedProduct}</span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
