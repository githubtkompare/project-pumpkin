# Project Pumpkin - AI Assistant Guide

This document provides comprehensive context about Project Pumpkin for AI assistants to provide better support.

## Project Overview

**Project Pumpkin** is a Docker-based web performance testing platform powered
by Playwright and Firefox. It automates website performance testing, captures
screenshots, records network activity, measures load times, and stores all
results in a PostgreSQL database with an interactive web dashboard.

**Project Name:** "Pumpkin" is the name of the cat mascot 🐈
**Version:** 1.0.0
**License:** CC0 1.0 Universal (Public Domain)
**Primary Use:** Internal/trusted network performance monitoring

### Important: Emoji Usage

**Always use 🐈 (cat emoji) when referring to Pumpkin - NEVER use 🎃 (pumpkin emoji).**

Pumpkin is the name of the cat, not a vegetable. The cat emoji should be used in:

- README.md headings and footer
- Any documentation mentioning the mascot
- Any new files or features added to the project

**Never add 🎃 anywhere in the codebase.**

## Project Architecture

### Technology Stack

**Runtime:**

- Node.js (ES Modules)
- Docker & Docker Compose

**Backend:**

- Express.js - Web framework
- PostgreSQL 16 - Database
- pg - PostgreSQL client library

**Testing:**

- Playwright 1.48.2 - Browser automation
- Firefox - Browser engine

**Frontend:**

- Vanilla JavaScript (no framework)
- Static HTML/CSS
- Chart.js (future enhancement)

### Service Architecture

```text
┌─────────────────────────────────────────────────┐
│                Docker Network                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │PostgreSQL│←─│  Node.js │←─│  Playwright  │  │
│  │  :5432   │  │   App    │  │  Container   │  │
│  │          │  │  :3000   │  │ (Interactive)│  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │             │                │          │
└───────┼─────────────┼────────────────┼──────────┘
        │             │                │
    postgres-data  test-history/  test-history/
     (volume)      (bind mount)   (bind mount)
```

### Directory Structure

```text
project-pumpkin/
├── .env.example           # Environment template (DATABASE_URL, passwords)
├── .gitignore            # Git exclusions (.env, test-results/, etc.)
├── .markdownlint.json    # Markdown linting rules
├── docker-compose.yml    # Multi-service orchestration
├── Dockerfile           # Playwright container image
├── package.json         # Node.js dependencies
├── playwright.config.js # Playwright test configuration
├── run-container.sh     # Helper script for interactive testing
├── test-urls.sh         # Sequential URL testing script
├── test-urls-parallel.sh # Parallel URL testing script
│
├── db/
│   ├── init.sql         # Database schema initialization
│   └── migrations/      # Database migrations
│       └── 001_rename_domains_to_urls.sql
│
├── public/              # Web dashboard (static files)
│   ├── index.html       # Home page (test runs list)
│   ├── run-details.html # Test run details
│   ├── url-results.html # URL test results
│   ├── test-detail.html # Individual test details
│   ├── app.js           # Main dashboard logic
│   ├── timezone-toggle.js # UTC/Local toggle component
│   ├── timezone-utils.js  # Timezone conversion utilities
│   └── styles.css       # Dashboard styles
│
├── src/
│   ├── index.js         # Express app entry point
│   ├── database/
│   │   ├── client.js    # PostgreSQL connection pool
│   │   ├── ingest.js    # Test result insertion
│   │   ├── queries.js   # Database query functions
│   │   ├── cli.js       # CLI query tool
│   │   ├── cleanup.js   # Orphaned test cleanup
│   │   ├── create-test-run.js
│   │   ├── update-test-run.js
│   │   └── wait-for-db.js
│   ├── routes/
│   │   └── api.js       # REST API endpoints
│   └── reports/
│       └── generate.js  # Performance report generator
│
├── tests/
│   ├── example.spec.js           # Example test
│   ├── uchicago-screenshot.spec.js # Main screenshot test
│   ├── batch-urls.spec.js        # Batch URL testing
│   ├── test-helpers.js           # Shared test utilities
│   └── urls.txt                  # List of URLs to test
│
├── test-history/        # Test artifacts (screenshots, HAR files)
│   └── YYYY-MM-DDTHH-MM-SS-MMMZ__domain/
│       ├── screenshot.png
│       └── network.har
│
└── Documentation/
    ├── README.md        # Main user guide (beginner-friendly)
    ├── DATABASE.md      # Database schema and queries
    ├── SECURITY.md      # Security best practices
    ├── DOCKER-USAGE.md  # Docker testing guide
    ├── LICENSE          # CC0 1.0 Universal license
    └── CLAUDE.md        # This file
```

