// src/components/Dashboard.js
import React, { useState, useEffect, useMemo } from 'react';
//import { fetchGlobalData, fetchCountriesData, fetchHistoricalData } from '../api/service';
import {
  fetchGlobalData,
  fetchAllCountries as fetchCountriesData,
  fetchHistoricalAllData as fetchHistoricalData,
  fetchHistoricalCountriesData,
  fetchKoreaRegionalData
} from '../api/service';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import WorldMap from './charts/WorldMap';
import KoreaRegionalMap from './charts/KoreaRegionalMap';
import '../styles/Dashboard.css';

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
};

const buildWhoCountryMetricsByIso2 = async () => {
  const publicBase = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const publicCsvUrl = `${publicBase}/csv/WHO-COVID-19-global-data.csv`;
  const primaryWhoCsvUrl = process.env.REACT_APP_WHO_GLOBAL_CSV_URL || publicCsvUrl;
  const candidates = [primaryWhoCsvUrl, publicCsvUrl, '/csv/WHO-COVID-19-global-data.csv']
    .filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

  for (let i = 0; i < candidates.length; i += 1) {
    try {
      const res = await fetch(candidates[i]);
      if (!res.ok) continue;
      const text = (await res.text()).trim().replace(/^\uFEFF/, '');
      if (!text || text.startsWith('<!DOCTYPE html')) continue;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) continue;

      const header = parseCsvLine(lines[0]).map((h) => String(h || '').trim());
      const idxDate = header.indexOf('Date_reported');
      const idxCode = header.indexOf('Country_code');
      const idxCumCases = header.indexOf('Cumulative_cases');
      const idxCumDeaths = header.indexOf('Cumulative_deaths');
      const idxNewCases = header.indexOf('New_cases');
      if ([idxDate, idxCode, idxCumCases, idxCumDeaths, idxNewCases].some((idx) => idx < 0)) continue;

      const rows = lines.slice(1).map((line) => parseCsvLine(line));
      const latestDate = rows.reduce((maxDate, row) => {
        const date = String(row[idxDate] || '').trim();
        return date > maxDate ? date : maxDate;
      }, '');
      if (!latestDate) continue;

      const latestDateObj = new Date(latestDate);
      const startObj = new Date(latestDateObj);
      startObj.setDate(startObj.getDate() - 27);

      const rolling28Map = new Map();
      const latestTotalsMap = new Map();
      rows.forEach((row) => {
        const code = String(row[idxCode] || '').trim().toUpperCase();
        if (!code || code === 'OWID_WRL') return;
        const dateText = String(row[idxDate] || '').trim();
        const dateObj = new Date(dateText);
        if (Number.isNaN(dateObj.getTime())) return;
        if (dateObj < startObj || dateObj > latestDateObj) return;
        const value = Number(row[idxNewCases] || 0);
        rolling28Map.set(code, (rolling28Map.get(code) || 0) + (Number.isFinite(value) ? value : 0));
      });

      rows.forEach((row) => {
        const code = String(row[idxCode] || '').trim().toUpperCase();
        if (!code || code === 'OWID_WRL') return;
        const dateText = String(row[idxDate] || '').trim();
        if (dateText !== latestDate) return;
        const cases = Number(row[idxCumCases] || 0);
        const deaths = Number(row[idxCumDeaths] || 0);
        latestTotalsMap.set(code, {
          cases: Number.isFinite(cases) ? cases : 0,
          deaths: Number.isFinite(deaths) ? deaths : 0
        });
      });
      return { rolling28Map, latestTotalsMap, latestDate };
    } catch (error) {
      // try next
    }
  }
  return { rolling28Map: new Map(), latestTotalsMap: new Map(), latestDate: '' };
};

