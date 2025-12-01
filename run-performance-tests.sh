#!/bin/bash

# Performance Testing Script for Alert Monitoring System
# This script runs comprehensive performance tests and generates reports

set -e

echo "=========================================="
echo "Alert Monitoring System - Performance Tests"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_HOST=${API_HOST:-localhost}
API_PORT=${API_PORT:-3000}
RESULTS_DIR="performance-results"

# Create results directory
mkdir -p $RESULTS_DIR

# Function to check if server is running
check_server() {
    echo "Checking if server is running at http://${API_HOST}:${API_PORT}..."
    if curl -s -f "http://${API_HOST}:${API_PORT}/health" > /dev/null; then
        echo -e "${GREEN}✓ Server is running${NC}"
        return 0
    else
        echo -e "${RED}✗ Server is not running${NC}"
        echo "Please start the server first:"
        echo "  cd vite-project/server && npm start"
        return 1
    fi
}

# Function to run load test
run_load_test() {
    local users=$1
    local duration=$2
    local test_name=$3
    
    echo ""
    echo "=========================================="
    echo "Running: $test_name"
    echo "Users: $users | Duration: ${duration}ms"
    echo "=========================================="
    
    cd vite-project/server
    CONCURRENT_USERS=$users TEST_DURATION=$duration API_HOST=$API_HOST API_PORT=$API_PORT node load-test.js
    
    # Move report to results directory
    latest_report=$(ls -t load-test-report-*.json | head -1)
    if [ -f "$latest_report" ]; then
        mv "$latest_report" "../../${RESULTS_DIR}/${test_name}-report.json"
        echo -e "${GREEN}✓ Report saved to ${RESULTS_DIR}/${test_name}-report.json${NC}"
    fi
    
    cd ../..
}

# Function to generate summary
generate_summary() {
    echo ""
    echo "=========================================="
    echo "Generating Performance Summary"
    echo "=========================================="
    
    cat > "${RESULTS_DIR}/summary.md" << 'EOF'
# Performance Test Summary

## Test Configuration
- **Date:** $(date)
- **Target:** http://${API_HOST}:${API_PORT}
- **Test Duration:** Various (see individual tests)

## Test Results

EOF

    # Add results from each test
    for report in ${RESULTS_DIR}/*-report.json; do
        if [ -f "$report" ]; then
            test_name=$(basename "$report" -report.json)
            echo "### $test_name" >> "${RESULTS_DIR}/summary.md"
            echo "" >> "${RESULTS_DIR}/summary.md"
            
            # Extract key metrics using node
            node -e "
                const fs = require('fs');
                const data = JSON.parse(fs.readFileSync('$report', 'utf8'));
                console.log('- **Total Requests:** ' + data.summary.totalRequests);
                console.log('- **Success Rate:** ' + data.summary.successRate.toFixed(2) + '%');
                console.log('- **Requests/sec:** ' + data.summary.requestsPerSecond.toFixed(2));
                console.log('- **Avg Latency:** ' + data.latency.average.toFixed(2) + 'ms');
                console.log('- **P95 Latency:** ' + data.latency.p95.toFixed(2) + 'ms');
                console.log('- **P99 Latency:** ' + data.latency.p99.toFixed(2) + 'ms');
            " >> "${RESULTS_DIR}/summary.md"
            
            echo "" >> "${RESULTS_DIR}/summary.md"
        fi
    done
    
    echo -e "${GREEN}✓ Summary generated at ${RESULTS_DIR}/summary.md${NC}"
}

# Main execution
main() {
    # Check if server is running
    if ! check_server; then
        exit 1
    fi
    
    echo ""
    echo "Starting performance test suite..."
    echo "This will take approximately 10 minutes"
    echo ""
    
    # Test 1: Light Load (10 users, 60 seconds)
    run_load_test 10 60000 "test1-light-load"
    
    # Test 2: Medium Load (25 users, 60 seconds)
    run_load_test 25 60000 "test2-medium-load"
    
    # Test 3: Heavy Load (50 users, 60 seconds)
    run_load_test 50 60000 "test3-heavy-load"
    
    # Test 4: Stress Test (100 users, 30 seconds)
    run_load_test 100 30000 "test4-stress-test"
    
    # Test 5: Endurance Test (20 users, 180 seconds)
    run_load_test 20 180000 "test5-endurance-test"
    
    # Generate summary
    generate_summary
    
    echo ""
    echo "=========================================="
    echo -e "${GREEN}All tests completed!${NC}"
    echo "=========================================="
    echo ""
    echo "Results saved in: ${RESULTS_DIR}/"
    echo "Summary: ${RESULTS_DIR}/summary.md"
    echo ""
    echo "Next steps:"
    echo "1. Review the summary report"
    echo "2. Analyze individual test reports"
    echo "3. Compare against performance benchmarks"
    echo "4. Identify bottlenecks and optimization opportunities"
    echo ""
}

# Run main function
main
