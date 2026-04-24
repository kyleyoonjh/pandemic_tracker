// src/api/service.js
import axios from 'axios';
import { ENDPOINTS } from '../constants/apiEndpoints';

// Create axios instance with default configurations
const apiClient = axios.create({
  timeout: 10000,
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

// Global data service
export const fetchGlobalData = async () => {
  try {
    const response = await apiClient.get(ENDPOINTS.GLOBAL);
    return response.data;
  } catch (error) {
    console.error(`Error fetching global data: ${error.message}`);
    throw error;
  }
};

// Country data services
export const fetchAllCountries = async () => {
  try {
    const response = await apiClient.get(ENDPOINTS.COUNTRIES);
    return response.data;
  } catch (error) {
    console.error(`Error fetching countries data: ${error.message}`);
    throw error;
  }
};

export const fetchCountryData = async (country) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    const response = await apiClient.get(ENDPOINTS.COUNTRY(country));
    return response.data;
  } catch (error) {
    console.error(`Error fetching data for ${country}: ${error.message}`);
    throw error;
  }
};

// Historical data services
export const fetchHistoricalAllData = async (days = 30) => {
  try {
    const response = await apiClient.get(ENDPOINTS.HISTORICAL_ALL(days));
    return response.data;
  } catch (error) {
    console.error(`Error fetching historical global data: ${error.message}`);
    throw error;
  }
};

export const fetchHistoricalCountryData = async (country, days = 30) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    const response = await apiClient.get(ENDPOINTS.HISTORICAL_COUNTRY(country, days));
    return response.data;
  } catch (error) {
    console.error(`Error fetching historical data for ${country}: ${error.message}`);
    throw error;
  }
};

export const fetchHistoricalCountriesData = async (days = 2) => {
  try {
    const response = await apiClient.get(ENDPOINTS.HISTORICAL_COUNTRIES(days));
    return response.data;
  } catch (error) {
    console.error(`Error fetching historical countries data: ${error.message}`);
    throw error;
  }
};

// Vaccination data services
export const fetchVaccineData = async () => {
  try {
    const response = await apiClient.get(ENDPOINTS.VACCINE);
    return response.data;
  } catch (error) {
    console.error(`Error fetching vaccine data: ${error.message}`);
    throw error;
  }
};

export const fetchCountryVaccineData = async (country) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    const response = await apiClient.get(ENDPOINTS.VACCINE_COUNTRY(country));
    return response.data;
  } catch (error) {
    console.error(`Error fetching vaccine data for ${country}: ${error.message}`);
    throw error;
  }
};

// Continent data service
export const fetchContinentsData = async () => {
  try {
    const response = await apiClient.get(ENDPOINTS.CONTINENTS);
    return response.data;
  } catch (error) {
    console.error(`Error fetching continents data: ${error.message}`);
    throw error;
  }
};

// Dashboard data with simplified error handling
export const fetchDashboardData = async (country = 'all') => {
  try {
    const currentData = country === 'all'
      ? await fetchGlobalData()
      : await fetchCountryData(country);

    const historicalData = country === 'all'
      ? await fetchHistoricalAllData(90)
      : await fetchHistoricalCountryData(country, 90);

    // Vaccine endpoint can fail depending on API limits/data availability.
    // Keep dashboard resilient by returning null instead of throwing.
    let vaccineData = null;
    try {
      vaccineData = country === 'all'
        ? await fetchVaccineData()
        : await fetchCountryVaccineData(country);
    } catch (vaccineError) {
      console.warn('Vaccine data unavailable, continuing without it:', vaccineError.message);
    }

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
    const countries = await fetchAllCountries();
    return countries
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, limit);
  } catch (error) {
    console.error(`Error fetching top countries: ${error.message}`);
    throw error;
  }
};