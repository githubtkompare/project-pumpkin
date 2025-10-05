#!/usr/bin/env node
// @ts-check

/**
 * Report generator for Playwright metrics database
 * Generates comprehensive performance reports from stored test data
 */

import { initializePool, closePool, isDatabaseConnected } from '../database/client.js';
import * as queries from '../database/queries.js';

async function generateReport() {
  await initializePool();

  if (!isDatabaseConnected()) {
    console.error('❌ Database connection failed. Cannot generate report.');
    process.exit(1);
  }

  try {
    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('                 PLAYWRIGHT PERFORMANCE REPORT                         ');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    // Latest Test Run Summary
    const latestRun = await queries.getLatestTestRun();
    if (latestRun) {
      printLatestRunSummary(latestRun);
    }

    // Average Metrics
    const averages = await queries.getLatestRunAverages();
    if (averages) {
      printAverageMetrics(averages);
    }

    // Slowest URLs
    const slowest = await queries.getSlowestUrls(10);
    if (slowest.length > 0) {
      printSlowestUrls(slowest);
    }

    // Fastest URLs
    const fastest = await queries.getFastestUrls(5);
    if (fastest.length > 0) {
      printFastestUrls(fastest);
    }

    // Tests with Errors
    const errors = await queries.getTestsWithErrors(10);
    if (errors.length > 0) {
      printTestsWithErrors(errors);
    }

    // 404 Errors
    const notFound = await queries.getUrlsWithMost404s(10);
    if (notFound.length > 0) {
      print404Summary(notFound);
    }

    // HTTP Status Code Summary
    const statusCodes = await queries.getTestsByStatusCode();
    if (statusCodes.length > 0) {
      printStatusCodeSummary(statusCodes);
    }

    // HTTP 400+ Error Details
    const failedRequests = await queries.getFailedRequests();
    if (failedRequests.length > 0) {
      printFailedRequestsDetails(failedRequests);
    }

    // Historical Comparison (if we have more than one run)
    const allRuns = await queries.getAllTestRuns(2);
    if (allRuns.length >= 2) {
      printHistoricalComparison(allRuns);
    }

    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('                      END OF REPORT                                    ');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('Report generation error:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

function printLatestRunSummary(run) {
  console.log('─'.repeat(70));
  console.log('LATEST TEST RUN SUMMARY');
  console.log('─'.repeat(70));
  console.log(`Test Run ID:        ${run.id}`);
  console.log(`Timestamp:          ${run.run_timestamp.toISOString()}`);
  console.log(`Status:             ${getStatusEmoji(run.status)} ${run.status}`);
  console.log(`Total URLs:         ${run.total_urls}`);
  console.log(`Tests Completed:    ${run.tests_completed}`);
  console.log(`Success Rate:       ${run.passed_count}/${run.tests_completed} (${Math.round(run.passed_count / run.tests_completed * 100)}%)`);
  console.log(`Duration:           ${formatDuration(run.duration_ms)}`);
  console.log(`Parallel Workers:   ${run.parallel_workers}`);
  console.log(`Avg Page Load Time: ${run.avg_page_load_ms}ms`);
  console.log(`Avg TTFB:           ${run.avg_ttfb_ms}ms`);
  console.log('');
}

function printAverageMetrics(averages) {
  console.log('─'.repeat(70));
  console.log('PERFORMANCE METRICS (AVERAGES)');
  console.log('─'.repeat(70));
  console.log(`DNS Lookup:         ${averages.avg_dns_ms}ms`);
  console.log(`TCP Connection:     ${averages.avg_tcp_ms}ms`);
  console.log(`TLS Negotiation:    ${averages.avg_tls_ms}ms`);
  console.log(`Time to First Byte: ${averages.avg_ttfb_ms}ms`);
  console.log(`Total Page Load:    ${averages.avg_load_time_ms}ms`);
  console.log(`Resources Loaded:   ${averages.avg_resources}`);
  console.log(`Transfer Size:      ${formatBytes(averages.avg_transfer_bytes)}`);
  console.log('');
}

function printSlowestUrls(urls) {
  console.log('─'.repeat(70));
  console.log('SLOWEST URLS (Top 10)');
  console.log('─'.repeat(70));
  console.log('Rank  Domain'.padEnd(42) + 'Load Time'.padEnd(14) + 'TTFB');
  console.log('─'.repeat(70));

  urls.forEach((url, index) => {
    const rank = `${index + 1}.`.padEnd(6);
    const domainName = url.domain.substring(0, 32).padEnd(36);
    const loadTime = `${url.total_page_load_ms}ms`.padEnd(14);
    const ttfb = `${url.time_to_first_byte_ms}ms`;

    const emoji = getPerformanceEmoji(url.total_page_load_ms);
    console.log(`${rank}${emoji} ${domainName}${loadTime}${ttfb}`);
  });
  console.log('');
}

function printFastestUrls(urls) {
  console.log('─'.repeat(70));
  console.log('FASTEST URLS (Top 5)');
  console.log('─'.repeat(70));
  console.log('Rank  Domain'.padEnd(42) + 'Load Time'.padEnd(14) + 'TTFB');
  console.log('─'.repeat(70));

  urls.forEach((url, index) => {
    const rank = `${index + 1}.`.padEnd(6);
    const domainName = url.domain.substring(0, 32).padEnd(36);
    const loadTime = `${url.total_page_load_ms}ms`.padEnd(14);
    const ttfb = `${url.time_to_first_byte_ms}ms`;

    console.log(`${rank}⚡ ${domainName}${loadTime}${ttfb}`);
  });
  console.log('');
}

function printTestsWithErrors(errors) {
  console.log('─'.repeat(70));
  console.log(`TESTS WITH ERRORS (${errors.length} found)`);
  console.log('─'.repeat(70));

  errors.forEach(error => {
    console.log(`❌ ${error.domain}`);
    console.log(`   URL: ${error.url}`);
    console.log(`   Status: ${error.status}`);
    const httpCodes = JSON.parse(JSON.stringify(error.http_response_codes || {}));
    const errorCodes = Object.entries(httpCodes)
      .filter(([code]) => parseInt(code) >= 400)
      .map(([code, count]) => `${code}(${count})`)
      .join(', ');
    if (errorCodes) {
      console.log(`   Error Codes: ${errorCodes}`);
    }
    console.log('');
  });
}

function print404Summary(urls) {
  console.log('─'.repeat(70));
  console.log('URLS WITH 404 ERRORS');
  console.log('─'.repeat(70));
  console.log('Domain'.padEnd(40) + '404 Count'.padEnd(12) + 'Last Seen');
  console.log('─'.repeat(70));

  urls.forEach(url => {
    console.log(
      url.domain.substring(0, 38).padEnd(40) +
      String(url.count_404s).padEnd(12) +
      url.last_seen.toISOString().substring(0, 19)
    );
  });
  console.log('');
}

function printStatusCodeSummary(codes) {
  console.log('─'.repeat(70));
  console.log('HTTP STATUS CODE SUMMARY');
  console.log('─'.repeat(70));
  console.log('Code'.padEnd(12) + 'Category'.padEnd(20) + 'Tests'.padEnd(10) + 'Responses');
  console.log('─'.repeat(70));

  codes.forEach(code => {
    const category = getStatusCategory(code.status_code);
    const emoji = getStatusEmoji(category);
    console.log(
      String(code.status_code).padEnd(12) +
      `${emoji} ${category}`.padEnd(20) +
      String(code.test_count).padEnd(10) +
      code.total_responses
    );
  });
  console.log('');
}

function printFailedRequestsDetails(failedRequests) {
  console.log('─'.repeat(70));
  console.log(`HTTP 400+ ERROR DETAILS (${failedRequests.length} failed requests)`);
  console.log('─'.repeat(70));

  // Group by test domain for better readability
  const groupedByTest = {};
  failedRequests.forEach(req => {
    if (!groupedByTest[req.testDomain]) {
      groupedByTest[req.testDomain] = [];
    }
    groupedByTest[req.testDomain].push(req);
  });

  // Print grouped results
  Object.entries(groupedByTest).forEach(([testDomain, requests]) => {
    console.log(`\n🌐 Test Domain: ${testDomain}`);
    console.log('   ' + '─'.repeat(66));

    requests.forEach(req => {
      const emoji = req.statusCode >= 500 ? '🔥' : '❌';
      console.log(
        '   ' +
        `${emoji} ${req.statusCode}`.padEnd(10) +
        req.statusCategory
      );
      console.log('   URL: ' + req.failedRequestUrl);
      console.log('');
    });
  });

  console.log('');
}

function printHistoricalComparison(runs) {
  if (runs.length < 2) return;

  const latest = runs[0];
  const previous = runs[1];

  console.log('─'.repeat(70));
  console.log('HISTORICAL COMPARISON');
  console.log('─'.repeat(70));
  console.log(`Latest Run:   ${latest.run_timestamp.toISOString()}`);
  console.log(`Previous Run: ${previous.run_timestamp.toISOString()}`);
  console.log('');

  const loadDiff = latest.avg_page_load_ms - previous.avg_page_load_ms;
  const ttfbDiff = latest.avg_ttfb_ms - previous.avg_ttfb_ms;

  console.log('Metric'.padEnd(25) + 'Latest'.padEnd(15) + 'Previous'.padEnd(15) + 'Change');
  console.log('─'.repeat(70));
  console.log(
    'Avg Page Load Time'.padEnd(25) +
    `${latest.avg_page_load_ms}ms`.padEnd(15) +
    `${previous.avg_page_load_ms}ms`.padEnd(15) +
    formatChange(loadDiff)
  );
  console.log(
    'Avg TTFB'.padEnd(25) +
    `${latest.avg_ttfb_ms}ms`.padEnd(15) +
    `${previous.avg_ttfb_ms}ms`.padEnd(15) +
    formatChange(ttfbDiff)
  );
  console.log(
    'Tests Completed'.padEnd(25) +
    String(latest.tests_completed).padEnd(15) +
    String(previous.tests_completed).padEnd(15) +
    formatChange(latest.tests_completed - previous.tests_completed, false)
  );
  console.log('');
}

// Helper functions
function getStatusEmoji(status) {
  const statusMap = {
    'COMPLETED': '✅',
    'PARTIAL': '⚠️',
    'RUNNING': '🔄',
    'FAILED': '❌',
    'Success': '✅',
    'Redirect': '↪️',
    'Client Error': '❌',
    'Server Error': '🔥'
  };
  return statusMap[status] || '•';
}

function getStatusCategory(code) {
  if (code >= 200 && code < 300) return 'Success';
  if (code >= 300 && code < 400) return 'Redirect';
  if (code >= 400 && code < 500) return 'Client Error';
  if (code >= 500) return 'Server Error';
  return 'Unknown';
}

function getPerformanceEmoji(loadTime) {
  if (loadTime < 1000) return '🟢';
  if (loadTime < 3000) return '🟡';
  return '🔴';
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatChange(value, isMs = true) {
  const suffix = isMs ? 'ms' : '';
  if (value > 0) return `🔺 +${value}${suffix}`;
  if (value < 0) return `🔻 ${value}${suffix}`;
  return `➖ 0${suffix}`;
}

// Run report
generateReport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
