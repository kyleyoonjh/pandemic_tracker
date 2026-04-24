// src / components / charts / LineChart.js
import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useSelector } from 'react-redux';
import { formatNumber, formatDate } from '../../utils/formatters';
import { colorScales } from '../../constants/colorScales';
import '../../styles/components/charts.css';

const LineChart = ({
  data,
  width = 800,
  height = 400,
  margin = { top: 20, right: 30, bottom: 50, left: 60 },
  xAccessor = d => new Date(d.date),
  yAccessor = d => d.value,
  seriesAccessor = d => d.series,
  xLabel = 'Date',
  yLabel = 'Value',
  title = 'Pandemic Timeline',
  colors = colorScales.multi,
  animate = true,
  showLegend = true,
  tooltipFormat = (d) => `${formatDate(xAccessor(d))}: ${formatNumber(yAccessor(d))}`
}) => {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const theme = useSelector(state => state.ui.theme);
  // eslint-disable-next-line no-unused-vars
  const [hoveredData, setHoveredData] = useState(null);

  // Process data for visualization
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // If data is already in the expected format, use it directly
    if (Array.isArray(data) && data[0] && 'series' in data[0]) {
      return data;
    }

    // If we have nested data (e.g., multiple series)
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data.flat();
    }

    // If we have an object with date keys (API format)
    if (!Array.isArray(data)) {
      const series = Object.keys(data);
      return series.flatMap(seriesName => {
        return Object.entries(data[seriesName]).map(([date, value]) => ({
          date,
          value,
          series: seriesName
        }));
      });
    }

    // Default case: single series data
    return data.map(d => ({
      ...d,
      series: 'default'
    }));
  }, [data]);

  // Compute domains for scales
  const { xDomain, yDomain, seriesNames } = useMemo(() => {
    if (!processedData || processedData.length === 0) {
      return { xDomain: [new Date(), new Date()], yDomain: [0, 0], seriesNames: [] };
    }

    const xValues = processedData.map(xAccessor);
    const yValues = processedData.map(yAccessor);
    const seriesSet = new Set(processedData.map(seriesAccessor));

    return {
      xDomain: [d3.min(xValues), d3.max(xValues)],
      yDomain: [0, d3.max(yValues) * 1.1], // Add 10% padding to y-axis
      seriesNames: [...seriesSet]
    };
  }, [processedData, xAccessor, yAccessor, seriesAccessor]);

  // Create and update chart
  useEffect(() => {
    if (!processedData || processedData.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup dimensions
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    const xScale = d3.scaleTime()
      .domain(xDomain)
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range([innerHeight, 0]);

    const colorScale = d3.scaleOrdinal()
      .domain(seriesNames)
      .range(colors.length >= seriesNames.length ? colors : d3.schemeCategory10);

    // Create line generator
    const line = d3.line()
      .defined(d => !isNaN(yAccessor(d)))
      .x(d => xScale(xAccessor(d)))
      .y(d => yScale(yAccessor(d)))
      .curve(d3.curveMonotoneX);

    // Create container group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add x axis
    const xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat('%b %d')));

    xAxis.selectAll('text')
      .style('fill', theme === 'dark' ? '#ddd' : '#333')
      .attr('y', 10)
      .attr('dy', '.71em')
      .style('text-anchor', 'middle');

    xAxis.selectAll('line')
      .style('stroke', theme === 'dark' ? '#555' : '#ddd');

    xAxis.select('path')
      .style('stroke', theme === 'dark' ? '#555' : '#ddd');

    // Add y axis
    const yAxis = g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(formatNumber));

    yAxis.selectAll('text')
      .style('fill', theme === 'dark' ? '#ddd' : '#333');

    yAxis.selectAll('line')
      .style('stroke', theme === 'dark' ? '#555' : '#ddd');

    yAxis.select('path')
      .style('stroke', theme === 'dark' ? '#555' : '#ddd');

    // Add axis labels
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('fill', theme === 'dark' ? '#ddd' : '#333')
      .text(xLabel);

    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('fill', theme === 'dark' ? '#ddd' : '#333')
      .text(yLabel);

    // Add chart title
    g.append('text')
      .attr('class', 'chart-title')
      .attr('x', innerWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .style('fill', theme === 'dark' ? '#fff' : '#333')
      .text(title);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid-lines x-grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(5)
          .tickSize(-innerHeight)
          .tickFormat('')
      )
      .selectAll('line')
      .style('stroke', theme === 'dark' ? '#333' : '#eee')
      .style('stroke-opacity', 0.7);

    g.append('g')
      .attr('class', 'grid-lines y-grid')
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat('')
      )
      .selectAll('line')
      .style('stroke', theme === 'dark' ? '#333' : '#eee')
      .style('stroke-opacity', 0.7);

    // Group data by series
    const nestedData = d3.group(processedData, seriesAccessor);
    
    // Draw lines for each series
    nestedData.forEach((values, key) => {
      // If animate is true, animate the line drawing
      if (animate) {
        const path = g.append('path')
          .datum(values)
          .attr('class', 'line')
          .attr('fill', 'none')
          .attr('stroke', colorScale(key))
          .attr('stroke-width', 2.5)
          .attr('d', line);

        const totalLength = path.node().getTotalLength();
        
        path
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(1500)
          .ease(d3.easeLinear)
          .attr('stroke-dashoffset', 0);
      } else {
        g.append('path')
          .datum(values)
          .attr('class', 'line')
          .attr('fill', 'none')
          .attr('stroke', colorScale(key))
          .attr('stroke-width', 2.5)
          .attr('d', line);
      }
    });

    // Add legend if there are multiple series
    if (showLegend && seriesNames.length > 1) {
      const legend = g.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${innerWidth - 120}, 0)`);

      seriesNames.forEach((seriesName, i) => {
        const legendItem = legend.append('g')
          .attr('transform', `translate(0, ${i * 20})`);

        legendItem.append('rect')
          .attr('width', 12)
          .attr('height', 12)
          .attr('fill', colorScale(seriesName));

        legendItem.append('text')
          .attr('x', 20)
          .attr('y', 10)
          .attr('text-anchor', 'start')
          .style('font-size', '12px')
          .style('fill', theme === 'dark' ? '#ddd' : '#333')
          .text(seriesName);
      });
    }

    // Create hover elements for tooltip functionality
    const hoverLine = g.append('line')
      .attr('class', 'hover-line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('stroke', theme === 'dark' ? '#fff' : '#000')
      .style('stroke-width', 1)
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0);

    const allPoints = [];
    nestedData.forEach((values, key) => {
      values.forEach(d => {
        if (isNaN(yAccessor(d))) return;
        
        allPoints.push({
          x: xScale(xAccessor(d)),
          y: yScale(yAccessor(d)),
          data: d,
          series: key,
          color: colorScale(key)
        });
      });
    });

    // Create a voronoi overlay for better hover detection
    const delaunay = d3.Delaunay.from(
      allPoints,
      d => d.x,
      d => d.y
    );
    const voronoi = delaunay.voronoi([0, 0, innerWidth, innerHeight]);

    g.append('g')
      .attr('class', 'voronoi')
      .selectAll('path')
      .data(allPoints)
      .join('path')
      .attr('d', (d, i) => voronoi.renderCell(i))
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .on('mouseover', (event, d) => {
        setHoveredData(d);
        
        // Show the hover line
        hoverLine
          .attr('x1', d.x)
          .attr('x2', d.x)
          .style('opacity', 0.5);
        
        // Show tooltip
        const tooltip = d3.select(tooltipRef.current);
        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`)
          .html(`
            <div class="tooltip-series" style="color:${d.color}">
              ${d.series}
            </div>
            <div class="tooltip-value">
              ${tooltipFormat(d.data)}
            </div>
          `);
        
        // Highlight this point
        g.selectAll('.hover-point')
          .remove();
          
        g.append('circle')
          .attr('class', 'hover-point')
          .attr('cx', d.x)
          .attr('cy', d.y)
          .attr('r', 5)
          .attr('fill', d.color)
          .attr('stroke', theme === 'dark' ? '#fff' : '#fff')
          .attr('stroke-width', 2);
      })
      .on('mouseout', () => {
        setHoveredData(null);
        hoverLine.style('opacity', 0);
        d3.select(tooltipRef.current).style('opacity', 0);
        g.selectAll('.hover-point').remove();
      });

  }, [processedData, width, height, margin, xDomain, yDomain, seriesNames, xAccessor, yAccessor, seriesAccessor, xLabel, yLabel, title, colors, theme, animate, showLegend, tooltipFormat]);

  if (!data || data.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  return (
    <div className="line-chart-container">
      <svg ref={svgRef} width={width} height={height} className="line-chart"></svg>
      <div ref={tooltipRef} className="chart-tooltip"></div>
    </div>
  );
};

export default React.memo(LineChart);