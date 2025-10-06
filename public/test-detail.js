// Test Detail JavaScript - Single domain test detail page

// Utility functions
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  return Math.round(num).toLocaleString();
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return 'N/A';
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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

function getHttpBadgeClass(code) {
  const codeNum = parseInt(code);
  if (codeNum >= 200 && codeNum < 300) return 'success';
  if (codeNum >= 300 && codeNum < 400) return 'info';
  if (codeNum >= 400 && codeNum < 500) return 'warning';
  if (codeNum >= 500) return 'danger';
  return 'secondary';
}

function getHttpCodeDescription(code) {
  const descriptions = {
    // 2xx Success
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    206: 'Partial Content',

    // 3xx Redirection
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',

    // 4xx Client Errors
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    410: 'Gone',
    429: 'Too Many Requests',

    // 5xx Server Errors
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };

  return descriptions[code] || '';
}

// Get test ID from URL parameters
function getTestIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// API call
async function fetchTestDetails(testId) {
  try {
    const response = await fetch(`/api/url-tests/${testId}`);
    const result = await response.json();

    if (result.success) {
      displayTestDetails(result.data);
    } else {
      displayError('Test not found');
    }
  } catch (error) {
    console.error('Failed to fetch test details:', error);
    displayError('Failed to load test details');
  }
}

// Display functions
function displayTestDetails(test) {
  // Update page title
  document.title = `${test.domain} - Test Details`;
  document.getElementById('test-title').textContent = test.domain;

  // Update back button
  const backBtn = document.getElementById('back-to-run');
  backBtn.href = `/run-details.html?id=${test.test_run_id}`;

  // Display overview
  displayOverview(test);

  // Display screenshot
  displayScreenshot(test);

  // Display performance metrics
  displayPerformanceMetrics(test);

  // Display HTTP codes
  displayHttpCodes(test.http_response_codes);

  // Display resource types
  displayResourceTypes(test.resources_by_type);

  // Display failed requests if there are any 4xx/5xx errors
  displayFailedRequests(test.id);
}

function displayOverview(test) {
  const card = document.getElementById('test-overview-card');
  card.innerHTML = `
    <div class="card-body">
      <div class="row">
        <div class="col-md-6">
          <h5 class="card-title">${test.domain} ${getStatusBadge(test.status)}</h5>
          <p class="card-text mb-1"><strong>URL:</strong> <a href="${test.url}" target="_blank">${test.url}</a></p>
          <p class="card-text mb-1"><strong>Page Title:</strong> ${test.page_title || 'N/A'}</p>
          <p class="card-text mb-1"><strong>Test Timestamp:</strong> ${formatTimestamp(test.test_timestamp)}</p>
          <p class="card-text mb-1"><strong>Browser:</strong> ${test.browser}</p>
          <p class="card-text mb-1"><strong>Test Duration:</strong> ${formatNumber(test.test_duration_ms)} ms</p>
          <p class="card-text mb-1"><strong>Scroll Duration:</strong> ${formatNumber(test.scroll_duration_ms)} ms</p>
        </div>
        <div class="col-md-6">
          <h6>Quick Stats</h6>
          <p class="card-text mb-1"><strong>Total Page Load:</strong> ${formatNumber(test.total_page_load_ms)} ms</p>
          <p class="card-text mb-1"><strong>Time to First Byte:</strong> ${formatNumber(test.time_to_first_byte_ms)} ms</p>
          <p class="card-text mb-1"><strong>Total Resources:</strong> ${test.total_resources || 'N/A'}</p>
          <p class="card-text mb-1"><strong>Total Transfer Size:</strong> ${formatBytes(test.total_transfer_size_bytes)}</p>
          ${test.error_message ? `<div class="alert alert-danger mt-2 mb-0"><strong>Error:</strong> ${test.error_message}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function displayScreenshot(test) {
  const card = document.getElementById('screenshot-card');

  // Convert container path to web-accessible path
  // Path format: /app/test-history/TIMESTAMP__DOMAIN/screenshot.png
  // Web format: /test-history/TIMESTAMP__DOMAIN/screenshot.png
  const screenshotPath = test.screenshot_path.replace('/app/', '/');

  card.innerHTML = `
    <div class="mb-3">
      <a href="${screenshotPath}" target="_blank" class="btn btn-sm btn-outline-primary">Open Full Size</a>
      <a href="${test.har_path.replace('/app/', '/')}" download class="btn btn-sm btn-outline-secondary ms-2">Download HAR File</a>
    </div>
    <img src="${screenshotPath}"
         alt="Screenshot of ${test.domain}"
         class="img-fluid"
         style="max-width: 100%; height: auto;"
         onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'alert alert-warning\\'>Screenshot not available</div>';">
  `;
}

function displayPerformanceMetrics(test) {
  const container = document.getElementById('performance-metrics');

  container.innerHTML = `
    <div class="row">
      <div class="col-md-4 mb-3">
        <h6 class="text-muted">Network Timing</h6>
        <table class="table table-sm">
          <tbody>
            <tr><td>DNS Lookup</td><td class="text-end">${formatNumber(test.dns_lookup_ms)} ms</td></tr>
            <tr><td>TCP Connection</td><td class="text-end">${formatNumber(test.tcp_connection_ms)} ms</td></tr>
            <tr><td>TLS Negotiation</td><td class="text-end">${formatNumber(test.tls_negotiation_ms)} ms</td></tr>
            <tr><td>Time to First Byte</td><td class="text-end"><strong>${formatNumber(test.time_to_first_byte_ms)} ms</strong></td></tr>
            <tr><td>Response Time</td><td class="text-end">${formatNumber(test.response_time_ms)} ms</td></tr>
          </tbody>
        </table>
      </div>

      <div class="col-md-4 mb-3">
        <h6 class="text-muted">Page Load Timing</h6>
        <table class="table table-sm">
          <tbody>
            <tr><td>DOM Content Loaded</td><td class="text-end">${formatNumber(test.dom_content_loaded_ms)} ms</td></tr>
            <tr><td>DOM Interactive</td><td class="text-end">${formatNumber(test.dom_interactive_ms)} ms</td></tr>
            <tr><td>Total Page Load</td><td class="text-end"><strong>${formatNumber(test.total_page_load_ms)} ms</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div class="col-md-4 mb-3">
        <h6 class="text-muted">Document Sizes</h6>
        <table class="table table-sm">
          <tbody>
            <tr><td>Transfer Size</td><td class="text-end">${formatBytes(test.doc_transfer_size_bytes)}</td></tr>
            <tr><td>Encoded Size</td><td class="text-end">${formatBytes(test.doc_encoded_size_bytes)}</td></tr>
            <tr><td>Decoded Size</td><td class="text-end">${formatBytes(test.doc_decoded_size_bytes)}</td></tr>
            <tr><td><strong>Total Transfer</strong></td><td class="text-end"><strong>${formatBytes(test.total_transfer_size_bytes)}</strong></td></tr>
            <tr><td><strong>Total Encoded</strong></td><td class="text-end"><strong>${formatBytes(test.total_encoded_size_bytes)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function displayHttpCodes(httpCodes) {
  const container = document.getElementById('http-codes');

  if (!httpCodes || typeof httpCodes !== 'object' || Object.keys(httpCodes).length === 0) {
    container.innerHTML = '<p class="text-muted">No HTTP response codes recorded</p>';
    return;
  }

  const codes = Object.entries(httpCodes)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([code, count]) => {
      const badgeClass = getHttpBadgeClass(code);
      const description = getHttpCodeDescription(code);
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <span class="badge bg-${badgeClass}">${code}</span>
            ${description ? `<span class="ms-2 text-muted small">${description}</span>` : ''}
          </div>
          <span>${count} request${count !== 1 ? 's' : ''}</span>
        </div>
      `;
    })
    .join('');

  container.innerHTML = codes;
}

