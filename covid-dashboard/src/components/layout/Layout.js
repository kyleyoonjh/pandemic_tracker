// src/components/Layout.js
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Dashboard.css';

const Layout = ({ children }) => {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // You could also add logic here to save the preference and apply a dark theme
  };
  
  return (
    <div className="app-container">
      <div className={`side-menu ${menuOpen ? 'open' : ''}`}>
        <div className="side-menu-header">
          <h2>Explore Data</h2>
        </div>
        
        <div className="menu-section">
          <div className="menu-section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
            VIEWS
          </div>
          <Link to="/" className={`menu-item ${location.pathname === '/' ? 'active' : ''}`}>
            Overview
          </Link>
          <Link to="/trends" className={`menu-item ${location.pathname === '/trends' ? 'active' : ''}`}>
            Trends & Forecasts
          </Link>
          <Link to="/vaccination" className={`menu-item ${location.pathname === '/vaccination' ? 'active' : ''}`}>
            Vaccination Progress
          </Link>
          <Link to="/testing" className={`menu-item ${location.pathname === '/testing' ? 'active' : ''}`}>
            Testing Data
          </Link>
        </div>
        
        <div className="menu-section">
          <div className="menu-section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 8v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h14a2 2 0 012 2z"></path>
              <path d="M2 10h20"></path>
              <path d="M7 15h10"></path>
            </svg>
            ANALYSIS
          </div>
          <Link to="/comparison" className={`menu-item ${location.pathname === '/comparison' ? 'active' : ''}`}>
            Country Comparison
          </Link>
          <Link to="/hotspots" className={`menu-item ${location.pathname === '/hotspots' ? 'active' : ''}`}>
            Current Hotspots
          </Link>
          <Link to="/recovery" className={`menu-item ${location.pathname === '/recovery' ? 'active' : ''}`}>
            Recovery Rates
          </Link>
        </div>
        
        <div className="menu-section">
          <div className="menu-section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20v-6M6 20V10M18 20V4"></path>
            </svg>
            SETTINGS
          </div>
          <Link to="/preferences" className={`menu-item ${location.pathname === '/preferences' ? 'active' : ''}`}>
            Display Preferences
          </Link>
          <Link to="/sources" className={`menu-item ${location.pathname === '/sources' ? 'active' : ''}`}>
            Data Sources
          </Link>
        </div>
      </div>
      
      <div className="main-content">
        <div className="top-nav">
          <div className="nav-links">
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link to="/about" className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}>
              About
            </Link>
            <Link to="/resources" className={`nav-link ${location.pathname === '/resources' ? 'active' : ''}`}>
              Resources
            </Link>
          </div>
          
          <div className="nav-right">
            <select className="data-source-dropdown">
              <option>Johns Hopkins University</option>
              <option>WHO</option>
              <option>Our World in Data</option>
            </select>
            
            <div className="last-updated-indicator">
              Last updated: {new Date().toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </div>
            
            <button className="theme-toggle" onClick={toggleDarkMode}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            
            <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
              menu
            </button>
          </div>
        </div>
        
        <div className="content-area">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;