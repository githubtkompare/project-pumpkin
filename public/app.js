// Dashboard JavaScript - Main page functionality

// Utility functions
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

// API calls
async function fetchLatestRun() {
  try {
    const response = await fetch('/api/test-runs/latest');
    const result = await response.json();
    if (result.success) {
      displayLatestRun(result.data);
    } else {
      displayError('latest-run-card', 'No test runs found');
    }
  } catch (error) {
    console.error('Failed to fetch latest run:', error);
    displayError('latest-run-card', 'Failed to load latest run');
  }
}

async function fetchStats() {
  try {
    const response = await fetch('/api/stats/latest');
    const result = await response.json();
    if (result.success) {
      displayStats(result.data);
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
}

async function fetchTestRuns() {
  try {
    const response = await fetch('/api/test-runs?limit=5');
    const result = await response.json();
    if (result.success) {
      displayTestRuns(result.data);
    } else {
      displayTableError('test-runs-table', 'No test runs found');
    }
  } catch (error) {
    console.error('Failed to fetch test runs:', error);
    displayTableError('test-runs-table', 'Failed to load test runs');
  }
}

// Display functions
function displayLatestRun(run) {
  const card = document.getElementById('latest-run-card');
  card.innerHTML = `
    <div class="card-body">
      <div class="row">
        <div class="col-md-6">
          <h5 class="card-title">Run #${run.id} ${getStatusBadge(run)}</h5>
          <p class="card-text mb-1"><strong>Timestamp:</strong> ${formatTimestamp(run.run_timestamp)}</p>
          <p class="card-text mb-1"><strong>Total URLs:</strong> ${run.total_urls}</p>
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
      <div class="mt-3">
        <a href="/run-details.html?id=${run.id}" class="btn btn-primary btn-sm">View Details</a>
      </div>
    </div>
  `;
}

function displayStats(stats) {
  document.getElementById('stat-load-time').textContent =
    stats.avg_load_time_ms ? `${formatNumber(stats.avg_load_time_ms)} ms` : 'N/A';
  document.getElementById('stat-ttfb').textContent =
    stats.avg_ttfb_ms ? `${formatNumber(stats.avg_ttfb_ms)} ms` : 'N/A';
  document.getElementById('stat-passed').textContent =
    stats.tests_completed || '--';

  // Get latest run for failed count
  fetchLatestRun().then(() => {
    fetch('/api/test-runs/latest')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          document.getElementById('stat-failed').textContent = result.data.failed_count || 0;
        }
      });
  });
}

function displayTestRuns(runs) {
  const tbody = document.querySelector('#test-runs-table tbody');

  if (runs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No test runs found</td></tr>';
    return;
  }

  tbody.innerHTML = runs.map(run => `
    <tr>
      <td>${run.id}</td>
      <td>${formatTimestamp(run.run_timestamp)}</td>
      <td>${getStatusBadge(run)}</td>
      <td>${run.total_urls}</td>
      <td class="text-success">${run.passed_count || 0}</td>
      <td class="text-danger">${run.failed_count || 0}</td>
      <td>${formatNumber(run.avg_page_load_ms)} ms</td>
      <td>${formatDuration(run.duration_ms)}</td>
      <td>
        <a href="/run-details.html?id=${run.id}" class="btn btn-sm btn-outline-primary">View</a>
      </td>
    </tr>
  `).join('');
}

function displayError(elementId, message) {
  const element = document.getElementById(elementId);
  element.innerHTML = `
    <div class="alert alert-warning mb-0" role="alert">
      ${message}
    </div>
  `;
}

function displayTableError(tableId, message) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">${message}</td></tr>`;
}

// Calendar and date search functionality
let availableDates = [];
let calendarInstance = null;

async function fetchAvailableDates() {
  try {
    const response = await fetch('/api/calendar/available-dates');
    const result = await response.json();
    if (result.success) {
      availableDates = result.data;
      initializeCalendar();
    }
  } catch (error) {
    console.error('Failed to fetch available dates:', error);
  }
}

function initializeCalendar() {
  const dateInput = document.getElementById('date-input');

  calendarInstance = flatpickr('#calendar-container', {
    inline: true,
    enable: availableDates,
    dateFormat: 'Y-m-d',
    onChange: function(selectedDates, dateStr) {
      if (dateStr) {
        dateInput.value = dateStr;
        fetchRunsByDate(dateStr);
      }
    }
  });

  // Also bind to the input field
  flatpickr('#date-input', {
    enable: availableDates,
    dateFormat: 'Y-m-d',
    onChange: function(selectedDates, dateStr) {
      if (dateStr && calendarInstance) {
        calendarInstance.setDate(dateStr, false);
        fetchRunsByDate(dateStr);
      }
    }
  });
}

