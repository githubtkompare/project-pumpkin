// @ts-check
import { query, isDatabaseConnected } from './client.js';

/**
 * Query utilities for retrieving and analyzing Playwright test data
 * Provides common queries for reporting and trend analysis
 */

/**
 * Get the latest test run with summary statistics
 * @returns {Promise<object|null>}
 */
export async function getLatestTestRun() {
  if (!isDatabaseConnected()) {
    return null;
  }

  const sql = `SELECT * FROM v_latest_test_run LIMIT 1`;

  try {
    const result = await query(sql);
    return result?.rows[0] || null;
  } catch (error) {
    console.error('Failed to get latest test run:', error.message);
    return null;
  }
}

/**
 * Get all test runs with summary statistics
 * @param {number} limit - Maximum number of runs to return (default: 10)
 * @returns {Promise<Array>}
 */
export async function getAllTestRuns(limit = 10) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT
      tr.id,
      tr.run_uuid,
      tr.run_timestamp,
      tr.total_domains,
      tr.parallel_workers,
      tr.duration_ms,
      tr.passed_count,
      tr.failed_count,
      tr.status,
      COUNT(dt.id) as tests_completed,
      ROUND(AVG(dt.total_page_load_ms)::numeric, 2) as avg_page_load_ms,
      ROUND(AVG(dt.time_to_first_byte_ms)::numeric, 2) as avg_ttfb_ms
    FROM test_runs tr
    LEFT JOIN domain_tests dt ON dt.test_run_id = tr.id
    GROUP BY tr.id
    ORDER BY tr.run_timestamp DESC
    LIMIT $1
  `;

  try {
    const result = await query(sql, [limit]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to get test runs:', error.message);
    return [];
  }
}

/**
 * Get all domain tests for a specific test run
 * @param {number} testRunId - Test run ID
 * @returns {Promise<Array>}
 */
export async function getDomainTestsByRun(testRunId) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT
      id,
      test_timestamp,
      url,
      domain,
      page_title,
      status,
      total_page_load_ms,
      time_to_first_byte_ms,
      total_resources,
      http_response_codes
    FROM domain_tests
    WHERE test_run_id = $1
    ORDER BY test_timestamp ASC
  `;

  try {
    const result = await query(sql, [testRunId]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to get domain tests:', error.message);
    return [];
  }
}

/**
 * Get a single domain test by ID with all details
 * @param {number} testId - Domain test ID
 * @returns {Promise<object|null>}
 */
export async function getDomainTestById(testId) {
  if (!isDatabaseConnected()) {
    return null;
  }

  const sql = `
    SELECT
      dt.*,
      tr.run_timestamp,
      tr.id as test_run_id
    FROM domain_tests dt
    JOIN test_runs tr ON tr.id = dt.test_run_id
    WHERE dt.id = $1
  `;

  try {
    const result = await query(sql, [testId]);
    return result?.rows[0] || null;
  } catch (error) {
    console.error('Failed to get domain test:', error.message);
    return null;
  }
}

/**
 * Get performance trend for a specific domain across multiple test runs
 * @param {string} domain - Domain name (e.g., 'www.uchicago.edu')
 * @param {number} limit - Number of historical runs to include (default: 10)
 * @returns {Promise<Array>}
 */
export async function getDomainPerformanceTrend(domain, limit = 10) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT * FROM v_performance_trends
    WHERE domain = $1
    ORDER BY run_timestamp DESC
    LIMIT $2
  `;

  try {
    const result = await query(sql, [domain, limit]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to get performance trend:', error.message);
    return [];
  }
}

/**
 * Get all tests with errors (4xx/5xx HTTP responses or failed status)
 * @param {number} limit - Maximum number of results (default: 50)
 * @returns {Promise<Array>}
 */
export async function getTestsWithErrors(limit = 50) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `SELECT * FROM v_tests_with_errors LIMIT $1`;

  try {
    const result = await query(sql, [limit]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to get tests with errors:', error.message);
    return [];
  }
}

/**
 * Get domains with most 404 errors
 * @param {number} limit - Number of domains to return (default: 10)
 * @returns {Promise<Array>}
 */
export async function getDomainsWithMost404s(limit = 10) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT
      domain,
      url,
      COUNT(*) as tests_with_404s,
      (http_response_codes->>'404')::int as count_404s,
      MAX(test_timestamp) as last_seen
    FROM domain_tests
    WHERE http_response_codes ? '404'
    GROUP BY domain, url, http_response_codes
    ORDER BY (http_response_codes->>'404')::int DESC
    LIMIT $1
  `;

  try {
    const result = await query(sql, [limit]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to get domains with 404s:', error.message);
    return [];
  }
}

