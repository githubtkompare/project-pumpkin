// URL Results JavaScript - URL-specific test results page

import {
  formatTimestamp as tzFormatTimestamp,
  getTimezonePreference,
  getDateString,
  getToday,
  formatChartDateLabel
} from './timezone-utils.js';

// Utility functions
function formatTimestamp(timestamp) {
  return tzFormatTimestamp(timestamp);
}

function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  return Math.round(num).toLocaleString();
}

function getStatusBadge(status) {
  const statusMap = {
    'COMPLETED': 'success',
    'RUNNING': 'primary',
    'PARTIAL': 'warning',
    'FAILED': 'danger',
    'PASSED': 'success',
    'ERROR': 'danger',
    'TIMEOUT': 'warning'
  };
  const badgeClass = statusMap[status] || 'secondary';
  return `<span class="badge bg-${badgeClass}">${status}</span>`;
}

function formatHttpCodes(httpCodes) {
  if (!httpCodes || typeof httpCodes !== 'object') return 'N/A';

  const codes = Object.entries(httpCodes)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([code, count]) => {
      const codeNum = parseInt(code);
      let badgeClass = 'secondary';
      if (codeNum >= 200 && codeNum < 300) badgeClass = 'success';
      else if (codeNum >= 300 && codeNum < 400) badgeClass = 'info';
      else if (codeNum >= 400 && codeNum < 500) badgeClass = 'warning';
      else if (codeNum >= 500) badgeClass = 'danger';

      return `<span class="badge bg-${badgeClass} me-1">${code}: ${count}</span>`;
    })
    .join('');

  return codes || 'N/A';
}

// Get URL from URL parameters
function getUrlFromQueryString() {
  const params = new URLSearchParams(window.location.search);
  return params.get('url');
}

// API calls
async function fetchUrlTests(url) {
  try {
    const response = await fetch(`/api/urls/${encodeURIComponent(url)}/tests`);
    const result = await response.json();

    if (result.success) {
      displayUrlSummary(url, result.data);
      displayUrlTests(result.data);
    } else {
      displayError('No tests found for this URL');
    }
  } catch (error) {
    console.error('Failed to fetch URL tests:', error);
    displayError('Failed to load test results');
  }
}

async function fetchDailyAverages(url) {
  try {
    const response = await fetch(`/api/urls/${encodeURIComponent(url)}/daily-averages?days=15`);
    const result = await response.json();

    if (result.success) {
      chartData = result.data; // Store globally for resize
      drawDailyAverageChart(result.data);
    }
  } catch (error) {
    console.error('Failed to fetch daily averages:', error);
  }
}

// Display functions
function displayUrlSummary(url, tests) {
  const card = document.getElementById('url-summary-card');

  if (tests.length === 0) {
    card.innerHTML = `
      <div class="alert alert-warning mb-0" role="alert">
        No test results found for this URL
      </div>
    `;
    return;
  }

  // Calculate summary statistics
  const totalTests = tests.length;
  const passedTests = tests.filter(t => t.status === 'PASSED' || t.status === 'COMPLETED').length;
  const failedTests = tests.filter(t => t.status === 'FAILED' || t.status === 'ERROR').length;

  const avgLoadTime = tests.reduce((sum, t) => sum + (parseFloat(t.total_page_load_ms) || 0), 0) / totalTests;
  const avgTtfb = tests.reduce((sum, t) => sum + (parseFloat(t.time_to_first_byte_ms) || 0), 0) / totalTests;

  const latestTest = tests[0]; // Tests are sorted by timestamp DESC
  const oldestTest = tests[tests.length - 1];

  card.innerHTML = `
    <div class="card-body">
      <div class="row">
        <div class="col-md-6">
          <h5 class="card-title">URL Information</h5>
          <p class="card-text mb-1"><strong>Domain:</strong> ${latestTest.domain}</p>
          <p class="card-text mb-1"><strong>Full URL:</strong> <a href="${latestTest.url}" target="_blank">${latestTest.url}</a></p>
          <p class="card-text mb-1"><strong>Latest Page Title:</strong> ${latestTest.page_title || 'N/A'}</p>
          <p class="card-text mb-1"><strong>First Tested:</strong> ${formatTimestamp(oldestTest.test_timestamp)}</p>
          <p class="card-text mb-1"><strong>Last Tested:</strong> ${formatTimestamp(latestTest.test_timestamp)}</p>
        </div>
        <div class="col-md-6">
          <h5 class="card-title">Test Statistics</h5>
          <p class="card-text mb-1"><strong>Total Tests:</strong> ${totalTests}</p>
          <p class="card-text mb-1"><strong>Passed:</strong> <span class="text-success">${passedTests}</span></p>
          <p class="card-text mb-1"><strong>Failed:</strong> <span class="text-danger">${failedTests}</span></p>
          <p class="card-text mb-1"><strong>Avg Load Time:</strong> ${formatNumber(avgLoadTime)} ms</p>
          <p class="card-text mb-1"><strong>Avg TTFB:</strong> ${formatNumber(avgTtfb)} ms</p>
        </div>
      </div>
    </div>
  `;
}