async function fetchRunsByDate(date) {
  try {
    const response = await fetch(`/api/calendar/runs-by-date?date=${date}`);
    const result = await response.json();

    if (result.success) {
      displayDateSearchResults(date, result.data);
    } else {
      displayDateSearchError(date, 'No test runs found for this date');
    }
  } catch (error) {
    console.error('Failed to fetch runs by date:', error);
    displayDateSearchError(date, 'Failed to load test runs');
  }
}

function displayDateSearchResults(date, runs) {
  const resultsContainer = document.getElementById('date-search-results');
  const dateDisplay = document.getElementById('selected-date-display');
  const tbody = document.querySelector('#date-search-table tbody');

  dateDisplay.textContent = formatDate(date);
  resultsContainer.style.display = 'block';

  if (runs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No test runs found for this date</td></tr>';
    return;
  }

  tbody.innerHTML = runs.map(run => `
    <tr>
      <td>${run.id}</td>
      <td>${formatTimestamp(run.run_timestamp)}</td>
      <td>${getStatusBadge(run)}</td>
      <td>${run.total_urls}</td>
      <td class="text-success">${run.passed_count || 0}</td>
      <td class="text-danger">${run.failed_count || 0}</td>
      <td>${formatNumber(run.avg_page_load_ms)} ms</td>
      <td>${formatDuration(run.duration_ms)}</td>
      <td>
        <a href="/run-details.html?id=${run.id}" class="btn btn-sm btn-outline-primary">View</a>
      </td>
    </tr>
  `).join('');
}

function displayDateSearchError(date, message) {
  const resultsContainer = document.getElementById('date-search-results');
  const dateDisplay = document.getElementById('selected-date-display');
  const tbody = document.querySelector('#date-search-table tbody');

  dateDisplay.textContent = formatDate(date);
  resultsContainer.style.display = 'block';
  tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">${message}</td></tr>`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// URL Search and Autocomplete functionality
let urlAutocompleteTimeout = null;
let selectedUrl = null;

async function fetchUrlAutocomplete(query) {
  if (!query || query.length < 2) {
    hideUrlAutocomplete();
    return;
  }

  try {
    const response = await fetch(`/api/urls/autocomplete?q=${encodeURIComponent(query)}`);
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      displayUrlAutocomplete(result.data);
    } else {
      hideUrlAutocomplete();
    }
  } catch (error) {
    console.error('Failed to fetch URL autocomplete:', error);
    hideUrlAutocomplete();
  }
}

function displayUrlAutocomplete(suggestions) {
  const list = document.getElementById('url-autocomplete-list');

  list.innerHTML = suggestions.map(item => `
    <button type="button" class="list-group-item list-group-item-action" data-domain="${item.domain}">
      <strong>${item.domain}</strong>
      <br>
      <small class="text-muted">${item.url}</small>
    </button>
  `).join('');

  list.style.display = 'block';

  // Add click handlers to autocomplete items
  list.querySelectorAll('.list-group-item').forEach(item => {
    item.addEventListener('click', function() {
      const domain = this.getAttribute('data-domain');
      selectedUrl = domain;
      document.getElementById('url-search-input').value = domain;
      hideUrlAutocomplete();
    });
  });
}

function hideUrlAutocomplete() {
  const list = document.getElementById('url-autocomplete-list');
  list.style.display = 'none';
  list.innerHTML = '';
}

function setupUrlSearch() {
  const input = document.getElementById('url-search-input');
  const form = document.getElementById('url-search-form');

  // Handle input with debouncing
  input.addEventListener('input', function() {
    clearTimeout(urlAutocompleteTimeout);
    const query = this.value.trim();

    if (query.length >= 2) {
      urlAutocompleteTimeout = setTimeout(() => {
        fetchUrlAutocomplete(query);
      }, 300); // 300ms debounce
    } else {
      hideUrlAutocomplete();
    }
  });

  // Hide autocomplete when clicking outside
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !document.getElementById('url-autocomplete-list').contains(e.target)) {
      hideUrlAutocomplete();
    }
  });

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const urlValue = input.value.trim();

    if (urlValue) {
      // Use selectedUrl if available (from autocomplete), otherwise use input value
      const searchUrl = selectedUrl || urlValue;
      window.location.href = `/url-results.html?url=${encodeURIComponent(searchUrl)}`;
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  fetchLatestRun();
  fetchStats();
  fetchTestRuns();
  fetchAvailableDates();
  setupUrlSearch();

  // Auto-refresh every 30 seconds
  setInterval(() => {
    fetchLatestRun();
    fetchStats();
    fetchTestRuns();
  }, 30000);
});
