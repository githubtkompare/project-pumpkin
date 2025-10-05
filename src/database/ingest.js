// @ts-check
import { query, transaction, isDatabaseConnected } from './client.js';
import { promises as fs } from 'fs';

/**
 * Data ingestion module for storing Playwright test results in PostgreSQL
 * Handles test runs, domain tests, and associated metrics
 */

/**
 * Create a new test run record
 * @param {number} totalDomains - Total number of domains to test
 * @param {number} parallelWorkers - Number of parallel workers
 * @param {string} notes - Optional notes about this test run
 * @returns {Promise<{id: number, uuid: string}|null>} Test run ID and UUID or null on failure
 */
export async function createTestRun(totalDomains, parallelWorkers = 4, notes = null) {
  if (!isDatabaseConnected()) {
    console.warn('Database not connected. Test run not recorded.');
    return null;
  }

  const sql = `
    INSERT INTO test_runs (total_domains, parallel_workers, status, notes)
    VALUES ($1, $2, $3, $4)
    RETURNING id, run_uuid
  `;

  try {
    const result = await query(sql, [totalDomains, parallelWorkers, 'RUNNING', notes]);
    if (result && result.rows.length > 0) {
      const { id, run_uuid } = result.rows[0];
      console.error(`✓ Test run created: ID=${id}, UUID=${run_uuid}`);
      return { id, uuid: run_uuid };
    }
    return null;
  } catch (error) {
    console.error('Failed to create test run:', error.message);
    return null;
  }
}

/**
 * Update test run status and duration
 * @param {number} testRunId - Test run ID
 * @param {string} status - Status: 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'
 * @param {number} durationMs - Total duration in milliseconds
 * @returns {Promise<boolean>}
 */
export async function updateTestRun(testRunId, status, durationMs = null) {
  if (!isDatabaseConnected() || !testRunId) {
    return false;
  }

  const sql = `
    UPDATE test_runs
    SET status = $1, duration_ms = $2
    WHERE id = $3
  `;

  try {
    await query(sql, [status, durationMs, testRunId]);
    console.error(`✓ Test run ${testRunId} updated: status=${status}, duration=${durationMs}ms`);
    return true;
  } catch (error) {
    console.error('Failed to update test run:', error.message);
    return false;
  }
}

/**
 * Insert a domain test result into the database
 * @param {number} testRunId - Test run ID (can be null if running standalone)
 * @param {object} testMetadata - Test metadata from runWebsiteTest
 * @param {object} performanceMetrics - Performance metrics from collectPerformanceMetrics
 * @param {object} httpResponseCodes - HTTP response code counts
 * @param {boolean} storeFiles - Whether to store binary files in database (default: false)
 * @returns {Promise<number|null>} Domain test ID or null on failure
 */
export async function insertDomainTest(testRunId, testMetadata, performanceMetrics, httpResponseCodes = {}, storeFiles = false) {
  if (!isDatabaseConnected()) {
    console.warn('Database not connected. Domain test result not stored.');
    return null;
  }

  // Extract domain from URL
  const domain = new URL(testMetadata.url).hostname;

  // Prepare resources by type as JSON
  const resourcesByType = performanceMetrics.resources?.byType || {};

  // Read binary files if requested
  let screenshotData = null;
  let harData = null;

  if (storeFiles) {
    try {
      screenshotData = await fs.readFile(testMetadata.screenshotPath);
      harData = await fs.readFile(testMetadata.harPath);
    } catch (error) {
      console.warn('Failed to read binary files for storage:', error.message);
    }
  }

  const sql = `
    INSERT INTO domain_tests (
      test_run_id,
      test_timestamp,
      url,
      domain,
      browser,
      user_agent,
      page_title,
      test_duration_ms,
      scroll_duration_ms,
      status,
      dns_lookup_ms,
      tcp_connection_ms,
      tls_negotiation_ms,
      time_to_first_byte_ms,
      response_time_ms,
      dom_content_loaded_ms,
      dom_interactive_ms,
      total_page_load_ms,
      doc_transfer_size_bytes,
      doc_encoded_size_bytes,
      doc_decoded_size_bytes,
      total_resources,
      total_transfer_size_bytes,
      total_encoded_size_bytes,
      resources_by_type,
      http_response_codes,
      screenshot_path,
      har_path,
      screenshot_data,
      har_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
    )
    RETURNING id, test_uuid
  `;

  const params = [
    testRunId,
    testMetadata.timestamp,
    testMetadata.url,
    domain,
    testMetadata.browser,
    testMetadata.userAgent,
    testMetadata.pageTitle,
    testMetadata.testDuration,
    testMetadata.scrollDuration,
    testMetadata.testStatus,
    performanceMetrics.navigation?.dnsLookup || 0,
    performanceMetrics.navigation?.tcpConnection || 0,
    performanceMetrics.navigation?.tlsNegotiation || 0,
    performanceMetrics.navigation?.timeToFirstByte || 0,
    performanceMetrics.navigation?.responseTime || 0,
    performanceMetrics.navigation?.domContentLoaded || 0,
    performanceMetrics.navigation?.domInteractive || 0,
    performanceMetrics.navigation?.pageLoadTime || 0,
    performanceMetrics.navigation?.transferSize || 0,
    performanceMetrics.navigation?.encodedBodySize || 0,
    performanceMetrics.navigation?.decodedBodySize || 0,
    performanceMetrics.resources?.total || 0,
    performanceMetrics.resources?.totalTransferSize || 0,
    performanceMetrics.resources?.totalEncodedSize || 0,
    JSON.stringify(resourcesByType),
    JSON.stringify(httpResponseCodes),
    testMetadata.screenshotPath,
    testMetadata.harPath,
    screenshotData,
    harData
  ];

  try {
    const result = await query(sql, params);
    if (result && result.rows.length > 0) {
      const { id, test_uuid } = result.rows[0];
      console.error(`✓ Domain test stored: ID=${id}, UUID=${test_uuid}, URL=${testMetadata.url}`);

      // Also insert normalized HTTP response codes and resource types
      await insertHttpResponses(id, httpResponseCodes);
      await insertResourceTypes(id, resourcesByType);

      return id;
    }
    return null;
  } catch (error) {
    console.error('Failed to insert domain test:', error.message);
    console.error('URL:', testMetadata.url);
    return null;
  }
}

