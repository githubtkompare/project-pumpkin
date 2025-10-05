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

# View performance metrics and reports (from database)
npm run db:report                # Full performance report
npm run db:query latest          # Latest test run summary
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
│   └── network.har       # Network activity (HAR file)
└── 2025-10-03T22-31-45-789Z__www.google.com/
    ├── screenshot.png
    └── network.har
```

All performance metrics and test summaries are stored in PostgreSQL and can be accessed via:
- `npm run db:report` - Comprehensive performance report
- `npm run db:query latest` - Latest test run summary
- `npm run db:query slowest 10` - 10 slowest domains
- `npm run db:query errors` - Tests with errors

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
docker-compose up -d app
```

### Testing the Dockerized App

**Important**: When testing the app from inside the Playwright container, use `http://app:3000` (the service name), not `http://localhost:3000`:

```bash
# Correct - uses Docker service name
TEST_URL=http://app:3000 docker-compose run --rm playwright npx playwright test --project=firefox

# Wrong - localhost refers to inside the Playwright container, not the app
TEST_URL=http://localhost:3000 npm run docker:test  # This will fail!
```

**Why `http://app:3000`?**
Docker Compose creates a network where services communicate by service name. The app runs in a service called `app`, so other containers access it at `http://app:3000`.

### Testing from Your Local Machine

If you have Playwright installed locally (outside Docker), you can test the Dockerized app using localhost:

```bash
# App is running in Docker, Playwright runs locally
TEST_URL=http://localhost:3000 npx playwright test --project=firefox
```

## Benefits of This Setup

✅ **Fully Portable** - Works on any machine with Docker
✅ **Self-Contained** - No local Playwright/browser installation needed
✅ **Interactive** - Run multiple tests in one session
✅ **Persistent Results** - All outputs saved to local filesystem
✅ **Flexible URLs** - Test any website easily
✅ **Consistent Environment** - Same setup everywhere (dev, CI, prod)
