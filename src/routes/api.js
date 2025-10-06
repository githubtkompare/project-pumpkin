// @ts-check
import express from 'express';
import {
  getAllTestRuns,
  getUrlTestsByRun,
  getUrlTestById,
  getLatestTestRun,
  getLatestRunAverages,
  getSlowestUrls,
  getFastestUrls,
  getTestsWithErrors,
  getFailedRequests,
  getFailedRequestsByTestId,
  getAvailableDates,
  getTestRunsByDate,
  getUrlAutocomplete,
  getTestsByUrl,
  getDailyAverageLoadTime
} from '../database/queries.js';

const router = express.Router();

/**
 * GET /api/test-runs
 * Get all test runs with summary statistics
 */
router.get('/test-runs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const runs = await getAllTestRuns(limit);
    res.json({ success: true, data: runs });
  } catch (error) {
    console.error('API Error - /test-runs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/test-runs/latest
 * Get the latest test run with summary
 */
router.get('/test-runs/latest', async (req, res) => {
  try {
    const latest = await getLatestTestRun();
    if (!latest) {
      return res.status(404).json({ success: false, error: 'No test runs found' });
    }
    res.json({ success: true, data: latest });
  } catch (error) {
    console.error('API Error - /test-runs/latest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/test-runs/:id
 * Get specific test run details
 */
router.get('/test-runs/:id', async (req, res) => {
  try {
    const runs = await getAllTestRuns(1000); // Get all to find specific one
    const run = runs.find(r => r.id === parseInt(req.params.id));

    if (!run) {
      return res.status(404).json({ success: false, error: 'Test run not found' });
    }

    res.json({ success: true, data: run });
  } catch (error) {
    console.error('API Error - /test-runs/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/test-runs/:id/urls
 * Get all URL tests for a specific test run
 */
router.get('/test-runs/:id/urls', async (req, res) => {
  try {
    const testRunId = parseInt(req.params.id);
    const urls = await getUrlTestsByRun(testRunId);
    res.json({ success: true, data: urls });
  } catch (error) {
    console.error('API Error - /test-runs/:id/urls:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/url-tests/:id
 * Get a single URL test with all details
 */
router.get('/url-tests/:id', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const test = await getUrlTestById(testId);

    if (!test) {
      return res.status(404).json({ success: false, error: 'URL test not found' });
    }

    res.json({ success: true, data: test });
  } catch (error) {
    console.error('API Error - /url-tests/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/url-tests/:id/failed-requests
 * Get failed HTTP requests (400+) for a specific URL test
 */
router.get('/url-tests/:id/failed-requests', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const failedRequests = await getFailedRequestsByTestId(testId);
    res.json({ success: true, data: failedRequests });
  } catch (error) {
    console.error('API Error - /url-tests/:id/failed-requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/latest
 * Get statistics for the latest test run
 */
router.get('/stats/latest', async (req, res) => {
  try {
    const stats = await getLatestRunAverages();
    if (!stats) {
      return res.status(404).json({ success: false, error: 'No statistics available' });
    }
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('API Error - /stats/latest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/slowest
 * Get slowest URLs from latest test run
 */
router.get('/stats/slowest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const slowest = await getSlowestUrls(limit);
    res.json({ success: true, data: slowest });
  } catch (error) {
    console.error('API Error - /stats/slowest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/fastest
 * Get fastest URLs from latest test run
 */
router.get('/stats/fastest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const fastest = await getFastestUrls(limit);
    res.json({ success: true, data: fastest });
  } catch (error) {
    console.error('API Error - /stats/fastest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/errors
 * Get tests with errors
 */
router.get('/stats/errors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const errors = await getTestsWithErrors(limit);
    res.json({ success: true, data: errors });
  } catch (error) {
    console.error('API Error - /stats/errors:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/calendar/available-dates
 * Get all dates that have test runs (for calendar highlighting)
 */
router.get('/calendar/available-dates', async (req, res) => {
  try {
    const dates = await getAvailableDates();
    res.json({ success: true, data: dates });
  } catch (error) {
    console.error('API Error - /calendar/available-dates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/calendar/runs-by-date
 * Get all test runs for a specific date
 * Query parameter: date (YYYY-MM-DD)
 */
router.get('/calendar/runs-by-date', async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) {
      return res.status(400).json({ success: false, error: 'Date parameter is required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const runs = await getTestRunsByDate(date);
    res.json({ success: true, data: runs });
  } catch (error) {
    console.error('API Error - /calendar/runs-by-date:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/urls/autocomplete
 * Get URL autocomplete suggestions
 * Query parameter: q (search query)
 */
router.get('/urls/autocomplete', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const limit = parseInt(req.query.limit) || 10;
    const suggestions = await getUrlAutocomplete(query, limit);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('API Error - /urls/autocomplete:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/urls/:domain/tests
 * Get all test results for a specific URL/domain
 */
router.get('/urls/:domain/tests', async (req, res) => {
  try {
    const domain = decodeURIComponent(req.params.domain);
    const limit = parseInt(req.query.limit) || 100;
    const tests = await getTestsByUrl(domain, limit);
    res.json({ success: true, data: tests });
  } catch (error) {
    console.error('API Error - /urls/:domain/tests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/urls/:domain/daily-averages
 * Get daily average load times for a specific URL (last N days)
 * Query parameters:
 *   - days (default: 15)
 *   - timezone (default: 'UTC', accepts IANA timezone names like 'America/Chicago')
 */
router.get('/urls/:domain/daily-averages', async (req, res) => {
  try {
    const domain = decodeURIComponent(req.params.domain);
    const days = parseInt(req.query.days) || 15;
    const timezone = req.query.timezone || 'UTC';

    // Validate timezone parameter
    const validTimezonePattern = /^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/;
    if (!validTimezonePattern.test(timezone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timezone parameter. Use UTC or IANA timezone name (e.g., America/Chicago)'
      });
    }

    const averages = await getDailyAverageLoadTime(domain, days, timezone);
    res.json({ success: true, data: averages });
  } catch (error) {
    console.error('API Error - /urls/:domain/daily-averages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
