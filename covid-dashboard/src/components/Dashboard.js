// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
//import { fetchGlobalData, fetchCountriesData, fetchHistoricalData } from '../api/service';
import { fetchGlobalData, fetchAllCountries as fetchCountriesData, fetchHistoricalAllData as fetchHistoricalData } from '../api/service';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import PieChart from './charts/PieChart';
import WorldMap from './charts/WorldMap';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [globalData, setGlobalData] = useState(null);
  const [countriesData, setCountriesData] = useState([]);
  const [historicalData, setHistoricalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI state
  const [selectedCountry, setSelectedCountry] = useState('Global');
  const [timeRange, setTimeRange] = useState('30');
  const [activeMetric, setActiveMetric] = useState('cases');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  
  // Current data based on selection
  const [currentData, setCurrentData] = useState(null);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [globalResult, countriesResult, historicalResult] = await Promise.all([
          fetchGlobalData(),
          fetchCountriesData(),
          fetchHistoricalData()
        ]);
        
        setGlobalData(globalResult);
        setCountriesData(countriesResult);
        setHistoricalData(historicalResult);
        setCurrentData(globalResult); // Default to global data
        setLoading(false);
      } catch (err) {
        setError('Failed to load COVID-19 data. Please try again later.');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  useEffect(() => {
    if (selectedCountry === 'Global' && globalData) {
      setCurrentData(globalData);
    } else if (countriesData.length > 0) {
      const countryData = countriesData.find(c => c.country === selectedCountry);
      if (countryData) {
        setCurrentData(countryData);
      }
    }
  }, [selectedCountry, globalData, countriesData]);
  
  const handleCountryChange = (e) => {
    setSelectedCountry(e.target.value);
  };
  
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    
    // Update date range based on selected time period
    const endDate = new Date();
    let startDate;
    
    if (range === '7') {
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 7);
    } else if (range === '30') {
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 30);
    } else if (range === '90') {
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 90);
    } else if (range === '365') {
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 365);
    } else {
      // 'all' - use earliest available data
      startDate = new Date('2020-01-22');
    }
    
    setDateRange({
      from: startDate.toISOString().split('T')[0],
      to: endDate.toISOString().split('T')[0]
    });
  };
  
  if (loading) return <div className="loading">Loading COVID-19 data...</div>;
  if (error) return <div className="error">{error}</div>;
  
  // Format number with commas
  const formatNumber = (num) => {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "N/A";
  };
  
  // Calculate percentage change (mock for now)
  const getPercentChange = () => {
    return '0.0%';
  };
  
  // Top 10 countries by cases
  const topCountries = [...countriesData]
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 10);
  
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>COVID-19 Dashboard</h1>
        <div className="last-updated">Last updated: {new Date().toLocaleDateString()}</div>
      </div>
      
      <div className="dashboard-controls">
        <div className="country-selector">
          <label>Select Country:</label>
          <select value={selectedCountry} onChange={handleCountryChange}>
            <option value="Global">Global</option>
            {countriesData.map(country => (
              <option key={country.country} value={country.country}>
                {country.country}
              </option>
            ))}
          </select>
        </div>
        
        <div className="date-range-selector">
          <div className="time-range-tabs">
            <button 
              className={`time-range-tab ${timeRange === '7' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('7')}
            >
              7 Days
            </button>
            <button 
              className={`time-range-tab ${timeRange === '30' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('30')}
            >
              30 Days
            </button>
            <button 
              className={`time-range-tab ${timeRange === '90' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('90')}
            >
              90 Days
            </button>
            <button 
              className={`time-range-tab ${timeRange === '365' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('365')}
            >
              1 Year
            </button>
            <button 
              className={`time-range-tab ${timeRange === 'all' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('all')}
            >
              All Time
            </button>
          </div>
        </div>
        
        <div className="date-picker-container">
          <div>
            <label>From:</label>
            <input 
              type="date" 
              value={dateRange.from} 
              onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
            />
          </div>
          <div>
            <label>To:</label>
            <input 
              type="date" 
              value={dateRange.to} 
              onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
            />
          </div>
        </div>
        
        <div className="metric-selector">
          <button 
            className={`metric-button ${activeMetric === 'cases' ? 'active' : ''}`}
            onClick={() => setActiveMetric('cases')}
          >
            Cases
          </button>
          <button 
            className={`metric-button ${activeMetric === 'deaths' ? 'active' : ''}`}
            onClick={() => setActiveMetric('deaths')}
          >
            Deaths
          </button>
          <button 
            className={`metric-button ${activeMetric === 'recovered' ? 'active' : ''}`}
            onClick={() => setActiveMetric('recovered')}
          >
            Recovered
          </button>
        </div>
      </div>
      
      <div className="stats-container">
        <div className="stat-card total-cases">
          <h3>Total Cases</h3>
          <div className="stat-value">{formatNumber(currentData?.cases)}</div>
          <div className="stat-change positive">
            {getPercentChange()} ↑
          </div>
        </div>
        
        <div className="stat-card active-cases">
          <h3>Active Cases</h3>
          <div className="stat-value">{formatNumber(currentData?.active)}</div>
        </div>
        
        <div className="stat-card recovered">
          <h3>Recovered</h3>
          <div className="stat-value">{formatNumber(currentData?.recovered)}</div>
        </div>
        
        <div className="stat-card deaths">
          <h3>Deaths</h3>
          <div className="stat-value">{formatNumber(currentData?.deaths)}</div>
          <div className="stat-change positive">
            {getPercentChange()} ↑
          </div>
        </div>
        
        <div className="stat-card total-tests">
          <h3>Total Tests</h3>
          <div className="stat-value">{formatNumber(currentData?.tests)}</div>
        </div>
        
        <div className="stat-card case-fatality">
          <h3>Case Fatality Rate</h3>
          <div className="stat-value">
            {currentData?.deaths && currentData?.cases 
              ? ((currentData.deaths / currentData.cases) * 100).toFixed(2) + '%'
              : 'N/A'
            }
          </div>
        </div>
      </div>
      
      <div className="charts-container">
        <div className="chart-card">
          <h3>COVID-19 Spread Map</h3>
          <WorldMap 
            data={countriesData}
            metric={activeMetric}
            height={350}
          />
        </div>
        
        <div className="chart-card">
          <h3>Global - Cases Over Time</h3>
          <LineChart 
            data={historicalData?.[activeMetric]}
            color="#5c6bc0"
            height={350}
          />
        </div>
        
        <div className="chart-card">
          <h3>Daily New Cases</h3>
          <BarChart 
            data={historicalData?.cases}
            derivative={true} // Show daily changes
            color="#ffa726"
            height={350}
          />
        </div>
        
        <div className="chart-card">
          <h3>Daily New Deaths</h3>
          <BarChart 
            data={historicalData?.deaths}
            derivative={true}
            color="#ef5350"
            height={350}
          />
        </div>
        
        <div className="chart-card">
          <h3>Top 10 Countries by Cases</h3>
          <BarChart 
            data={topCountries.map(country => ({
              name: country.country,
              value: country[activeMetric]
            }))}
            horizontal={true}
            color="#5c6bc0"
            height={350}
          />
        </div>
        
        <div className="chart-card">
          <h3>Global Distribution</h3>
          <PieChart 
            data={[
              { label: 'Active', value: globalData?.active || 0, color: '#ffa726' },
              { label: 'Recovered', value: globalData?.recovered || 0, color: '#66bb6a' },
              { label: 'Deaths', value: globalData?.deaths || 0, color: '#ef5350' }
            ]}
            height={350}
          />
        </div>
      </div>
      
      <div className="dashboard-footer">
        <p>Data source: Using reliable mock data for development and demonstration purposes.</p>
        <p className="disclaimer">
          Note: This dashboard uses pre-populated sample data for visualization purposes since the disease.sh API is currently unavailable.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;