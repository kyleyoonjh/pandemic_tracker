// src/api/service.js
import axios from 'axios';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { 
  mockGlobalData,
  mockCountriesData,
  mockHistoricalData,
  mockVaccineData
} from './mockData';

// Create axios instance with default configurations
const apiClient = axios.create({
  timeout: 15000, // 15 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging
    if (error.response) {
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
        endpoint: error.config.url
      });
    } else if (error.request) {
      console.error('API Error Request:', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// IMPORTANT: Always use mock data since the real API is unavailable
const USE_MOCK_DATA = true;

// Global data service
export const fetchGlobalData = async () => {
  try {
    if (USE_MOCK_DATA) {
      console.warn('Using mock global data');
      return mockGlobalData;
    }
    
    const response = await apiClient.get(ENDPOINTS.GLOBAL);
    return response.data;
  } catch (error) {
    console.error(`Error fetching global data: ${error.message}`);
    return mockGlobalData;
  }
};

// Country data services
export const fetchAllCountries = async () => {
  try {
    if (USE_MOCK_DATA) {
      console.warn('Using mock countries data');
      return mockCountriesData;
    }
    
    const response = await apiClient.get(ENDPOINTS.COUNTRIES);
    return response.data;
  } catch (error) {
    console.error(`Error fetching countries data: ${error.message}`);
    return mockCountriesData;
  }
};

export const fetchCountryData = async (country) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    if (USE_MOCK_DATA) {
      console.warn(`Using mock data for country ${country}`);
      return mockCountriesData.find(c => c.country.toLowerCase() === country.toLowerCase()) || mockCountriesData[0];
    }
    
    const response = await apiClient.get(ENDPOINTS.COUNTRY(country));
    return response.data;
  } catch (error) {
    console.error(`Error fetching data for ${country}: ${error.message}`);
    return mockCountriesData.find(c => c.country.toLowerCase() === country.toLowerCase()) || mockCountriesData[0];
  }
};

// Historical data services
export const fetchHistoricalAllData = async (days = 30) => {
  try {
    if (USE_MOCK_DATA) {
      console.warn('Using mock historical data');
      return mockHistoricalData;
    }
    
    const response = await apiClient.get(ENDPOINTS.HISTORICAL_ALL(days));
    return response.data;
  } catch (error) {
    console.error(`Error fetching historical global data: ${error.message}`);
    return mockHistoricalData;
  }
};

export const fetchHistoricalCountryData = async (country, days = 30) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    if (USE_MOCK_DATA) {
      console.warn(`Using mock historical data for country ${country}`);
      return { country, timeline: mockHistoricalData };
    }
    
    const response = await apiClient.get(ENDPOINTS.HISTORICAL_COUNTRY(country, days));
    return response.data;
  } catch (error) {
    console.error(`Error fetching historical data for ${country}: ${error.message}`);
    return { country, timeline: mockHistoricalData };
  }
};

// Vaccination data services
export const fetchVaccineData = async () => {
  try {
    if (USE_MOCK_DATA) {
      console.warn('Using mock vaccine data');
      return mockVaccineData;
    }
    
    const response = await apiClient.get(ENDPOINTS.VACCINE);
    return response.data;
  } catch (error) {
    console.error(`Error fetching vaccine data: ${error.message}`);
    return mockVaccineData;
  }
};

export const fetchCountryVaccineData = async (country) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    if (USE_MOCK_DATA) {
      console.warn(`Using mock vaccine data for country ${country}`);
      return { country, timeline: mockVaccineData.timeline };
    }
    
    const response = await apiClient.get(ENDPOINTS.VACCINE_COUNTRY(country));
    return response.data;
  } catch (error) {
    console.error(`Error fetching vaccine data for ${country}: ${error.message}`);
    return { country, timeline: mockVaccineData.timeline };
  }
};

// Continent data service
export const fetchContinentsData = async () => {
  try {
    if (USE_MOCK_DATA) {
      console.warn('Using mock continents data');
      // Create mock continent data from countries
      const continents = {};
      mockCountriesData.forEach(country => {
        if (!continents[country.continent]) {
          continents[country.continent] = {
            continent: country.continent,
            cases: 0,
            deaths: 0,
            recovered: 0,
            active: 0,
            population: 0,
            countries: []
          };
        }
        
        continents[country.continent].cases += country.cases;
        continents[country.continent].deaths += country.deaths;
        continents[country.continent].recovered += country.recovered;
        continents[country.continent].active += country.active;
        continents[country.continent].population += country.population;
        continents[country.continent].countries.push(country.country);
      });
      
      return Object.values(continents);
    }
    
    const response = await apiClient.get(ENDPOINTS.CONTINENTS);
    return response.data;
  } catch (error) {
    console.error(`Error fetching continents data: ${error.message}`);
    
    // Create mock continent data from countries
    const continents = {};
    mockCountriesData.forEach(country => {
      if (!continents[country.continent]) {
        continents[country.continent] = {
          continent: country.continent,
          cases: 0,
          deaths: 0,
          recovered: 0,
          active: 0,
          population: 0,
          countries: []
        };
      }
      
      continents[country.continent].cases += country.cases;
      continents[country.continent].deaths += country.deaths;
      continents[country.continent].recovered += country.recovered;
      continents[country.continent].active += country.active;
      continents[country.continent].population += country.population;
      continents[country.continent].countries.push(country.country);
    });
    
    return Object.values(continents);
  }
};

// Dashboard data with simplified error handling
export const fetchDashboardData = async (country = 'all') => {
  try {
    // Since we're using mock data, we can simplify this
    // and ensure it always returns consistent data
    const currentData = country === 'all' ? 
      mockGlobalData : 
      mockCountriesData.find(c => c.country.toLowerCase() === country.toLowerCase()) || mockCountriesData[0];
    
    const historicalData = country === 'all' ? 
      mockHistoricalData : 
      { country, timeline: mockHistoricalData };
    
    const vaccineData = country === 'all' ? 
      mockVaccineData : 
      { country, timeline: mockVaccineData.timeline };
    
    return {
      current: currentData,
      historical: historicalData,
      vaccine: vaccineData,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    throw new Error(`Error fetching dashboard data: ${error.message}`);
  }
};

// Get top affected countries
export const fetchTopCountries = async (limit = 10, sortBy = 'cases') => {
  try {
    if (USE_MOCK_DATA) {
      console.warn('Using mock top countries data');
      return mockCountriesData
        .sort((a, b) => b[sortBy] - a[sortBy])
        .slice(0, limit);
    }
    
    const countries = await fetchAllCountries();
    return countries
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, limit);
  } catch (error) {
    console.error(`Error fetching top countries: ${error.message}`);
    return mockCountriesData
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, limit);
  }
};