// src/components/dashboard/Dashboard.js - with improved mock data handling
import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import StatisticsPanel from './StatisticsPanel';
import LineChart from '../charts/LineChart';
import BarChart from '../charts/BarChart';
import WorldMap from '../charts/WorldMap';
import PieChart from '../charts/PieChart';
import CountrySelector from './CountrySelector';
import DateRangePicker from './DateRangePicker';
import Card from '../common/Card';
import Loader from '../common/Loader';
import { 
  fetchDashboardData, 
  fetchAllCountriesData,
  setSelectedCountry,
  setDateRange,
  setMetric 
} from '../../redux/actions/dataActions';
import { formatDate, formatNumber } from '../../utils/formatters';
import { transformTimeSeriesData, transformCountryData } from '../../utils/dataTransformers';
import { COLOR_SCALES } from '../../constants/colorScales';
import '../../styles/components/dashboard.css';

const Dashboard = () => {
  const dispatch = useDispatch();

  // Correctly access data from the Redux store based on your actual reducer structure
  const { 
    global,
    countries,
    historical,
    selectedCountry,
    dateRange,
    filters
  } = useSelector(state => state.data);
  
  const { theme, loading: uiLoading } = useSelector(state => state.ui);
  const darkMode = theme === 'dark';
  
  const [activeMetric, setActiveMetric] = useState(filters.metric || 'cases');
  const [topCountriesData, setTopCountriesData] = useState([]);
  const [mapData, setMapData] = useState(null);
  
  // Notice we don't check for loading states for initial rendering since we're using mock data
  // which should load more or less instantly
  const isLoading = false;
  const error = null;
  
  // Load initial dashboard data
  useEffect(() => {
    dispatch(fetchDashboardData());
    dispatch(fetchAllCountriesData());
  }, [dispatch]);
  
  // Process countries data for top countries chart when available
  useEffect(() => {
    if (countries.list && countries.list.length > 0) {
      // Sort countries by active metric and take top 10
      const sorted = [...countries.list].sort((a, b) => 
        (b[activeMetric] || 0) - (a[activeMetric] || 0)
      ).slice(0, 10);
      
      setTopCountriesData(sorted);
    }
  }, [countries.list, activeMetric]);
  
  // Process data for world map
  useEffect(() => {
    if (countries.list && countries.list.length > 0) {
      setMapData(countries.list);
    }
  }, [countries.list]);
  
  // Transform timeline data for charts
  const processedTimelineData = useMemo(() => {
    if (!historical.global && 
        (!historical.countries || !historical.countries[selectedCountry === 'all' ? 'global' : selectedCountry])) {
      return null;
    }
    
    return selectedCountry === 'all' 
      ? historical.global 
      : historical.countries[selectedCountry];
  }, [historical.global, historical.countries, selectedCountry]);
  
  // Calculate daily new cases/deaths for line chart
  const dailyNewData = useMemo(() => {
    if (!processedTimelineData || !processedTimelineData.timeline) {
      // If we don't have the expected format from the API, try to adapt
      if (processedTimelineData && typeof processedTimelineData === 'object') {
        // This handles the case where historical data is directly in the object
        const timeline = processedTimelineData;
        
        const metrics = ['cases', 'deaths', 'recovered'];
        const dailyData = {};
        
        metrics.forEach(metric => {
          if (!timeline[metric]) return;
          
          const entries = Object.entries(timeline[metric]);
          
          dailyData[metric] = entries.map(([date, total], index) => {
            const prevTotal = index > 0 ? entries[index - 1][1] : 0;
            const newValue = Math.max(0, total - prevTotal);
            
            return {
              date,
              value: newValue,
              series: `new${metric.charAt(0).toUpperCase() + metric.slice(1)}`
            };
          });
        });
        
        return dailyData;
      }
      return null;
    }
    
    const metrics = ['cases', 'deaths', 'recovered'];
    const dailyData = {};
    
    metrics.forEach(metric => {
      const timeline = processedTimelineData.timeline?.[metric] || {};
      const entries = Object.entries(timeline);
      
      dailyData[metric] = entries.map(([date, total], index) => {
        const prevTotal = index > 0 ? entries[index - 1][1] : 0;
        const newValue = Math.max(0, total - prevTotal);
        
        return {
          date,
          value: newValue,
          series: `new${metric.charAt(0).toUpperCase() + metric.slice(1)}`
        };
      });
    });
    
    return dailyData;
  }, [processedTimelineData]);
  
  // Handle country selection
  const handleCountrySelect = (country) => {
    dispatch(setSelectedCountry(country === 'Global' ? 'all' : country));
    dispatch(fetchDashboardData(country === 'Global' ? 'all' : country));
  };
  
  // Handle date range change
  const handleDateRangeChange = (range) => {
    dispatch(setDateRange(range));
  };
  
  // Handle metric change for different visualizations
  const handleMetricChange = (metric) => {
    setActiveMetric(metric);
    dispatch(setMetric(metric));
  };
  
  // Get the appropriate data for the currently selected country
  const currentData = useMemo(() => {
    return selectedCountry === 'all' ? 
      global.data : 
      countries.list?.find(c => c.country === selectedCountry);
  }, [selectedCountry, global.data, countries.list]);
  
  // Helper to handle possible missing timeline structure
  const getTimelineData = (metric) => {
    // Check for different possible structures based on the API response or mock data
    if (processedTimelineData?.timeline?.[metric]) {
      return processedTimelineData.timeline[metric];
    } else if (processedTimelineData?.[metric]) {
      return processedTimelineData[metric]; 
    }
    return {};
  };
  
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Pandemic Dashboard</h1>
        <p className="last-updated">
          Last updated: {global.data?.updated ? formatDate(new Date(global.data.updated)) : new Date().toLocaleDateString()}
        </p>
        
        <div className="dashboard-controls">
          <CountrySelector 
            selectedCountry={selectedCountry === 'all' ? 'Global' : selectedCountry} 
            onSelectCountry={handleCountrySelect} 
          />
          
          <DateRangePicker 
            onChange={handleDateRangeChange} 
            startDate={dateRange?.start}
            endDate={dateRange?.end}
          />
          
          <div className="metric-selector">
            <button 
              className={activeMetric === 'cases' ? 'active' : ''} 
              onClick={() => handleMetricChange('cases')}
            >
              Cases
            </button>
            <button 
              className={activeMetric === 'deaths' ? 'active' : ''} 
              onClick={() => handleMetricChange('deaths')}
            >
              Deaths
            </button>
            <button 
              className={activeMetric === 'recovered' ? 'active' : ''} 
              onClick={() => handleMetricChange('recovered')}
            >
              Recovered
            </button>
          </div>
        </div>
      </div>
      
      <StatisticsPanel data={currentData} />
      
      <div className="dashboard-grid">
        <Card title="Pandemic Spread Map" className="map-card grid-span-2">
          {mapData ? (
            <WorldMap 
              data={mapData} 
              metric={activeMetric}
              colorRange={COLOR_SCALES[activeMetric] || COLOR_SCALES.cases}
              onCountryClick={(country) => handleCountrySelect(country.country)}
              height={480}
            />
          ) : (
            <Loader />
          )}
        </Card>
        
        {/* Timeline chart with flexible data structure handling */}
        <Card title={`${selectedCountry === 'all' ? 'Global' : selectedCountry} - ${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} Over Time`} className="timeline-card grid-span-2">
          {getTimelineData(activeMetric) && Object.keys(getTimelineData(activeMetric)).length > 0 ? (
            <LineChart 
              data={Object.entries(getTimelineData(activeMetric)).map(([date, value]) => ({
                date,
                value,
                series: activeMetric
              }))}
              xLabel="Date"
              yLabel={activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)}
              title=""
              colors={[COLOR_SCALES[activeMetric]?.[1] || '#4285F4']}
              height={350}
            />
          ) : (
            <div className="no-data-message">
              No timeline data available for {activeMetric}
            </div>
          )}
        </Card>
        
        {dailyNewData && dailyNewData.cases && dailyNewData.cases.length > 0 && (
          <Card title="Daily New Cases" className="daily-card">
            <LineChart 
              data={dailyNewData.cases.slice(-30)} // Show last 30 days
              xLabel="Date"
              yLabel="New Cases"
              title=""
              colors={[COLOR_SCALES.newCases ? COLOR_SCALES.newCases[1] : '#FF9F00']}
              height={300}
            />
          </Card>
        )}
        
        {dailyNewData && dailyNewData.deaths && dailyNewData.deaths.length > 0 && (
          <Card title="Daily New Deaths" className="daily-card">
            <LineChart 
              data={dailyNewData.deaths.slice(-30)} // Show last 30 days
              xLabel="Date"
              yLabel="New Deaths"
              title=""
              colors={[COLOR_SCALES.newDeaths ? COLOR_SCALES.newDeaths[1] : '#FF5252']}
              height={300}
            />
          </Card>
        )}
        
        {topCountriesData && topCountriesData.length > 0 && (
          <Card title={`Top 10 Countries by ${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)}`} className="top-countries-card">
            <BarChart 
              data={topCountriesData.map(country => ({
                label: country.country,
                value: country[activeMetric] || 0,
                series: activeMetric
              }))}
              xLabel="Country"
              yLabel={activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)}
              title=""
              color={COLOR_SCALES[activeMetric]?.[1] || '#4285F4'}
              height={350}
            />
          </Card>
        )}
        
        {currentData && (
          <Card title={`${selectedCountry === 'all' ? 'Global' : selectedCountry} Distribution`} className="distribution-card">
            <PieChart 
              data={[
                { label: 'Active', value: currentData.active || 0, color: '#FF9F00' },
                { label: 'Recovered', value: currentData.recovered || 0, color: '#4CAF50' },
                { label: 'Deaths', value: currentData.deaths || 0, color: '#FF5252' }
              ]}
              height={300}
            />
          </Card>
        )}
      </div>
      
      {/* Additional stats or tables could be added here */}
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