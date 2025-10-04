// @ts-check
import { test, chromium } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Auto-scroll function to trigger lazy-loaded images and content
 * Scrolls progressively down the page with pauses to allow content to load
 */
async function autoScrollPage(page) {
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
async function collectPerformanceMetrics(page) {
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

test.describe('Website Screenshot Test', () => {
  test('navigate to website and capture full page screenshot with performance metrics', async ({ browser }) => {
    const testStartTime = Date.now();

    // Create test-history directory if it doesn't exist (separate from Playwright's managed test-results)
    const testResultsDir = path.join(process.cwd(), 'test-history');
    await fs.mkdir(testResultsDir, { recursive: true });

    // Get URL from environment variable or use default
    const url = process.env.TEST_URL || 'https://www.uchicago.edu/';

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
    const logPath = path.join(testRunDir, 'report.txt');
    const harPath = path.join(testRunDir, 'network.har');

    // Create browser context with HAR recording enabled
    console.log(`Test run directory: ${testRunDir}`);
    console.log('Starting HAR recording...');
    const context = await browser.newContext({
      recordHar: { path: harPath }
    });

    // Create new page in the context
    const page = await context.newPage();

    // Navigate to the URL (already defined above)
    console.log(`Target URL: ${url}`);
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for all page elements to load
    console.log('Waiting for page to fully load...');
    await page.waitForLoadState('load');

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

    // Close context to finalize HAR file
    await context.close();
    console.log('HAR recording saved.');

    const testDuration = Date.now() - testStartTime;

    // Gather test metadata
    const testMetadata = {
      timestamp: new Date().toISOString(),
      url: url,
      browser: browser.browserType().name(),
      screenshotPath: screenshotPath,
      harPath: harPath,
      pageTitle: await page.title().catch(() => 'N/A'),
      testDuration: testDuration,
      scrollDuration: scrollDuration,
      testStatus: 'PASSED'
    };

    // Format performance metrics for display
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatMs = (ms) => Math.round(ms * 100) / 100 + ' ms';

    // Write test results to text file
    const logContent = `Website Screenshot Test Results
${'='.repeat(70)}
TEST INFORMATION
${'='.repeat(70)}
Timestamp:        ${testMetadata.timestamp}
URL:              ${testMetadata.url}
Browser:          ${testMetadata.browser}
Page Title:       ${testMetadata.pageTitle}
Test Duration:    ${testDuration} ms
Scroll Duration:  ${scrollDuration} ms
Status:           ${testMetadata.testStatus}

${'='.repeat(70)}
PERFORMANCE METRICS - NAVIGATION TIMING
${'='.repeat(70)}
DNS Lookup:              ${formatMs(performanceMetrics.navigation.dnsLookup)}
TCP Connection:          ${formatMs(performanceMetrics.navigation.tcpConnection)}
TLS Negotiation:         ${formatMs(performanceMetrics.navigation.tlsNegotiation)}
Time to First Byte:      ${formatMs(performanceMetrics.navigation.timeToFirstByte)}
Response Time:           ${formatMs(performanceMetrics.navigation.responseTime)}
DOM Content Loaded:      ${formatMs(performanceMetrics.navigation.domContentLoaded)}
DOM Interactive:         ${formatMs(performanceMetrics.navigation.domInteractive)}
Total Page Load Time:    ${formatMs(performanceMetrics.navigation.pageLoadTime)}

Document Transfer Size:  ${formatBytes(performanceMetrics.navigation.transferSize)}
Document Encoded Size:   ${formatBytes(performanceMetrics.navigation.encodedBodySize)}
Document Decoded Size:   ${formatBytes(performanceMetrics.navigation.decodedBodySize)}

${'='.repeat(70)}
NETWORK STATISTICS - RESOURCE TIMING
${'='.repeat(70)}
Total Resources Loaded:  ${performanceMetrics.resources.total}
Total Transfer Size:     ${formatBytes(performanceMetrics.resources.totalTransferSize)}
Total Encoded Size:      ${formatBytes(performanceMetrics.resources.totalEncodedSize)}

Resources by Type:
${Object.entries(performanceMetrics.resources.byType)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `  ${type.padEnd(20)} ${count}`)
  .join('\n')}

${'='.repeat(70)}
OUTPUT FILES
${'='.repeat(70)}
Screenshot:   ${screenshotPath}
HAR File:     ${harPath}
Log File:     ${logPath}
${'='.repeat(70)}
`;

    await fs.writeFile(logPath, logContent, 'utf-8');
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Test run completed successfully!`);
    console.log(`All files saved to: ${testRunDir}`);
    console.log(`  - Screenshot: screenshot.png`);
    console.log(`  - HAR file: network.har`);
    console.log(`  - Report: report.txt`);
    console.log(`${'='.repeat(70)}`);
  });
});
