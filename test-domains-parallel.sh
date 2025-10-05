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

# Run Playwright batch test with Firefox
npx playwright test --project=firefox-parallel --workers="$WORKERS"

# Check exit status
EXIT_CODE=$?

echo ""
echo "========================================================================"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ All tests completed successfully!"
else
    echo "⚠ Some tests failed (exit code: $EXIT_CODE)"
fi
echo "========================================================================"
echo "Results saved to test-history/"
echo ""
echo "To view detailed HTML report (opens browser):"
echo "  npx playwright show-report"
echo "========================================================================"

exit $EXIT_CODE