function displayUrlTests(tests) {
  const tbody = document.querySelector('#url-tests-table tbody');

  if (tests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No tests found for this URL</td></tr>';
    return;
  }

  tbody.innerHTML = tests.map(test => `
    <tr>
      <td>${getStatusBadge(test.status)}</td>
      <td class="text-truncate" style="max-width: 200px;" title="${test.page_title || 'N/A'}">
        ${test.page_title || 'N/A'}
      </td>
      <td data-order="${test.total_page_load_ms || 0}">${formatNumber(test.total_page_load_ms)}</td>
      <td data-order="${test.time_to_first_byte_ms || 0}">${formatNumber(test.time_to_first_byte_ms)}</td>
      <td data-order="${test.total_resources || 0}">${test.total_resources || 'N/A'}</td>
      <td>${formatHttpCodes(test.http_response_codes)}</td>
      <td data-order="${new Date(test.test_timestamp).getTime()}">${formatTimestamp(test.test_timestamp)}</td>
      <td>
        <a href="/run-details.html?id=${test.test_run_id}" class="text-decoration-none">#${test.test_run_id}</a>
      </td>
      <td>
        <a href="/test-detail.html?id=${test.id}" class="btn btn-sm btn-outline-primary">View Details</a>
      </td>
    </tr>
  `).join('');

  // Initialize DataTables with pagination and filtering
  if ($.fn.DataTable.isDataTable('#url-tests-table')) {
    $('#url-tests-table').DataTable().destroy();
  }

  $('#url-tests-table').DataTable({
    pageLength: 20,
    order: [[6, 'desc']], // Sort by Test Timestamp (descending) by default - most recent first
    columnDefs: [
      { orderable: false, targets: 8 } // Disable sorting on Actions column
    ],
    language: {
      search: "Filter:",
      lengthMenu: "Show _MENU_ entries per page",
      info: "Showing _START_ to _END_ of _TOTAL_ test results",
      infoEmpty: "No test results available",
      infoFiltered: "(filtered from _MAX_ total results)"
    }
  });
}

function displayError(message) {
  document.getElementById('url-summary-card').innerHTML = `
    <div class="alert alert-warning mb-0" role="alert">
      ${message}
    </div>
  `;

  const tbody = document.querySelector('#url-tests-table tbody');
  tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">${message}</td></tr>`;
}

