// Timezone Toggle Component for Project Pumpkin
// Reusable UI component for switching between UTC and Local timezone

import { getTimezonePreference, setTimezonePreference, getLocalTimezoneAbbr } from './timezone-utils.js';

/**
 * Create and inject the timezone toggle UI into a specified container
 * @param {string|HTMLElement} container - Container element or selector
 * @returns {HTMLElement} The created toggle element
 */
export function createTimezoneToggle(container) {
  const containerEl = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!containerEl) {
    console.error('Timezone toggle container not found:', container);
    return null;
  }

  const currentPref = getTimezonePreference();
  const localTz = getLocalTimezoneAbbr();

  // Create toggle HTML
  const toggleHTML = `
    <div class="btn-group" role="group" aria-label="Timezone selection">
      <input type="radio" class="btn-check" name="timezone-toggle" id="tz-utc" value="UTC" ${currentPref === 'UTC' ? 'checked' : ''}>
      <label class="btn btn-outline-light btn-sm" for="tz-utc">UTC</label>

      <input type="radio" class="btn-check" name="timezone-toggle" id="tz-local" value="Local" ${currentPref === 'Local' ? 'checked' : ''}>
      <label class="btn btn-outline-light btn-sm" for="tz-local">Local (${localTz})</label>
    </div>
  `;

  containerEl.innerHTML = toggleHTML;

  // Add event listeners
  const utcRadio = containerEl.querySelector('#tz-utc');
  const localRadio = containerEl.querySelector('#tz-local');

  utcRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      setTimezonePreference('UTC');
    }
  });

  localRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      setTimezonePreference('Local');
    }
  });

  return containerEl;
}

/**
 * Initialize timezone toggle in the navbar
 * Looks for an element with id="timezone-toggle-container"
 */
export function initTimezoneToggle() {
  const container = document.getElementById('timezone-toggle-container');
  if (container) {
    createTimezoneToggle(container);
  } else {
    console.warn('No #timezone-toggle-container found in page');
  }
}

/**
 * Update the toggle UI to reflect current preference
 * Useful if preference changed on another page/tab
 */
export function updateToggleState() {
  const currentPref = getTimezonePreference();
  const utcRadio = document.getElementById('tz-utc');
  const localRadio = document.getElementById('tz-local');

  if (utcRadio && localRadio) {
    utcRadio.checked = currentPref === 'UTC';
    localRadio.checked = currentPref === 'Local';
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTimezoneToggle);
} else {
  initTimezoneToggle();
}
