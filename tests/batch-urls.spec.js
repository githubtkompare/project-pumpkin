// @ts-check
import { test } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { runWebsiteTest } from './test-helpers.js';

// Read URLs from urls.txt file (using sync read to avoid top-level await)
const urlsFilePath = path.join(process.cwd(), 'tests', 'urls.txt');
const urlsContent = readFileSync(urlsFilePath, 'utf-8');
const urls = urlsContent
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0);

console.log(`Loaded ${urls.length} URLs from urls.txt`);

// Create a test for each URL
test.describe('Batch URL Screenshot Tests', () => {
  for (const url of urls) {
    test(`Test URL: ${url}`, async ({ browser }) => {
      // Set test timeout to 2 minutes for slow-loading pages
      test.setTimeout(120000);

      await runWebsiteTest(browser, url);
    });
  }
});
