// src/api/mockData.js
// Generate more recent dates for the historical data
const generateDates = (days) => {
  const dates = {};
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().substr(-2)}`;
    dates[dateStr] = 0;
  }
  
  return dates;
};

// Create realistic data progression
const generateTimelineData = (days, finalValue, growth = 'linear', startValue = 0) => {
  const dateKeys = Object.keys(generateDates(days)).reverse();
  const result = {};
  
  dateKeys.forEach((date, index) => {
    let value;
    
    if (growth === 'linear') {
      // Linear progression
      value = Math.round(startValue + (finalValue - startValue) * (index / (dateKeys.length - 1)));
    } else if (growth === 'exponential') {
      // Exponential progression
      value = Math.round(startValue + (finalValue - startValue) * Math.pow(index / (dateKeys.length - 1), 2));
    } else if (growth === 'logarithmic') {
      // Logarithmic progression - avoid log(0)
      const logBase = Math.max(1, index) / Math.max(1, dateKeys.length - 1);
      value = Math.round(startValue + (finalValue - startValue) * (Math.log(logBase * 9 + 1) / Math.log(10)));
    } else if (growth === 'sigmoid') {
      // Sigmoid progression (S-curve)
      const midpoint = dateKeys.length / 2;
      const steepness = 8 / dateKeys.length;
      value = Math.round(startValue + (finalValue - startValue) / (1 + Math.exp(-steepness * (index - midpoint))));
    }
    
    result[date] = Math.max(0, value);
  });
  
  return result;
};

// Global COVID-19 data
export const mockGlobalData = {
  updated: Date.now(),
  cases: 775230420,
  todayCases: 37832,
  deaths: 7000345,
  todayDeaths: 183,
  recovered: 747082008,
  todayRecovered: 42951,
  active: 21148067,
  critical: 37661,
  casesPerOneMillion: 97576,
  deathsPerOneMillion: 881,
  tests: 6924488127,
  testsPerOneMillion: 869233,
  population: 7944935131,
  oneCasePerPeople: 10,
  oneDeathPerPeople: 1135,
  oneTestPerPeople: 1,
  activePerOneMillion: 2661,
  recoveredPerOneMillion: 94034,
  criticalPerOneMillion: 4.7
};

// Country-specific COVID-19 data
export const mockCountriesData = [
  {
    country: "USA",
    countryInfo: {
      _id: 840,
      iso2: "US",
      iso3: "USA",
      lat: 38,
      long: -97,
      flag: "https://disease.sh/assets/img/flags/us.png"
    },
    cases: 103488598,
    todayCases: 15247,
    deaths: 1127152,
    todayDeaths: 78,
    recovered: 100766999,
    todayRecovered: 12431,
    active: 1594447,
    critical: 3254,
    casesPerOneMillion: 311234,
    deathsPerOneMillion: 3385,
    tests: 1216187868,
    testsPerOneMillion: 3654412,
    population: 331002651,
    continent: "North America",
    oneCasePerPeople: 3,
    oneDeathPerPeople: 295,
    oneTestPerPeople: 0,
    activePerOneMillion: 4789.9,
    recoveredPerOneMillion: 303058.9,
    criticalPerOneMillion: 9.8
  },
  {
    country: "India",
    countryInfo: {
      _id: 356,
      iso2: "IN",
      iso3: "IND",
      lat: 20,
      long: 77,
      flag: "https://disease.sh/assets/img/flags/in.png"
    },
    cases: 44986461,
    todayCases: 3752,
    deaths: 531832,
    todayDeaths: 21,
    recovered: 44446514,
    todayRecovered: 4211,
    active: 8115,
    critical: 412,
    casesPerOneMillion: 32086,
    deathsPerOneMillion: 379,
    tests: 934143773,
    testsPerOneMillion: 666112,
    population: 1380004385,
    continent: "Asia",
    oneCasePerPeople: 31,
    oneDeathPerPeople: 2636,
    oneTestPerPeople: 1,
    activePerOneMillion: 5.79,
    recoveredPerOneMillion: 31701.1,
    criticalPerOneMillion: 0.29
  },
  {
    country: "France",
    countryInfo: {
      _id: 250,
      iso2: "FR",
      iso3: "FRA",
      lat: 46,
      long: 2,
      flag: "https://disease.sh/assets/img/flags/fr.png"
    },
    cases: 39908640,
    todayCases: 2187,
    deaths: 164752,
    todayDeaths: 14,
    recovered: 39701887,
    todayRecovered: 1932,
    active: 42001,
    critical: 789,
    casesPerOneMillion: 609577,
    deathsPerOneMillion: 2517,
    tests: 271490188,
    testsPerOneMillion: 4149074,
    population: 65273511,
    continent: "Europe",
    oneCasePerPeople: 2,
    oneDeathPerPeople: 397,
    oneTestPerPeople: 0,
    activePerOneMillion: 641.4,
    recoveredPerOneMillion: 606417.8,
    criticalPerOneMillion: 12.1
  },
  // Add more countries as needed...
  {
    country: "Brazil",
    countryInfo: {
      _id: 76,
      iso2: "BR",
      iso3: "BRA",
      lat: -10,
      long: -55,
      flag: "https://disease.sh/assets/img/flags/br.png"
    },
    cases: 37679913,
    todayCases: 4289,
    deaths: 704659,
    todayDeaths: 32,
    recovered: 36615002,
    todayRecovered: 3845,
    active: 360252,
    critical: 1124,
    casesPerOneMillion: 175691,
    deathsPerOneMillion: 3285,
    tests: 63776166,
    testsPerOneMillion: 297321,
    population: 212559417,
    continent: "South America",
    oneCasePerPeople: 6,
    oneDeathPerPeople: 304,
    oneTestPerPeople: 3,
    activePerOneMillion: 1680,
    recoveredPerOneMillion: 170726,
    criticalPerOneMillion: 5.24
  },
  {
    country: "Germany",
    countryInfo: {
      _id: 276,
      iso2: "DE",
      iso3: "DEU",
      lat: 51,
      long: 9,
      flag: "https://disease.sh/assets/img/flags/de.png"
    },
    cases: 38431454,
    todayCases: 1923,
    deaths: 175988,
    todayDeaths: 8,
    recovered: 38068500,
    todayRecovered: 2147,
    active: 186966,
    critical: 652,
    casesPerOneMillion: 457035,
    deathsPerOneMillion: 2093,
    tests: 138040528,
    testsPerOneMillion: 1642173,
    population: 83783942,
    continent: "Europe",
    oneCasePerPeople: 2,
    oneDeathPerPeople: 478,
    oneTestPerPeople: 1,
    activePerOneMillion: 2224,
    recoveredPerOneMillion: 452718,
    criticalPerOneMillion: 7.76
  },
  {
    country: "Japan",
    countryInfo: {
      _id: 392,
      iso2: "JP",
      iso3: "JPN",
      lat: 36,
      long: 138,
      flag: "https://disease.sh/assets/img/flags/jp.png"
    },
    cases: 33586973,
    todayCases: 5382,
    deaths: 74694,
    todayDeaths: 12,
    recovered: 33201231,
    todayRecovered: 7239,
    active: 311048,
    critical: 178,
    casesPerOneMillion: 266893,
    deathsPerOneMillion: 593,
    tests: 100414883,
    testsPerOneMillion: 798050,
    population: 126476461,
    continent: "Asia",
    oneCasePerPeople: 4,
    oneDeathPerPeople: 1687,
    oneTestPerPeople: 1,
    activePerOneMillion: 2471,
    recoveredPerOneMillion: 263828,
    criticalPerOneMillion: 1.41
  },
  {
    country: "UK",
    countryInfo: {
      _id: 826,
      iso2: "GB",
      iso3: "GBR",
      lat: 54,
      long: -2,
      flag: "https://disease.sh/assets/img/flags/gb.png"
    },
    cases: 24642377,
    todayCases: 3421,
    deaths: 227019,
    todayDeaths: 19,
    recovered: 24337854,
    todayRecovered: 3542,
    active: 77504,
    critical: 412,
    casesPerOneMillion: 360630,
    deathsPerOneMillion: 3322,
    tests: 522526476,
    testsPerOneMillion: 7642686,
    population: 67886011,
    continent: "Europe",
    oneCasePerPeople: 3,
    oneDeathPerPeople: 301,
    oneTestPerPeople: 0,
    activePerOneMillion: 1134,
    recoveredPerOneMillion: 356174,
    criticalPerOneMillion: 6.03
  },
  {
    country: "Italy",
    countryInfo: {
      _id: 380,
      iso2: "IT",
      iso3: "ITA",
      lat: 42.8333,
      long: 12.8333,
      flag: "https://disease.sh/assets/img/flags/it.png"
    },
    cases: 25847084,
    todayCases: 1246,
    deaths: 190786,
    todayDeaths: 18,
    recovered: 25581306,
    todayRecovered: 1521,
    active: 74992,
    critical: 289,
    casesPerOneMillion: 427998,
    deathsPerOneMillion: 3159,
    tests: 278439257,
    testsPerOneMillion: 4603857,
    population: 60461826,
    continent: "Europe",
    oneCasePerPeople: 2,
    oneDeathPerPeople: 317,
    oneTestPerPeople: 0,
    activePerOneMillion: 1240,
    recoveredPerOneMillion: 423099,
    criticalPerOneMillion: 4.78
  },
  {
    country: "South Korea",
    countryInfo: {
      _id: 410,
      iso2: "KR",
      iso3: "KOR",
      lat: 37,
      long: 127.5,
      flag: "https://disease.sh/assets/img/flags/kr.png"
    },
    cases: 34542266,
    todayCases: 3892,
    deaths: 35898,
    todayDeaths: 5,
    recovered: 34380122,
    todayRecovered: 4321,
    active: 126246,
    critical: 87,
    casesPerOneMillion: 674517,
    deathsPerOneMillion: 701,
    tests: 15804065,
    testsPerOneMillion: 308654,
    population: 51269185,
    continent: "Asia",
    oneCasePerPeople: 1,
    oneDeathPerPeople: 1429,
    oneTestPerPeople: 3,
    activePerOneMillion: 2464,
    recoveredPerOneMillion: 671352,
    criticalPerOneMillion: 1.7
  },
  {
    country: "Russia",
    countryInfo: {
      _id: 643,
      iso2: "RU",
      iso3: "RUS",
      lat: 60,
      long: 100,
      flag: "https://disease.sh/assets/img/flags/ru.png"
    },
    cases: 22430404,
    todayCases: 4127,
    deaths: 397036,
    todayDeaths: 42,
    recovered: 21777560,
    todayRecovered: 3896,
    active: 255808,
    critical: 1321,
    casesPerOneMillion: 153496,
    deathsPerOneMillion: 2718,
    tests: 273400000,
    testsPerOneMillion: 1871347,
    population: 145934462,
    continent: "Europe",
    oneCasePerPeople: 7,
    oneDeathPerPeople: 368,
    oneTestPerPeople: 1,
    activePerOneMillion: 1751,
    recoveredPerOneMillion: 149027,
    criticalPerOneMillion: 9.04
  }
];

// Historical global data with realistic progression
export const mockHistoricalData = {
  cases: generateTimelineData(90, 775230420, 'sigmoid', 700000000),
  deaths: generateTimelineData(90, 7000345, 'logarithmic', 6800000),
  recovered: generateTimelineData(90, 747082008, 'sigmoid', 670000000)
};

// Mock vaccine data
export const mockVaccineData = {
  timeline: generateTimelineData(90, 13900000000, 'sigmoid', 13500000000)
};

// Generate historical country-specific data
export const generateCountryHistorical = (country, days = 90) => {
  const countryData = mockCountriesData.find(c => c.country === country);
  if (!countryData) return null;
  
  return {
    country: country,
    timeline: {
      cases: generateTimelineData(days, countryData.cases, 'sigmoid', countryData.cases * 0.9),
      deaths: generateTimelineData(days, countryData.deaths, 'logarithmic', countryData.deaths * 0.95),
      recovered: generateTimelineData(days, countryData.recovered, 'sigmoid', countryData.recovered * 0.85)
    }
  };
};

// Generate vaccine data for specific countries
export const generateCountryVaccineData = (country, days = 90) => {
  const countryData = mockCountriesData.find(c => c.country === country);
  if (!countryData) return null;
  
  // Assume vaccination coverage of around 70-85% of population
  const vaccineTotal = Math.round(countryData.population * (0.7 + Math.random() * 0.15));
  
  return {
    country: country,
    timeline: generateTimelineData(days, vaccineTotal, 'sigmoid', vaccineTotal * 0.9)
  };
};

// Generate continent data by aggregating countries
export const generateContinentData = () => {
  const continents = {};
  
  mockCountriesData.forEach(country => {
    if (!continents[country.continent]) {
      continents[country.continent] = {
        continent: country.continent,
        cases: 0,
        todayCases: 0,
        deaths: 0,
        todayDeaths: 0,
        recovered: 0,
        todayRecovered: 0,
        active: 0,
        critical: 0,
        population: 0,
        countries: []
      };
    }
    
    const cont = continents[country.continent];
    cont.cases += country.cases;
    cont.todayCases += country.todayCases;
    cont.deaths += country.deaths;
    cont.todayDeaths += country.todayDeaths;
    cont.recovered += country.recovered;
    cont.todayRecovered += country.todayRecovered;
    cont.active += country.active;
    cont.critical += country.critical;
    cont.population += country.population;
    cont.countries.push(country.country);
  });
  
  return Object.values(continents);
};