/**
 * Get slowest loading domains from latest test run
 * @param {number} limit - Number of domains to return (default: 10)
 * @returns {Promise<Array>}
 */
export async function getSlowestDomains(limit = 10) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT
      dt.domain,
      dt.url,
      dt.total_page_load_ms,
      dt.time_to_first_byte_ms,
      dt.total_resources,
      dt.test_timestamp
    FROM domain_tests dt
    JOIN test_runs tr ON tr.id = dt.test_run_id
    WHERE tr.id = (SELECT id FROM test_runs ORDER BY run_timestamp DESC LIMIT 1)
    ORDER BY dt.total_page_load_ms DESC
    LIMIT $1
  `;

  try {
    const result = await query(sql, [limit]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to get slowest domains:', error.message);
    return [];
  }
}

/**
 * Get fastest loading domains from latest test run
 * @param {number} limit - Number of domains to return (default: 10)
 * @returns {Promise<Array>}
 */
export async function getFastestDomains(limit = 10) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT
      dt.domain,
      dt.url,
      dt.total_page_load_ms,
      dt.time_to_first_byte_ms,
      dt.total_resources,
      dt.test_timestamp
    FROM domain_tests dt
    JOIN test_runs tr ON tr.id = dt.test_run_id
    WHERE tr.id = (SELECT id FROM test_runs ORDER BY run_timestamp DESC LIMIT 1)
    ORDER BY dt.total_page_load_ms ASC
    LIMIT $1
  `;

  try {
    const result = await query(sql, [limit]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to get fastest domains:', error.message);
    return [];
  }
}

/**
 * Compare two test runs
 * @param {number} runId1 - First test run ID (typically newer)
 * @param {number} runId2 - Second test run ID (typically older)
 * @returns {Promise<Array>}
 */