function displayResourceTypes(resourceTypes) {
  const container = document.getElementById('resource-types');

  if (!resourceTypes || typeof resourceTypes !== 'object' || Object.keys(resourceTypes).length === 0) {
    container.innerHTML = '<p class="text-muted">No resource type data available</p>';
    return;
  }

  const types = Object.entries(resourceTypes)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([type, count]) => `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span><code>${type}</code></span>
        <span class="badge bg-secondary">${count}</span>
      </div>
    `)
    .join('');

  container.innerHTML = types;
}

async function displayFailedRequests(testId) {
  const section = document.getElementById('errors-section');
  const container = document.getElementById('failed-requests');

  try {
    const response = await fetch(`/api/url-tests/${testId}/failed-requests`);
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      // Show the section
      section.style.display = 'block';

      // Group errors by status code for better organization
      const errorsByCode = {};
      result.data.forEach(error => {
        if (!errorsByCode[error.statusCode]) {
          errorsByCode[error.statusCode] = [];
        }
        errorsByCode[error.statusCode].push(error);
      });

      // Build HTML
      let html = '<div class="table-responsive"><table class="table table-sm table-hover">';
      html += '<thead><tr><th>Status Code</th><th>Resource URL</th></tr></thead><tbody>';

      // Sort by status code
      Object.keys(errorsByCode).sort((a, b) => parseInt(a) - parseInt(b)).forEach(code => {
        const errors = errorsByCode[code];
        const badgeClass = getHttpBadgeClass(code);

        errors.forEach((error, index) => {
          html += '<tr>';
          if (index === 0) {
            html += `<td rowspan="${errors.length}" class="align-middle"><span class="badge bg-${badgeClass}">${code}</span></td>`;
          }
          html += `<td><small class="text-break">${escapeHtml(error.failedRequestUrl)}</small></td>`;
          html += '</tr>';
        });
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;
    } else {
      // No errors, hide the section
      section.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to fetch failed requests:', error);
    section.style.display = 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function displayError(message) {
  document.getElementById('test-overview-card').innerHTML = `
    <div class="alert alert-danger mb-0" role="alert">
      ${message}
    </div>
  `;
  document.getElementById('screenshot-card').innerHTML = `
    <div class="alert alert-warning mb-0">
      Screenshot not available
    </div>
  `;
  document.getElementById('performance-metrics').innerHTML = `
    <div class="alert alert-warning mb-0">
      Performance metrics not available
    </div>
  `;
  document.getElementById('http-codes').innerHTML = '';
  document.getElementById('resource-types').innerHTML = '';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const testId = getTestIdFromUrl();

  if (!testId) {
    displayError('No test ID specified');
    return;
  }

  fetchTestDetails(testId);
});
