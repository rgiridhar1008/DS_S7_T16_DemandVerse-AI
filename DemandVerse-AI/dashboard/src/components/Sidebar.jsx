import React from 'react';
import { NavLink } from 'react-router-dom';
import { useDashboardContext } from '../context/DashboardContext';
import { 
  LayoutDashboard, 
  TrendingUp, 
  LineChart, 
  Scale, 
  Package, 
  GitBranch, 
  DollarSign, 
  Lightbulb,
  Activity,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

const Sidebar = () => {
  const { sidebarCollapsed, setSidebarCollapsed, mobileNavOpen, setMobileNavOpen } = useDashboardContext();

  const navGroups = [
    {
      title: 'Overview',
      items: [
        { name: 'Executive Dashboard', path: '/executive', icon: LayoutDashboard }
      ]
    },
    {
      title: 'Analytics',
      items: [
        { name: 'Sales Analytics', path: '/sales', icon: TrendingUp },
        { name: 'Demand Forecast', path: '/forecast', icon: LineChart },
        { name: 'Model Comparison', path: '/model-comparison', icon: Scale }
      ]
    },
    {
      title: 'Operations',
      items: [
        { name: 'Inventory', path: '/inventory', icon: Package },
        { name: 'What-If Analysis', path: '/what-if', icon: GitBranch },
        { name: 'Financial Impact', path: '/financial', icon: DollarSign }
      ]
    },
    {
      title: 'Intelligence & Lineage',
      items: [
        { name: 'Business Insights', path: '/insights', icon: Lightbulb },
        { name: 'System Health', path: '/system-health', icon: Activity }
      ]
    }
  ];

  return (
    <>
      {mobileNavOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50 }} 
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <img src="/logo.png" alt="DemandVerse AI" className="brand-text" style={{ height: '100px', objectFit: 'contain', margin: '0 auto' }} />
          <button 
            className="d-md-none" 
            style={{ position: 'absolute', right: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'none' }}
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="nav-menu" style={{ flex: 1, overflowY: 'auto' }}>
          {navGroups.map((group, idx) => (
            <div key={idx} style={{ marginBottom: '1.5rem' }}>
              {!sidebarCollapsed && (
                <div style={{ 
                  fontSize: '0.7rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em', 
                  color: 'var(--text-tertiary)',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  paddingLeft: '0.5rem'
                }}>
                  {group.title}
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink 
                      key={item.path} 
                      to={item.path} 
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                      title={sidebarCollapsed ? item.name : undefined}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <Icon size={20} />
                      <span className="nav-text" style={{ whiteSpace: 'nowrap' }}>{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-end' }}>
          <button 
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
