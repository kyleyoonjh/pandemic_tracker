// src/api/mockData.js
// Generate more recent dates for the historical data
const generateDates = (days) => {
  const dates = {};
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().substr(-2)}`;
    dates[dateStr] = null;
  }
  
  return dates;
};

// Create realistic data progression
const generateTimelineData = (days, finalValue, growth = 'linear') => {
  const dateKeys = Object.keys(generateDates(days)).reverse();
  const result = {};
  
  dateKeys.forEach((date, index) => {
    let value;
    if (growth === 'linear') {
      // Linear progression
      value = Math.round(finalValue * (index + 1) / dateKeys.length);
    } else if (growth === 'exponential') {
      // Exponential progression
      value = Math.round(finalValue * Math.pow((index + 1) / dateKeys.length, 2));
    } else if (growth === 'logarithmic') {
      // Logarithmic progression
      value = Math.round(finalValue * (Math.log(index + 1) / Math.log(dateKeys.length)));
    } else if (growth === 'sigmoid') {
      // Sigmoid progression (S-curve)
      const midpoint = dateKeys.length / 2;
      const steepness = 10 / dateKeys.length;
      value = Math.round(finalValue / (1 + Math.exp(-steepness * (index - midpoint))));
    }
    
    result[date] = Math.max(0, value);
  });
  
  return result;
};

export const mockGlobalData = {
  updated: Date.now(),
  cases: 775230420,
  todayCases: 37832,
  deaths: 7000000,
  todayDeaths: 183,
  recovered: 747082008,
  active: 21148412,
  critical: 37661,
  tests: 6924488127,
  population: 7944935131
};

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
    active: 1694447,
    critical: 3254,
    tests: 1216187868,
    continent: "North America",
    population: 331002651
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
    active: 8115,
    critical: 412,
    tests: 934143773,
    continent: "Asia",
    population: 1380004385
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
    active: 42001,
    critical: 789,
    tests: 271490188,
    continent: "Europe",
    population: 65273511
  },
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
    active: 360252,
    critical: 1124,
    tests: 63776166,
    continent: "South America",
    population: 212559417
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
    active: 186966,
    critical: 652,
    tests: 138040528,
    continent: "Europe",
    population: 83783942
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
    active: 77504,
    critical: 412,
    tests: 522526476,
    continent: "Europe",
    population: 67886011
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
    active: 255808,
    critical: 1321,
    tests: 273400000,
    continent: "Europe",
    population: 145934462
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
    active: 311048,
    critical: 178,
    tests: 100414883,
    continent: "Asia",
    population: 126476461
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
    active: 126246,
    critical: 87,
    tests: 15804065,
    continent: "Asia",
    population: 51269185
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
    active: 74992,
    critical: 289,
    tests: 278439257,
    continent: "Europe",
    population: 60461826
  }
];

// Generate historical data with realistic progression
export const mockHistoricalData = {
  cases: generateTimelineData(90, 775230420, 'sigmoid'),
  deaths: generateTimelineData(90, 7000000, 'logarithmic'),
  recovered: generateTimelineData(90, 747082008, 'sigmoid')
};

export const mockVaccineData = {
  timeline: generateTimelineData(90, 13900000000, 'sigmoid')
};