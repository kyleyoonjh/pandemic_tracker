// src/constants/apiEndpoints.js
/**
 * API endpoints for COVID-19 data
 * Using disease.sh API (https://disease.sh/)
 */

const BASE_URL = 'https://disease.sh/v3/covid-19';

export const ENDPOINTS = {
  // Global data
  GLOBAL: `${BASE_URL}/all`,
  
  // Country-specific data
  COUNTRIES: `${BASE_URL}/countries`,
  COUNTRY: (country) => `${BASE_URL}/countries/${country}`,
  
  // Historical data
  HISTORICAL_ALL: (lastDays = 'all') => `${BASE_URL}/historical/all?lastdays=${lastDays}`,
  HISTORICAL_COUNTRY: (country, lastDays = 'all') => `${BASE_URL}/historical/${country}?lastdays=${lastDays}`,
  
  // Continent data
  CONTINENTS: `${BASE_URL}/continents`,
  CONTINENT: (continent) => `${BASE_URL}/continents/${continent}`,
  
  // Vaccine data
  VACCINE: `${BASE_URL}/vaccine/coverage`,
  VACCINE_COUNTRY: (country) => `${BASE_URL}/vaccine/coverage/countries/${country}`,
  
  // Testing data
  TEST_COUNTRIES: `${BASE_URL}/tests`,
};

// Alternative APIs for fallback or additional data
export const ALTERNATIVE_ENDPOINTS = {
  JHU_BASE: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series',
  WHO_BASE: 'https://covid19.who.int/WHO-COVID-19-global-data.csv',
  
  // JHU time series data
  JHU_CONFIRMED: `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv`,
  JHU_DEATHS: `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv`,
  JHU_RECOVERED: `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_recovered_global.csv`,
};

export default ENDPOINTS;