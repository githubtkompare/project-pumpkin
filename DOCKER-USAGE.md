# Docker Interactive Testing Guide

## Overview

Project Pumpkin uses Docker Compose to orchestrate multiple services:
- **PostgreSQL** - Database for storing test results and metrics
- **App** - Node.js web server for dashboard and API
- **Playwright** - Interactive testing environment with Firefox

All services communicate via a private Docker network and share data through persistent volumes.

## Quick Start

### 1. Build the Docker Image (First Time Only)
```bash
npm run docker:build
```
This creates a self-contained Docker image with Playwright, Firefox, and all dependencies.

### 2. Start Services
```bash
docker-compose up -d
```
This starts the PostgreSQL database and web application in the background.

### 3. Start Interactive Shell
```bash
npm run docker:shell
```

This opens an interactive bash shell inside the Docker container where you can run tests. The database and app services must be running first.

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

**File System:**
```bash
# List all test runs
ls -la test-history/

# View a specific test directory
ls -la test-history/2025-10-05T14-30-22-123Z__www.example.com/
```

**Database Queries:**
```bash
# Full performance report
npm run db:report

# Latest test run summary
npm run db:query latest

# Show all recent test runs
npm run db:query runs 10

# Show URL tests for a specific run ID
npm run db:query urls 123

# Performance trend for a domain
npm run db:query trend www.uchicago.edu 10

# Show tests with errors
npm run db:query errors

# Show slowest domains
npm run db:query slowest 10

# Show failed HTTP requests (400+)
npm run db:query failed-requests 20

# Help - show all available commands
npm run db:query help
```

**Web Dashboard:**
```bash
# Open in your browser
http://localhost:3000
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
Test run directory: /app/test-history/2025-10-05T22-30-15-123Z__www.uchicago.edu
Starting test run ID: 42
✓  Website Screenshot Test > navigate to website and capture full page screenshot (5.2s)

root@abc123:/app# TEST_URL=https://www.google.com npx playwright test --project=firefox
Test run directory: /app/test-history/2025-10-05T22-31-45-789Z__www.google.com
Starting test run ID: 43
✓  Website Screenshot Test > navigate to website and capture full page screenshot (3.1s)

root@abc123:/app# ls test-history/
2025-10-05T22-30-15-123Z__www.uchicago.edu
2025-10-05T22-31-45-789Z__www.google.com

root@abc123:/app# npm run db:query latest
═══════════════════════════════════════════════════════════════════════
LATEST TEST RUN
═══════════════════════════════════════════════════════════════════════
ID:                 43
Status:             COMPLETED
Total URLs:         1
Tests Completed:    1
Passed:             1
Failed:             0
Avg Page Load:      1245.67ms
Avg TTFB:           324.12ms
═══════════════════════════════════════════════════════════════════════

root@abc123:/app# exit
```

## Test Results Structure

Each test run creates a timestamped directory:

```
test-history/
├── 2025-10-05T22-30-15-123Z__www.uchicago.edu/
│   ├── screenshot.png    # Full-page screenshot
│   └── network.har       # Network activity (HAR file)
└── 2025-10-05T22-31-45-789Z__www.google.com/
    ├── screenshot.png
    └── network.har
```

**Performance metrics** are stored in PostgreSQL and accessible via:
- `npm run db:report` - Comprehensive performance report
- `npm run db:query latest` - Latest test run summary
- `npm run db:query urls <run-id>` - All URLs in a test run
- `npm run db:query slowest 10` - 10 slowest domains
- `npm run db:query errors` - Tests with errors
- `npm run db:query failed-requests` - HTTP 400+ errors with details
- Dashboard at http://localhost:3000 - Interactive web interface

## Docker Compose Services

### Service Architecture

```yaml
services:
  postgres:      # PostgreSQL database
    - Port: 5432
    - Volume: postgres-data (persistent)
    - Health check: pg_isready
    - Restarts: unless-stopped

  app:           # Node.js web application
    - Port: 3000
    - Depends on: postgres (healthy)
    - Dashboard and API endpoints
    - Restarts: unless-stopped

  playwright:    # Interactive testing environment
    - No persistent process
    - Interactive shell (docker-compose run)
    - Access to database and test-history
    - Depends on: postgres, app
```

### Health Checks

Check service status:
```bash
# View all services
docker-compose ps

# Check database health
docker exec project-pumpkin-db pg_isready -U pumpkin

# Check app logs
docker-compose logs app

# Check database logs
docker-compose logs postgres
```

## Volume Management

### Persistent Volumes

Project Pumpkin uses two persistent volumes:

1. **postgres-data** - Database storage
   ```bash
   # View volume info
   docker volume inspect project-pumpkin_postgres-data

   # Backup volume (see DATABASE.md for full instructions)
   docker exec project-pumpkin-db pg_dump -U pumpkin playwright_metrics > backup.sql
   ```

