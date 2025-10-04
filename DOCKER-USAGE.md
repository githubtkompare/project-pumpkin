# Docker Interactive Testing Guide

## Quick Start

### 1. Build the Docker Image (First Time Only)
```bash
npm run docker:build
```
This creates a self-contained Docker image with Playwright, Firefox, and all dependencies.

### 2. Start Interactive Shell
```bash
npm run docker:shell
```

This opens an interactive bash shell inside the Docker container where you can run tests.

## Inside the Container

Once you're in the container (you'll see a prompt like `root@abc123:/app#`), you can run:

### Run Tests

**Default URL (UChicago):**
```bash
npx playwright test --project=firefox
```

**Custom URL:**
```bash
TEST_URL=https://www.google.com npx playwright test --project=firefox
```

**Set URL for Multiple Tests:**
```bash
export TEST_URL=https://www.anthropic.com
npx playwright test --project=firefox
# URL is remembered for subsequent tests
```

### View Results

```bash
# List all test runs
ls -la test-history/

# View a specific report
cat test-history/2025-10-03T22-30-15-123Z__www.uchicago.edu/report.txt

# View latest report
cat test-history/$(ls -t test-history/ | head -1)/report.txt
```

### Exit Container

```bash
exit
```

All test results are saved to your local `test-history/` directory!

## Alternative Methods

### Method 1: Using Helper Script

```bash
# Default URL
./run-container.sh

# Custom URL
./run-container.sh https://www.anthropic.com
```

### Method 2: Using Docker Compose Directly

```bash
# Default URL
docker-compose run --rm playwright

# With custom URL
TEST_URL=https://www.google.com docker-compose run --rm playwright
```

### Method 3: Quick Test (Non-Interactive)

```bash
# Run test and exit
npm run docker:test

# With custom URL
TEST_URL=https://www.github.com npm run docker:test
```

## Example Interactive Session

```bash
$ npm run docker:shell

> docker-compose run --rm playwright

root@abc123:/app# npx playwright test --project=firefox
Test run directory: /app/test-history/2025-10-03T22-30-15-123Z__www.uchicago.edu
✓  Website Screenshot Test > navigate to website and capture full page screenshot

root@abc123:/app# TEST_URL=https://www.google.com npx playwright test --project=firefox
Test run directory: /app/test-history/2025-10-03T22-31-45-789Z__www.google.com
✓  Website Screenshot Test > navigate to website and capture full page screenshot

root@abc123:/app# ls test-history/
2025-10-03T22-30-15-123Z__www.uchicago.edu
2025-10-03T22-31-45-789Z__www.google.com

root@abc123:/app# exit
```

## Test Results Structure

Each test run creates a timestamped directory:

```
test-history/
├── 2025-10-03T22-30-15-123Z__www.uchicago.edu/
│   ├── screenshot.png    # Full-page screenshot
│   ├── network.har       # Network activity (HAR file)
│   └── report.txt        # Performance metrics
└── 2025-10-03T22-31-45-789Z__www.google.com/
    ├── screenshot.png
    ├── network.har
    └── report.txt
```

## Troubleshooting

### Container won't start
```bash
# Rebuild the image
docker build -t project-pumpkin . --no-cache
```

### Can't see test results
```bash
# Verify volume mount
docker-compose run --rm playwright ls -la test-history/
```

### Tests fail
```bash
# Run with debug output
docker-compose run --rm playwright npx playwright test --project=firefox --debug
```

## Running the Node.js App

If you need to run the Node.js app alongside tests:

```bash
# Start app service
docker-compose up app

# In another terminal, run tests against it
TEST_URL=http://localhost:3000 npm run docker:test
```

## Benefits of This Setup

✅ **Fully Portable** - Works on any machine with Docker
✅ **Self-Contained** - No local Playwright/browser installation needed
✅ **Interactive** - Run multiple tests in one session
✅ **Persistent Results** - All outputs saved to local filesystem
✅ **Flexible URLs** - Test any website easily
✅ **Consistent Environment** - Same setup everywhere (dev, CI, prod)
