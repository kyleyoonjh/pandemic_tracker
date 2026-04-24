// src / components / charts / PieChart.js
import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
//import { formatNumber, formatPercent } from '../../utils/formatters';
import { formatNumber, formatPercentage } from '../../utils/formatters';
import '../../styles/components/charts.css';

const formatCompactNumber = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return '0';
  if (numericValue >= 1000000000) return `${(numericValue / 1000000000).toFixed(1)}B`;
  if (numericValue >= 1000000) return `${(numericValue / 1000000).toFixed(1)}M`;
  if (numericValue >= 1000) return `${(numericValue / 1000).toFixed(1)}K`;
  return `${Math.round(numericValue)}`;
};

const PieChart = ({
  data,
  width = 400,
  height = 400,
  margin = { top: 20, right: 20, bottom: 20, left: 20 },
  innerRadius = 0, // Set to 0 for pie, > 0 for donut
  metric = 'value',
  colorScheme = d3.schemeTableau10,
  onSliceClick = () => {}
}) => {
  const chartRef = useRef();
  const tooltipRef = useRef();
  // eslint-disable-next-line no-unused-vars
  const [activeSlice, setActiveSlice] = useState(null);

  // Derived dimensions and constants
  const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;
  
  // Memoized scales and arcs
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    // Filter out zero or negative values
    const filteredData = data.filter(d => d[metric] > 0);
    
    // Create color scale
    const color = d3.scaleOrdinal()
      .domain(filteredData.map(d => d.label))
      .range(colorScheme);
    
    // Create pie generator
    const pie = d3.pie()
      .value(d => d[metric])
      .sort(null); // Don't sort so data maintains input order
    
    // Generate pie data
    const pieData = pie(filteredData);
    
    // Create arc generator
    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(3)
      .padAngle(0.01);
    
    // Create hover arc generator (slightly larger)
    const hoverArc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius * 1.05)
      .cornerRadius(3)
      .padAngle(0.01);
    
    // Calculate total for percentages
    const total = d3.sum(filteredData, d => d[metric]);
    
    return { pieData, color, arc, hoverArc, total };
  }, [data, metric, radius, innerRadius, colorScheme]);

  useEffect(() => {
    if (!chartData || !data || data.length === 0) return;
    
    const svg = d3.select(chartRef.current);
    const tooltip = d3.select(tooltipRef.current);
    const { pieData, color, arc, hoverArc, total } = chartData;
    
    // Clear previous chart
    svg.selectAll('*').remove();
    
    // Set SVG attributes
    svg
      .attr('width', width)
      .attr('height', height);
    
    // Add chart group
    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);
    
    // Add slices
    const slices = g.selectAll('.arc')
      .data(pieData)
      .enter()
      .append('g')
      .attr('class', 'arc');
    
    slices.append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.label))
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        setActiveSlice(d);
        
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('d', hoverArc);
        
        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`)
          .html(`
            <strong>${d.data.label}</strong><br/>
            ${formatNumber(d.data[metric])} (${formatPercentage(d.data[metric] / total)})
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`);
      })
      .on('mouseout', (event, d) => {
        setActiveSlice(null);
        
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('d', arc);
        
        tooltip.style('opacity', 0);
      })
      .on('click', (event, d) => {
        onSliceClick(d.data);
      });
    
    // Add labels for larger slices
    const labelArc = d3.arc()
      .innerRadius(radius * 0.7)
      .outerRadius(radius * 0.7);
    
    slices.append('text')
      .attr('transform', d => {
        // Only show label if slice is large enough (> 5%)
        if ((d.endAngle - d.startAngle) < 0.1) return 'scale(0)';
        return `translate(${labelArc.centroid(d)})`;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('class', 'pie-label')
      .text(d => {
        // Only show percentage if slice is large enough
        if ((d.endAngle - d.startAngle) < 0.2) return '';
        return formatPercentage(d.data[metric] / total);
      });
    
    // Add legend
    const legendG = svg.append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${Math.max(width - 210, 20)}, 24)`);
    
    // Only show legend if it fits
    if (pieData.length <= 10) {
      const legend = legendG.selectAll('.legend')
        .data(pieData)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => `translate(0, ${i * 20})`);
      
      legend.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', d => color(d.data.label));
      
      legend.append('text')
        .attr('x', 20)
        .attr('y', 10)
        .attr('class', 'legend-text')
        .text((d) => {
          const label = d.data.label.length > 14 ? `${d.data.label.slice(0, 14)}...` : d.data.label;
          const percent = formatPercentage(d.data[metric] / total);
          const compactValue = formatCompactNumber(d.data[metric]);
          return `${label} ${percent} (${compactValue})`;
        });
    }
    
  }, [data, width, height, margin, chartData, onSliceClick, radius, metric]);

  if (!data || data.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  return (
    <div className="pie-chart-container">
      <svg ref={chartRef} className="pie-chart"></svg>
      <div ref={tooltipRef} className="chart-tooltip"></div>
    </div>
  );
};

export default React.memo(PieChart);