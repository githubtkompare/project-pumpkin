# Database Documentation

Project Pumpkin uses PostgreSQL to store and analyze Playwright test metrics, including performance data, screenshots, and HAR files.

## Architecture

- **Database**: PostgreSQL 16 (Alpine)
- **Connection**: Managed via connection pooling with automatic retry
- **Storage**: Persistent volume (`postgres-data`) for data durability
- **Initialization**: Automated schema creation via `db/init.sql`

## Database Schema

### Tables

#### `test_runs`
Represents each execution of `test-domains-parallel.sh`

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| run_uuid | UUID | Unique identifier for this run |
| run_timestamp | TIMESTAMPTZ | When the run started |
| total_domains | INTEGER | Number of domains to test |
| parallel_workers | INTEGER | Number of parallel workers used |
| duration_ms | INTEGER | Total duration in milliseconds |
| passed_count | INTEGER | Number of passed tests |
| failed_count | INTEGER | Number of failed tests |
| status | VARCHAR(20) | RUNNING, COMPLETED, PARTIAL, FAILED |
| notes | TEXT | Optional notes about this run |

#### `domain_tests`
Individual domain test results within a test run

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| test_run_id | INTEGER | Foreign key to test_runs |
| test_uuid | UUID | Unique identifier for this test |
| test_timestamp | TIMESTAMPTZ | When the test ran |
| url | VARCHAR(2048) | Full URL tested |
| domain | VARCHAR(512) | Domain name |
| browser | VARCHAR(50) | Browser used (e.g., 'firefox') |
| user_agent | TEXT | Browser user agent |
| page_title | TEXT | Page title |
| test_duration_ms | INTEGER | Total test duration |
| scroll_duration_ms | INTEGER | Auto-scroll duration |
| status | VARCHAR(20) | PASSED, FAILED, TIMEOUT, ERROR |
| dns_lookup_ms | DECIMAL(10,2) | DNS lookup time |
| tcp_connection_ms | DECIMAL(10,2) | TCP connection time |
| tls_negotiation_ms | DECIMAL(10,2) | TLS handshake time |
| time_to_first_byte_ms | DECIMAL(10,2) | TTFB |
| response_time_ms | DECIMAL(10,2) | Response download time |
| dom_content_loaded_ms | DECIMAL(10,2) | DOM content loaded event |
| dom_interactive_ms | DECIMAL(10,2) | DOM interactive time |
| total_page_load_ms | DECIMAL(10,2) | Total page load time |
| doc_transfer_size_bytes | BIGINT | Document transfer size |
| doc_encoded_size_bytes | BIGINT | Document encoded size |
| doc_decoded_size_bytes | BIGINT | Document decoded size |
| total_resources | INTEGER | Number of resources loaded |
| total_transfer_size_bytes | BIGINT | Total transfer size |
| total_encoded_size_bytes | BIGINT | Total encoded size |
| resources_by_type | JSONB | Resource counts by type |
| http_response_codes | JSONB | HTTP response code counts |
| screenshot_path | TEXT | Path to screenshot file |
| har_path | TEXT | Path to HAR file |
| report_path | TEXT | Path to report file |
| screenshot_data | BYTEA | Optional: screenshot binary data |
| har_data | BYTEA | Optional: HAR binary data |

#### `http_responses`
Normalized HTTP response codes (alternative to JSONB)

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| domain_test_id | INTEGER | Foreign key to domain_tests |
| status_code | INTEGER | HTTP status code (200, 404, etc.) |
| response_count | INTEGER | Number of responses with this code |

#### `resource_types`
Normalized resource types (alternative to JSONB)

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| domain_test_id | INTEGER | Foreign key to domain_tests |
| resource_type | VARCHAR(50) | Resource type (script, img, css, etc.) |
| resource_count | INTEGER | Number of resources of this type |

### Views

#### `v_latest_test_run`
Summary of the most recent test run with aggregated statistics

#### `v_performance_trends`
Performance metrics for all domains across all runs for trend analysis

#### `v_tests_with_errors`
All tests that have 4xx/5xx HTTP responses or failed status

## Database Connection