export async function compareTestRuns(runId1, runId2) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT
      dt1.domain,
      dt1.url,
      dt1.total_page_load_ms as new_load_time,
      dt2.total_page_load_ms as old_load_time,
      (dt1.total_page_load_ms - dt2.total_page_load_ms) as load_time_diff,
      ROUND(((dt1.total_page_load_ms - dt2.total_page_load_ms) / dt2.total_page_load_ms * 100)::numeric, 2) as percent_change,
      dt1.time_to_first_byte_ms as new_ttfb,
      dt2.time_to_first_byte_ms as old_ttfb,
      (dt1.time_to_first_byte_ms - dt2.time_to_first_byte_ms) as ttfb_diff
    FROM domain_tests dt1
    JOIN domain_tests dt2 ON dt1.domain = dt2.domain
    WHERE dt1.test_run_id = $1 AND dt2.test_run_id = $2
    ORDER BY load_time_diff DESC
  `;

  try {
    const result = await query(sql, [runId1, runId2]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to compare test runs:', error.message);
    return [];
  }
}

/**
 * Get average performance metrics for latest test run
 * @returns {Promise<object|null>}
 */
export async function getLatestRunAverages() {
  if (!isDatabaseConnected()) {
    return null;
  }

  const sql = `
    SELECT
      tr.run_timestamp,
      tr.total_domains,
      COUNT(dt.id) as tests_completed,
      ROUND(AVG(dt.total_page_load_ms)::numeric, 2) as avg_load_time_ms,
      ROUND(AVG(dt.time_to_first_byte_ms)::numeric, 2) as avg_ttfb_ms,
      ROUND(AVG(dt.dns_lookup_ms)::numeric, 2) as avg_dns_ms,
      ROUND(AVG(dt.tcp_connection_ms)::numeric, 2) as avg_tcp_ms,
      ROUND(AVG(dt.tls_negotiation_ms)::numeric, 2) as avg_tls_ms,
      ROUND(AVG(dt.total_resources)::numeric, 2) as avg_resources,
      ROUND(AVG(dt.total_transfer_size_bytes)::numeric, 0) as avg_transfer_bytes
    FROM test_runs tr
    JOIN domain_tests dt ON dt.test_run_id = tr.id
    WHERE tr.id = (SELECT id FROM test_runs ORDER BY run_timestamp DESC LIMIT 1)
    GROUP BY tr.id, tr.run_timestamp, tr.total_domains
  `;

  try {
    const result = await query(sql);
    return result?.rows[0] || null;
  } catch (error) {
    console.error('Failed to get latest run averages:', error.message);
    return null;
  }
}

/**
 * Get tests grouped by HTTP status code
 * @param {number} testRunId - Test run ID (optional, defaults to latest)
 * @returns {Promise<Array>}
 */
export async function getTestsByStatusCode(testRunId = null) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = testRunId
    ? `
      SELECT
        hr.status_code,
        COUNT(DISTINCT hr.domain_test_id) as test_count,
        SUM(hr.response_count) as total_responses
      FROM http_responses hr
      JOIN domain_tests dt ON dt.id = hr.domain_test_id
      WHERE dt.test_run_id = $1
      GROUP BY hr.status_code
      ORDER BY hr.status_code ASC
    `
    : `
      SELECT
        hr.status_code,
        COUNT(DISTINCT hr.domain_test_id) as test_count,
        SUM(hr.response_count) as total_responses
      FROM http_responses hr
      JOIN domain_tests dt ON dt.id = hr.domain_test_id
      JOIN test_runs tr ON tr.id = dt.test_run_id
      WHERE tr.id = (SELECT id FROM test_runs ORDER BY run_timestamp DESC LIMIT 1)
      GROUP BY hr.status_code
      ORDER BY hr.status_code ASC
    `;

  try {
    const result = testRunId ? await query(sql, [testRunId]) : await query(sql);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to get tests by status code:', error.message);
    return [];
  }
}

/**
 * Search for domain tests by URL pattern
 * @param {string} pattern - SQL LIKE pattern (e.g., '%uchicago%')
 * @param {number} limit - Maximum results (default: 20)
 * @returns {Promise<Array>}
 */
export async function searchDomainTests(pattern, limit = 20) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT
      dt.id,
      dt.test_timestamp,
      dt.url,
      dt.domain,
      dt.page_title,
      dt.status,
      dt.total_page_load_ms,
      tr.run_timestamp
    FROM domain_tests dt
    JOIN test_runs tr ON tr.id = dt.test_run_id
    WHERE dt.url ILIKE $1 OR dt.domain ILIKE $1
    ORDER BY dt.test_timestamp DESC
    LIMIT $2
  `;

  try {
    const result = await query(sql, [pattern, limit]);
    return result?.rows || [];
  } catch (error) {
    console.error('Failed to search domain tests:', error.message);
    return [];
  }
}

/**
 * Get failed HTTP requests (400+ status codes) with detailed request URLs
 * Reads HAR files from filesystem to extract specific failed request URLs
 * @param {number} testRunId - Test run ID (optional, defaults to latest)
 * @param {number} limit - Maximum number of tests to process (default: 50)
 * @returns {Promise<Array>} Array of {testUrl, testDomain, failedRequestUrl, statusCode, statusCategory}
 */
