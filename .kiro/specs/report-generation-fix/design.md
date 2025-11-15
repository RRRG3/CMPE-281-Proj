# Design Document

## Overview

This design document outlines the solution for implementing functional report generation in the Owner Dashboard. The current implementation only displays toast notifications without generating actual reports. This fix will add proper data fetching, report generation, and file download functionality for three report types: Monthly Summary, Weekly Report, and Performance Report.

## Architecture

The solution follows the existing client-side architecture pattern used in the Owner Dashboard:

1. **Event Handlers**: Click event listeners on report buttons
2. **API Integration**: Use existing `post()` and `get()` functions from `api.js` to fetch data
3. **Data Processing**: Transform API responses into report-ready format
4. **File Generation**: Create JSON files with formatted report data
5. **Download Trigger**: Use browser Blob API to trigger file downloads

## Components and Interfaces

### Modified Component

**File**: `vite-project/src/assets/js/owner-dashboard.js`

**Function**: `initReports()` - Lines 883-950

The existing event listener for `.report-card` elements needs to be enhanced to handle three additional report types:
- `monthly` - Monthly Summary Report
- `weekly` - Weekly Report  
- `performance` - Performance Report

### API Endpoints Used

The implementation will use existing backend endpoints:

1. **POST /api/v1/alerts/search**
   - Used to fetch filtered alert data
   - Parameters: `{ limit, startDate, endDate }`
   - Returns: `{ items: Alert[] }`

2. **GET /api/v1/alerts/stats**
   - Used to fetch aggregated statistics
   - Returns: Statistics object with counts, metrics, and breakdowns

3. **GET /api/v1/alerts/weekly-trends**
   - Used to fetch weekly trend data
   - Returns: `{ trends: Array<{ day, date, count }> }`

## Data Models

### Monthly Summary Report Structure

```json
{
  "report_type": "monthly_summary",
  "generated_at": "ISO 8601 timestamp",
  "period": {
    "start": "ISO 8601 date",
    "end": "ISO 8601 date",
    "days": 30
  },
  "summary": {
    "total_alerts": number,
    "alerts_by_severity": {
      "critical": number,
      "high": number,
      "medium": number,
      "low": number
    },
    "alerts_by_type": {
      "type_name": number
    },
    "alerts_by_status": {
      "open": number,
      "acknowledged": number,
      "resolved": number
    }
  },
  "metrics": {
    "mean_time_to_acknowledge_minutes": number,
    "mean_time_to_resolve_minutes": number
  },
  "alerts": "Array of alert objects"
}
```

### Weekly Report Structure

```json
{
  "report_type": "weekly_report",
  "generated_at": "ISO 8601 timestamp",
  "period": {
    "start": "ISO 8601 date",
    "end": "ISO 8601 date",
    "days": 7
  },
  "daily_breakdown": [
    {
      "date": "ISO 8601 date",
      "day": "Day name",
      "count": number
    }
  ],
  "summary": {
    "total_alerts": number,
    "alerts_by_severity": {},
    "alerts_by_type": {}
  },
  "alerts": "Array of alert objects"
}
```

### Performance Report Structure

```json
{
  "report_type": "performance_report",
  "generated_at": "ISO 8601 timestamp",
  "metrics": {
    "mean_time_to_acknowledge_seconds": number,
    "mean_time_to_resolve_seconds": number,
    "total_alerts": number,
    "open_alerts": number,
    "resolved_alerts": number
  },
  "breakdown": {
    "by_severity": {},
    "by_status": {},
    "by_type": {}
  },
  "system_health": {
    "uptime_percentage": number,
    "active_devices": number
  }
}
```

## Error Handling

1. **Network Errors**: If API calls fail, catch the error and display an error toast with message "Failed to generate report"
2. **Empty Data**: If no alerts are found, still generate the report with zero counts
3. **Timeout**: Use existing API timeout handling (no changes needed)
4. **Browser Compatibility**: Use standard Blob API which is supported in all modern browsers

## Testing Strategy

### Manual Testing

1. **Monthly Summary Test**:
   - Click "Monthly Summary" button
   - Verify loading toast appears
   - Verify file downloads with correct filename format
   - Open JSON file and verify structure matches design
   - Verify success toast appears

2. **Weekly Report Test**:
   - Click "Weekly Report" button
   - Verify loading toast appears
   - Verify file downloads with correct filename format
   - Open JSON file and verify daily breakdown is present
   - Verify success toast appears

3. **Performance Report Test**:
   - Click "Performance Report" button
   - Verify loading toast appears
   - Verify file downloads with correct filename format
   - Open JSON file and verify metrics are present
   - Verify success toast appears

4. **Error Handling Test**:
   - Simulate network failure (disconnect backend)
   - Click each report button
   - Verify error toast appears with appropriate message

### Browser Testing

Test in:
- Chrome/Edge (Chromium)
- Firefox
- Safari

## Implementation Notes

1. **Code Location**: All changes are in `vite-project/src/assets/js/owner-dashboard.js` in the `initReports()` function
2. **Existing Pattern**: Follow the same pattern used for the "export" report type (lines 895-920)
3. **Date Calculations**: Use JavaScript Date API to calculate date ranges (30 days ago, 7 days ago)
4. **File Naming**: Use ISO date format (YYYY-MM-DD) for consistency
5. **No Backend Changes**: This is a frontend-only fix using existing API endpoints
