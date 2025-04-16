// src/components/charts/BarChart.js
/*import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useSelector } from 'react-redux';
import { formatNumber } from '../../utils/formatters';
import { colorScales } from '../../constants/colorScales';
import '../../styles/components/charts.css';

const BarChart = ({
  data,
  width = 800,
  height = 400,
  margin = { top: 20, right: 30, bottom: 60, left: 60 },
  xAccessor = d => d.label,
  yAccessor = d => d.value,
  seriesAccessor = d => d.series,
  xLabel = 'Category',
  yLabel = 'Value',
  title = 'COVID-19 Statistics',
  colors = colorScales.categories,
  sortBy = null, // 'asc', 'desc', or null
  maxBars = 20,
  horizontal = false,
  animate = true,
  tooltipFormat = (d) => `${xAccessor(d)}: ${formatNumber(yAccessor(d))}`
}) => {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const theme = useSelector(state => state.ui.theme);
  // eslint-disable-next-line no-unused-vars
  const [hoveredData, setHoveredData] = useState(null);

  // Process and prepare data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // If data is already in expected format
    if (Array.isArray(data) && data[0] && ('label' in data[0] || 'series' in data[0])) {
      return data.map(d => ({
        ...d,
        label: d.label || d.name || d.country || 'Unknown',
        value: yAccessor(d),
        series: seriesAccessor(d) || 'default'
      }));
    }
    
    // Convert objects to array format
    if (!Array.isArray(data)) {
      return Object.entries(data).map(([key, value]) => ({
        label: key,
        value: typeof value === 'object' ? value.value || value.count || 0 : value,
        series: 'default'
      }));
    }
    
    return data.map(d => ({
      ...d,
      label: xAccessor(d),
      value: yAccessor(d),
      series: seriesAccessor(d) || 'default'
    }));
  }, [data, xAccessor, yAccessor, seriesAccessor]);
  
  // Sort and limit data if needed
  const finalData = useMemo(() => {
    if (!processedData || processedData.length === 0) return [];
    
    let sortedData = [...processedData];
    
    // Sort data if requested
    if (sortBy === 'asc') {
      sortedData.sort((a, b) => a.value - b.value);
    } else if (sortBy === 'desc') {
      sortedData.sort((a, b) => b.value - a.value);
    }
    
    // Limit number of bars if needed
    if (sortedData.length > maxBars) {
      sortedData = sortedData.slice(0, maxBars);
    }
    
    return sortedData;
  }, [processedData, sortBy, maxBars]);

  // Create scales and draw chart
  useEffect(() => {
    if (!finalData || finalData.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup dimensions
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Group data by series
    const nestedData = d3.group(finalData, d => d.series);
    const seriesNames = [...nestedData.keys()];

    // Create scales and axes based on orientation
    let xScale, yScale, xAxis, yAxis;
    
    if (horizontal) {
      // For horizontal bars
      xScale = d3.scaleLinear()
        .domain([0, d3.max(finalData, d => d.value) * 1.1])
        .range([0, innerWidth]);
        
      yScale = d3.scaleBand()
        .domain(finalData.map(d => d.label))
        .range([0, innerHeight])
        .padding(0.2);
        
      xAxis = g => g
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(5).tickFormat(formatNumber))
        .call(g => g.select('.domain').remove());
        
      yAxis = g => g
        .call(d3.axisLeft(yScale))
        .call(g => g.select('.domain').remove());
    } else {
      // For vertical bars
      xScale = d3.scaleBand()
        .domain(finalData.map(d => d.label))
        .range([0, innerWidth])
        .padding(0.2);
        
      yScale = d3.scaleLinear()
        .domain([0, d3.max(finalData, d => d.value) * 1.1])
        .range([innerHeight, 0]);
        
      xAxis = g => g
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .call(g => g.select('.domain').remove());
        
      yAxis = g => g
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(formatNumber))
        .call(g => g.select('.domain').remove());
    }

    // Create color scale for multiple series if needed
    const colorScale = d3.scaleOrdinal()
      .domain(seriesNames)
      .range(colors.length >= seriesNames.length ? colors : d3.schemeCategory10);

    // Create container group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid y-grid')
      .call(horizontal ? 
        d3.axisBottom(xScale)
          .ticks(5)
          .tickSize(innerHeight)
          .tickFormat('') :
        d3.axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat('')
      )
      .style('color', theme === 'dark' ? '#333' : '#eee')
      .style('opacity', 0.7);

    // Add axes
    g.append('g')
      .attr('class', 'x-axis')
      .call(xAxis)
      .selectAll('text')
      .attr('y', horizontal ? 10 : 0)
      .attr('x', horizontal ? 0 : -5)
      .attr('dy', '.35em')
      .attr('transform', horizontal ? null : 'rotate(-45)')
      .style('text-anchor', horizontal ? 'middle' : 'end')
      .style('fill', theme === 'dark' ? '#ddd' : '#333')
      .style('font-size', '10px');

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .style('fill', theme === 'dark' ? '#ddd' : '#333');

    // Add axis labels
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + (horizontal ? 40 : 50))
      .attr('text-anchor', 'middle')
      .style('fill', theme === 'dark' ? '#ddd' : '#333')
      .text(horizontal ? yLabel : xLabel);

    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('fill', theme === 'dark' ? '#ddd' : '#333')
      .text(horizontal ? xLabel : yLabel);

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

    // Draw bars based on orientation
    if (horizontal) {
      const bars = g.selectAll('.bar')
        .data(finalData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('y', d => yScale(d.label))
        .attr('height', yScale.bandwidth())
        .attr('fill', d => colorScale(d.series))
        .on('mouseover', (event, d) => {
          setHoveredData(d);
          d3.select(event.currentTarget)
            .attr('stroke', theme === 'dark' ? '#fff' : '#000')
            .attr('stroke-width', 1);
            
          d3.select(tooltipRef.current)
            .style('opacity', 1)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 28}px`)
            .html(tooltipFormat(d));
        })
        .on('mouseout', (event) => {
          setHoveredData(null);
          d3.select(event.currentTarget)
            .attr('stroke', 'none');
            
          d3.select(tooltipRef.current)
            .style('opacity', 0);
        });

      // Animate bars if enabled
      if (animate) {
        bars
          .attr('x', 0)
          .attr('width', 0)
          .transition()
          .duration(800)
          .delay((d, i) => i * 20)
          .attr('width', d => xScale(d.value));
      } else {
        bars
          .attr('x', 0)
          .attr('width', d => xScale(d.value));
      }
    } else {
      const bars = g.selectAll('.bar')
        .data(finalData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.label))
        .attr('width', xScale.bandwidth())
        .attr('fill', d => colorScale(d.series))
        .on('mouseover', (event, d) => {
          setHoveredData(d);
          d3.select(event.currentTarget)
            .attr('stroke', theme === 'dark' ? '#fff' : '#000')
            .attr('stroke-width', 1);
            
          d3.select(tooltipRef.current)
            .style('opacity', 1)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 28}px`)
            .html(tooltipFormat(d));
        })
        .on('mouseout', (event) => {
          setHoveredData(null);
          d3.select(event.currentTarget)
            .attr('stroke', 'none');
            
          d3.select(tooltipRef.current)
            .style('opacity', 0);
        });

      // Animate bars if enabled
      if (animate) {
        bars
          .attr('y', innerHeight)
          .attr('height', 0)
          .transition()
          .duration(800)
          .delay((d, i) => i * 20)
          .attr('y', d => yScale(d.value))
          .attr('height', d => innerHeight - yScale(d.value));
      } else {
        bars
          .attr('y', d => yScale(d.value))
          .attr('height', d => innerHeight - yScale(d.value));
      }
    }

    // Add data labels if there are few bars
    if (finalData.length <= 10) {
      if (horizontal) {
        g.selectAll('.bar-label')
          .data(finalData)
          .enter()
          .append('text')
          .attr('class', 'bar-label')
          .attr('x', d => xScale(d.value) + 5)
          .attr('y', d => yScale(d.label) + yScale.bandwidth() / 2)
          .attr('dy', '.35em')
          .style('fill', theme === 'dark' ? '#ddd' : '#333')
          .style('font-size', '10px')
          .text(d => formatNumber(d.value));
      } else {
        g.selectAll('.bar-label')
          .data(finalData)
          .enter()
          .append('text')
          .attr('class', 'bar-label')
          .attr('x', d => xScale(d.label) + xScale.bandwidth() / 2)
          .attr('y', d => yScale(d.value) - 5)
          .attr('text-anchor', 'middle')
          .style('fill', theme === 'dark' ? '#ddd' : '#333')
          .style('font-size', '10px')
          .text(d => formatNumber(d.value));
      }
    }
    
  }, [finalData, width, height, margin, horizontal, animate, theme, tooltipFormat, colors, xLabel, yLabel, title]);

  if (!data || data.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  return (
    <div className="bar-chart-container">
      <svg ref={svgRef} width={width} height={height} className="bar-chart"></svg>
      <div ref={tooltipRef} className="chart-tooltip"></div>
    </div>
  );
};

export default React.memo(BarChart);
*/



