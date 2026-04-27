import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import '../../styles/components/charts.css';

const KOREA_GEOJSON_URL = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_provinces_geo_simple.json';

const REGION_NAME_ALIASES = {
  서울특별시: '서울',
  Seoul: '서울',
  부산광역시: '부산',
  Busan: '부산',
  대구광역시: '대구',
  Daegu: '대구',
  인천광역시: '인천',
  Incheon: '인천',
  광주광역시: '광주',
  Gwangju: '광주',
  대전광역시: '대전',
  Daejeon: '대전',
  울산광역시: '울산',
  Ulsan: '울산',
  세종특별자치시: '세종',
  Sejong: '세종',
  경기도: '경기',
  Gyeonggi: '경기',
  강원도: '강원',
  Gangwon: '강원',
  충청북도: '충북',
  Chungbuk: '충북',
  충청남도: '충남',
  Chungnam: '충남',
  전라북도: '전북',
  Jeonbuk: '전북',
  전라남도: '전남',
  Jeonnam: '전남',
  경상북도: '경북',
  Gyeongbuk: '경북',
  경상남도: '경남',
  Gyeongnam: '경남',
  제주특별자치도: '제주',
  Jeju: '제주'
};

const normalizeName = (name) => {
  const raw = String(name || '').trim();
  return REGION_NAME_ALIASES[raw] || raw.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/g, '');
};

const formatCompact = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
};

const getMetricValue = (row, metric) => {
  if (!row) return 0;
  if (metric === 'deaths' || metric === 'caseFatalityRate') return Number(row.deaths || 0);
  if (metric === 'yesterdayCases') return Number(row.newConfirmed || 0);
  return Number(row.confirmed || 0);
};

const getMetricLabel = (metric) => {
  if (metric === 'deaths' || metric === 'caseFatalityRate') return 'Deaths';
  if (metric === 'yesterdayCases') return 'New';
  return 'Confirmed';
};

const LABEL_OFFSETS = {
  서울: [0, -8],
  인천: [-10, 4],
  세종: [10, -4],
  대전: [8, 8],
  광주: [-6, 8],
  대구: [8, 8],
  울산: [12, 8],
  부산: [12, 10],
  제주: [0, -8]
};

const KoreaRegionalMap = ({ regionalData = [], metric = 'cases', width = 960, height = 560 }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tooltipRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [containerWidth, setContainerWidth] = useState(width);

  useEffect(() => {
    fetch(KOREA_GEOJSON_URL)
      .then((res) => res.json())
      .then((json) => setGeoData(json))
      .catch(() => setGeoData(null));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const element = containerRef.current;
    const updateWidth = () => {
      const next = Math.floor(element.getBoundingClientRect().width || width);
      setContainerWidth(next > 0 ? next : width);
    };
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  const regionalMap = useMemo(() => {
    const map = new Map();
    regionalData.forEach((row) => {
      map.set(normalizeName(row.region), row);
    });
    return map;
  }, [regionalData]);

  useEffect(() => {
    if (!geoData || !mapRef.current) return;

    const mapWidth = Math.max(320, Math.min(width, containerWidth || width));
    const mapHeight = Math.round((height / width) * mapWidth);
    const labelFontSize = mapWidth < 640 ? 8.5 : 10;
    const labelValueFontSize = mapWidth < 640 ? 7.5 : 9;
    const labelDy = mapWidth < 640 ? 9 : 11;

    const svg = d3.select(mapRef.current);
    svg.selectAll('*').remove();
    svg
      .attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)
      .attr('width', '100%')
      .attr('height', 'auto')
      .attr('preserveAspectRatio', 'xMidYMid meet');
    const tooltip = d3.select(tooltipRef.current);

    const projection = d3.geoMercator().fitExtent([[20, 24], [mapWidth - 20, mapHeight - 20]], geoData);
    const path = d3.geoPath(projection);

    const values = Array.from(regionalMap.values()).map((d) => getMetricValue(d, metric)).filter((v) => v > 0);
    const color = d3.scaleSequential(d3.interpolateReds).domain([0, d3.max(values) || 1]);

    svg.append('g')
      .selectAll('path')
      .data(geoData.features || [])
      .join('path')
      .attr('d', path)
      .attr('fill', (d) => {
        const name = normalizeName(d.properties?.name);
        const row = regionalMap.get(name);
        return row ? color(getMetricValue(row, metric)) : '#e5e7eb';
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.2)
      .on('mousemove', (event, d) => {
        const name = normalizeName(d.properties?.name);
        const row = regionalMap.get(name);
        const metricLabel = getMetricLabel(metric);
        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`)
          .html(
            row
              ? `<strong>${name}</strong><br/>${metricLabel}: ${formatCompact(getMetricValue(row, metric))}<br/>Deaths: ${formatCompact(row.deaths)}`
              : `<strong>${name}</strong><br/>No data`
          );
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0);
      });

    // Show region labels directly on the map for quick reading.
    svg.append('g')
      .selectAll('text')
      .data(geoData.features || [])
      .join('text')
      .attr('transform', (d) => {
        const name = normalizeName(d.properties?.name);
        const [x, y] = path.centroid(d);
        const [dx, dy] = LABEL_OFFSETS[name] || [0, 0];
        return `translate(${x + dx}, ${y + dy})`;
      })
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .style('paint-order', 'stroke')
      .style('stroke', '#ffffff')
      .style('stroke-width', 2.6)
      .style('font-size', `${labelFontSize}px`)
      .style('font-weight', 700)
      .style('fill', '#1f2937')
      .each(function attachLabel(d) {
        const el = d3.select(this);
        const name = normalizeName(d.properties?.name);
        const row = regionalMap.get(name);
        if (!row) return;
        el.append('tspan')
          .attr('x', 0)
          .attr('dy', 0)
          .text(name);
        el.append('tspan')
          .attr('x', 0)
          .attr('dy', labelDy)
          .style('font-size', `${labelValueFontSize}px`)
          .style('fill', '#7f1d1d')
          .text(formatCompact(Number(row.confirmed || 0)));
      });
  }, [geoData, regionalMap, metric, width, height, containerWidth]);

  if (!geoData) {
    return <div className="chart-placeholder">Loading Korea regional map...</div>;
  }

  return (
    <div ref={containerRef} className="world-map-container">
      <svg ref={mapRef} className="world-map"></svg>
      <div ref={tooltipRef} className="chart-tooltip"></div>
    </div>
  );
};

export default KoreaRegionalMap;
