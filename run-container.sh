#!/bin/bash
# Helper script to start interactive Playwright Docker container
# Usage: ./run-container.sh [URL]
#
# Examples:
#   ./run-container.sh                           # Use default URL
#   ./run-container.sh https://www.google.com    # Custom URL

# Set TEST_URL from first argument or use default
TEST_URL=${1:-https://www.uchicago.edu/}

echo "Starting interactive Playwright container..."
echo "Test URL: $TEST_URL"
echo ""
echo "Inside the container, you can run:"
echo "  npx playwright test --project=firefox"
echo "  TEST_URL=https://example.com npx playwright test --project=firefox"
echo ""

docker run -it --rm \
  -v "$(pwd)/test-history:/app/test-history" \
  -e "TEST_URL=$TEST_URL" \
  project-pumpkin \
  /bin/bash
