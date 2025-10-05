#!/usr/bin/env node
// @ts-check

/**
 * Cleanup orphaned test-history directories
 * Removes directories in test-history/ that don't have corresponding database entries
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializePool, closePool, isDatabaseConnected, query } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root (src/database -> ../../)
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const TEST_HISTORY_DIR = path.join(PROJECT_ROOT, 'test-history');

/**
 * Extract directory name from database path
 * Example: /app/test-history/2025-10-05T01-29-35-445Z__authoring.uchicago.edu/screenshot.png
 * Returns: 2025-10-05T01-29-35-445Z__authoring.uchicago.edu
 */
function extractDirNameFromPath(dbPath) {
  const parts = dbPath.split('/');
  const testHistoryIndex = parts.indexOf('test-history');
  if (testHistoryIndex !== -1 && parts.length > testHistoryIndex + 1) {
    return parts[testHistoryIndex + 1];
  }
  return null;
}

/**
 * Get all directory names from database
 * @returns {Promise<Set<string>>} Set of directory names
 */
async function getDirectoryNamesFromDatabase() {
  const sql = `
    SELECT DISTINCT screenshot_path
    FROM domain_tests
  `;

  const result = await query(sql);
  const dirNames = new Set();

  if (result && result.rows) {
    for (const row of result.rows) {
      const dirName = extractDirNameFromPath(row.screenshot_path);
      if (dirName) {
        dirNames.add(dirName);
      }
    }
  }

  return dirNames;
}

/**
 * Get all directory names from filesystem
 * @returns {Promise<string[]>} Array of directory names
 */
async function getDirectoryNamesFromFilesystem() {
  try {
    const entries = await fs.readdir(TEST_HISTORY_DIR, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => !name.startsWith('.')); // Exclude hidden directories
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('test-history directory does not exist. Nothing to clean up.');
      return [];
    }
    throw error;
  }
}

/**
 * Main cleanup function
 * @param {boolean} dryRun - If true, only show what would be deleted
 * @returns {Promise<{deleted: number, kept: number, orphaned: string[]}>}
 */
async function cleanupOrphanedDirectories(dryRun = false) {
  await initializePool();

  if (!isDatabaseConnected()) {
    throw new Error('Database connection failed. Cannot verify directory status.');
  }

  console.log('═'.repeat(70));
  console.log('Test History Cleanup Utility');
  console.log('═'.repeat(70));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no files will be deleted)' : 'LIVE (files will be deleted)'}`);
  console.log('');

  // Get directory lists
  console.log('Scanning database for registered test runs...');
  const dbDirs = await getDirectoryNamesFromDatabase();
  console.log(`✓ Found ${dbDirs.size} directories in database`);

  console.log('Scanning filesystem for test directories...');
  const fsDirs = await getDirectoryNamesFromFilesystem();
  console.log(`✓ Found ${fsDirs.length} directories in filesystem`);
  console.log('');

  // Find orphaned directories
  const orphanedDirs = fsDirs.filter(dirName => !dbDirs.has(dirName));
  const keptDirs = fsDirs.filter(dirName => dbDirs.has(dirName));

  console.log('─'.repeat(70));
  console.log('ANALYSIS RESULTS');
  console.log('─'.repeat(70));
  console.log(`Directories in database:  ${dbDirs.size}`);
  console.log(`Directories in filesystem: ${fsDirs.length}`);
  console.log(`Orphaned (not in DB):     ${orphanedDirs.length}`);
  console.log(`Valid (in DB):            ${keptDirs.length}`);
  console.log('');

  if (orphanedDirs.length === 0) {
    console.log('✓ No orphaned directories found. Everything is clean!');
    console.log('═'.repeat(70));
    return { deleted: 0, kept: keptDirs.length, orphaned: [] };
  }

  console.log('─'.repeat(70));
  console.log('ORPHANED DIRECTORIES (NOT IN DATABASE)');
  console.log('─'.repeat(70));

  let deletedCount = 0;
  for (const dirName of orphanedDirs) {
    const dirPath = path.join(TEST_HISTORY_DIR, dirName);

    if (dryRun) {
      console.log(`[DRY RUN] Would delete: ${dirName}`);
    } else {
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
        console.log(`✓ Deleted: ${dirName}`);
        deletedCount++;
      } catch (error) {
        console.error(`✗ Failed to delete ${dirName}: ${error.message}`);
      }
    }
  }

  console.log('');
  console.log('─'.repeat(70));
  console.log('SUMMARY');
  console.log('─'.repeat(70));

  if (dryRun) {
    console.log(`Would delete: ${orphanedDirs.length} directories`);
    console.log(`Would keep:   ${keptDirs.length} directories`);
    console.log('');
    console.log('Run without --dry-run to actually delete these directories.');
  } else {
    console.log(`Deleted:      ${deletedCount} directories`);
    console.log(`Kept:         ${keptDirs.length} directories`);
    console.log(`Failed:       ${orphanedDirs.length - deletedCount} directories`);
  }

  console.log('═'.repeat(70));

  return {
    deleted: deletedCount,
    kept: keptDirs.length,
    orphaned: orphanedDirs
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Usage: node src/database/cleanup.js [options]

Options:
  --dry-run, -n    Show what would be deleted without actually deleting
  --help, -h       Show this help message

Description:
  Scans the test-history/ directory and removes any directories that don't
  have corresponding entries in the database. This cleans up orphaned test
  results from failed runs or tests created before database integration.

Examples:
  # Preview what would be deleted
  node src/database/cleanup.js --dry-run
  npm run db:cleanup -- --dry-run

  # Actually delete orphaned directories
  node src/database/cleanup.js
  npm run db:cleanup
`);
    process.exit(0);
  }

  try {
    await cleanupOrphanedDirectories(dryRun);
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    await closePool();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { cleanupOrphanedDirectories, getDirectoryNamesFromDatabase, getDirectoryNamesFromFilesystem };
