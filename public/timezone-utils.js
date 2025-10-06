// Timezone Utilities for Project Pumpkin
// Handles timezone preference storage and date/time formatting

/**
 * Get the user's timezone preference from localStorage
 * @returns {string} 'UTC' or 'Local' (default: 'UTC')
 */
export function getTimezonePreference() {
  return localStorage.getItem('timezonePreference') || 'UTC';
}

/**
 * Set the user's timezone preference in localStorage
 * @param {string} timezone - 'UTC' or 'Local'
 */
export function setTimezonePreference(timezone) {
  if (timezone !== 'UTC' && timezone !== 'Local') {
    console.error('Invalid timezone preference:', timezone);
    return;
  }
  localStorage.setItem('timezonePreference', timezone);

  // Dispatch custom event to notify other components
  window.dispatchEvent(new CustomEvent('timezoneChanged', { detail: { timezone } }));
}

/**
 * Get the user's local timezone abbreviation (e.g., 'CDT', 'PST', 'EST')
 * @returns {string} Timezone abbreviation
 */
export function getLocalTimezoneAbbr() {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' });
  const parts = formatter.formatToParts(date);
  const timeZonePart = parts.find(part => part.type === 'timeZoneName');
  return timeZonePart ? timeZonePart.value : 'Local';
}

/**
 * Format a UTC ISO timestamp string for display
 * @param {string} isoString - ISO 8601 timestamp (e.g., "2025-10-05T23:01:00.206Z")
 * @param {string} timezone - 'UTC' or 'Local' (optional, uses preference if not provided)
 * @returns {string} Formatted timestamp (e.g., "10/5/2025, 11:01:00 PM CDT")
 */
export function formatTimestamp(isoString, timezone = null) {
  if (!isoString) return 'N/A';

  const tz = timezone || getTimezonePreference();
  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  if (tz === 'UTC') {
    return date.toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } else {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }
}

/**
 * Format a UTC ISO date string for display (date only, no time)
 * @param {string} isoString - ISO 8601 date or timestamp
 * @param {string} timezone - 'UTC' or 'Local' (optional, uses preference if not provided)
 * @returns {string} Formatted date (e.g., "10/5/2025")
 */
export function formatDate(isoString, timezone = null) {
  if (!isoString) return 'N/A';

  const tz = timezone || getTimezonePreference();
  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  if (tz === 'UTC') {
    return date.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  }
}

/**
 * Get the date portion of a UTC timestamp in the specified timezone
 * Used for grouping data by calendar day
 * @param {string} isoString - ISO 8601 timestamp
 * @param {string} timezone - 'UTC' or 'Local' (optional, uses preference if not provided)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getDateString(isoString, timezone = null) {
  if (!isoString) return null;

  const tz = timezone || getTimezonePreference();
  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    return null;
  }

  if (tz === 'UTC') {
    // Return UTC date
    return date.toISOString().split('T')[0];
  } else {
    // Return local date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Get "today" in the specified timezone
 * @param {string} timezone - 'UTC' or 'Local' (optional, uses preference if not provided)
 * @returns {Date} Date object set to midnight in the specified timezone
 */
export function getToday(timezone = null) {
  const tz = timezone || getTimezonePreference();
  const now = new Date();

  if (tz === 'UTC') {
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return utcDate;
  } else {
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return localDate;
  }
}

/**
 * Format a short date label for charts (e.g., "10/5")
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Short date label (e.g., "10/5")
 */
export function formatChartDateLabel(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString + 'T00:00:00Z'); // Parse as UTC
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${month}/${day}`;
}