function drawDailyAverageChart(data) {
  const svg = document.getElementById('daily-average-chart');
  const container = svg.parentElement;

  // Get container dimensions
  const containerWidth = container.offsetWidth;
  const containerHeight = 300;

  // Set SVG viewBox for responsiveness
  svg.setAttribute('viewBox', `0 0 ${containerWidth} ${containerHeight}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // Clear existing SVG content
  svg.innerHTML = '';

  // Generate complete date range for last 15 days (timezone-aware)
  const timezone = getTimezonePreference();
  const today = getToday(timezone);
  const completeData = [];

  for (let i = 14; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    // Get date string in appropriate timezone
    const dateStr = timezone === 'UTC'
      ? date.toISOString().split('T')[0]
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // Find matching data for this date
    const existing = data.find(d => {
      const dbDateStr = getDateString(d.test_date, timezone);
      return dbDateStr === dateStr;
    });

    completeData.push({
      test_date: dateStr,
      avg_load_time_ms: existing ? parseFloat(existing.avg_load_time_ms) : 0,
      test_count: existing ? existing.test_count : 0
    });
  }

  // Set chart dimensions
  const padding = { top: 40, right: 40, bottom: 60, left: 80 };
  const chartWidth = containerWidth - padding.left - padding.right;
  const chartHeight = containerHeight - padding.top - padding.bottom;

  // Find max value for scaling
  const maxValue = Math.max(...completeData.map(d => d.avg_load_time_ms), 1);
  const yScale = chartHeight / maxValue;

  // Calculate bar width and spacing
  const barWidth = chartWidth / completeData.length - 10;
  const barSpacing = 10;

  // Add accessibility elements
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.id = 'chart-title';
  title.textContent = 'Average Load Time - Last 15 Days';
  svg.appendChild(title);

  const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
  desc.id = 'chart-desc';
  desc.textContent = `Bar chart showing daily average page load times in milliseconds over the last 15 days. Maximum value: ${Math.round(maxValue)}ms.`;
  svg.appendChild(desc);

  // Create groups for layering
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridGroup.setAttribute('class', 'grid-lines');
  svg.appendChild(gridGroup);

  const barsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  barsGroup.setAttribute('class', 'bars');
  svg.appendChild(barsGroup);

  const axesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  axesGroup.setAttribute('class', 'axes');
  svg.appendChild(axesGroup);

  const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelsGroup.setAttribute('class', 'labels');
  svg.appendChild(labelsGroup);

  // Draw Y-axis grid lines (behind bars)
  const ySteps = 5;
  const yAxisValues = [];
  for (let i = 0; i <= ySteps; i++) {
    const value = (maxValue / ySteps) * i;
    const y = padding.top + chartHeight - (value * yScale);
    yAxisValues.push({ value, y });

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', padding.left);
    line.setAttribute('y1', y);
    line.setAttribute('x2', padding.left + chartWidth);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', '#e9ecef');
    line.setAttribute('stroke-width', '1');
    gridGroup.appendChild(line);
  }

  // Draw bars with rounded top corners
  completeData.forEach((item, index) => {
    const barHeight = item.avg_load_time_ms * yScale;
    const x = padding.left + index * (barWidth + barSpacing);
    const y = padding.top + chartHeight - barHeight;
    const effectiveHeight = barHeight > 0 ? barHeight : 1;
    const cornerRadius = Math.min(4, barWidth / 4, effectiveHeight / 2);

    // Create bar rect
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', effectiveHeight);
    rect.setAttribute('rx', cornerRadius);
    rect.setAttribute('ry', cornerRadius);
    rect.setAttribute('fill', item.avg_load_time_ms === 0 ? '#dee2e6' : '#0d6efd');

    // Add accessibility label
    const dateLabel = formatChartDateLabel(item.test_date);
    rect.setAttribute('aria-label', `${dateLabel}: ${Math.round(item.avg_load_time_ms)}ms`);

    barsGroup.appendChild(rect);

    // Draw value label on top of bar (only if > 0)
    if (item.avg_load_time_ms > 0) {
      const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valueText.setAttribute('x', x + barWidth / 2);
      valueText.setAttribute('y', y - 5);
      valueText.setAttribute('text-anchor', 'middle');
      valueText.setAttribute('font-size', '11px');
      valueText.setAttribute('font-family', 'Arial');
      valueText.setAttribute('fill', '#000');
      valueText.textContent = Math.round(item.avg_load_time_ms) + 'ms';
      labelsGroup.appendChild(valueText);
    }

    // Draw date label (rotated)
    const dateText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dateText.setAttribute('x', x + barWidth / 2);
    dateText.setAttribute('y', padding.top + chartHeight + 15);
    dateText.setAttribute('text-anchor', 'end');
    dateText.setAttribute('font-size', '10px');
    dateText.setAttribute('font-family', 'Arial');
    dateText.setAttribute('fill', '#6c757d');
    dateText.setAttribute('transform', `rotate(-45, ${x + barWidth / 2}, ${padding.top + chartHeight + 15})`);
    dateText.textContent = dateLabel;
    labelsGroup.appendChild(dateText);
  });

  // Draw Y-axis
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding.left);
  yAxis.setAttribute('y1', padding.top);
  yAxis.setAttribute('x2', padding.left);
  yAxis.setAttribute('y2', padding.top + chartHeight);
  yAxis.setAttribute('stroke', '#dee2e6');
  yAxis.setAttribute('stroke-width', '1');
  axesGroup.appendChild(yAxis);

  // Draw X-axis
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', padding.left);
  xAxis.setAttribute('y1', padding.top + chartHeight);
  xAxis.setAttribute('x2', padding.left + chartWidth);
  xAxis.setAttribute('y2', padding.top + chartHeight);
  xAxis.setAttribute('stroke', '#dee2e6');
  xAxis.setAttribute('stroke-width', '1');
  axesGroup.appendChild(xAxis);

  // Y-axis label
  const yAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yAxisLabel.setAttribute('x', 20);
  yAxisLabel.setAttribute('y', padding.top + chartHeight / 2);
  yAxisLabel.setAttribute('text-anchor', 'middle');
  yAxisLabel.setAttribute('font-size', '12px');
  yAxisLabel.setAttribute('font-family', 'Arial');
  yAxisLabel.setAttribute('font-weight', 'bold');
  yAxisLabel.setAttribute('fill', '#000');
  yAxisLabel.setAttribute('transform', `rotate(-90, 20, ${padding.top + chartHeight / 2})`);
  yAxisLabel.textContent = 'Average Load Time (ms)';
  labelsGroup.appendChild(yAxisLabel);

  // X-axis label
  const xAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xAxisLabel.setAttribute('x', padding.left + chartWidth / 2);
  xAxisLabel.setAttribute('y', containerHeight - 10);
  xAxisLabel.setAttribute('text-anchor', 'middle');
  xAxisLabel.setAttribute('font-size', '12px');
  xAxisLabel.setAttribute('font-family', 'Arial');
  xAxisLabel.setAttribute('font-weight', 'bold');
  xAxisLabel.setAttribute('fill', '#000');
  xAxisLabel.textContent = 'Date';
  labelsGroup.appendChild(xAxisLabel);

  // Draw Y-axis scale labels
  yAxisValues.forEach(({ value, y }) => {
    const scaleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    scaleText.setAttribute('x', padding.left - 10);
    scaleText.setAttribute('y', y + 4);
    scaleText.setAttribute('text-anchor', 'end');
    scaleText.setAttribute('font-size', '10px');
    scaleText.setAttribute('font-family', 'Arial');
    scaleText.setAttribute('fill', '#6c757d');
    scaleText.textContent = Math.round(value);
    labelsGroup.appendChild(scaleText);
  });
}

// Store chart data globally for redrawing on resize
let chartData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const url = getUrlFromQueryString();

  if (!url) {
    displayError('No URL specified');
    document.getElementById('url-title').textContent = 'Unknown';
    return;
  }

  // Set page title
  document.getElementById('url-title').textContent = decodeURIComponent(url);
  document.title = `${decodeURIComponent(url)} - Test Results`;

  // Fetch and display tests
  fetchUrlTests(url);

  // Fetch and display daily averages chart
  fetchDailyAverages(url);

  // Make chart responsive to window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (chartData) {
        drawDailyAverageChart(chartData);
      }
    }, 250); // Debounce resize events
  });

  // Listen for timezone changes and refresh displays
  window.addEventListener('timezoneChanged', () => {
    fetchUrlTests(url);
    if (chartData) {
      drawDailyAverageChart(chartData);
    }
  });
});
