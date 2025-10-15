import { promises as fs } from 'fs';
import path from 'path';
import { initializePool, isDatabaseConnected } from '../src/database/client.js';
import { insertUrlTest, getTestRunIdFromEnv, createTestRun } from '../src/database/ingest.js';

// Global variable to store auto-created test run ID for the current test session
let autoCreatedTestRunId = null;

/**
 * Auto-scroll function to trigger lazy-loaded images and content
 * Scrolls progressively down the page with pauses to allow content to load
 */
export async function autoScrollPage(page) {
  const scrollStartTime = Date.now();

  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100; // Scroll 100px at a time
      const delay = 100; // Pause 100ms between scrolls

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        // Stop when we've scrolled past the entire page height
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  });

  // Wait a bit more for final images to load
  await page.waitForTimeout(1000);

  // Scroll back to top for the screenshot
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const scrollDuration = Date.now() - scrollStartTime;
  return scrollDuration;
}

/**
 * Collect performance metrics from the browser
 */
export async function collectPerformanceMetrics(page) {
  return await page.evaluate(() => {
    const navTiming = performance.getEntriesByType('navigation')[0];
    const resourceTimings = performance.getEntriesByType('resource');

    // Calculate key metrics
    const metrics = {
      navigation: navTiming ? {
        dnsLookup: navTiming.domainLookupEnd - navTiming.domainLookupStart,
        tcpConnection: navTiming.connectEnd - navTiming.connectStart,
        tlsNegotiation: navTiming.secureConnectionStart > 0 ? navTiming.connectEnd - navTiming.secureConnectionStart : 0,
        timeToFirstByte: navTiming.responseStart - navTiming.requestStart,
        responseTime: navTiming.responseEnd - navTiming.responseStart,
        domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart,
        domInteractive: navTiming.domInteractive - navTiming.fetchStart,
        pageLoadTime: navTiming.loadEventEnd - navTiming.fetchStart,
        transferSize: navTiming.transferSize || 0,
        encodedBodySize: navTiming.encodedBodySize || 0,
        decodedBodySize: navTiming.decodedBodySize || 0
      } : null,

      resources: {
        total: resourceTimings.length,
        byType: {},
        totalTransferSize: 0,
        totalEncodedSize: 0
      }
    };

    // Categorize resources by type
    resourceTimings.forEach(resource => {
      const type = resource.initiatorType || 'other';
      if (!metrics.resources.byType[type]) {
        metrics.resources.byType[type] = 0;
      }
      metrics.resources.byType[type]++;

      metrics.resources.totalTransferSize += resource.transferSize || 0;
      metrics.resources.totalEncodedSize += resource.encodedBodySize || 0;
    });

    return metrics;
  });
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format milliseconds to human-readable string
 */
export function formatMs(ms) {
  return Math.round(ms * 100) / 100 + ' ms';
}

/**
 * Parse HAR file and extract HTTP response code statistics
 */
export async function parseHttpResponseCodes(harPath) {
  try {
    const harContent = await fs.readFile(harPath, 'utf-8');
    const harData = JSON.parse(harContent);

    const statusCodeCounts = {};

    // Extract response status codes from HAR entries
    if (harData.log && harData.log.entries) {
      harData.log.entries.forEach(entry => {
        if (entry.response && entry.response.status) {
          const statusCode = entry.response.status;
          // Ignore -1 status codes (failed/aborted requests)
          if (statusCode > 0) {
            statusCodeCounts[statusCode] = (statusCodeCounts[statusCode] || 0) + 1;
          }
        }
      });
    }

    return statusCodeCounts;
  } catch (error) {
    console.error(`Error parsing HAR file: ${error.message}`);
    return {};
  }
}

/**
 * Ensure a test run ID exists for database tracking
 * If TEST_RUN_ID environment variable is set (from batch script), use it
 * Otherwise, auto-create a test run for this session
 * @returns {Promise<number|null>} Test run ID or null if unable to create
 */
async function ensureTestRunId() {
  // Always initialize the database pool first
  try {
    await initializePool();

    if (!isDatabaseConnected()) {
      console.warn('⚠ Database not available - skipping test run creation');
      return null;
    }
  } catch (error) {
    console.warn('⚠ Error initializing database pool:', error.message);
    return null;
  }

  // Check if TEST_RUN_ID is already set by batch script
  const envTestRunId = getTestRunIdFromEnv();
  if (envTestRunId) {
    console.log(`Using test run ID from environment: ${envTestRunId}`);
    return envTestRunId;
  }

  // Check if we already auto-created a test run for this session
  if (autoCreatedTestRunId) {
    return autoCreatedTestRunId;
  }

  // Try to auto-create a test run
  console.log('Auto-creating test run for individual test execution...');
  const testRun = await createTestRun(
    1, // totalUrls - we don't know how many, so estimate 1
    1, // parallelWorkers
    'Individual test run (auto-created)'
  );

  if (testRun) {
    autoCreatedTestRunId = testRun.id;
    console.log(`✓ Auto-created test run with ID: ${autoCreatedTestRunId}`);
    return autoCreatedTestRunId;
  } else {
    console.warn('⚠ Failed to auto-create test run - database save will be skipped');
    return null;
  }
}

/**
 * Run a complete website screenshot test with performance metrics
 * @param {object} browser - Playwright browser instance
 * @param {string} url - URL to test
 */
export async function runWebsiteTest(browser, url) {
  const testStartTime = Date.now();

  // Create test-history directory if it doesn't exist
  const testResultsDir = path.join(process.cwd(), 'test-history');
  await fs.mkdir(testResultsDir, { recursive: true });

  // Extract hostname from URL and sanitize for filesystem compatibility
  const urlWithoutProtocol = url
    .replace(/^https?:\/\//, '')           // Remove http:// or https://
    .replace(/\/$/, '')                    // Remove trailing slash
    .replace(/[:/?#\[\]@!$&'()*+,;=]/g, '_');  // Replace URL special chars with underscore

  // Generate timestamp and create directory name with URL
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dirName = `${timestamp}__${urlWithoutProtocol}`;
  const testRunDir = path.join(testResultsDir, dirName);
  await fs.mkdir(testRunDir, { recursive: true });

  // Define file paths within the timestamped directory
  const screenshotPath = path.join(testRunDir, 'screenshot.png');
  const harPath = path.join(testRunDir, 'network.har');

  // Create browser context with HAR recording enabled
  console.log(`Test run directory: ${testRunDir}`);
  console.log('Starting HAR recording...');
  const context = await browser.newContext({
    recordHar: { path: harPath }
  });

  // Create new page in the context
  const page = await context.newPage();

  // Navigate to the URL
  console.log(`Target URL: ${url}`);
  console.log(`Navigating to ${url}...`);
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000  // 60 second timeout for navigation
  });

  // Wait for all page elements to load
  console.log('Waiting for page to fully load...');
  await page.waitForLoadState('load', { timeout: 60000 });

  // Give extra time for dynamic content to render
  await page.waitForTimeout(2000);

  // Auto-scroll to trigger lazy-loaded images
  console.log('Auto-scrolling to load lazy-loaded content...');
  const scrollDuration = await autoScrollPage(page);
  console.log(`Auto-scroll complete. Duration: ${scrollDuration}ms`);

  // Collect performance metrics
  console.log('Collecting performance metrics...');
  const performanceMetrics = await collectPerformanceMetrics(page);

  // Take screenshot
  console.log(`Taking screenshot...`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

  // Collect metadata before closing context
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const pageTitle = await page.title().catch(() => 'N/A');

  // Close context to finalize HAR file
  await context.close();
  console.log('HAR recording saved.');

  const testDuration = Date.now() - testStartTime;

  // Parse HTTP response codes from HAR file
  console.log('Parsing HTTP response codes from HAR file...');
  const httpResponseCodes = await parseHttpResponseCodes(harPath);

  // Gather test metadata
  const testMetadata = {
    timestamp: new Date().toISOString(),
    url: url,
    browser: browser.browserType().name(),
    userAgent: userAgent,
    screenshotPath: screenshotPath,
    harPath: harPath,
    pageTitle: pageTitle,
    testDuration: testDuration,
    scrollDuration: scrollDuration,
    testStatus: 'PASSED'
  };

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test run completed successfully!`);
  console.log(`All files saved to: ${testRunDir}`);
  console.log(`  - Screenshot: screenshot.png`);
  console.log(`  - HAR file: network.har`);
  console.log(`${'='.repeat(70)}`);

  // Store results in database if connection is available
  try {
    // Ensure we have a test run ID (from env or auto-created)
    const testRunId = await ensureTestRunId();

    if (testRunId) {
      console.log('Storing test results in database...');

      const urlTestId = await insertUrlTest(
        testRunId,
        testMetadata,
        performanceMetrics,
        httpResponseCodes,
        false // Don't store binary files in DB by default
      );

      if (urlTestId) {
        console.log(`✓ Test results stored in database (ID: ${urlTestId}, Test Run: ${testRunId})`);
      } else {
        console.warn('⚠ Failed to store test results in database');
      }
    } else {
      console.log('⚠ No test run ID available - results saved to filesystem only');
    }
  } catch (dbError) {
    console.warn('Database storage failed (results still saved to filesystem):', dbError.message);
  }

  return testMetadata;
}
