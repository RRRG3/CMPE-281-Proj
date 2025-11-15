# Requirements Document

## Introduction

This document specifies the requirements for fixing the non-functional report generation buttons in the Reports and Analytics section of the Owner Dashboard. Currently, when users click on "Monthly Summary", "Weekly Report", or "Performance Report" buttons, they only see a toast notification but no actual report is generated or downloaded.

## Glossary

- **Owner Dashboard**: The web interface used by home owners to monitor their smart home senior care system
- **Report Button**: A clickable UI element in the Reports and Analytics section that should generate and download a report
- **Toast Notification**: A temporary message displayed to the user
- **Report Data**: Aggregated alert and system statistics formatted for user consumption

## Requirements

### Requirement 1

**User Story:** As a home owner, I want to click the "Monthly Summary" button and receive a downloadable monthly report, so that I can review the system's performance over the past month

#### Acceptance Criteria

1. WHEN the user clicks the "Monthly Summary" button, THE Owner Dashboard SHALL fetch alert data from the past 30 days from the backend API
2. WHEN the monthly data is retrieved, THE Owner Dashboard SHALL generate a JSON file containing monthly statistics including total alerts, alerts by severity, alerts by type, and response metrics
3. WHEN the JSON file is generated, THE Owner Dashboard SHALL trigger a browser download with filename format "monthly-summary-YYYY-MM-DD.json"
4. IF the data fetch fails, THEN THE Owner Dashboard SHALL display an error toast notification to the user
5. WHILE the report is being generated, THE Owner Dashboard SHALL display a loading toast notification

### Requirement 2

**User Story:** As a home owner, I want to click the "Weekly Report" button and receive a downloadable weekly report, so that I can review the system's performance over the past week

#### Acceptance Criteria

1. WHEN the user clicks the "Weekly Report" button, THE Owner Dashboard SHALL fetch alert data from the past 7 days from the backend API
2. WHEN the weekly data is retrieved, THE Owner Dashboard SHALL generate a JSON file containing weekly statistics including daily alert counts, alerts by severity, alerts by type, and response metrics
3. WHEN the JSON file is generated, THE Owner Dashboard SHALL trigger a browser download with filename format "weekly-report-YYYY-MM-DD.json"
4. IF the data fetch fails, THEN THE Owner Dashboard SHALL display an error toast notification to the user
5. WHILE the report is being generated, THE Owner Dashboard SHALL display a loading toast notification

### Requirement 3

**User Story:** As a home owner, I want to click the "Performance Report" button and receive a downloadable performance report, so that I can analyze system performance metrics and response times

#### Acceptance Criteria

1. WHEN the user clicks the "Performance Report" button, THE Owner Dashboard SHALL fetch comprehensive alert statistics from the backend API
2. WHEN the performance data is retrieved, THE Owner Dashboard SHALL generate a JSON file containing performance metrics including mean time to acknowledge, mean time to resolve, alert counts by severity and status, and system uptime statistics
3. WHEN the JSON file is generated, THE Owner Dashboard SHALL trigger a browser download with filename format "performance-report-YYYY-MM-DD.json"
4. IF the data fetch fails, THEN THE Owner Dashboard SHALL display an error toast notification to the user
5. WHILE the report is being generated, THE Owner Dashboard SHALL display a loading toast notification
