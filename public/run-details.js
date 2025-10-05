// Run Details JavaScript - Details page functionality

// Utility functions (duplicated for standalone page)
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function formatDuration(ms) {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}

function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  return Math.round(num).toLocaleString();
}

function getStatusBadge(run) {
  // Handle both object and string input for backwards compatibility
  const status = typeof run === 'string' ? run : run.status;
  const failedCount = typeof run === 'object' ? (run.failed_count || 0) : null;

  // If all tests passed (failed_count === 0), always show green
  if (failedCount !== null && failedCount === 0 && (status === 'PARTIAL' || status === 'COMPLETED')) {
    return `<span class="badge bg-success">${status}</span>`;
  }

  // Otherwise, use the standard mapping
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

// Get run ID from URL parameters
function getRunIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// API calls
async function fetchRunSummary(runId) {
  try {
    const response = await fetch(`/api/test-runs/${runId}`);
    const result = await response.json();
    if (result.success) {
      displayRunSummary(result.data);
    } else {
      displayError('run-summary-card', 'Test run not found');
    }
  } catch (error) {
    console.error('Failed to fetch run summary:', error);
    displayError('run-summary-card', 'Failed to load test run');
  }
}

async function fetchUrlTests(runId) {
  try {
    const response = await fetch(`/api/test-runs/${runId}/urls`);
    const result = await response.json();
    if (result.success) {
      displayUrlTests(result.data);
    } else {
      displayTableError('No URL tests found');
    }
  } catch (error) {
    console.error('Failed to fetch URL tests:', error);
    displayTableError('Failed to load URL tests');
  }
}

// Display functions
function displayRunSummary(run) {
  const card = document.getElementById('run-summary-card');
  card.innerHTML = `
    <div class="card-body">
      <div class="row">
        <div class="col-md-6">
          <h5 class="card-title">Run #${run.id} ${getStatusBadge(run)}</h5>
          <p class="card-text mb-1"><strong>UUID:</strong> <code>${run.run_uuid || 'N/A'}</code></p>
          <p class="card-text mb-1"><strong>Timestamp:</strong> ${formatTimestamp(run.run_timestamp)}</p>
          <p class="card-text mb-1"><strong>Total Domains:</strong> ${run.total_domains}</p>
          <p class="card-text mb-1"><strong>Parallel Workers:</strong> ${run.parallel_workers}</p>
          <p class="card-text mb-1"><strong>Duration:</strong> ${formatDuration(run.duration_ms)}</p>
        </div>
        <div class="col-md-6">
          <p class="card-text mb-1"><strong>Tests Completed:</strong> ${run.tests_completed || 0}</p>
          <p class="card-text mb-1"><strong>Passed:</strong> <span class="text-success">${run.passed_count || 0}</span></p>
          <p class="card-text mb-1"><strong>Failed:</strong> <span class="text-danger">${run.failed_count || 0}</span></p>
          <p class="card-text mb-1"><strong>Avg Load Time:</strong> ${formatNumber(run.avg_page_load_ms)} ms</p>
          <p class="card-text mb-1"><strong>Avg TTFB:</strong> ${formatNumber(run.avg_ttfb_ms)} ms</p>
        </div>
      </div>
    </div>
  `;
}

function displayUrlTests(tests) {
  const tbody = document.querySelector('#domain-tests-table tbody');

  if (tests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No domain tests found</td></tr>';
    return;
  }

  tbody.innerHTML = tests.map(test => `
    <tr>
      <td>${getStatusBadge(test.status)}</td>
      <td>
        <a href="${test.url}" target="_blank" class="text-decoration-none">
          ${test.domain}
        </a>
      </td>
      <td class="text-truncate" style="max-width: 200px;" title="${test.page_title || 'N/A'}">
        ${test.page_title || 'N/A'}
      </td>
      <td data-order="${test.total_page_load_ms || 0}">${formatNumber(test.total_page_load_ms)}</td>
      <td data-order="${test.time_to_first_byte_ms || 0}">${formatNumber(test.time_to_first_byte_ms)}</td>
      <td data-order="${test.total_resources || 0}">${test.total_resources || 'N/A'}</td>
      <td>${formatHttpCodes(test.http_response_codes)}</td>
      <td data-order="${new Date(test.test_timestamp).getTime()}">${formatTimestamp(test.test_timestamp)}</td>
      <td>
        <a href="/test-detail.html?id=${test.id}" class="btn btn-sm btn-outline-primary">View Details</a>
      </td>
    </tr>
  `).join('');

  // Initialize DataTables
  if ($.fn.DataTable.isDataTable('#domain-tests-table')) {
    $('#domain-tests-table').DataTable().destroy();
  }

  $('#domain-tests-table').DataTable({
    pageLength: 20,
    order: [[3, 'desc']], // Sort by Load Time (descending) by default
    columnDefs: [
      { orderable: false, targets: 8 } // Disable sorting on Actions column
    ],
    language: {
      search: "Filter:",
      lengthMenu: "Show _MENU_ entries per page"
    }
  });
}

function displayError(elementId, message) {
  const element = document.getElementById(elementId);
  element.innerHTML = `
    <div class="alert alert-warning mb-0" role="alert">
      ${message}
    </div>
  `;
}

function displayTableError(message) {
  const tbody = document.querySelector('#domain-tests-table tbody');
  tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">${message}</td></tr>`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const runId = getRunIdFromUrl();

  if (!runId) {
    displayError('run-summary-card', 'No run ID specified');
    displayTableError('No run ID specified');
    return;
  }

  fetchRunSummary(runId);
  fetchUrlTests(runId);
});
