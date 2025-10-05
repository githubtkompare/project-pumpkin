-- ============================================================================
-- Project Pumpkin - Playwright Metrics Database Schema
-- ============================================================================
-- This schema stores performance metrics, screenshots, and HAR files from
-- Playwright website tests run via test-domains-parallel.sh
--
-- Design principles:
-- 1. Test runs are grouped (each script execution = one test_run)
-- 2. Individual domain tests link to their test run
-- 3. Metrics stored as individual columns for efficient querying
-- 4. Binary data (screenshots, HAR) stored with filesystem paths
-- 5. HTTP codes and resource types stored as JSONB for flexibility
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: test_runs
-- Represents each execution of test-domains-parallel.sh
-- ============================================================================
CREATE TABLE IF NOT EXISTS test_runs (
    id SERIAL PRIMARY KEY,
    run_uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    run_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_domains INTEGER NOT NULL,
    parallel_workers INTEGER NOT NULL DEFAULT 4,
    duration_ms INTEGER,
    passed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING', -- 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_runs_timestamp ON test_runs(run_timestamp DESC);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_uuid ON test_runs(run_uuid);

-- ============================================================================
-- Table: domain_tests
-- Individual domain test results within a test run
-- ============================================================================
CREATE TABLE IF NOT EXISTS domain_tests (
    id SERIAL PRIMARY KEY,
    test_run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,

    -- Test identification
    test_uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    test_timestamp TIMESTAMPTZ NOT NULL,
    url VARCHAR(2048) NOT NULL,
    domain VARCHAR(512) NOT NULL,

    -- Test metadata
    browser VARCHAR(50) NOT NULL,
    user_agent TEXT NOT NULL,
    page_title TEXT,
    test_duration_ms INTEGER NOT NULL,
    scroll_duration_ms INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PASSED', -- 'PASSED', 'FAILED', 'TIMEOUT', 'ERROR'
    error_message TEXT,

    -- Performance metrics - Navigation Timing (all in milliseconds)
    dns_lookup_ms DECIMAL(10,2),
    tcp_connection_ms DECIMAL(10,2),
    tls_negotiation_ms DECIMAL(10,2),
    time_to_first_byte_ms DECIMAL(10,2),
    response_time_ms DECIMAL(10,2),
    dom_content_loaded_ms DECIMAL(10,2),
    dom_interactive_ms DECIMAL(10,2),
    total_page_load_ms DECIMAL(10,2),

    -- Document sizes (in bytes)
    doc_transfer_size_bytes BIGINT,
    doc_encoded_size_bytes BIGINT,
    doc_decoded_size_bytes BIGINT,

    -- Network statistics
    total_resources INTEGER,
    total_transfer_size_bytes BIGINT,
    total_encoded_size_bytes BIGINT,

    -- Resource breakdown (stored as JSON for flexibility)
    -- Example: {"script": 35, "img": 24, "css": 3, "fetch": 6, "other": 19}
    resources_by_type JSONB,

    -- HTTP response codes (stored as JSON)
    -- Example: {"200": 100, "206": 2, "404": 1, "500": 1}
    http_response_codes JSONB,

    -- File references (paths within container)
    screenshot_path TEXT NOT NULL,
    har_path TEXT NOT NULL,
    report_path TEXT NOT NULL,

    -- Binary data (optional - can store files directly in DB)
    -- For now we'll store paths only, but these columns are ready if needed
    screenshot_data BYTEA,
    har_data BYTEA,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domain_tests_run ON domain_tests(test_run_id);
CREATE INDEX idx_domain_tests_timestamp ON domain_tests(test_timestamp DESC);
CREATE INDEX idx_domain_tests_url ON domain_tests(url);
CREATE INDEX idx_domain_tests_domain ON domain_tests(domain);
CREATE INDEX idx_domain_tests_status ON domain_tests(status);
CREATE INDEX idx_domain_tests_uuid ON domain_tests(test_uuid);
CREATE INDEX idx_domain_tests_page_load ON domain_tests(total_page_load_ms);
CREATE INDEX idx_domain_tests_ttfb ON domain_tests(time_to_first_byte_ms);

-- GIN index for JSONB columns to enable efficient querying
CREATE INDEX idx_domain_tests_http_codes ON domain_tests USING GIN (http_response_codes);
CREATE INDEX idx_domain_tests_resources ON domain_tests USING GIN (resources_by_type);

-- ============================================================================
-- Table: http_responses (normalized alternative to JSON)
-- Use this for efficient querying by specific HTTP status codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS http_responses (
    id SERIAL PRIMARY KEY,
    domain_test_id INTEGER NOT NULL REFERENCES domain_tests(id) ON DELETE CASCADE,
    status_code INTEGER NOT NULL,
    response_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_http_responses_test ON http_responses(domain_test_id);
CREATE INDEX idx_http_responses_code ON http_responses(status_code);
CREATE INDEX idx_http_responses_code_range ON http_responses(status_code) WHERE status_code >= 400;

-- ============================================================================
-- Table: resource_types (normalized alternative to JSON)
-- Use this for efficient querying by specific resource types
-- ============================================================================
CREATE TABLE IF NOT EXISTS resource_types (
    id SERIAL PRIMARY KEY,
    domain_test_id INTEGER NOT NULL REFERENCES domain_tests(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    resource_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resource_types_test ON resource_types(domain_test_id);
CREATE INDEX idx_resource_types_type ON resource_types(resource_type);

-- ============================================================================
-- Useful Views
-- ============================================================================

-- Latest test run summary
CREATE OR REPLACE VIEW v_latest_test_run AS
SELECT
    tr.id,
    tr.run_uuid,
    tr.run_timestamp,
    tr.total_domains,
    tr.parallel_workers,
    tr.duration_ms,
    tr.passed_count,
    tr.failed_count,
    tr.status,
    COUNT(dt.id) as tests_completed,
    ROUND(AVG(dt.total_page_load_ms)::numeric, 2) as avg_page_load_ms,
    ROUND(AVG(dt.time_to_first_byte_ms)::numeric, 2) as avg_ttfb_ms,
    MIN(dt.test_timestamp) as first_test_at,
    MAX(dt.test_timestamp) as last_test_at
FROM test_runs tr
LEFT JOIN domain_tests dt ON dt.test_run_id = tr.id
GROUP BY tr.id
ORDER BY tr.run_timestamp DESC
LIMIT 1;

-- Performance comparison across runs
CREATE OR REPLACE VIEW v_performance_trends AS
SELECT
    dt.domain,
    dt.url,
    tr.run_timestamp,
    dt.total_page_load_ms,
    dt.time_to_first_byte_ms,
    dt.dns_lookup_ms,
    dt.tcp_connection_ms,
    dt.total_resources,
    dt.total_transfer_size_bytes,
    dt.status,
    tr.id as test_run_id
FROM domain_tests dt
JOIN test_runs tr ON tr.id = dt.test_run_id
ORDER BY dt.domain, tr.run_timestamp DESC;

-- Tests with errors (4xx/5xx responses)
CREATE OR REPLACE VIEW v_tests_with_errors AS
SELECT
    dt.id,
    dt.test_timestamp,
    dt.domain,
    dt.url,
    dt.page_title,
    dt.status,
    dt.http_response_codes,
    tr.run_timestamp as run_timestamp
FROM domain_tests dt
JOIN test_runs tr ON tr.id = dt.test_run_id
WHERE
    dt.http_response_codes::text ~ '"[45][0-9]{2}"'  -- Regex to find 4xx or 5xx codes
    OR dt.status != 'PASSED'
ORDER BY dt.test_timestamp DESC;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update test_runs.updated_at on any change
CREATE OR REPLACE FUNCTION update_test_runs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_test_runs_timestamp
BEFORE UPDATE ON test_runs
FOR EACH ROW
EXECUTE FUNCTION update_test_runs_timestamp();

-- Auto-update test_runs passed/failed counts when domain_tests are inserted
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
AFTER INSERT ON domain_tests
FOR EACH ROW
EXECUTE FUNCTION update_test_run_counts();

-- ============================================================================
-- Sample Queries (commented out, for reference)
-- ============================================================================

-- Get latest test run with all results
-- SELECT * FROM v_latest_test_run;

-- Compare performance of specific domain across runs
-- SELECT * FROM v_performance_trends WHERE domain = 'www.uchicago.edu' LIMIT 10;

-- Find all tests with errors
-- SELECT * FROM v_tests_with_errors LIMIT 20;

-- Get average metrics for latest run
-- SELECT
--     tr.run_timestamp,
--     AVG(dt.total_page_load_ms) as avg_load_time,
--     AVG(dt.time_to_first_byte_ms) as avg_ttfb,
--     AVG(dt.total_resources) as avg_resources
-- FROM test_runs tr
-- JOIN domain_tests dt ON dt.test_run_id = tr.id
-- WHERE tr.id = (SELECT id FROM test_runs ORDER BY run_timestamp DESC LIMIT 1)
-- GROUP BY tr.id, tr.run_timestamp;

-- Find domains with most 404 errors
-- SELECT
--     domain,
--     COUNT(*) as tests_with_404s,
--     http_response_codes->'404' as count_404s
-- FROM domain_tests
-- WHERE http_response_codes ? '404'
-- GROUP BY domain, http_response_codes
-- ORDER BY (http_response_codes->>'404')::int DESC;

-- ============================================================================
-- Grants (if needed for specific users)
-- ============================================================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pumpkin;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pumpkin;
-- GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO pumpkin;

-- ============================================================================
-- Initialization Complete
-- ============================================================================
