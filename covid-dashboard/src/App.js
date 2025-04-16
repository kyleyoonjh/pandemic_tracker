// Src / App.js
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ThemeProvider from './components/ui/ThemeProvider';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
//import Dashboard from './components/dashboard/Dashboard';
import Dashboard from './components/Dashboard';
import Footer from './components/layout/Footer';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loader from './components/common/Loader';
import { fetchDashboardData } from './redux/actions/dataActions';
import { toggleSidebar, setTheme } from './redux/actions/uiActions';
import './styles/global.css';

// Placeholder components for other routes
const About = () => <div className="dashboard-container"><h1>About</h1><p>Information about this COVID-19 dashboard.</p></div>;
const Resources = () => <div className="dashboard-container"><h1>Resources</h1><p>COVID-19 resources and information.</p></div>;
const Trends = () => <div className="dashboard-container"><h1>Trends & Forecasts</h1><p>COVID-19 trends analysis.</p></div>;
const Vaccination = () => <div className="dashboard-container"><h1>Vaccination Progress</h1><p>Global vaccination data.</p></div>;
const Testing = () => <div className="dashboard-container"><h1>Testing Data</h1><p>COVID-19 testing statistics.</p></div>;
const Comparison = () => <div className="dashboard-container"><h1>Country Comparison</h1><p>Compare COVID-19 metrics between countries.</p></div>;
const Hotspots = () => <div className="dashboard-container"><h1>Current Hotspots</h1><p>COVID-19 hotspot analysis.</p></div>;
const Recovery = () => <div className="dashboard-container"><h1>Recovery Rates</h1><p>COVID-19 recovery statistics.</p></div>;
const Preferences = () => <div className="dashboard-container"><h1>Display Preferences</h1><p>Customize your dashboard experience.</p></div>;
const Sources = () => <div className="dashboard-container"><h1>Data Sources</h1><p>Information about data sources used in this dashboard.</p></div>;

const AppContent = () => {
  const dispatch = useDispatch();
  const { theme, sidebar, loading } = useSelector(state => state.ui);
  const darkMode = theme === 'dark';
  const sidebarOpen = sidebar.open;
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load initial data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await dispatch(fetchDashboardData());
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setInitialLoadComplete(true);
      }
    };
    loadData();

    // Handle responsive sidebar based on screen size
    const handleResize = () => {
      if (window.innerWidth < 768 && sidebarOpen) {
        dispatch(toggleSidebar());
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch, sidebarOpen]);

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Determine if any part of the UI is loading
  const isLoading = loading.global || loading.maps || loading.charts;

  const renderRouteContent = (Component) => (
    <ErrorBoundary showDetails={true} onRetry={() => dispatch(fetchDashboardData())}>
      {(!initialLoadComplete || isLoading) ? (
        <div className="loading-container">
          <Loader size="large" />
          <p>Loading COVID-19 dashboard data...</p>
        </div>
      ) : (
        <Component />
      )}
    </ErrorBoundary>
  );

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
      <Header />
      <div className="main-content">
        <Sidebar />
        <main className={`dashboard-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <Routes>
            <Route path="/" element={renderRouteContent(Dashboard)} />
            <Route path="/about" element={<About />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/vaccination" element={<Vaccination />} />
            <Route path="/testing" element={<Testing />} />
            <Route path="/comparison" element={<Comparison />} />
            <Route path="/hotspots" element={<Hotspots />} />
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/sources" element={<Sources />} />
          </Routes>
        </main>
      </div>
      <Footer />
    </div>
  );
};

const App = () => {
  const { theme } = useSelector(state => state.ui);
  const darkMode = theme === 'dark';

  return (
    <Router>
      <ThemeProvider defaultTheme={darkMode ? 'dark' : 'light'}>
        <AppContent />
      </ThemeProvider>
    </Router>
  );
};

export default App;