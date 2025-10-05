#!/usr/bin/env node
// @ts-check

/**
 * Helper script to update a test run status in the database
 * Usage: node src/database/update-test-run.js <testRunId> <status> <durationMs>
 * Status: COMPLETED, PARTIAL, FAILED
 */

import { initializePool, closePool } from './client.js';
import { updateTestRun } from './ingest.js';

async function main() {
  const testRunId = parseInt(process.argv[2]);
  const status = process.argv[3] || 'COMPLETED';
  const durationMs = parseInt(process.argv[4]) || null;

  if (!testRunId || testRunId === 0) {
    console.error('Error: testRunId is required', { stdio: 'inherit' });
    process.exit(1);
  }

  if (!['RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'].includes(status)) {
    console.error(`Error: Invalid status '${status}'. Must be RUNNING, COMPLETED, PARTIAL, or FAILED`, { stdio: 'inherit' });
    process.exit(1);
  }

  try {
    await initializePool();
    const success = await updateTestRun(testRunId, status, durationMs);

    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error updating test run:', error.message, { stdio: 'inherit' });
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
