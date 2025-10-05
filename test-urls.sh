#!/bin/bash

# Script to test all URLs from urls.txt using Playwright
# Usage: ./test-urls.sh

URLS_FILE="tests/urls.txt"
TEST_SPEC="tests/uchicago-screenshot.spec.js"

# Check if URLs file exists
if [ ! -f "$URLS_FILE" ]; then
    echo "Error: $URLS_FILE not found"
    exit 1
fi

# Count total URLs
TOTAL=$(wc -l < "$URLS_FILE")
CURRENT=0

echo "Starting tests for $TOTAL URLs..."
echo "=================================="

# Read each URL and run the test
while IFS= read -r url || [ -n "$url" ]; do
    # Skip empty lines
    if [ -z "$url" ]; then
        continue
    fi

    CURRENT=$((CURRENT + 1))
    echo ""
    echo "[$CURRENT/$TOTAL] Testing: $url"
    echo "-----------------------------------"

    # Run the Playwright test with the URL as TEST_URL
    TEST_URL="$url" npx playwright test --project=firefox "$TEST_SPEC"

    # Check exit status
    if [ $? -eq 0 ]; then
        echo "✓ Success: $url"
    else
        echo "✗ Failed: $url"
    fi
done < "$URLS_FILE"

echo ""
echo "=================================="
echo "All tests completed!"
echo "Results saved to test-history/"
