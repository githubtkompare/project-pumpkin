#!/bin/bash

# Script to test all URLs from urls.txt in parallel using Playwright workers
# Usage: ./test-urls-parallel.sh [workers]

URLS_FILE="tests/urls.txt"
WORKERS=${1:-4}  # Default to 4 workers if not specified

# Check if URLs file exists
if [ ! -f "$URLS_FILE" ]; then
    echo "Error: $URLS_FILE not found"
    exit 1
fi

# Count total URLs (use grep -c to count non-empty lines, not newlines)
TOTAL=$(grep -c . "$URLS_FILE")

echo "========================================================================"
echo "Parallel URL Testing"
echo "========================================================================"
echo "Total URLs:     $TOTAL"
echo "Parallel workers: $WORKERS"
echo "Expected time:  ~2-3 minutes (vs ~9-10 minutes sequential)"
echo "========================================================================"
echo ""

# Wait for database to be ready
echo "Checking database connectivity..."
if ! node src/database/wait-for-db.js 30; then
    echo ""
    echo "⚠ Warning: Database not available"
    echo "Tests will run but results will NOT be saved to database"
    echo "Only screenshots and HAR files will be saved to test-history/"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    export TEST_RUN_ID=""
else
    echo ""
    # Create test run in database and get TEST_RUN_ID
    echo "Creating test run record in database..."
    TEST_RUN_RESULT=$(node src/database/create-test-run.js "$TOTAL" "$WORKERS" "Parallel test run from test-urls-parallel.sh")

    export TEST_RUN_ID="$TEST_RUN_RESULT"

    if [ "$TEST_RUN_ID" != "0" ] && [ -n "$TEST_RUN_ID" ]; then
        echo "✓ Test run created with ID: $TEST_RUN_ID"
        # Ensure TEST_RUN_ID is available to child processes
        export TEST_RUN_ID
    else
        echo "⚠ Database not available - continuing without database tracking"
        export TEST_RUN_ID=""
    fi

    echo "DEBUG: TEST_RUN_ID is set to: $TEST_RUN_ID"
    echo ""
fi

# Record start time
START_TIME=$(date +%s%3N)

# Run Playwright batch test with Firefox
npx playwright test --project=firefox-parallel --workers="$WORKERS"

# Check exit status
EXIT_CODE=$?

# Record end time and calculate duration
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Update test run status in database
if [ -n "$TEST_RUN_ID" ] && [ "$TEST_RUN_ID" != "0" ]; then
    if [ $EXIT_CODE -eq 0 ]; then
        STATUS="COMPLETED"
    else
        STATUS="PARTIAL"
    fi

    echo ""
    echo "Updating test run status in database..."
    node src/database/update-test-run.js "$TEST_RUN_ID" "$STATUS" "$DURATION"
fi

echo ""
echo "========================================================================"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ All tests completed successfully!"
else
    echo "⚠ Some tests failed (exit code: $EXIT_CODE)"
fi
echo "========================================================================"
echo "Test duration: ${DURATION}ms"
echo "Results saved to test-history/"
if [ -n "$TEST_RUN_ID" ] && [ "$TEST_RUN_ID" != "0" ]; then
    echo "Database test run ID: $TEST_RUN_ID"
fi
echo ""
echo "To view detailed HTML report (opens browser):"
echo "  npx playwright show-report"
echo ""
echo "To query database results:"
echo "  npm run db:query latest"
echo "  npm run db:report"
echo "========================================================================"

exit $EXIT_CODE
