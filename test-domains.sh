#!/bin/bash

# Script to test all domains from domains.txt using Playwright
# Usage: ./test-domains.sh

DOMAINS_FILE="tests/domains.txt"
TEST_SPEC="tests/uchicago-screenshot.spec.js"

# Check if domains file exists
if [ ! -f "$DOMAINS_FILE" ]; then
    echo "Error: $DOMAINS_FILE not found"
    exit 1
fi

# Count total domains
TOTAL=$(wc -l < "$DOMAINS_FILE")
CURRENT=0

echo "Starting tests for $TOTAL domains..."
echo "=================================="

# Read each domain and run the test
while IFS= read -r domain || [ -n "$domain" ]; do
    # Skip empty lines
    if [ -z "$domain" ]; then
        continue
    fi

    CURRENT=$((CURRENT + 1))
    echo ""
    echo "[$CURRENT/$TOTAL] Testing: https://$domain"
    echo "-----------------------------------"

    # Run the Playwright test with the domain as TEST_URL
    TEST_URL="https://$domain" npx playwright test --project=firefox "$TEST_SPEC"

    # Check exit status
    if [ $? -eq 0 ]; then
        echo "✓ Success: $domain"
    else
        echo "✗ Failed: $domain"
    fi
done < "$DOMAINS_FILE"

echo ""
echo "=================================="
echo "All tests completed!"
echo "Results saved to test-history/"
