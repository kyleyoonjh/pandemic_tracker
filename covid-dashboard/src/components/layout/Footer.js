// src / components / layout / Footer.js
import React from 'react';
import '../../styles/components/layout.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>Pandemic Dashboard</h3>
          <p>An interactive visualization tool for tracking Pandemic statistics worldwide.</p>
        </div>
        
        <div className="footer-section">
          <h3>Data Sources</h3>
          <ul>
            <li><a href="https://disease.sh/" target="_blank" rel="noopener noreferrer">disease.sh</a></li>
            <li><a href="https://github.com/CSSEGISandData/COVID-19" target="_blank" rel="noopener noreferrer">Johns Hopkins CSSE</a></li>
            <li><a href="https://covid19.who.int/" target="_blank" rel="noopener noreferrer">World Health Organization</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h3>Resources</h3>
          <ul>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#api">API Documentation</a></li>
            <li><a href="#github" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
          </ul>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} Pandemic Interactive Dashboard. All data is provided for educational and informational purposes only.</p>
        <p>This dashboard is not affiliated with any health organization or government entity.</p>
      </div>
    </footer>
  );
};

export default Footer;