The database connection is configured via the `DATABASE_URL` environment variable:

```
DATABASE_URL=postgresql://pumpkin:pumpkin_password@postgres:5432/playwright_metrics
```

### Connection Features:
- **Automatic retry**: 5 attempts with 2-second delays
- **Connection pooling**: Max 20 connections
- **Graceful degradation**: Tests continue even if database is unavailable
- **Health checks**: Automatic connection validation

## Querying the Database

### CLI Tool

Use the built-in CLI tool for common queries:

```bash
# Show latest test run
npm run db:query latest

# Show all recent test runs
npm run db:query runs 10

# Show domain tests for a specific run
npm run db:query domains 123

# Show performance trend for a domain
npm run db:query trend www.uchicago.edu 10

# Show tests with errors
npm run db:query errors

# Show domains with 404 errors
npm run db:query 404s

# Show slowest domains
npm run db:query slowest 10

# Compare two test runs
npm run db:query compare 10 9

# Search for domains
npm run db:query search "%uchicago%"

# Show help
npm run db:query help
```

### Generate Reports

Generate a comprehensive performance report:

```bash
npm run db:report
```

This generates a formatted report including:
- Latest test run summary
- Average performance metrics
- Slowest and fastest domains
- Tests with errors
- HTTP status code summary
- Historical comparison

### Direct SQL Access

Connect to the database directly using `psql`:

```bash
# From host machine
docker exec -it project-pumpkin-db psql -U pumpkin -d playwright_metrics

# From playwright container
psql postgresql://pumpkin:pumpkin_password@postgres:5432/playwright_metrics
```

## Example Queries

### Get latest test run with all domain results
```sql
SELECT * FROM v_latest_test_run;
```

### Compare performance across runs for a specific domain
```sql
SELECT
    tr.run_timestamp,
    dt.total_page_load_ms,
    dt.time_to_first_byte_ms,
    dt.status
FROM domain_tests dt
JOIN test_runs tr ON tr.id = dt.test_run_id
WHERE dt.domain = 'www.uchicago.edu'
ORDER BY tr.run_timestamp DESC
LIMIT 10;
```

### Find all tests with 4xx or 5xx errors
```sql
SELECT * FROM v_tests_with_errors LIMIT 20;
```

### Get average metrics for latest run
```sql
SELECT
    AVG(total_page_load_ms) as avg_load,
    AVG(time_to_first_byte_ms) as avg_ttfb,
    AVG(total_resources) as avg_resources
FROM domain_tests
WHERE test_run_id = (
    SELECT id FROM test_runs
    ORDER BY run_timestamp DESC
    LIMIT 1
);
```

### Find domains with most 404 errors
```sql
SELECT
    domain,
    COUNT(*) as tests_with_404s,
    (http_response_codes->>'404')::int as count_404s
FROM domain_tests
WHERE http_response_codes ? '404'
GROUP BY domain, http_response_codes
ORDER BY (http_response_codes->>'404')::int DESC
LIMIT 10;
```

## Data Flow

### Test Execution Flow

1. **Start Test Run**
   - `test-domains-parallel.sh` creates a `test_runs` record
   - Sets status to 'RUNNING'
   - Returns `TEST_RUN_ID` environment variable

2. **Run Tests**
   - Playwright executes tests in parallel
   - Each test calls `runWebsiteTest()` in `test-helpers.js`

3. **Store Results**
   - After each test completes:
     - Performance metrics collected
     - HAR file parsed for HTTP codes
     - Screenshot saved
     - Data inserted into `domain_tests` table
     - `test_runs` counts auto-updated via trigger

4. **Complete Test Run**
   - `test-domains-parallel.sh` updates `test_runs` status to 'COMPLETED'
   - Records total duration

### Database Integration Points

| File | Purpose |
|------|---------|
| [src/database/client.js](src/database/client.js) | Connection pool management |
| [src/database/ingest.js](src/database/ingest.js) | Data insertion functions |
| [src/database/queries.js](src/database/queries.js) | Query utilities |
| [src/database/cli.js](src/database/cli.js) | Command-line interface |
| [src/reports/generate.js](src/reports/generate.js) | Report generation |
| [tests/test-helpers.js](tests/test-helpers.js) | Test execution + DB storage |
| [test-domains-parallel.sh](test-domains-parallel.sh) | Test run tracking |

