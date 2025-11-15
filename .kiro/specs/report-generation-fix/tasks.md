# Implementation Plan

- [x] 1. Implement Monthly Summary report generation
  - Modify the `initReports()` function in `vite-project/src/assets/js/owner-dashboard.js`
  - Add conditional logic to handle `report === 'monthly'` case
  - Calculate date range for past 30 days using JavaScript Date API
  - Fetch alerts from backend using `post('/api/v1/alerts/search')` with date filters
  - Fetch statistics using `get('/api/v1/alerts/stats')`
  - Aggregate data by severity, type, and status
  - Create JSON report object matching the Monthly Summary Report Structure from design
  - Generate Blob and trigger download with filename `monthly-summary-YYYY-MM-DD.json`
  - Display success toast notification
  - Add error handling with error toast on failure
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement Weekly Report generation
  - Add conditional logic to handle `report === 'weekly'` case in the same event listener
  - Calculate date range for past 7 days using JavaScript Date API
  - Fetch alerts from backend using `post('/api/v1/alerts/search')` with date filters
  - Fetch weekly trends using `get('/api/v1/alerts/weekly-trends')`
  - Create daily breakdown array with counts per day
  - Aggregate summary statistics by severity and type
  - Create JSON report object matching the Weekly Report Structure from design
  - Generate Blob and trigger download with filename `weekly-report-YYYY-MM-DD.json`
  - Display success toast notification
  - Add error handling with error toast on failure
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement Performance Report generation
  - Add conditional logic to handle `report === 'performance'` case in the same event listener
  - Fetch comprehensive statistics using `get('/api/v1/alerts/stats')`
  - Extract performance metrics (MTTA, MTTR) and convert from seconds to minutes
  - Create breakdown objects for severity, status, and type
  - Add system health information (can use placeholder values or fetch from stats)
  - Create JSON report object matching the Performance Report Structure from design
  - Generate Blob and trigger download with filename `performance-report-YYYY-MM-DD.json`
  - Display success toast notification
  - Add error handling with error toast on failure
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Test all report generation functionality
  - Manually test Monthly Summary button click and verify file download
  - Manually test Weekly Report button click and verify file download
  - Manually test Performance Report button click and verify file download
  - Verify all downloaded JSON files have correct structure and data
  - Verify toast notifications appear correctly (loading, success, error)
  - Test error handling by simulating network failure
  - Verify filename formats are correct with current date
  - _Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5_
