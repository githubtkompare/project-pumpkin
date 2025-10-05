#!/bin/bash

# Script to test all domains from domains.txt in parallel using Playwright workers
# Usage: ./test-domains-parallel.sh [workers]

DOMAINS_FILE="tests/domains.txt"
WORKERS=${1:-4}  # Default to 4 workers if not specified

# Check if domains file exists
if [ ! -f "$DOMAINS_FILE" ]; then
    echo "Error: $DOMAINS_FILE not found"
    exit 1
fi

# Count total domains
TOTAL=$(wc -l < "$DOMAINS_FILE" | tr -d ' ')

echo "========================================================================"
echo "Parallel Domain Testing"
echo "========================================================================"
echo "Total domains:  $TOTAL"
echo "Parallel workers: $WORKERS"
echo "Expected time:  ~2-3 minutes (vs ~9-10 minutes sequential)"
echo "========================================================================"
echo ""

# Create test run in database and get TEST_RUN_ID
echo "Creating test run record in database..."
TEST_RUN_RESULT=$(node src/database/create-test-run.js "$TOTAL" "$WORKERS" "Parallel test run from test-domains-parallel.sh")

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