/**
 * Insert HTTP response codes into normalized table
 * @param {number} domainTestId - Domain test ID
 * @param {object} httpResponseCodes - HTTP response code counts
 * @returns {Promise<boolean>}
 */
async function insertHttpResponses(domainTestId, httpResponseCodes) {
  if (!isDatabaseConnected() || !domainTestId || Object.keys(httpResponseCodes).length === 0) {
    return false;
  }

  const values = Object.entries(httpResponseCodes).map(([code, count]) =>
    `(${domainTestId}, ${parseInt(code)}, ${count})`
  ).join(', ');

  const sql = `
    INSERT INTO http_responses (domain_test_id, status_code, response_count)
    VALUES ${values}
  `;

  try {
    await query(sql);
    return true;
  } catch (error) {
    console.error('Failed to insert HTTP responses:', error.message);
    return false;
  }
}

/**
 * Insert resource types into normalized table
 * @param {number} domainTestId - Domain test ID
 * @param {object} resourceTypes - Resource type counts
 * @returns {Promise<boolean>}
 */
async function insertResourceTypes(domainTestId, resourceTypes) {
  if (!isDatabaseConnected() || !domainTestId || Object.keys(resourceTypes).length === 0) {
    return false;
  }

  const values = Object.entries(resourceTypes).map(([type, count]) =>
    `(${domainTestId}, '${type}', ${count})`
  ).join(', ');

  const sql = `
    INSERT INTO resource_types (domain_test_id, resource_type, resource_count)
    VALUES ${values}
  `;

  try {
    await query(sql);
    return true;
  } catch (error) {
    console.error('Failed to insert resource types:', error.message);
    return false;
  }
}

/**
 * Get current test run ID from environment variable
 * Set by test-domains-parallel.sh before running tests
 * @returns {number|null}
 */
export function getTestRunIdFromEnv() {
  const testRunId = process.env.TEST_RUN_ID;
  return testRunId ? parseInt(testRunId) : null;
}

/**
 * Bulk insert multiple domain tests within a transaction
 * Useful for importing historical data
 * @param {number} testRunId - Test run ID
 * @param {Array} domainTests - Array of domain test objects
 * @returns {Promise<number>} Number of tests inserted
 */
export async function bulkInsertDomainTests(testRunId, domainTests) {
  if (!isDatabaseConnected()) {
    console.warn('Database not connected. Bulk insert skipped.');
    return 0;
  }

  let inserted = 0;

  try {
    await transaction(async (client) => {
      for (const test of domainTests) {
        const { testMetadata, performanceMetrics, httpResponseCodes } = test;
        const id = await insertDomainTest(testRunId, testMetadata, performanceMetrics, httpResponseCodes, false);
        if (id) inserted++;
      }
    });

    console.error(`✓ Bulk insert complete: ${inserted}/${domainTests.length} tests inserted`);
    return inserted;
  } catch (error) {
    console.error('Bulk insert failed:', error.message);
    return inserted;
  }
}
