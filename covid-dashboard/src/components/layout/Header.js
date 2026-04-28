// src / compnents / layout / Header.js
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleThemeAction } from '../../redux/actions/uiActions';
import '../../styles/components/layout.css';

const Header = () => {
  const dispatch = useDispatch();
  const { darkMode } = useSelector(state => state.ui);
  const [compactMenuOpen, setCompactMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('#dashboard');

  useEffect(() => {
    const syncHash = () => {
      const nextHash = window.location.hash || '#dashboard';
      setActiveHash(nextHash);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);
  
  const handleThemeToggle = () => {
    dispatch(toggleThemeAction());
  };
  
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <span className="logo-text">
            Pandemic Tracker<span className="logo-accent"> Sea-Through</span>
          </span>
        </div>
        
        <nav className="nav-links">
          <a href="#dashboard" className={`nav-link ${activeHash === '#dashboard' ? 'active' : ''}`}>Covid-19</a>
          <a href="#about" className={`nav-link ${activeHash === '#about' ? 'active' : ''}`}>백일해</a>
          <a href="#resources" className={`nav-link ${activeHash === '#resources' ? 'active' : ''}`}>AI Agent</a>
        </nav>

        <div className="compact-menu-wrap">
          <button
            type="button"
            className="compact-menu-button"
            aria-label="Open navigation menu"
            onClick={() => setCompactMenuOpen((prev) => !prev)}
          >
            Menu
          </button>
          {compactMenuOpen && (
            <div className="compact-menu-dropdown">
              <a href="#dashboard" className={`compact-menu-link ${activeHash === '#dashboard' ? 'active' : ''}`} onClick={() => setCompactMenuOpen(false)}>Covid-19</a>
              <a href="#about" className={`compact-menu-link ${activeHash === '#about' ? 'active' : ''}`} onClick={() => setCompactMenuOpen(false)}>백일해</a>
              <a href="#resources" className={`compact-menu-link ${activeHash === '#resources' ? 'active' : ''}`} onClick={() => setCompactMenuOpen(false)}>AI Agent</a>
            </div>
          )}
        </div>
        
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