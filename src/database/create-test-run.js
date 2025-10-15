#!/usr/bin/env node
// @ts-check

/**
 * Helper script to create a test run in the database
 * Usage: node src/database/create-test-run.js <totalUrls> <workers> [notes]
 * Outputs: test_run_id or 0 on failure
 */

import { initializePool, closePool } from './client.js';
import { createTestRun } from './ingest.js';

async function main() {
  const totalUrls = parseInt(process.argv[2]) || 0;
  const workers = parseInt(process.argv[3]) || 4;
  const notes = process.argv[4] || 'Parallel test run from test-urls-parallel.sh';

  if (totalUrls === 0) {
    console.error('Error: totalUrls is required');
    process.exit(1);
  }

  try {
    await initializePool();
    const result = await createTestRun(totalUrls, workers, notes);

    if (result) {
      // Output only the ID to stdout for the shell script to capture
      console.log(result.id);
      process.exit(0);
    } else {
      console.error('Failed to create test run - database connection may have failed');
      console.log('0');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error creating test run:', error.message);
    console.error('Stack trace:', error.stack);
    console.log('0');
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
