#!/usr/bin/env node
// @ts-check

/**
 * Database connectivity check script
 * Waits for database to be ready before proceeding
 * Usage: node src/database/wait-for-db.js [timeout_seconds]
 */

import { initializePool, closePool, isDatabaseConnected } from './client.js';

async function waitForDatabase(timeoutSeconds = 30) {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;

  console.error('⏳ Waiting for database connection...');

  while (Date.now() - startTime < timeoutMs) {
    try {
      await initializePool();

      if (isDatabaseConnected()) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`✓ Database connection established (${elapsed}s)`);
        await closePool();
        return true;
      }
    } catch (error) {
      // Continue waiting
    }

    // Wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`✗ Database connection failed after ${elapsed}s`);
  await closePool();
  return false;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const timeoutSeconds = parseInt(process.argv[2]) || 30;

  waitForDatabase(timeoutSeconds)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

export { waitForDatabase };
