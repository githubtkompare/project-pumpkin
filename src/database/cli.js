#!/usr/bin/env node
// @ts-check

/**
 * CLI tool for querying the Playwright metrics database
 * Usage: npm run db:query <command> [args]
 */

import { initializePool, closePool, isDatabaseConnected } from './client.js';
import * as queries from './queries.js';

const COMMANDS = {
  latest: 'Show latest test run summary',
  runs: 'Show all test runs (optional: limit)',
  urls: 'Show URL tests for a test run (requires: runId)',
  trend: 'Show performance trend for a domain (requires: domain, optional: limit)',
  errors: 'Show tests with errors (optional: limit)',
  '404s': 'Show URLs with most 404 errors (optional: limit)',
  'failed-requests': 'Show HTTP 400+ failed request details (optional: limit)',
  slowest: 'Show slowest URLs from latest run (optional: limit)',
  fastest: 'Show fastest URLs from latest run (optional: limit)',
  compare: 'Compare two test runs (requires: runId1, runId2)',
  averages: 'Show average metrics for latest run',
  codes: 'Show tests grouped by HTTP status code (optional: runId)',
  search: 'Search URL tests by URL pattern (requires: pattern, optional: limit)',
  help: 'Show this help message'
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    printHelp();
    process.exit(0);
  }

  // Initialize database connection
  await initializePool();

  if (!isDatabaseConnected()) {
    console.error('❌ Database connection failed. Cannot execute queries.');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'latest':
        await showLatestRun();
        break;

      case 'runs':
        const runLimit = parseInt(args[1]) || 10;
        await showAllRuns(runLimit);
        break;

      case 'urls':
        const runId = parseInt(args[1]);
        if (!runId) {
          console.error('Error: runId required');
          process.exit(1);
        }
        await showUrlTests(runId);
        break;

      case 'trend':
        const domain = args[1];
        if (!domain) {
          console.error('Error: domain required');
          process.exit(1);
        }
        const trendLimit = parseInt(args[2]) || 10;
        await showPerformanceTrend(domain, trendLimit);
        break;

      case 'errors':
        const errorLimit = parseInt(args[1]) || 50;
        await showTestsWithErrors(errorLimit);
        break;

      case '404s':
        const notFoundLimit = parseInt(args[1]) || 10;
        await showUrlsWith404s(notFoundLimit);
        break;

      case 'failed-requests':
        const failedLimit = parseInt(args[1]) || 50;
        await showFailedRequests(failedLimit);
        break;

      case 'slowest':
        const slowLimit = parseInt(args[1]) || 10;
        await showSlowestUrls(slowLimit);
        break;

      case 'fastest':
        const fastLimit = parseInt(args[1]) || 10;
        await showFastestUrls(fastLimit);
        break;

      case 'compare':
        const runId1 = parseInt(args[1]);
        const runId2 = parseInt(args[2]);
        if (!runId1 || !runId2) {
          console.error('Error: two runId arguments required');
          process.exit(1);
        }
        await compareRuns(runId1, runId2);
        break;

      case 'averages':
        await showAverages();
        break;

      case 'codes':
        const codeRunId = args[1] ? parseInt(args[1]) : null;
        await showStatusCodes(codeRunId);
        break;

      case 'search':
        const pattern = args[1];
        if (!pattern) {
          console.error('Error: search pattern required');
          process.exit(1);
        }
        const searchLimit = parseInt(args[2]) || 20;
        await searchUrls(pattern, searchLimit);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

function printHelp() {
  console.log('\nPlaywright Metrics Database CLI\n');
  console.log('Usage: npm run db:query <command> [args]\n');
  console.log('Available commands:\n');
  Object.entries(COMMANDS).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(12)} ${desc}`);
  });
  console.log('\nExamples:');
  console.log('  npm run db:query latest');
  console.log('  npm run db:query runs 5');
  console.log('  npm run db:query domains 123');
  console.log('  npm run db:query trend www.uchicago.edu 10');
  console.log('  npm run db:query failed-requests 20');
  console.log('  npm run db:query search "%uchicago%"');
  console.log('  npm run db:query compare 10 9');
  console.log('');
}

async function showLatestRun() {
  const run = await queries.getLatestTestRun();
  if (!run) {
    console.log('No test runs found');
    return;
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('LATEST TEST RUN');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`ID:                 ${run.id}`);
  console.log(`UUID:               ${run.run_uuid}`);
  console.log(`Timestamp:          ${run.run_timestamp}`);
  console.log(`Status:             ${run.status}`);
  console.log(`Total URLs:         ${run.total_urls}`);
  console.log(`Tests Completed:    ${run.tests_completed}`);
  console.log(`Passed:             ${run.passed_count}`);
  console.log(`Failed:             ${run.failed_count}`);
  console.log(`Duration:           ${run.duration_ms}ms`);
  console.log(`Parallel Workers:   ${run.parallel_workers}`);
  console.log(`Avg Page Load:      ${run.avg_page_load_ms}ms`);
  console.log(`Avg TTFB:           ${run.avg_ttfb_ms}ms`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

async function showAllRuns(limit) {
  const runs = await queries.getAllTestRuns(limit);
  if (runs.length === 0) {
    console.log('No test runs found');
    return;
  }

  console.log(`\nShowing ${runs.length} most recent test runs:\n`);
  console.log('ID'.padEnd(6) + 'Timestamp'.padEnd(28) + 'Status'.padEnd(12) + 'Tests'.padEnd(8) + 'Passed'.padEnd(8) + 'Failed'.padEnd(8) + 'Avg Load (ms)');
  console.log('─'.repeat(100));

  runs.forEach(run => {
    console.log(
      String(run.id).padEnd(6) +
      run.run_timestamp.toISOString().padEnd(28) +
      run.status.padEnd(12) +
      String(run.tests_completed).padEnd(8) +
      String(run.passed_count).padEnd(8) +
      String(run.failed_count).padEnd(8) +
      run.avg_page_load_ms
    );
  });
  console.log('');
}

async function showUrlTests(runId) {
  const tests = await queries.getUrlTestsByRun(runId);
  if (tests.length === 0) {
    console.log(`No URL tests found for run ID ${runId}`);
    return;
  }

  console.log(`\nURL tests for run ID ${runId} (${tests.length} tests):\n`);
  console.log('Domain'.padEnd(35) + 'Status'.padEnd(10) + 'Load (ms)'.padEnd(12) + 'TTFB (ms)'.padEnd(12) + 'Resources');
  console.log('─'.repeat(100));

  tests.forEach(test => {
    console.log(
      test.domain.padEnd(35) +
      test.status.padEnd(10) +
      String(test.total_page_load_ms).padEnd(12) +
      String(test.time_to_first_byte_ms).padEnd(12) +
      test.total_resources
    );
  });
  console.log('');
}

async function showPerformanceTrend(domain, limit) {
  const trends = await queries.getDomainPerformanceTrend(domain, limit);
  if (trends.length === 0) {
    console.log(`No performance data found for domain: ${domain}`);
    return;
  }

  console.log(`\nPerformance trend for ${domain} (${trends.length} runs):\n`);
  console.log('Test Run'.padEnd(28) + 'Page Load (ms)'.padEnd(16) + 'TTFB (ms)'.padEnd(12) + 'DNS (ms)'.padEnd(10) + 'Status');
  console.log('─'.repeat(100));

  trends.forEach(trend => {
    console.log(
      trend.run_timestamp.toISOString().substring(0, 19).padEnd(28) +
      String(trend.total_page_load_ms).padEnd(16) +
      String(trend.time_to_first_byte_ms).padEnd(12) +
      String(trend.dns_lookup_ms).padEnd(10) +
      trend.status
    );
  });
  console.log('');
}

async function showTestsWithErrors(limit) {
  const tests = await queries.getTestsWithErrors(limit);
  if (tests.length === 0) {
    console.log('No tests with errors found');
    return;
  }

  console.log(`\nTests with errors (${tests.length} found):\n`);
  tests.forEach(test => {
    console.log(`Domain:     ${test.domain}`);
    console.log(`URL:        ${test.url}`);
    console.log(`Status:     ${test.status}`);
    console.log(`Timestamp:  ${test.test_timestamp}`);
    console.log(`HTTP Codes: ${JSON.stringify(test.http_response_codes)}`);
    console.log('─'.repeat(80));
  });
  console.log('');
}

async function showUrlsWith404s(limit) {
  const urls = await queries.getUrlsWithMost404s(limit);
  if (urls.length === 0) {
    console.log('No URLs with 404 errors found');
    return;
  }

  console.log(`\nURLs with most 404 errors (${urls.length} found):\n`);
  console.log('Domain'.padEnd(35) + '404 Count'.padEnd(12) + 'Last Seen');
  console.log('─'.repeat(80));

  urls.forEach(url => {
    console.log(
      url.domain.padEnd(35) +
      String(url.count_404s).padEnd(12) +
      url.last_seen.toISOString()
    );
  });
  console.log('');
}

async function showFailedRequests(limit) {
  const requests = await queries.getFailedRequests(null, limit);
  if (requests.length === 0) {
    console.log('No failed requests (HTTP 400+) found');
    return;
  }

  console.log(`\nHTTP 400+ Failed Request Details (${requests.length} found):\n`);

  // Group by test domain
  const grouped = {};
  requests.forEach(req => {
    if (!grouped[req.testDomain]) {
      grouped[req.testDomain] = [];
    }
    grouped[req.testDomain].push(req);
  });

  Object.entries(grouped).forEach(([testDomain, reqs]) => {
    console.log(`\nTest Domain: ${testDomain}`);
    console.log('─'.repeat(100));

    reqs.forEach(req => {
      const emoji = req.statusCode >= 500 ? '🔥' : '❌';
      console.log(
        `${emoji} ${req.statusCode}`.padEnd(8) +
        req.statusCategory
      );
      console.log('URL: ' + req.failedRequestUrl);
      console.log('');
    });
  });

  console.log('');
}

async function showSlowestUrls(limit) {
  const urls = await queries.getSlowestUrls(limit);
  if (urls.length === 0) {
    console.log('No URL data found');
    return;
  }

  console.log(`\nSlowest ${limit} URLs from latest run:\n`);
  console.log('Domain'.padEnd(35) + 'Page Load (ms)'.padEnd(16) + 'TTFB (ms)'.padEnd(12) + 'Resources');
  console.log('─'.repeat(100));

  urls.forEach(url => {
    console.log(
      url.domain.padEnd(35) +
      String(url.total_page_load_ms).padEnd(16) +
      String(url.time_to_first_byte_ms).padEnd(12) +
      url.total_resources
    );
  });
  console.log('');
}

async function showFastestUrls(limit) {
  const urls = await queries.getFastestUrls(limit);
  if (urls.length === 0) {
    console.log('No URL data found');
    return;
  }

  console.log(`\nFastest ${limit} URLs from latest run:\n`);
  console.log('Domain'.padEnd(35) + 'Page Load (ms)'.padEnd(16) + 'TTFB (ms)'.padEnd(12) + 'Resources');
  console.log('─'.repeat(100));

  urls.forEach(url => {
    console.log(
      url.domain.padEnd(35) +
      String(url.total_page_load_ms).padEnd(16) +
      String(url.time_to_first_byte_ms).padEnd(12) +
      url.total_resources
    );
  });
  console.log('');
}

async function compareRuns(runId1, runId2) {
  const comparison = await queries.compareTestRuns(runId1, runId2);
  if (comparison.length === 0) {
    console.log(`No comparison data found for runs ${runId1} and ${runId2}`);
    return;
  }

  console.log(`\nComparing test runs ${runId1} (new) vs ${runId2} (old):\n`);
  console.log('Domain'.padEnd(35) + 'New Load'.padEnd(12) + 'Old Load'.padEnd(12) + 'Diff (ms)'.padEnd(12) + 'Change %');
  console.log('─'.repeat(100));

  comparison.forEach(comp => {
    const arrow = comp.load_time_diff > 0 ? '↑' : '↓';
    console.log(
      comp.domain.padEnd(35) +
      String(comp.new_load_time).padEnd(12) +
      String(comp.old_load_time).padEnd(12) +
      String(comp.load_time_diff).padEnd(12) +
      `${arrow} ${comp.percent_change}%`
    );
  });
  console.log('');
}

async function showAverages() {
  const averages = await queries.getLatestRunAverages();
  if (!averages) {
    console.log('No average data found');
    return;
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('AVERAGE METRICS - LATEST RUN');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`Run Timestamp:      ${averages.run_timestamp}`);
  console.log(`Total Domains:      ${averages.total_domains}`);
  console.log(`Tests Completed:    ${averages.tests_completed}`);
  console.log(`Avg Load Time:      ${averages.avg_load_time_ms}ms`);
  console.log(`Avg TTFB:           ${averages.avg_ttfb_ms}ms`);
  console.log(`Avg DNS Lookup:     ${averages.avg_dns_ms}ms`);
  console.log(`Avg TCP Connection: ${averages.avg_tcp_ms}ms`);
  console.log(`Avg TLS Negotiation:${averages.avg_tls_ms}ms`);
  console.log(`Avg Resources:      ${averages.avg_resources}`);
  console.log(`Avg Transfer Size:  ${Math.round(averages.avg_transfer_bytes / 1024)} KB`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

async function showStatusCodes(runId) {
  const codes = await queries.getTestsByStatusCode(runId);
  if (codes.length === 0) {
    console.log('No HTTP status code data found');
    return;
  }

  const runInfo = runId ? ` for run ID ${runId}` : ' from latest run';
  console.log(`\nHTTP Status Codes${runInfo}:\n`);
  console.log('Status Code'.padEnd(15) + 'Tests'.padEnd(10) + 'Total Responses');
  console.log('─'.repeat(50));

  codes.forEach(code => {
    console.log(
      String(code.status_code).padEnd(15) +
      String(code.test_count).padEnd(10) +
      code.total_responses
    );
  });
  console.log('');
}

async function searchUrls(pattern, limit) {
  const results = await queries.searchUrlTests(pattern, limit);
  if (results.length === 0) {
    console.log(`No URLs found matching pattern: ${pattern}`);
    return;
  }

  console.log(`\nSearch results for "${pattern}" (${results.length} found):\n`);
  console.log('Domain'.padEnd(35) + 'Status'.padEnd(10) + 'Load (ms)'.padEnd(12) + 'Timestamp');
  console.log('─'.repeat(100));

  results.forEach(result => {
    console.log(
      result.domain.padEnd(35) +
      result.status.padEnd(10) +
      String(result.total_page_load_ms).padEnd(12) +
      result.test_timestamp.toISOString()
    );
  });
  console.log('');
}

// Run CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
