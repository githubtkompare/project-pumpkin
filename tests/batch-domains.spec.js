// @ts-check
import { test } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { runWebsiteTest } from './test-helpers.js';

// Read domains from domains.txt file (using sync read to avoid top-level await)
const domainsFilePath = path.join(process.cwd(), 'tests', 'domains.txt');
const domainsContent = readFileSync(domainsFilePath, 'utf-8');
const domains = domainsContent
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0);

console.log(`Loaded ${domains.length} domains from domains.txt`);

// Create a test for each domain
test.describe('Batch Domain Screenshot Tests', () => {
  for (const domain of domains) {
    test(`Test domain: ${domain}`, async ({ browser }) => {
      // Set test timeout to 2 minutes for slow-loading pages
      test.setTimeout(120000);

      const url = `https://${domain}`;
      await runWebsiteTest(browser, url);
    });
  }
});
