// src/components/Dashboard.js
import React, { useState, useEffect, useMemo } from 'react';
//import { fetchGlobalData, fetchCountriesData, fetchHistoricalData } from '../api/service';
import {
  fetchGlobalData,
  fetchAllCountries as fetchCountriesData,
  fetchHistoricalAllData as fetchHistoricalData,
  fetchHistoricalCountriesData
} from '../api/service';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import WorldMap from './charts/WorldMap';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const MENU_TITLE_MAP = {
    '#dashboard': 'Covid-19',
    '#about': 'Flu A,B',
    '#resources': 'MFox'
  };

  const [globalData, setGlobalData] = useState(null);
  const [countriesData, setCountriesData] = useState([]);
  const [historicalData, setHistoricalData] = useState(null);
  const [historicalCountriesData, setHistoricalCountriesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI state
  const [selectedCountry, setSelectedCountry] = useState('Global');
  const [timeRange, setTimeRange] = useState('30');
  const [activeMetric, setActiveMetric] = useState('cases');
  const [sortKey, setSortKey] = useState('currentInfectionRateValue');
  const [isRefreshingTable, setIsRefreshingTable] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [menuPrefix, setMenuPrefix] = useState(MENU_TITLE_MAP['#dashboard']);
  
  // Current data based on selection
  const [currentData, setCurrentData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [globalResult, countriesResult, historicalResult, historicalCountriesResult] = await Promise.all([
          fetchGlobalData(),
          fetchCountriesData(),
          fetchHistoricalData(),
          fetchHistoricalCountriesData(2)
        ]);
        
        setGlobalData(globalResult);
        setCountriesData(countriesResult);
        setHistoricalData(historicalResult);
        setHistoricalCountriesData(Array.isArray(historicalCountriesResult) ? historicalCountriesResult : []);
        setCurrentData(globalResult); // Default to global data
        setLoading(false);
      } catch (err) {
        setError('Failed to load Pandemic data. Please try again later.');
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

  useEffect(() => {
    const applyMenuPrefixFromHash = () => {
      const currentHash = window.location.hash || '#dashboard';
      setMenuPrefix(MENU_TITLE_MAP[currentHash] || 'Covid-19');
    };

    applyMenuPrefixFromHash();
    window.addEventListener('hashchange', applyMenuPrefixFromHash);
    return () => window.removeEventListener('hashchange', applyMenuPrefixFromHash);
  }, []);
  
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

  const handleSortByColumn = async (columnKey) => {
    setIsRefreshingTable(true);
    try {
      const [latestCountries, latestHistoricalCountries] = await Promise.all([
        fetchCountriesData(),
        fetchHistoricalCountriesData(2)
      ]);
      setCountriesData(latestCountries);
      setHistoricalCountriesData(Array.isArray(latestHistoricalCountries) ? latestHistoricalCountries : []);
      setSortKey(columnKey);
    } catch (fetchError) {
      console.error('Failed to refresh countries data before sorting:', fetchError);
    } finally {
      setIsRefreshingTable(false);
    }
  };
  
  // Format number with commas
  const formatNumber = (num) => {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "N/A";
  };

  const getLatestDailyIncrement = (timeline) => {
    if (!timeline || typeof timeline !== 'object') return null;
    const entries = Object.entries(timeline)
      .map(([date, value]) => ({
        date: new Date(date),
        value: Number(value || 0)
      }))
      .filter((item) => !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date - b.date);

    if (entries.length < 2) return null;
    const latest = entries[entries.length - 1].value;
    const previous = entries[entries.length - 2].value;
    return Math.max(0, latest - previous);
  };

  const formatCompactNumber = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '0';
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return `${Math.round(num)}`;
  };

  const getLatestIncrementAndRate = (timeline) => {
    if (!timeline || typeof timeline !== 'object') return { increment: null, rate: null };
    const entries = Object.entries(timeline)
      .map(([date, value]) => ({
        date: new Date(date),
        value: Number(value || 0)
      }))
      .filter((item) => !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date - b.date);

    if (entries.length < 2) return { increment: null, rate: null };
    const latest = entries[entries.length - 1].value;
    const previous = entries[entries.length - 2].value;
    const increment = Math.max(0, latest - previous);
    const rate = previous > 0 ? (increment / previous) * 100 : null;
    return { increment, rate };
  };
  
  const mapDataWithDerivedMetrics = useMemo(() => {
    return countriesData.map((country) => ({
      ...country,
      caseFatalityRate: country?.cases > 0
        ? (Number(country.deaths || 0) / Number(country.cases || 0)) * 100
        : 0,
      currentInfectionRate: country?.population > 0
        ? (Number(country.active || 0) / Number(country.population || 0)) * 100
        : 0
    }));
  }, [countriesData]);

  const countryYesterdayCasesMap = useMemo(() => {
    const map = new Map();
    historicalCountriesData.forEach((item) => {
      if (!item?.country || !item?.timeline?.cases) return;
      const increment = getLatestDailyIncrement(item.timeline.cases);
      map.set(String(item.country).toLowerCase(), increment);
    });
    return map;
  }, [historicalCountriesData]);

  const mapDataWithYesterdayMetrics = useMemo(() => {
    return mapDataWithDerivedMetrics.map((country) => ({
      ...country,
      yesterdayCases: countryYesterdayCasesMap.get(String(country.country || '').toLowerCase()) ?? 0
    }));
  }, [mapDataWithDerivedMetrics, countryYesterdayCasesMap]);

  const yesterdayGlobalCasesStats = useMemo(() => {
    return getLatestIncrementAndRate(historicalData?.cases);
  }, [historicalData]);

  const yesterdayGlobalDeathsStats = useMemo(() => {
    return getLatestIncrementAndRate(historicalData?.deaths);
  }, [historicalData]);

  const displayedNewCases = useMemo(() => {
    if (selectedCountry === 'Global' || selectedCountry === 'all') {
      return yesterdayGlobalCasesStats.increment;
    }

    const selectedCountryName = String(selectedCountry || '').toLowerCase();
    const countryYesterday = countryYesterdayCasesMap.get(selectedCountryName);
    if (Number.isFinite(countryYesterday) && countryYesterday >= 0) return countryYesterday;
    return null;
  }, [selectedCountry, yesterdayGlobalCasesStats, countryYesterdayCasesMap]);

  const displayedCasesPercent = useMemo(() => {
    if (selectedCountry === 'Global' || selectedCountry === 'all') {
      return yesterdayGlobalCasesStats.rate;
    }
    const todayCases = Number(currentData?.todayCases || 0);
    const totalCases = Number(currentData?.cases || 0);
    const previousCases = totalCases - todayCases;
    if (todayCases <= 0 || previousCases <= 0) return null;
    return (todayCases / previousCases) * 100;
  }, [selectedCountry, currentData, yesterdayGlobalCasesStats]);

  const displayedDeathsPercent = useMemo(() => {
    if (selectedCountry === 'Global' || selectedCountry === 'all') {
      return yesterdayGlobalDeathsStats.rate;
    }
    const todayDeaths = Number(currentData?.todayDeaths || 0);
    const totalDeaths = Number(currentData?.deaths || 0);
    const previousDeaths = totalDeaths - todayDeaths;
    if (todayDeaths <= 0 || previousDeaths <= 0) return null;
    return (todayDeaths / previousDeaths) * 100;
  }, [selectedCountry, currentData, yesterdayGlobalDeathsStats]);

  const globalDistribution = useMemo(() => {
    const active = Number(globalData?.active || 0);
    const recovered = Number(globalData?.recovered || 0);
    const deaths = Number(globalData?.deaths || 0);
    const total = active + recovered + deaths;
    if (total <= 0) return [];

    return [
      { label: 'Active', value: active, color: '#4e79a7' },
      { label: 'Recovered', value: recovered, color: '#f28e2b' },
      { label: 'Deaths', value: deaths, color: '#e15759' }
    ].map((item) => ({
      ...item,
      percent: (item.value / total) * 100
    }));
  }, [globalData]);

  // Top 10 countries by active metric
  const topCountries = [...mapDataWithYesterdayMetrics]
    .sort((a, b) => (Number(b[activeMetric] || 0) - Number(a[activeMetric] || 0)))
    .slice(0, 10);

  const rankedCountries = useMemo(() => {
    const computedRows = [...countriesData]
      .filter((country) =>
        country &&
        Number.isFinite(country.cases) &&
        country.cases > 0 &&
        Number.isFinite(country.population) &&
        country.population > 0
      )
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 25)
      .map((country, index) => {
        const cases = Number(country.cases || 0);
        const population = Number(country.population || 0);
        const active = Number(country.active || 0);
        const recoveredFromApi = Number(country.recovered || 0);
        const deaths = Number(country.deaths || 0);
        const hasReliableRecoveryData = recoveredFromApi > 0;
        const recovered = recoveredFromApi > 0
          ? recoveredFromApi
          : Math.max(0, cases - active - deaths);

        return {
          rank: index + 1,
          country: country.country,
          cases,
          newConfirmed: countryYesterdayCasesMap.get(String(country.country || '').toLowerCase()) ?? null,
          currentInfectionCases: active,
          deaths,
          infectionRateValue: population > 0 ? (cases / population) * 100 : 0,
          recoveryRateValue: hasReliableRecoveryData && cases > 0
            ? (recovered / cases) * 100
            : null,
          currentInfectionRateValue: hasReliableRecoveryData && population > 0
            ? (active / population) * 100
            : null,
          deathRateValue: cases > 0 ? (deaths / cases) * 100 : 0
        };
      });

    const sortableRows = [...computedRows];

    sortableRows.sort((a, b) => {
      if (sortKey === 'country') {
        return String(a.country).localeCompare(String(b.country));
      }
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      const aMissing = aValue === null || !Number.isFinite(Number(aValue));
      const bMissing = bValue === null || !Number.isFinite(Number(bValue));

      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return Number(bValue) - Number(aValue);
    });

    return sortableRows
      .slice(0, 10)
      .map((country, index) => ({
        ...country,
        rank: index + 1,
        infectionRate: country.infectionRateValue.toFixed(2),
        recoveryRate: country.recoveryRateValue !== null ? country.recoveryRateValue.toFixed(2) : 'N/A',
        currentInfectionRate: country.currentInfectionRateValue !== null ? country.currentInfectionRateValue.toFixed(2) : 'N/A',
        deathRate: country.deathRateValue.toFixed(2)
      }));
  }, [countriesData, sortKey, countryYesterdayCasesMap]);

  if (loading) return <div className="loading">Loading Pandemic data...</div>;
  if (error) return <div className="error">{error}</div>;
  
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>{menuPrefix} Pandemic Dashboard</h1>
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
        
      </div>
      
      <div className="stats-container">
        <button type="button" className={`stat-card rt-metric metric-card-button ${activeMetric === 'yesterdayCases' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('yesterdayCases')}>
          <h3>New Cases</h3>
          <div className="stat-value">
            {displayedNewCases !== null ? formatNumber(displayedNewCases) : 'N/A'}
          </div>
          <div className="stat-change neutral">
            New confirmed
          </div>
        </button>

        <button type="button" className={`stat-card total-cases metric-card-button ${activeMetric === 'cases' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('cases')}>
          <h3>Total Cases</h3>
          <div className="stat-value">{formatNumber(currentData?.cases)}</div>
          <div className="stat-change positive">
            {displayedCasesPercent !== null ? `${displayedCasesPercent.toFixed(2)}%` : 'N/A'} ↑
          </div>
        </button>
        
        <button type="button" className={`stat-card active-cases metric-card-button ${activeMetric === 'active' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('active')}>
          <h3>Active Cases</h3>
          <div className="stat-value">{formatNumber(currentData?.active)}</div>
        </button>
        
        <button type="button" className={`stat-card recovered metric-card-button ${activeMetric === 'recovered' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('recovered')}>
          <h3>Recovered</h3>
          <div className="stat-value">{formatNumber(currentData?.recovered)}</div>
        </button>
        
        <button type="button" className={`stat-card deaths metric-card-button ${activeMetric === 'deaths' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('deaths')}>
          <h3>Deaths</h3>
          <div className="stat-value">{formatNumber(currentData?.deaths)}</div>
          <div className="stat-change positive">
            {displayedDeathsPercent !== null ? `${displayedDeathsPercent.toFixed(2)}%` : 'N/A'} ↑
          </div>
        </button>
        
        <button type="button" className={`stat-card case-fatality metric-card-button ${activeMetric === 'caseFatalityRate' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('caseFatalityRate')}>
          <h3>Case Fatality Rate</h3>
          <div className="stat-value">
            {currentData?.deaths && currentData?.cases 
              ? ((currentData.deaths / currentData.cases) * 100).toFixed(2) + '%'
              : 'N/A'
            }
          </div>
        </button>

        <button type="button" className={`stat-card current-infection-cases metric-card-button ${activeMetric === 'active' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('active')}>
          <h3>Current Infection Cases</h3>
          <div className="stat-value">{formatNumber(currentData?.active)}</div>
        </button>

        <button type="button" className={`stat-card current-infection-rate metric-card-button ${activeMetric === 'currentInfectionRate' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('currentInfectionRate')}>
          <h3>Current Infection Rate</h3>
          <div className="stat-value">
            {currentData?.active && currentData?.population
              ? ((currentData.active / currentData.population) * 100).toFixed(2) + '%'
              : 'N/A'}
          </div>
        </button>
      </div>
      
      <div className="charts-container">
        <div className="chart-card map-chart-card">
          <h3>Pandemic Spread Map</h3>
          <WorldMap 
            data={mapDataWithYesterdayMetrics}
            metric={activeMetric}
            height={560}
          />
        </div>

        <div className="chart-card map-table-card">
          <h3>Countries Ranked by Current Infection Rate {isRefreshingTable ? '(Refreshing...)' : ''}</h3>
          <div className="countries-table-wrapper">
            <table className="countries-table">
              <thead>
                <tr>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('currentInfectionRateValue')} disabled={isRefreshingTable}>Rank</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('country')} disabled={isRefreshingTable}>Country</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('cases')} disabled={isRefreshingTable}>Cases</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('newConfirmed')} disabled={isRefreshingTable}>New Confirmed</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('infectionRateValue')} disabled={isRefreshingTable}>Infection Rate</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('recoveryRateValue')} disabled={isRefreshingTable}>Recovery Rate</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('currentInfectionCases')} disabled={isRefreshingTable}>Current Infection Cases</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('currentInfectionRateValue')} disabled={isRefreshingTable}>Current Infection Rate</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('deaths')} disabled={isRefreshingTable}>Deaths</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('deathRateValue')} disabled={isRefreshingTable}>Death Rate</button></th>
                </tr>
              </thead>
              <tbody>
                {rankedCountries.map((country) => (
                  <tr key={country.country}>
                    <td>{country.rank}</td>
                    <td>{country.country}</td>
                    <td>{formatNumber(country.cases)}</td>
                    <td>{country.newConfirmed !== null ? formatNumber(country.newConfirmed) : 'N/A'}</td>
                    <td>{country.infectionRate}%</td>
                    <td>{country.recoveryRate === 'N/A' ? 'N/A' : `${country.recoveryRate}%`}</td>
                    <td>{formatNumber(country.currentInfectionCases)}</td>
                    <td>{country.currentInfectionRate === 'N/A' ? 'N/A' : `${country.currentInfectionRate}%`}</td>
                    <td>{formatNumber(country.deaths)}</td>
                    <td>{country.deathRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="chart-card global-distribution-card">
          <h3>Global Distribution</h3>
          <div className="distribution-list">
            {globalDistribution.map((item) => (
              <div className="distribution-row" key={item.label}>
                <div className="distribution-row-header">
                  <div className="distribution-label-wrap">
                    <span className="distribution-dot" style={{ backgroundColor: item.color }}></span>
                    <span className="distribution-label">{item.label}</span>
                  </div>
                  <div className="distribution-values">
                    <span className="distribution-percent">{item.percent.toFixed(2)}%</span>
                    <span className="distribution-count">({formatCompactNumber(item.value)})</span>
                  </div>
                </div>
                <div className="distribution-track">
                  <div
                    className="distribution-fill"
                    style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="dashboard-footer">
        <p>Data source: Real-time data from disease.sh API.</p>
        <p className="disclaimer">
          Note: Values refresh from live API responses and may change frequently.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;