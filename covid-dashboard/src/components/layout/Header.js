// src / compnents / layout / Header.js
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleThemeAction } from '../../redux/actions/uiActions';
import '../../styles/components/layout.css';

const Header = () => {
  const dispatch = useDispatch();
  const { darkMode } = useSelector(state => state.ui);
  
  const handleThemeToggle = () => {
    dispatch(toggleThemeAction());
  };
  
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <span className="logo-text">Covid-19 Pandemic Tracker</span>
        </div>
        
        <nav className="nav-links">
          <a href="#dashboard" className="nav-link active">Dashboard</a>
          <a href="#about" className="nav-link">About</a>
          <a href="#resources" className="nav-link">Resources</a>
        </nav>
        
        <div className="header-actions">
          <div className="data-source-wrapper">
            <select className="data-source-selector">
              <option value="jhu">Johns Hopkins University</option>
              <option value="who">World Health Organization</option>
            </select>
          </div>
          
          <div className="last-updated">
            Last updated: {new Date().toLocaleString()}
          </div>
          
          <button
            className="theme-toggle"
            onClick={handleThemeToggle}
            aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          
          <button className="mobile-menu-button" aria-label="Toggle mobile menu">
            <span className="material-icons">menu</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;