## Maintenance

### Backup Database

```bash
# Backup to file
docker exec project-pumpkin-db pg_dump -U pumpkin playwright_metrics > backup.sql

# Backup with compression
docker exec project-pumpkin-db pg_dump -U pumpkin playwright_metrics | gzip > backup.sql.gz
```

### Restore Database

```bash
# Restore from file
cat backup.sql | docker exec -i project-pumpkin-db psql -U pumpkin -d playwright_metrics

# Restore from compressed file
gunzip -c backup.sql.gz | docker exec -i project-pumpkin-db psql -U pumpkin -d playwright_metrics
```

### Clear Old Data

```sql
-- Delete test runs older than 30 days (cascades to domain_tests)
DELETE FROM test_runs
WHERE run_timestamp < NOW() - INTERVAL '30 days';

-- Vacuum database to reclaim space
VACUUM FULL;
```

### View Database Size

```sql
SELECT pg_size_pretty(pg_database_size('playwright_metrics'));
```

### Cleanup Orphaned Test Directories

The cleanup utility removes test-history directories that don't have corresponding database entries (from failed runs or pre-database tests):

```bash
# Preview what would be deleted (recommended first)
DATABASE_URL='postgresql://pumpkin:pumpkin_password@localhost:5432/playwright_metrics' \
  npm run db:cleanup -- --dry-run

# Actually delete orphaned directories
DATABASE_URL='postgresql://pumpkin:pumpkin_password@localhost:5432/playwright_metrics' \
  npm run db:cleanup

# Inside Docker containers (DATABASE_URL already set)
npm run db:cleanup -- --dry-run  # Preview
npm run db:cleanup               # Delete
```

**What it does:**
1. Scans all directories in `test-history/`
2. Queries database for all registered test paths
3. Identifies directories not in database (orphaned)
4. Deletes orphaned directories (keeps database-registered ones)

**When to use:**
- After failed test runs that didn't complete database insertion
- To clean up tests created before database integration
- To reclaim disk space from incomplete tests

## Performance Considerations

### Indexes
The schema includes optimized indexes for:
- Timestamp-based queries (run_timestamp, test_timestamp)
- Domain lookups (domain, url)
- Status filtering (status)
- JSONB searches (http_response_codes, resources_by_type)

### Binary Data
By default, screenshots and HAR files are stored on the filesystem with paths in the database. To store binary data in the database, set `storeFiles: true` when calling `insertDomainTest()`.

**Recommendation**: Keep binary data on filesystem for:
- Smaller database size
- Faster queries
- Easier file serving

Store in database only for:
- Critical tests requiring guaranteed persistence
- Compliance requirements
- When filesystem is not durable

## Troubleshooting

### Database Connection Failed
```bash
# Check if postgres container is running
docker ps | grep postgres

# Check postgres logs
docker logs project-pumpkin-db

# Verify health check
docker exec project-pumpkin-db pg_isready -U pumpkin
```

### Reset Database
```bash
# Stop containers
docker-compose down

# Remove postgres volume
docker volume rm project-pumpkin_postgres-data

# Rebuild and restart
docker-compose up -d
```

### View Query Performance
```sql
-- Enable query timing
\timing

-- Analyze a query
EXPLAIN ANALYZE SELECT * FROM domain_tests WHERE domain = 'www.uchicago.edu';
```

## Security Notes

⚠️ **Default credentials are for development only**

For production use:
1. Change database password in [docker-compose.yml](docker-compose.yml)
2. Use secrets management (Docker secrets, environment files)
3. Enable SSL connections
4. Restrict network access
5. Regular backups

## Future Enhancements

Potential improvements:
- [ ] TimescaleDB extension for time-series optimization
- [ ] Automated data retention policies
- [ ] Performance alerting thresholds
- [ ] GraphQL API for queries
- [ ] Web dashboard for visualization
- [ ] Export to CSV/JSON
- [ ] Comparison reports across time ranges
