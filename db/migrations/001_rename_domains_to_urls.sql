-- ============================================================================
-- Migration: Rename "domain" terminology to "URL" throughout the schema
-- ============================================================================
-- This migration renames domain_tests table to url_tests and updates all
-- related objects (indexes, views, triggers, foreign keys) to reflect that
-- we're testing full URLs, not just domains.
--
-- Note: The 'domain' column is kept for backward compatibility and indexing.
-- It stores the extracted hostname from the URL.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Rename the main table
-- ============================================================================
ALTER TABLE domain_tests RENAME TO url_tests;

-- ============================================================================
-- Step 2: Update test_runs table column names
-- ============================================================================
ALTER TABLE test_runs RENAME COLUMN total_domains TO total_urls;

-- ============================================================================
-- Step 3: Rename foreign key columns in related tables
-- ============================================================================
ALTER TABLE http_responses RENAME COLUMN domain_test_id TO url_test_id;
ALTER TABLE resource_types RENAME COLUMN domain_test_id TO url_test_id;

-- ============================================================================
-- Step 4: Recreate indexes with new names
-- ============================================================================
-- Drop old indexes
DROP INDEX IF EXISTS idx_domain_tests_run;
DROP INDEX IF EXISTS idx_domain_tests_timestamp;
DROP INDEX IF EXISTS idx_domain_tests_url;
DROP INDEX IF EXISTS idx_domain_tests_domain;
DROP INDEX IF EXISTS idx_domain_tests_status;
DROP INDEX IF EXISTS idx_domain_tests_uuid;
DROP INDEX IF EXISTS idx_domain_tests_page_load;
DROP INDEX IF EXISTS idx_domain_tests_ttfb;
DROP INDEX IF EXISTS idx_domain_tests_http_codes;
DROP INDEX IF EXISTS idx_domain_tests_resources;

-- Create new indexes
CREATE INDEX idx_url_tests_run ON url_tests(test_run_id);
CREATE INDEX idx_url_tests_timestamp ON url_tests(test_timestamp DESC);
CREATE INDEX idx_url_tests_url ON url_tests(url);
CREATE INDEX idx_url_tests_domain ON url_tests(domain);
CREATE INDEX idx_url_tests_status ON url_tests(status);
CREATE INDEX idx_url_tests_uuid ON url_tests(test_uuid);
CREATE INDEX idx_url_tests_page_load ON url_tests(total_page_load_ms);
CREATE INDEX idx_url_tests_ttfb ON url_tests(time_to_first_byte_ms);
CREATE INDEX idx_url_tests_http_codes ON url_tests USING GIN (http_response_codes);
CREATE INDEX idx_url_tests_resources ON url_tests USING GIN (resources_by_type);

-- Update related table indexes
DROP INDEX IF EXISTS idx_http_responses_test;
DROP INDEX IF EXISTS idx_resource_types_test;

CREATE INDEX idx_http_responses_test ON http_responses(url_test_id);
CREATE INDEX idx_resource_types_test ON resource_types(url_test_id);

-- ============================================================================
-- Step 5: Recreate views with new table name
-- ============================================================================

-- Drop existing views
DROP VIEW IF EXISTS v_latest_test_run;
DROP VIEW IF EXISTS v_performance_trends;
DROP VIEW IF EXISTS v_tests_with_errors;

-- Recreate v_latest_test_run
CREATE OR REPLACE VIEW v_latest_test_run AS
SELECT
    tr.id,
    tr.run_uuid,
    tr.run_timestamp,
    tr.total_urls,
    tr.parallel_workers,
    tr.duration_ms,
    tr.passed_count,
    tr.failed_count,
    tr.status,
    COUNT(ut.id) as tests_completed,
    ROUND(AVG(ut.total_page_load_ms)::numeric, 2) as avg_page_load_ms,
    ROUND(AVG(ut.time_to_first_byte_ms)::numeric, 2) as avg_ttfb_ms,
    MIN(ut.test_timestamp) as first_test_at,
    MAX(ut.test_timestamp) as last_test_at
FROM test_runs tr
LEFT JOIN url_tests ut ON ut.test_run_id = tr.id
GROUP BY tr.id
ORDER BY tr.run_timestamp DESC
LIMIT 1;

-- Recreate v_performance_trends
CREATE OR REPLACE VIEW v_performance_trends AS
SELECT
    ut.domain,
    ut.url,
    tr.run_timestamp,
    ut.total_page_load_ms,
    ut.time_to_first_byte_ms,
    ut.dns_lookup_ms,
    ut.tcp_connection_ms,
    ut.total_resources,
    ut.total_transfer_size_bytes,
    ut.status,
    tr.id as test_run_id
FROM url_tests ut
JOIN test_runs tr ON tr.id = ut.test_run_id
ORDER BY ut.domain, tr.run_timestamp DESC;

-- Recreate v_tests_with_errors
CREATE OR REPLACE VIEW v_tests_with_errors AS
SELECT
    ut.id,
    ut.test_timestamp,
    ut.domain,
    ut.url,
    ut.page_title,
    ut.status,
    ut.http_response_codes,
    tr.run_timestamp as run_timestamp
FROM url_tests ut
JOIN test_runs tr ON tr.id = ut.test_run_id
WHERE
    ut.http_response_codes::text ~ '"[45][0-9]{2}"'
    OR ut.status != 'PASSED'
ORDER BY ut.test_timestamp DESC;

-- ============================================================================
-- Step 6: Recreate trigger function with new table name
-- ============================================================================

-- Drop and recreate the trigger function
DROP TRIGGER IF EXISTS trigger_update_test_run_counts ON url_tests;
DROP FUNCTION IF EXISTS update_test_run_counts();

CREATE OR REPLACE FUNCTION update_test_run_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'PASSED' THEN
        UPDATE test_runs
        SET passed_count = passed_count + 1
        WHERE id = NEW.test_run_id;
    ELSE
        UPDATE test_runs
        SET failed_count = failed_count + 1
        WHERE id = NEW.test_run_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_test_run_counts
AFTER INSERT ON url_tests
FOR EACH ROW
EXECUTE FUNCTION update_test_run_counts();

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMIT;