export async function getFailedRequests(testRunId = null, limit = 50) {
  if (!isDatabaseConnected()) {
    return [];
  }

  // Get domain tests with error responses
  const sql = testRunId
    ? `
      SELECT
        dt.id,
        dt.url as test_url,
        dt.domain as test_domain,
        dt.har_path,
        dt.http_response_codes
      FROM domain_tests dt
      WHERE dt.test_run_id = $1
        AND dt.http_response_codes::text ~ '"[4-5][0-9]{2}"'
      ORDER BY dt.test_timestamp DESC
      LIMIT $2
    `
    : `
      SELECT
        dt.id,
        dt.url as test_url,
        dt.domain as test_domain,
        dt.har_path,
        dt.http_response_codes
      FROM domain_tests dt
      JOIN test_runs tr ON tr.id = dt.test_run_id
      WHERE tr.id = (SELECT id FROM test_runs ORDER BY run_timestamp DESC LIMIT 1)
        AND dt.http_response_codes::text ~ '"[4-5][0-9]{2}"'
      ORDER BY dt.test_timestamp DESC
      LIMIT $1
    `;

  try {
    const params = testRunId ? [testRunId, limit] : [limit];
    const result = await query(sql, params);
    const tests = result?.rows || [];

    const failedRequests = [];

    // Import fs and path dynamically to avoid issues in browser environments
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    // Get directory path for resolving HAR files
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Process each test and parse its HAR file
    for (const test of tests) {
      try {
        // Convert Docker container path to actual filesystem path
        const harPath = test.har_path.replace('/app/', '');
        const absoluteHarPath = path.join(__dirname, '..', '..', harPath);

        // Read and parse HAR file
        const harContent = await fs.readFile(absoluteHarPath, 'utf-8');
        const harData = JSON.parse(harContent);

        // Extract failed requests from HAR entries
        if (harData.log && harData.log.entries) {
          for (const entry of harData.log.entries) {
            const statusCode = entry.response?.status;

            // Only include 4xx and 5xx errors
            if (statusCode >= 400) {
              const requestUrl = entry.request?.url || 'Unknown URL';

              // Determine status category
              let statusCategory = 'Unknown';
              if (statusCode >= 400 && statusCode < 500) {
                statusCategory = 'Client Error';
              } else if (statusCode >= 500) {
                statusCategory = 'Server Error';
              }

              failedRequests.push({
                testUrl: test.test_url,
                testDomain: test.test_domain,
                failedRequestUrl: requestUrl,
                statusCode: statusCode,
                statusCategory: statusCategory
              });
            }
          }
        }
      } catch (harError) {
        console.error(`Failed to parse HAR file for ${test.test_url}:`, harError.message);
      }
    }

    return failedRequests;
  } catch (error) {
    console.error('Failed to get failed requests:', error.message);
    return [];
  }
}

/**
 * Get failed HTTP requests for a specific domain test
 * @param {number} testId - Domain test ID
 * @returns {Promise<Array>} Array of {failedRequestUrl, statusCode, statusCategory}
 */
export async function getFailedRequestsByTestId(testId) {
  if (!isDatabaseConnected()) {
    return [];
  }

  const sql = `
    SELECT
      dt.id,
      dt.url as test_url,
      dt.domain as test_domain,
      dt.har_path,
      dt.http_response_codes
    FROM domain_tests dt
    WHERE dt.id = $1
      AND dt.http_response_codes::text ~ '"[4-5][0-9]{2}"'
  `;

  try {
    const result = await query(sql, [testId]);
    const test = result?.rows[0];

    if (!test) {
      return [];
    }

    const failedRequests = [];

    // Import fs and path dynamically
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    try {
      // Convert Docker container path to actual filesystem path
      // Docker path: /app/test-history/...
      // Local path: /path/to/project/test-history/...
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const harPath = test.har_path.replace('/app/', '');
      const absoluteHarPath = path.join(__dirname, '..', '..', harPath);

      // Read and parse HAR file
      const harContent = await fs.readFile(absoluteHarPath, 'utf-8');
      const harData = JSON.parse(harContent);

      // Extract failed requests from HAR entries
      if (harData.log && harData.log.entries) {
        for (const entry of harData.log.entries) {
          const statusCode = entry.response?.status;

          // Only include 4xx and 5xx errors
          if (statusCode >= 400) {
            const requestUrl = entry.request?.url || 'Unknown URL';

            // Determine status category
            let statusCategory = 'Unknown';
            if (statusCode >= 400 && statusCode < 500) {
              statusCategory = 'Client Error';
            } else if (statusCode >= 500) {
              statusCategory = 'Server Error';
            }

            failedRequests.push({
              failedRequestUrl: requestUrl,
              statusCode: statusCode,
              statusCategory: statusCategory
            });
          }
        }
      }
    } catch (harError) {
      console.error(`Failed to parse HAR file for test ${testId}:`, harError.message);
    }

    return failedRequests;
  } catch (error) {
    console.error('Failed to get failed requests by test ID:', error.message);
    return [];
  }
}