// src/components/charts/BarChart.js
// src/components/charts/BarChart.js

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import '../../styles/components/charts.css';

const BarChart = ({
  data,
  xLabel = '',
  yLabel = '',
  title = '',
  color = '#4285F4',
  colors,
  horizontal = false,
  height = 300,
  derivative = false,
  margin = { top: 30, right: 30, bottom: 50, left: 60 }
}) => {
  const chartRef = useRef(null);
  
  // Make sure colors exists, otherwise use the single color
  const colorArray = colors && Array.isArray(colors) && colors.length > 0 
    ? colors 
    : color 
      ? [color] 
      : ['#4285F4']; // Fallback color if both color and colors are undefined
  
  useEffect(() => {
    // Enhanced validation to prevent errors
    if (!chartRef.current) return;
    if (!data) {
      console.error("Chart data is undefined or null");
      return;
    }
    if (!Array.isArray(data)) {
      console.error("Chart data is not an array:", data);
      return;
    }
    if (data.length === 0) {
      console.error("Chart data array is empty");
      return;
    }
    
    // Clear previous chart
    d3.select(chartRef.current).selectAll('*').remove();
    
    const width = chartRef.current.clientWidth;
    
    // Set up the SVG
    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Process data for derivative if needed - with validation
    let chartData = [...data]; // Create a copy to avoid mutations
    
    if (derivative && Array.isArray(data)) {
      chartData = data.map((d, i) => {
        if (i === 0) return { ...d, value: 0 };
        return { ...d, value: d.value - data[i-1].value };
      }).filter(d => d.value > 0); // Only show positive derivatives
      
      // If after filtering we have no data, exit early
      if (chartData.length === 0) {
        console.warn("No positive derivatives found in the data");
        return;
      }
    }
    
    // Safe accessor function for getting labels
    const getLabel = (d) => {
      return (d && (d.label || d.name || d.date || '')).toString();
    };
    
    // Safe accessor function for getting values
    const getValue = (d) => {
      return d && typeof d.value === 'number' ? d.value : 0;
    };
    
    // Handle different data formats
    if (horizontal) {
      try {
        // For horizontal bars (e.g., country comparisons)
        const xScale = d3.scaleLinear()
          .domain([0, d3.max(chartData, getValue)])
          .range([0, chartWidth]);
        
        const yScale = d3.scaleBand()
          .domain(chartData.map(getLabel))
          .range([0, chartHeight])
          .padding(0.1);
        
        // X axis
        svg.append('g')
          .attr('transform', `translate(0, ${chartHeight})`)
          .call(d3.axisBottom(xScale).ticks(5))
          .append('text')
          .attr('fill', '#666')
          .attr('x', chartWidth / 2)
          .attr('y', 40)
          .attr('text-anchor', 'middle')
          .text(xLabel);
        
        // Y axis
        svg.append('g')
          .call(d3.axisLeft(yScale))
          .append('text')
          .attr('fill', '#666')
          .attr('transform', 'rotate(-90)')
          .attr('y', -40)
          .attr('x', -chartHeight / 2)
          .attr('text-anchor', 'middle')
          .text(yLabel);
        
        // Draw bars
        svg.selectAll('rect')
          .data(chartData)
          .enter()
          .append('rect')
          .attr('y', d => yScale(getLabel(d)))
          .attr('height', yScale.bandwidth())
          .attr('x', 0)
          .attr('width', d => xScale(getValue(d)))
          .attr('fill', (d, i) => colorArray[i % colorArray.length]);
      } catch (error) {
        console.error("Error rendering horizontal bar chart:", error);
      }
    } else {
      try {
        // For vertical bars (e.g., time series)
        const xScale = d3.scaleBand()
          .domain(chartData.map(getLabel))
          .range([0, chartWidth])
          .padding(0.1);
        
        const yScale = d3.scaleLinear()
          .domain([0, d3.max(chartData, getValue)])
          .range([chartHeight, 0]);
        
        // X axis
        svg.append('g')
          .attr('transform', `translate(0, ${chartHeight})`)
          .call(d3.axisBottom(xScale).tickValues(
            xScale.domain().filter((_, i) => i % Math.ceil(chartData.length / 10) === 0)
          ))
          .selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end');
        
        svg.append('text')
          .attr('fill', '#666')
          .attr('x', chartWidth / 2)
          .attr('y', chartHeight + 40)
          .attr('text-anchor', 'middle')
          .text(xLabel);
        
        // Y axis
        svg.append('g')
          .call(d3.axisLeft(yScale).ticks(5))
          .append('text')
          .attr('fill', '#666')
          .attr('transform', 'rotate(-90)')
          .attr('y', -40)
          .attr('x', -chartHeight / 2)
          .attr('text-anchor', 'middle')
          .text(yLabel);
        
        // Draw bars
        svg.selectAll('rect')
          .data(chartData)
          .enter()
          .append('rect')
          .attr('x', d => xScale(getLabel(d)))
          .attr('y', d => yScale(getValue(d)))
          .attr('width', xScale.bandwidth())
          .attr('height', d => chartHeight - yScale(getValue(d)))
          .attr('fill', (d, i) => d.color || colorArray[i % colorArray.length]);
      } catch (error) {
        console.error("Error rendering vertical bar chart:", error);
      }
    }
    
    // Add title if provided
    if (title) {
      svg.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text(title);
    }
  }, [data, xLabel, yLabel, title, colorArray, horizontal, height, margin, derivative]);
  
  // Render a placeholder if data is invalid
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="bar-chart-container" style={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="error-message">No data available to display</div>
      </div>
    );
  }
  
  return (
    <div className="bar-chart-container" style={{ height }}>
      <div ref={chartRef} className="bar-chart" style={{ width: '100%', height: '100%' }}></div>
    </div>
  );
};

export default BarChart;