## Database Schema

### Tables

**test_runs** - Each execution of test-urls-parallel.sh

- `id` (SERIAL) - Primary key
- `run_uuid` (UUID) - Unique identifier
- `run_timestamp` (TIMESTAMPTZ) - When run started (UTC)
- `total_urls` (INTEGER) - Number of URLs to test
- `parallel_workers` (INTEGER) - Number of parallel workers
- `duration_ms` (INTEGER) - Total duration
- `passed_count`, `failed_count` (INTEGER) - Test counts
- `status` (VARCHAR) - RUNNING, COMPLETED, PARTIAL, FAILED
- `notes` (TEXT) - Optional notes

**url_tests** - Individual URL test results

- `id` (SERIAL) - Primary key
- `test_run_id` (INTEGER) - Foreign key to test_runs
- `test_uuid` (UUID) - Unique identifier
- `test_timestamp` (TIMESTAMPTZ) - When test ran (UTC)
- `url`, `domain` - URL tested and extracted hostname
- `browser`, `user_agent` - Browser info
- `page_title` - Page title
- `status` - PASSED, FAILED, TIMEOUT, ERROR
- `error_message` - Error details if failed
- Performance metrics:
  - `dns_lookup_ms`, `tcp_connection_ms`, `tls_negotiation_ms`
  - `time_to_first_byte_ms`, `response_time_ms`
  - `dom_content_loaded_ms`, `dom_interactive_ms`
  - `total_page_load_ms`
- Resource counts:
  - `total_resources`, `total_transfer_size_bytes`
  - `resources_by_type` (JSONB)
  - `http_response_codes` (JSONB)
- File paths:
  - `screenshot_path`, `har_path`, `report_path`
  - `screenshot_data`, `har_data` (BYTEA, optional)

**http_responses** - Normalized HTTP response codes (alternative to JSONB)
**resource_types** - Normalized resource types (alternative to JSONB)

### Views

- `v_latest_test_run` - Summary of most recent run
- `v_performance_trends` - Performance across all runs
- `v_tests_with_errors` - Tests with 4xx/5xx errors

## API Endpoints

All endpoints return JSON with `{ success: boolean, data: any }` format.

### Test Runs

- `GET /api/test-runs?limit=10` - List all test runs
- `GET /api/test-runs/latest` - Latest test run
- `GET /api/test-runs/:id` - Specific test run
- `GET /api/test-runs/:id/urls` - All URL tests for a run

### URL Tests

- `GET /api/url-tests/:id` - Single URL test details
- `GET /api/url-tests/:id/failed-requests` - Failed HTTP requests for test

### Analytics

- `GET /api/analytics/latest` - Latest run averages
- `GET /api/analytics/slowest?limit=10` - Slowest URLs
- `GET /api/analytics/fastest?limit=10` - Fastest URLs
- `GET /api/analytics/errors?limit=50` - Tests with errors
- `GET /api/analytics/failed-requests?limit=50` - Failed HTTP requests

### Search & Navigation

- `GET /api/dates/available` - Dates with test data
- `GET /api/dates/:date/runs` - Test runs on specific date
- `GET /api/search/urls?q=example` - Search URLs
- `GET /api/search/urls/:url/tests?limit=10` - Tests for specific URL
- `GET /api/analytics/daily-load-times?days=30` - Daily average load times

### Timezone Support

All timestamp endpoints accept optional `timezone` query parameter:

```bash
GET /api/test-runs?timezone=America/Chicago
GET /api/test-runs?timezone=Europe/London
GET /api/test-runs?timezone=Asia/Tokyo
```

### Health Check

- `GET /health` - Service and database health status

## Environment Variables

**Required:**