2. **test-history/** - Test artifacts (mounted from host)
   ```bash
   # View size
   du -sh test-history/

   # Clean old tests
   npm run db:cleanup --dry-run  # Preview
   npm run db:cleanup            # Delete orphaned directories
   ```

### Volume Cleanup

**Remove all data (⚠️ destructive):**
```bash
# Stop all services
docker-compose down

# Remove volumes (deletes database!)
docker-compose down -v

# Remove test-history (deletes screenshots/HAR files!)
rm -rf test-history/
```

## Database Integration

### Environment Variables

The Playwright container needs `DATABASE_URL` to store results:

```bash
# Set in .env file (automatically loaded by docker-compose)
DATABASE_URL=postgresql://pumpkin:your_password@postgres:5432/playwright_metrics
```

**Note:** The hostname is `postgres` (the service name in docker-compose.yml), not `localhost`.

### Direct Database Access

**From host machine:**
```bash
docker exec -it project-pumpkin-db psql -U pumpkin -d playwright_metrics
```

**From Playwright container:**
```bash
psql $DATABASE_URL
```

**Common queries:**
```sql
-- Show all tables
\dt

-- Show recent test runs
SELECT id, run_timestamp, status, total_urls, passed_count, failed_count
FROM test_runs
ORDER BY run_timestamp DESC
LIMIT 10;

-- Show tests for specific domain
SELECT test_timestamp, total_page_load_ms, time_to_first_byte_ms, status
FROM url_tests
WHERE domain = 'www.uchicago.edu'
ORDER BY test_timestamp DESC
LIMIT 5;

-- Exit
\q
```

## Troubleshooting

### Container won't start
```bash
# Rebuild the image
docker-compose build --no-cache

# Check for port conflicts
lsof -i :3000  # macOS/Linux
lsof -i :5432

# View build logs
docker-compose build
```

### Database connection failed

**Symptoms:** Tests run but don't save to database, app shows "database: disconnected"

**Solutions:**

1. Check if database is running:
   ```bash
   docker-compose ps postgres
   docker exec project-pumpkin-db pg_isready -U pumpkin
   ```

2. Verify DATABASE_URL in .env:
   ```bash
   grep DATABASE_URL .env
   # Should be: postgresql://pumpkin:password@postgres:5432/playwright_metrics
   ```

3. Wait for database to initialize (first startup takes 10-30 seconds):
   ```bash
   docker-compose logs -f postgres
   # Wait for "database system is ready to accept connections"
   ```

4. Restart services:
   ```bash
   docker-compose restart
   ```

### Can't see test results
```bash
# Verify volume mount
docker-compose run --rm playwright ls -la test-history/

# Check database has data
docker exec project-pumpkin-db psql -U pumpkin -d playwright_metrics \
  -c "SELECT COUNT(*) FROM url_tests;"

# Check app is running
curl http://localhost:3000/health
```

### Tests fail
```bash
# Run with debug output
docker-compose run --rm playwright npx playwright test --project=firefox --debug

# Check test logs
docker-compose run --rm playwright npx playwright test --project=firefox --reporter=list

# Verify Firefox is installed
docker-compose run --rm playwright npx playwright install --dry-run firefox
```

### Port 3000 or 5432 already in use

**Find what's using the port:**
```bash
# macOS/Linux
lsof -i :3000
lsof -i :5432

# Windows
netstat -ano | findstr :3000
```

**Solutions:**

1. Stop conflicting service
2. Change port in docker-compose.yml:
   ```yaml
   ports:
     - "3001:3000"  # Change external port
   ```

### "Permission denied" errors

**On Linux:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, then test
docker ps
```

### Services keep restarting

```bash
# View logs
docker-compose logs --tail=50 -f

# Check resource usage
docker stats

# Increase Docker resources (Docker Desktop settings)
# Recommended: 4GB RAM, 2 CPUs minimum
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

## Available npm Scripts

All scripts can be run from the host machine:

```bash
# Docker operations
npm run docker:build      # Build Docker image
npm run docker:shell      # Start interactive Playwright shell
npm run docker:test       # Run single test (non-interactive)
npm run docker:compose    # Start all services (same as docker-compose up)

# Database operations
npm run db:query <cmd>    # Run database queries (see examples above)
npm run db:report         # Generate comprehensive performance report
npm run db:cleanup        # Remove orphaned test directories

# Application
npm start                 # Start app locally (requires local Node.js)
npm run dev               # Start app with auto-reload (development)
npm test                  # Run Playwright tests locally (requires Playwright)
```

## Timezone Support

The web dashboard and API support timezone conversion:

**Web Dashboard:**
- Toggle between UTC and local time on all pages
- Preference saved in browser localStorage
- Automatic timezone detection

**API:**
```bash
# Get runs in UTC (default)
curl http://localhost:3000/api/runs

# Get runs in specific timezone
curl http://localhost:3000/api/runs?timezone=America/Chicago
curl http://localhost:3000/api/runs?timezone=Europe/London
curl http://localhost:3000/api/runs?timezone=Asia/Tokyo
```

**Database:**
All timestamps stored as `TIMESTAMPTZ` (UTC) for consistency.

## Benefits of This Setup

✅ **Fully Portable** - Works on any machine with Docker
✅ **Self-Contained** - No local Playwright/browser installation needed
✅ **Interactive** - Run multiple tests in one session
✅ **Persistent Results** - All outputs saved to local filesystem and database
✅ **Flexible URLs** - Test any website easily
✅ **Consistent Environment** - Same setup everywhere (dev, CI, prod)
✅ **Database Integration** - Track metrics over time, compare runs
✅ **Web Dashboard** - Visualize results with charts and graphs
✅ **Service Isolation** - Database, app, and tests in separate containers
✅ **Health Monitoring** - Automatic health checks for all services