const Dashboard = () => {
  const MENU_TITLE_MAP = {
    '#dashboard': 'Covid-19',
    '#about': 'Flu A,B',
    '#resources': 'AI Agent'
  };

  const [globalData, setGlobalData] = useState(null);
  const [countriesData, setCountriesData] = useState([]);
  const [historicalData, setHistoricalData] = useState(null);
  const [historicalCountriesData, setHistoricalCountriesData] = useState([]);
  const [koreaRegionalData, setKoreaRegionalData] = useState([]);
  const [whoCountryRolling28Map, setWhoCountryRolling28Map] = useState(new Map());
  const [whoCountryLatestTotalsMap, setWhoCountryLatestTotalsMap] = useState(new Map());
  const [whoLatestDate, setWhoLatestDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI state
  const [selectedCountry, setSelectedCountry] = useState('Global');
  const [timeRange, setTimeRange] = useState('30');
  const [activeMetric, setActiveMetric] = useState('cases');
  const [sortKey, setSortKey] = useState('newConfirmed');
  const [isRefreshingTable, setIsRefreshingTable] = useState(false);
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);
  const [sourceMode, setSourceMode] = useState('who');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [menuPrefix, setMenuPrefix] = useState(MENU_TITLE_MAP['#dashboard']);
  const [activeMenuHash, setActiveMenuHash] = useState('#dashboard');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi! Ask anything about pandemic trends or this dashboard.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Current data based on selection
  const [currentData, setCurrentData] = useState(null);
  const isSouthKoreaSelected = useMemo(() => {
    const name = String(selectedCountry || '').toLowerCase();
    return ['s. korea', 'south korea', 'korea', 'kr'].includes(name);
  }, [selectedCountry]);

  const refreshAllData = async ({ blocking = false } = {}) => {
    if (blocking) setLoading(true);
    setError(null);
    try {
      const [globalResult, countriesResult] = await Promise.all([
        fetchGlobalData(),
        fetchCountriesData()
      ]);
      setGlobalData(globalResult);
      setCountriesData(countriesResult);
      if (selectedCountry === 'Global') {
        setCurrentData(globalResult);
      }

      const [historicalResult, historicalCountriesResult, koreaRegionalResult, whoMetricsResult] = await Promise.all([
        fetchHistoricalData().catch(() => null),
        fetchHistoricalCountriesData(30).catch(() => []),
        fetchKoreaRegionalData().catch(() => []),
        buildWhoCountryMetricsByIso2().catch(() => ({ rolling28Map: new Map(), latestTotalsMap: new Map(), latestDate: '' }))
      ]);

      setHistoricalData(historicalResult);
      setHistoricalCountriesData(Array.isArray(historicalCountriesResult) ? historicalCountriesResult : []);
      setKoreaRegionalData(Array.isArray(koreaRegionalResult) ? koreaRegionalResult : []);
      setWhoCountryRolling28Map(whoMetricsResult?.rolling28Map instanceof Map ? whoMetricsResult.rolling28Map : new Map());
      setWhoCountryLatestTotalsMap(whoMetricsResult?.latestTotalsMap instanceof Map ? whoMetricsResult.latestTotalsMap : new Map());
      setWhoLatestDate(String(whoMetricsResult?.latestDate || ''));
    } catch (err) {
      setError('Failed to load Pandemic data. Please try again later.');
    } finally {
      if (blocking) setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData({ blocking: true });
  }, []);

  const handleSourceModeChange = async (nextMode) => {
    if (!nextMode || nextMode === sourceMode) return;
    setIsSwitchingSource(true);
    setSourceMode(nextMode);
    await refreshAllData({ blocking: false });
    setIsSwitchingSource(false);
  };
  
  useEffect(() => {
    const useWho = sourceMode === 'who';
    const nextGlobal = useWho
      ? (whoCountryLatestTotalsMap.size > 0
        ? {
          updated: Date.now(),
          cases: Array.from(whoCountryLatestTotalsMap.values()).reduce((sum, item) => sum + Number(item?.cases || 0), 0),
          deaths: Array.from(whoCountryLatestTotalsMap.values()).reduce((sum, item) => sum + Number(item?.deaths || 0), 0),
          recovered: 0,
          active: 0,
          source: 'who-csv',
          sourceDate: whoLatestDate
        }
        : globalData)
      : globalData;
    const nextCountries = useWho
      ? countriesData
        .map((country) => {
          const iso2 = String(country?.countryInfo?.iso2 || '').toUpperCase();
          const totals = iso2 ? whoCountryLatestTotalsMap.get(iso2) : null;
          const rolling28 = iso2 ? whoCountryRolling28Map.get(iso2) : null;
          if (!totals || !Number.isFinite(Number(rolling28))) return null;
          return {
            ...country,
            cases: Number(totals.cases || 0),
            todayCases: Number(rolling28 || 0),
            deaths: Number(totals.deaths || 0),
            recovered: 0,
            active: 0,
            source: 'who-csv',
            sourceDate: whoLatestDate
          };
        })
        .filter((row) => row && Number(row.cases || 0) > 0)
      : countriesData;

    if (selectedCountry === 'Global' && nextGlobal) {
      setCurrentData(nextGlobal);
    } else if (nextCountries.length > 0) {
      const countryData = nextCountries.find((c) => c.country === selectedCountry);
      if (countryData) {
        setCurrentData(countryData);
      } else {
        setSelectedCountry('Global');
        setCurrentData(nextGlobal);
      }
    }
  }, [selectedCountry, sourceMode, globalData, countriesData, whoCountryLatestTotalsMap, whoCountryRolling28Map, whoLatestDate]);

  useEffect(() => {
    const applyMenuPrefixFromHash = () => {
      const currentHash = window.location.hash || '#dashboard';
      setActiveMenuHash(currentHash);
      setMenuPrefix(MENU_TITLE_MAP[currentHash] || 'Covid-19');
    };

    applyMenuPrefixFromHash();
    window.addEventListener('hashchange', applyMenuPrefixFromHash);
    return () => window.removeEventListener('hashchange', applyMenuPrefixFromHash);
  }, []);
  const isAiAgentView = activeMenuHash === '#resources';

  const handleAskAgent = async () => {
    const content = String(chatInput || '').trim();
    if (!content || chatLoading) return;

    const nextMessages = [...chatMessages, { role: 'user', content }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const response = await fetch('/api/ai-agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.slice(-12)
        })
      });
      if (!response.ok) {
        let reason = 'AI request failed.';
        try {
          const errorBody = await response.json();
          reason = errorBody?.error || reason;
        } catch (error) {
          try {
            const rawError = await response.text();
            if (rawError) reason = rawError;
          } catch (readError) {
            // keep fallback message
          }
        }
        throw new Error(reason);
      }
      const result = await response.json();
      const answer = String(result?.answer || '').trim() || 'No response from AI.';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${error.message || 'Unable to reach AI service.'}` }
      ]);
    } finally {
      setChatLoading(false);
    }
  };
  
  const handleCountryChange = (e) => {
    setSelectedCountry(e.target.value);
  };

  const handleSelectSouthKorea = () => {
    const southKoreaEntry = countriesData.find((country) => {
      const name = String(country?.country || '').toLowerCase();
      const iso2 = String(country?.countryInfo?.iso2 || '').toLowerCase();
      return iso2 === 'kr' || name === 's. korea' || name === 'south korea';
    });

    setSelectedCountry(southKoreaEntry?.country || 'S. Korea');
  };

  const handleSelectGlobal = () => {
    setSelectedCountry('Global');
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
          fetchHistoricalCountriesData(30)
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

  const getRollingIncrement = (timeline, days = 28) => {
    if (!timeline || typeof timeline !== 'object') return null;
    const entries = Object.entries(timeline)
      .map(([date, value]) => ({
        date: new Date(date),
        value: Number(value || 0)
      }))
      .filter((item) => !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date - b.date);

    if (entries.length < 2) return null;
    const latestIndex = entries.length - 1;
    const baselineIndex = Math.max(0, latestIndex - days);
    const latestValue = entries[latestIndex].value;
    const baselineValue = entries[baselineIndex].value;
    return Math.max(0, latestValue - baselineValue);
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
    const sourceCountries = sourceMode === 'who'
      ? countriesData
        .map((country) => {
          const iso2 = String(country?.countryInfo?.iso2 || '').toUpperCase();
          const totals = iso2 ? whoCountryLatestTotalsMap.get(iso2) : null;
          const rolling28 = iso2 ? whoCountryRolling28Map.get(iso2) : null;
          if (!totals || !Number.isFinite(Number(rolling28))) return null;
          return {
            ...country,
            cases: Number(totals.cases || 0),
            todayCases: Number(rolling28 || 0),
            deaths: Number(totals.deaths || 0),
            recovered: 0,
            active: 0,
            source: 'who-csv',
            sourceDate: whoLatestDate
          };
        })
        .filter((row) => row && Number(row.cases || 0) > 0)
      : countriesData;

    return sourceCountries.map((country) => ({
      ...country,
      caseFatalityRate: country?.cases > 0
        ? (Number(country.deaths || 0) / Number(country.cases || 0)) * 100
        : 0,
      currentInfectionRate: country?.population > 0
        ? (Number(country.active || 0) / Number(country.population || 0)) * 100
        : 0
    }));
  }, [sourceMode, countriesData, whoCountryLatestTotalsMap, whoCountryRolling28Map, whoLatestDate]);

  const whoGlobalData = useMemo(() => {
    if (whoCountryLatestTotalsMap.size === 0) return null;
    let totalCases = 0;
    let totalDeaths = 0;
    whoCountryLatestTotalsMap.forEach((value) => {
      totalCases += Number(value?.cases || 0);
      totalDeaths += Number(value?.deaths || 0);
    });
    let rollingNewCases28d = 0;
    whoCountryRolling28Map.forEach((value) => {
      rollingNewCases28d += Number(value || 0);
    });
    return {
      updated: Date.now(),
      cases: totalCases,
      todayCases: rollingNewCases28d,
      rollingNewCases28d,
      deaths: totalDeaths,
      recovered: 0,
      active: 0,
      tests: 0,
      source: 'who-csv',
      sourceDate: whoLatestDate
    };
  }, [whoCountryLatestTotalsMap, whoCountryRolling28Map, whoLatestDate]);

  const effectiveGlobalData = useMemo(() => {
    if (sourceMode === 'who') return whoGlobalData || globalData;
    return globalData;
  }, [sourceMode, whoGlobalData, globalData]);

  const effectiveCountriesData = useMemo(() => {
    if (sourceMode !== 'who') return countriesData;
    return countriesData
      .map((country) => {
        const iso2 = String(country?.countryInfo?.iso2 || '').toUpperCase();
        if (!iso2) return null;
        const totals = whoCountryLatestTotalsMap.get(iso2);
        const rolling28 = whoCountryRolling28Map.get(iso2);
        if (!totals || !Number.isFinite(Number(rolling28))) return null;
        return {
          ...country,
          cases: Number(totals.cases || 0),
          todayCases: Number(rolling28 || 0),
          deaths: Number(totals.deaths || 0),
          recovered: 0,
          active: 0,
          source: 'who-csv',
          sourceDate: whoLatestDate
        };
      })
      .filter((row) => row && Number(row.cases || 0) > 0);
  }, [sourceMode, countriesData, whoCountryLatestTotalsMap, whoCountryRolling28Map, whoLatestDate]);

  const countryYesterdayCasesMap = useMemo(() => {
    const map = new Map();
    historicalCountriesData.forEach((item) => {
      if (!item?.country || !item?.timeline?.cases) return;
      const increment = getRollingIncrement(item.timeline.cases, 28);
      map.set(String(item.country).toLowerCase(), increment);
    });
    return map;
  }, [historicalCountriesData]);

  const countryRolling28Map = useMemo(() => {
    const useWhoOnly = sourceMode === 'who';
    const map = new Map();
    effectiveCountriesData.forEach((country) => {
      const key = String(country?.country || '').toLowerCase();
      const iso2 = String(country?.countryInfo?.iso2 || '').toUpperCase();
      const whoValue = iso2 ? whoCountryRolling28Map.get(iso2) : null;
      const diseaseValue = countryYesterdayCasesMap.get(key);
      if (Number.isFinite(Number(whoValue))) {
        map.set(key, Number(whoValue));
      } else if (!useWhoOnly && Number.isFinite(Number(diseaseValue))) {
        map.set(key, Number(diseaseValue));
      }
    });
    return map;
  }, [sourceMode, effectiveCountriesData, whoCountryRolling28Map, countryYesterdayCasesMap]);

  const countryDailyStatsMap = useMemo(() => {
    const map = new Map();
    historicalCountriesData.forEach((item) => {
      if (!item?.country) return;
      const key = String(item.country).toLowerCase();
      const caseStats = getLatestIncrementAndRate(item?.timeline?.cases);
      const deathStats = getLatestIncrementAndRate(item?.timeline?.deaths);
      map.set(key, {
        caseIncrement: caseStats.increment,
        caseRate: caseStats.rate,
        deathIncrement: deathStats.increment,
        deathRate: deathStats.rate
      });
    });
    return map;
  }, [historicalCountriesData]);

  const mapDataWithYesterdayMetrics = useMemo(() => {
    return mapDataWithDerivedMetrics.map((country) => ({
      ...country,
      yesterdayCases: countryRolling28Map.get(String(country.country || '').toLowerCase()) ?? 0
    }));
  }, [mapDataWithDerivedMetrics, countryRolling28Map]);

  const yesterdayGlobalCasesStats = useMemo(() => {
    return getLatestIncrementAndRate(historicalData?.cases);
  }, [historicalData]);

  const yesterdayGlobalDeathsStats = useMemo(() => {
    return getLatestIncrementAndRate(historicalData?.deaths);
  }, [historicalData]);

  const displayedNewCases = useMemo(() => {
    if (selectedCountry === 'Global' || selectedCountry === 'all') {
      const globalSource = sourceMode === 'who' ? 'who-csv' : String(effectiveGlobalData?.source || '').toLowerCase();
      if (globalSource === 'who-csv') {
        const whoRolling = Number(effectiveGlobalData?.rollingNewCases28d ?? effectiveGlobalData?.todayCases);
        return Number.isFinite(whoRolling) ? whoRolling : null;
      }
      return yesterdayGlobalCasesStats.increment;
    }

    const selectedCountryName = String(selectedCountry || '').toLowerCase();
    const countryYesterday = countryRolling28Map.get(selectedCountryName);
    if (Number.isFinite(countryYesterday) && countryYesterday >= 0) return countryYesterday;
    return null;
  }, [selectedCountry, sourceMode, effectiveGlobalData, yesterdayGlobalCasesStats, countryRolling28Map]);

  const displayedCasesPercent = useMemo(() => {
    if (selectedCountry === 'Global' || selectedCountry === 'all') {
      return yesterdayGlobalCasesStats.rate;
    }
    const selectedCountryName = String(selectedCountry || '').toLowerCase();
    return countryDailyStatsMap.get(selectedCountryName)?.caseRate ?? null;
  }, [selectedCountry, yesterdayGlobalCasesStats, countryDailyStatsMap]);

  const displayedDeathsPercent = useMemo(() => {
    if (selectedCountry === 'Global' || selectedCountry === 'all') {
      return yesterdayGlobalDeathsStats.rate;
    }
    const selectedCountryName = String(selectedCountry || '').toLowerCase();
    return countryDailyStatsMap.get(selectedCountryName)?.deathRate ?? null;
  }, [selectedCountry, yesterdayGlobalDeathsStats, countryDailyStatsMap]);

  const displayedActiveCases = useMemo(() => {
    const source = sourceMode === 'who' ? 'who-csv' : String(effectiveGlobalData?.source || '').toLowerCase();
    const isGlobalSelection = selectedCountry === 'Global' || selectedCountry === 'all';
    if (isGlobalSelection && source === 'who-csv') {
      return null;
    }
    const active = Number(currentData?.active || 0);
    const cases = Number(currentData?.cases || 0);
    if (selectedCountry !== 'Global' && selectedCountry !== 'all' && cases > 0 && active === 0) {
      return null;
    }
    return active;
  }, [selectedCountry, currentData, sourceMode, effectiveGlobalData]);

  // Top 10 countries by active metric
  const topCountries = [...mapDataWithYesterdayMetrics]
    .sort((a, b) => (Number(b[activeMetric] || 0) - Number(a[activeMetric] || 0)))
    .slice(0, 10);

  const rankedCountries = useMemo(() => {
    const useWhoOnly = sourceMode === 'who';
    const computedRows = [...effectiveCountriesData]
      .filter((country) =>
        country &&
        Number.isFinite(country.population) &&
        country.population > 0
      )
      .sort((a, b) => Number(b.cases || 0) - Number(a.cases || 0))
      .slice(0, 25)
      .map((country, index) => {
        const iso2 = String(country?.countryInfo?.iso2 || '').toUpperCase();
        const whoTotals = iso2 ? whoCountryLatestTotalsMap.get(iso2) : null;
        const cases = useWhoOnly && whoTotals ? Number(whoTotals.cases || 0) : Number(country.cases || 0);
        const deaths = useWhoOnly && whoTotals ? Number(whoTotals.deaths || 0) : Number(country.deaths || 0);

        const newConfirmed = countryRolling28Map.get(String(country.country || '').toLowerCase()) ?? null;
        const hasCsvCoreData = !useWhoOnly || (newConfirmed !== null && cases > 0);
        if (!hasCsvCoreData) return null;

        return {
          rank: index + 1,
          country: country.country,
          cases,
          newConfirmed,
          deaths,
          deathRateValue: cases > 0 ? (deaths / cases) * 100 : 0
        };
      })
      .filter(Boolean);

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
        deathRate: country.deathRateValue.toFixed(2)
      }));
  }, [sourceMode, effectiveCountriesData, sortKey, countryRolling28Map, whoCountryLatestTotalsMap]);

  const koreaRegionalRows = useMemo(() => {
    return [...koreaRegionalData]
      .filter((row) => row?.region && row.region !== '검역')
      .sort((a, b) => Number(b.confirmed || 0) - Number(a.confirmed || 0));
  }, [koreaRegionalData]);

  const selectedCountryRow = useMemo(() => {
    if (!currentData || selectedCountry === 'Global' || selectedCountry === 'all') return null;

    const useWhoOnly = sourceMode === 'who';
    const iso2 = String(currentData?.countryInfo?.iso2 || '').toUpperCase();
    const whoTotals = iso2 ? whoCountryLatestTotalsMap.get(iso2) : null;
    const cases = useWhoOnly && whoTotals ? Number(whoTotals.cases || 0) : Number(currentData?.cases || 0);
    const deaths = useWhoOnly && whoTotals ? Number(whoTotals.deaths || 0) : Number(currentData?.deaths || 0);
    const selectedCountryName = String(selectedCountry || '').toLowerCase();
    const yesterdayCases = countryRolling28Map.get(selectedCountryName) ?? null;
    if (useWhoOnly && (yesterdayCases === null || cases <= 0)) return null;

    const deathRateValue = cases > 0 ? (deaths / cases) * 100 : null;

    return {
      country: currentData?.country || selectedCountry,
      cases,
      newConfirmed: yesterdayCases,
      deaths,
      deathRateValue
    };
  }, [currentData, selectedCountry, countryRolling28Map, sourceMode, whoCountryLatestTotalsMap]);

  const globalSourceLabel = useMemo(() => {
    const source = sourceMode === 'who' ? 'who-csv' : String(effectiveGlobalData?.source || 'disease.sh').toLowerCase();
    if (source === 'who-csv') return 'WHO';
    return 'disease.sh';
  }, [sourceMode, effectiveGlobalData]);

  const globalSourceDateLabel = useMemo(() => {
    if (globalSourceLabel !== 'WHO') return '';
    const sourceDate = String(effectiveGlobalData?.sourceDate || '').trim();
    return sourceDate ? ` (${sourceDate})` : '';
  }, [effectiveGlobalData, globalSourceLabel]);

  const koreaSourceDateLabel = useMemo(() => {
    if (!isSouthKoreaSelected) return '';
    const regionalDate = koreaRegionalRows.reduce((latest, row) => {
      const date = String(row?.sourceDate || '').trim();
      if (!date) return latest;
      return date > latest ? date : latest;
    }, '');
    const countryDate = String(currentData?.sourceDate || '').trim();
    const raw = regionalDate || countryDate;
    if (!raw) return '';

    const normalized = /^\d{8}$/.test(raw)
      ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
      : raw;
    return normalized;
  }, [isSouthKoreaSelected, koreaRegionalRows, currentData]);

  const isKrApiEnabled = useMemo(() => {
    const raw = String(process.env.REACT_APP_USE_KR_API || '').toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
  }, []);

  const koreaSourceDateDisplay = useMemo(() => {
    if (koreaSourceDateLabel) return koreaSourceDateLabel;
    if (!isKrApiEnabled || !isSouthKoreaSelected) return 'N/A';
    // data.go.kr ODMS_COVID_04 latest available date in this integration window
    return '2023-08-31';
  }, [koreaSourceDateLabel, isKrApiEnabled, isSouthKoreaSelected]);

  if (loading) return <div className="loading">Loading Pandemic data...</div>;
  if (error) return <div className="error">{error}</div>;
  
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>{menuPrefix} Pandemic Dashboard</h1>
        <div className="last-updated">
          Last updated: {new Date().toLocaleDateString()}
          <span className={`global-source-badge source-${globalSourceLabel.replace('.', '-')}`}>
            Global source: {globalSourceLabel}{globalSourceDateLabel}
          </span>
          <div className="source-toggle-group">
            <button
              type="button"
              className={`source-toggle-btn ${sourceMode === 'who' ? 'active' : ''}`}
              onClick={() => handleSourceModeChange('who')}
              disabled={isSwitchingSource}
            >
              WHO
            </button>
            <button
              type="button"
              className={`source-toggle-btn ${sourceMode === 'disease' ? 'active' : ''}`}
              onClick={() => handleSourceModeChange('disease')}
              disabled={isSwitchingSource}
            >
              disease.sh
            </button>
          </div>
        </div>
      </div>
      {isAiAgentView ? (
        <div className="chart-card ai-agent-card">
          <h3>AI Agent</h3>
          <div className="ai-chat-window">
            {chatMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`ai-chat-row ${message.role}`}>
                <div className="ai-chat-bubble">{message.content}</div>
              </div>
            ))}
            {chatLoading && (
              <div className="ai-chat-row assistant">
                <div className="ai-chat-bubble">Thinking...</div>
              </div>
            )}
          </div>
          <div className="ai-chat-input-row">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAskAgent();
                }
              }}
              placeholder="Ask the AI agent..."
              disabled={chatLoading}
              className="ai-chat-input"
            />
            <button
              type="button"
              onClick={handleAskAgent}
              disabled={chatLoading || !String(chatInput || '').trim()}
              className="ai-chat-send-btn"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
      <>
      <div className="dashboard-controls">
        <div className="country-selector">
          <label>Select Country:</label>
          <select value={selectedCountry} onChange={handleCountryChange}>
            <option value="Global">Global</option>
            {effectiveCountriesData.map(country => (
              <option key={country.country} value={country.country}>
                {country.country}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="global-quick-btn"
            onClick={handleSelectGlobal}
          >
            Global
          </button>
          <button
            type="button"
            className="south-korea-quick-btn"
            onClick={handleSelectSouthKorea}
          >
            South Korea
          </button>
        </div>
        
      </div>
      
      <div className="stats-container">
        <button type="button" className={`stat-card rt-metric metric-card-button ${activeMetric === 'yesterdayCases' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('yesterdayCases')}>
          <h3>New Cases</h3>
          <div className="stat-value">
            {displayedNewCases !== null ? formatNumber(displayedNewCases) : 'N/A'}
          </div>
          <div className="stat-change neutral">
            Last 28 days
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
          <div className="stat-value">{displayedActiveCases !== null ? formatNumber(displayedActiveCases) : 'N/A'}</div>
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

        <button type="button" className={`stat-card current-infection-rate metric-card-button ${activeMetric === 'currentInfectionRate' ? 'active-metric-card' : ''}`} onClick={() => setActiveMetric('currentInfectionRate')}>
          <h3>Current Infection Rate</h3>
          <div className="stat-value">
            {displayedActiveCases !== null && currentData?.population
              ? ((displayedActiveCases / currentData.population) * 100).toFixed(2) + '%'
              : 'N/A'}
          </div>
        </button>
      </div>
      
      <div className="charts-container">
        <div className="chart-card map-chart-card">
          <h3>Pandemic Spread Map</h3>
          {isSouthKoreaSelected ? (
            <KoreaRegionalMap regionalData={koreaRegionalData} metric={activeMetric} height={560} />
          ) : (
            <WorldMap
              data={mapDataWithYesterdayMetrics}
              metric={activeMetric}
              height={560}
              focusCountry={selectedCountry}
            />
          )}
        </div>

        {selectedCountryRow && (
          <div className="chart-card selected-country-table-card">
            <h3>Selected Country Details</h3>
            <div className="countries-table-wrapper">
              <table className="countries-table selected-country-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Cases</th>
                    <th>New Confirmed</th>
                    <th>Deaths</th>
                    <th>Death Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{selectedCountryRow.country}</td>
                    <td>{formatNumber(selectedCountryRow.cases)}</td>
                    <td>{selectedCountryRow.newConfirmed !== null ? formatNumber(selectedCountryRow.newConfirmed) : 'N/A'}</td>
                    <td>{formatNumber(selectedCountryRow.deaths)}</td>
                    <td>{selectedCountryRow.deathRateValue !== null ? `${selectedCountryRow.deathRateValue.toFixed(2)}%` : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isSouthKoreaSelected && (
          <div className="chart-card korea-regional-table-card">
            <h3>South Korea Regional Cases</h3>
            {koreaRegionalRows.length === 0 && (
              <p className="korea-regional-empty-note">
                No regional rows returned from data.go.kr. Check REACT_APP_DATA_GO_KR_SERVICE_KEY and restart the dev server after updating .env.
              </p>
            )}
            <div className="countries-table-wrapper">
              <table className="countries-table korea-regional-table">
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>Confirmed</th>
                    <th>New Confirmed</th>
                    <th>Deaths</th>
                  </tr>
                </thead>
                <tbody>
                  {koreaRegionalRows.map((row) => (
                    <tr key={row.region}>
                      <td>{row.region}</td>
                      <td>{formatNumber(row.confirmed)}</td>
                      <td>{formatNumber(row.newConfirmed)}</td>
                      <td>{formatNumber(row.deaths)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="chart-card map-table-card">
          <h3>Top Countries {isRefreshingTable ? '(Refreshing...)' : ''}</h3>
          <div className="countries-table-wrapper">
            <table className="countries-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('country')} disabled={isRefreshingTable}>Country</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('cases')} disabled={isRefreshingTable}>Cases</button></th>
                  <th><button type="button" className="sort-header-button" onClick={() => handleSortByColumn('newConfirmed')} disabled={isRefreshingTable}>New Confirmed</button></th>
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
                    <td>{formatNumber(country.deaths)}</td>
                    <td>{country.deathRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div className="dashboard-footer">
        <p>Data source: {sourceMode === 'who' ? 'WHO' : 'disease.sh only'}.</p>
        <p className="disclaimer">
          Note: Values refresh from live API responses and may change frequently.
        </p>
      </div>
      </>
      )}
    </div>
  );
};

export default Dashboard;