- `DATABASE_URL` - PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Container: `postgresql://pumpkin:password@postgres:5432/playwright_metrics`
  - Host: `postgresql://pumpkin:password@localhost:5432/playwright_metrics`

**Optional:**

- `NODE_ENV` - Environment (development/production)
- `PORT` - Web server port (default: 3000)
- `TEST_URL` - URL to test in Playwright (default: <https://www.uchicago.edu/>)

**PostgreSQL:**

- `POSTGRES_USER` - Database username (default: pumpkin)
- `POSTGRES_PASSWORD` - Database password (SET IN .env!)
- `POSTGRES_DB` - Database name (default: playwright_metrics)

## npm Scripts

```bash
# Application
npm start              # Start web server
npm run dev            # Start with auto-reload

# Docker
npm run docker:build   # Build Docker image
npm run docker:shell   # Interactive Playwright shell
npm run docker:test    # Run single test (non-interactive)
npm run docker:compose # Start all services

# Database
npm run db:query <command>  # Run queries (see below)
npm run db:report          # Generate performance report
npm run db:cleanup         # Remove orphaned test directories

# Testing
npm test               # Run Playwright tests locally
```

## Database CLI Commands

```bash
npm run db:query latest              # Latest test run summary
npm run db:query runs 10             # Last 10 test runs
npm run db:query urls 123            # URLs for test run ID 123
npm run db:query trend www.uchicago.edu 10  # Performance trend
npm run db:query errors              # Tests with errors
npm run db:query 404s                # URLs with 404 errors
npm run db:query failed-requests 20  # HTTP 400+ failed requests
npm run db:query slowest 10          # Slowest URLs
npm run db:query fastest 10          # Fastest URLs
npm run db:query compare 10 9        # Compare two test runs
npm run db:query averages            # Average metrics
npm run db:query codes               # HTTP status codes
npm run db:query search "%example%"  # Search URLs
npm run db:query help                # Show all commands
```

## Testing Workflows

### Single URL Test

```bash
# Start services
docker-compose up -d

# Run interactive test
docker-compose run --rm playwright
> npx playwright test --project=firefox
> TEST_URL=https://example.com npx playwright test --project=firefox
> exit
```

### Batch URL Test (Parallel)

```bash
# Edit URL list
nano tests/urls.txt

# Run parallel tests (4 workers default)
docker-compose run --rm playwright ./test-urls-parallel.sh

# Run with more workers
docker-compose run --rm playwright ./test-urls-parallel.sh 8
```

### View Results

```bash
# Dashboard
http://localhost:3000

# CLI
npm run db:report
npm run db:query latest

# Database
docker exec -it project-pumpkin-db psql -U pumpkin -d playwright_metrics
```

## Key Features

### ✅ Implemented

- Automated website testing with Playwright + Firefox
- Full-page screenshots
- HAR file network recording
- Comprehensive performance metrics (DNS, TCP, TLS, TTFB, page load)
- PostgreSQL database storage with triggers and views
- Interactive web dashboard with charts
- REST API with timezone support
- UTC/Local timezone toggle on all pages
- Failed request details with status categorization
- Parallel test execution (configurable workers)
- Database cleanup utility for orphaned tests
- CLI query tool with 15+ commands
- Performance report generator
- Docker Compose orchestration
- Health checks for all services
- Persistent volumes for data
- Comprehensive documentation

### 🔒 Security Status

**Current (Development):**

- ❌ No authentication
- ❌ No rate limiting
- ❌ No CORS restrictions
- ✅ Parameterized SQL queries (injection-safe)
- ✅ Environment variable management
- ✅ .env file excluded from git

**Production Requirements:**

- Add authentication (OAuth2, basic auth, API keys)
- Add rate limiting (express-rate-limit)
- Add security headers (helmet.js)
- Configure CORS
- Use reverse proxy (nginx/Caddy/Traefik)
- Enable HTTPS with Let's Encrypt
- Use Docker Secrets instead of .env
- Bind PostgreSQL to localhost only
- Enable database SSL/TLS

See [SECURITY.md](SECURITY.md) for comprehensive security guidance.

### 🔄 Potential Enhancements

- [ ] Authentication and authorization
- [ ] TimescaleDB extension for time-series optimization
- [ ] Automated data retention policies (cleanup exists, automation pending)
- [ ] Performance alerting thresholds
- [ ] GraphQL API
- [ ] Export to CSV/JSON
- [ ] Real-time test monitoring
- [ ] Performance regression detection
- [ ] Custom report templates
- [ ] Lighthouse integration
- [ ] Multi-browser support (Chrome, WebKit)
- [ ] Screenshot comparison (visual regression)
- [ ] Accessibility testing integration
- [ ] CI/CD pipeline examples

## Common Development Tasks

### Adding a New API Endpoint

1. Define route in [src/routes/api.js](src/routes/api.js)
2. Add query function in [src/database/queries.js](src/database/queries.js)
3. Test with curl or dashboard
4. Update this documentation

### Adding a New Database Query

1. Add function to [src/database/queries.js](src/database/queries.js)
2. Add command to [src/database/cli.js](src/database/cli.js)
3. Test with `npm run db:query`
4. Update [DATABASE.md](DATABASE.md)

### Adding a Dashboard Page

1. Create HTML file in [public/](public/)
2. Create JS file in [public/](public/)
3. Add navigation links
4. Use timezone-utils.js for timestamp formatting
5. Follow existing patterns from app.js

### Modifying Database Schema

1. Create migration in [db/migrations/](db/migrations/)
2. Update [db/init.sql](db/init.sql) for new installations
3. Test with fresh database (`docker-compose down -v && docker-compose up`)
4. Update [DATABASE.md](DATABASE.md) documentation

### Adding a New Test

1. Create spec file in [tests/](tests/)
2. Use test-helpers.js for database integration
3. Follow pattern from uchicago-screenshot.spec.js
4. Test with `docker-compose run --rm playwright npx playwright test`

## Testing Against This Codebase

### File Reading Best Practices

When asked about the codebase:

1. Always read files directly rather than guessing
2. Check [package.json](package.json) for dependencies and scripts
3. Check [docker-compose.yml](docker-compose.yml) for service configuration
4. Check [db/init.sql](db/init.sql) for current schema
5. Check [src/database/queries.js](src/database/queries.js) for available queries

### Common User Questions

**"How do I run tests?"**
→ See [DOCKER-USAGE.md](DOCKER-USAGE.md) or [README.md](README.md) Quick Start

**"How do I view results?"**
→ Dashboard: <http://localhost:3000>, CLI: `npm run db:query latest`

**"Database won't connect"**
→ Check [DOCKER-USAGE.md](DOCKER-USAGE.md) Troubleshooting → Database connection failed

**"How do I add URLs to test?"**
→ Edit [tests/urls.txt](tests/urls.txt), one URL per line

**"How do I deploy to production?"**
→ See [SECURITY.md](SECURITY.md) Production Deployment sections

**"How do I backup the database?"**
→ See [DATABASE.md](DATABASE.md) Maintenance → Backup Database

**"Tests are slow"**
→ Increase parallel workers: `./test-urls-parallel.sh 8`

**"What's the license?"**
→ CC0 1.0 Universal (public domain) - see [LICENSE](LICENSE)

## Important Notes for AI Assistants

### Things to NEVER Do

1. **Don't commit .env files** - These contain secrets
2. **Don't use references** - This project has NO references to that AI assistant tool
3. **Don't add authentication without asking** - This changes the user's workflow
4. **Don't modify docker-compose.yml ports without warning** - May break existing setups
5. **Don't suggest dropping database tables casually** - Data loss risk
6. **Don't recommend force-pushing to main** - Destructive
7. **Don't add heavy dependencies** - Keep the stack minimal

### Things to ALWAYS Do

1. **Read files before editing** - Don't guess content
2. **Test SQL queries are valid** - Check syntax
3. **Preserve existing patterns** - Match code style
4. **Update documentation** - Keep docs in sync with code
5. **Consider backward compatibility** - Don't break existing workflows
6. **Mention security implications** - For production changes
7. **Check for existing solutions** - Before adding new dependencies

### Code Style Preferences

- **ES Modules** (import/export, not require)
- **Async/await** (not callbacks or raw promises)
- **Template literals** for strings with variables
- **Destructuring** where appropriate
- **JSDoc comments** for functions
- **Parameterized queries** (never string concatenation for SQL)
- **Early returns** for error handling
- **Minimal dependencies** - Only add when truly needed

### Documentation Standards

- All Markdown files must pass markdownlint
- Use `[link text](relative/path.md)` for internal links
- Keep lines under 80 characters (where reasonable)
- Use fenced code blocks with language identifiers
- Include practical examples in documentation
- Cross-reference related documents

## Project Context & History

### Design Decisions

**Why PostgreSQL?**

- JSONB for flexible HTTP response/resource storage
- TIMESTAMPTZ for timezone-aware timestamps
- Triggers for automatic count updates
- GIN indexes for JSONB queries
- Robust, mature, well-documented

**Why Playwright?**

- Modern browser automation
- Excellent HAR file support
- Built-in network interception
- Active development and support
- Firefox support for diverse testing

**Why Docker Compose?**

- Consistent environments
- Easy multi-service orchestration
- Portable across platforms
- Production-ready with minimal changes
- Health check support

**Why Vanilla JS for Frontend?**

- No build step required
- Fast page loads
- Easy to understand and modify
- Reduces supply chain risk
- Sufficient for current needs

**Why CC0 License?**

- Maximum freedom for users
- No attribution required
- True public domain dedication
- Encourages forking and modification

### Naming Conventions

- **test_runs** - Execution of test-urls-parallel.sh
- **url_tests** - Individual URL test results (formerly domain_tests)
- **test-history/** - Directory for test artifacts
- **Test run** - Batch execution with multiple URLs
- **URL test** - Single URL test result
- **Test ID** - Database ID for url_tests table
- **Run ID** - Database ID for test_runs table

### Migration Notes

**2025-01:** Renamed domains → urls throughout codebase

- Table remains `url_tests` (migration handled in db/migrations/)
- Scripts renamed: test-domains-parallel.sh → test-urls-parallel.sh
- API endpoints use "urls" terminology
- Documentation updated consistently

## Troubleshooting Guide for AI Assistants

### User Reports "Tests Not Saving"

1. Check DATABASE_URL is set in .env
2. Verify PostgreSQL container is running: `docker-compose ps`
3. Check database logs: `docker-compose logs postgres`
4. Test connection: `npm run db:query latest`
5. Check for test-helpers.js database integration in test files

### User Reports "Dashboard Shows No Data"

1. Verify app container is running: `docker-compose ps`
2. Check API endpoints: `curl http://localhost:3000/api/runs`
3. Check browser console for errors
4. Verify data exists in database: `npm run db:query runs 10`
5. Check for CORS issues if accessing from different host

### User Reports "Can't Access Dashboard"

1. Check if app is running: `docker-compose ps app`
2. Verify port 3000 is available: `lsof -i :3000`
3. Check firewall rules
4. Try from localhost first
5. Check app logs: `docker-compose logs app`

### User Reports "Database Connection Failed"

1. Check .env file exists and has correct DATABASE_URL
2. Wait 30 seconds after starting (initialization time)
3. Check PostgreSQL health: `docker exec project-pumpkin-db pg_isready`
4. Verify password matches in all .env locations
5. Check network connectivity between containers

## Quick Reference

### File Locations

- **Database Schema:** [db/init.sql](db/init.sql)
- **API Routes:** [src/routes/api.js](src/routes/api.js)
- **Database Queries:** [src/database/queries.js](src/database/queries.js)
- **Test Configuration:** [playwright.config.js](playwright.config.js)
- **Main Test:** [tests/uchicago-screenshot.spec.js](tests/uchicago-screenshot.spec.js)
- **Docker Config:** [docker-compose.yml](docker-compose.yml), [Dockerfile](Dockerfile)
- **Environment Template:** [.env.example](.env.example)

### External Resources

- **Playwright Docs:** <https://playwright.dev>
- **PostgreSQL Docs:** <https://www.postgresql.org/docs/>
- **Express.js Docs:** <https://expressjs.com>
- **Docker Docs:** <https://docs.docker.com>

---

**Last Updated:** 2025-10-05

**Maintained By:** Project Pumpkin Team

**For Questions:** See [README.md](README.md) or project documentation

This document should be updated whenever major features are added, architecture
changes, or significant design decisions are made.
