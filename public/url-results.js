// URL Results JavaScript - URL-specific test results page

// Utility functions
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
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
  const canvas = document.getElementById('daily-average-chart');
  const ctx = canvas.getContext('2d');

  // Set canvas width to match container width
  const container = canvas.parentElement;
  canvas.width = container.offsetWidth;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Generate complete date range for last 15 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completeData = [];

  for (let i = 14; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Find matching data for this date
    const existing = data.find(d => {
      const testDate = new Date(d.test_date);
      return testDate.toISOString().split('T')[0] === dateStr;
    });

    completeData.push({
      test_date: dateStr,
      avg_load_time_ms: existing ? parseFloat(existing.avg_load_time_ms) : 0,
      test_count: existing ? existing.test_count : 0
    });
  }

  // Set canvas dimensions
  const padding = { top: 40, right: 40, bottom: 60, left: 80 };
  const chartWidth = canvas.width - padding.left - padding.right;
  const chartHeight = canvas.height - padding.top - padding.bottom;

  // Find max value for scaling
  const maxValue = Math.max(...completeData.map(d => d.avg_load_time_ms), 1); // Min 1 to avoid division by zero
  const yScale = chartHeight / maxValue;

  // Calculate bar width and spacing
  const barWidth = chartWidth / completeData.length - 10;
  const barSpacing = 10;

  // Draw Y-axis grid lines FIRST (so they appear behind bars)
  const ySteps = 5;
  const yAxisValues = [];
  for (let i = 0; i <= ySteps; i++) {
    const value = (maxValue / ySteps) * i;
    const y = padding.top + chartHeight - (value * yScale);
    yAxisValues.push({ value, y });

    // Draw grid line
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
  }

  // Helper function to draw bar with rounded top corners
  const drawRoundedBar = (x, y, width, height, radius) => {
    ctx.beginPath();
    // Start from bottom-left corner
    ctx.moveTo(x, y + height);
    // Left side going up
    ctx.lineTo(x, y + radius);
    // Top-left rounded corner
    ctx.arcTo(x, y, x + radius, y, radius);
    // Top side
    ctx.lineTo(x + width - radius, y);
    // Top-right rounded corner
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    // Right side going down
    ctx.lineTo(x + width, y + height);
    // Bottom side
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
  };

  // Draw bars
  completeData.forEach((item, index) => {
    const barHeight = item.avg_load_time_ms * yScale;
    const x = padding.left + index * (barWidth + barSpacing);
    const y = padding.top + chartHeight - barHeight;

    // Draw bar with rounded top corners
    ctx.fillStyle = item.avg_load_time_ms === 0 ? '#dee2e6' : '#0d6efd';
    const effectiveHeight = barHeight > 0 ? barHeight : 1;
    const cornerRadius = Math.min(4, barWidth / 4, effectiveHeight / 2); // Adaptive radius
    drawRoundedBar(x, y, barWidth, effectiveHeight, cornerRadius);

    // Draw value on top of bar (only if > 0)
    if (item.avg_load_time_ms > 0) {
      ctx.fillStyle = '#000';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        Math.round(item.avg_load_time_ms) + 'ms',
        x + barWidth / 2,
        y - 5
      );
    }

    // Draw date label
    ctx.fillStyle = '#6c757d';
    ctx.font = '10px Arial';
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartHeight + 15);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'right';
    const date = new Date(item.test_date);
    const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
    ctx.fillText(dateLabel, 0, 0);
    ctx.restore();
  });

  // Draw Y-axis
  ctx.strokeStyle = '#dee2e6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.stroke();

  // Draw X-axis
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartHeight);
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
  ctx.stroke();

  // Y-axis label
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px Arial';
  ctx.save();
  ctx.translate(20, padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Average Load Time (ms)', 0, 0);
  ctx.restore();

  // X-axis label
  ctx.textAlign = 'center';
  ctx.fillText('Date', padding.left + chartWidth / 2, canvas.height - 10);

  // Draw Y-axis scale labels (using pre-calculated values)
  yAxisValues.forEach(({ value, y }) => {
    ctx.fillStyle = '#6c757d';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(value), padding.left - 10, y + 4);
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
});
