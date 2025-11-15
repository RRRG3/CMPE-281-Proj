# Implementation Plan

## Phase 1: Database & Authentication Setup (Cameron's Component)

- [x] 1. Set up backend server structure and dependencies
  - Create `server/` directory in project root
  - Create `server/package.json` with Express, pg, mongodb, ws, jsonwebtoken, bcrypt, nanoid, cors, dotenv dependencies
  - Create `server/index.js` as main entry point
  - Create `.env.example` file with DB_URL, MONGO_URL, JWT_SECRET, PORT placeholders
  - _Requirements: 11.1, 14.1, 15.1_

- [x] 2. Set up PostgreSQL database and schema
  - Create `server/db/schema.sql` file with all table definitions
  - Create users table with user_id, name, email, password_hash, role, created_at
  - Create houses table with house_id, owner_id, address, timezone, created_at
  - Create devices table with device_id, house_id, device_type, status, name, firmware, config, timestamps
  - Create alerts table with alert_id, house_id, device_id, type, severity, state, status, score, message, timestamps, acknowledgment/resolution fields
  - Create alert_history table with history_id, alert_id, action, actor, note, meta, ts
  - Create refresh_tokens table with token_id, user_id, token, revoked, expires_at, created_at
  - Add all indexes for performance optimization
  - _Requirements: 8.1, 8.2, 11.1, 12.1, 15.1_

- [x] 3. Set up MongoDB connection and collections
  - Create `server/db/mongo.js` module for MongoDB connection
  - Initialize MongoClient with connection pooling
  - Create telemetry collection with time-series configuration
  - Create ml_inference collection
  - Export database and collection references
  - _Requirements: 19.1, 22.1_

- [x] 4. Create PostgreSQL connection pool
  - Create `server/db/postgres.js` module for PostgreSQL connection
  - Initialize pg.Pool with max 20 connections from DB_URL environment variable
  - Export pool for use in route handlers
  - Add connection error handling and logging
  - _Requirements: 8.1, 14.1_

- [x] 5. Implement authentication utilities
  - Create `server/auth/utils.js` module
  - Implement `hashPassword(password)` function using bcrypt with 10 salt rounds
  - Implement `comparePassword(password, hash)` function using bcrypt
  - Implement `generateAccessToken(user)` function creating JWT with 1 hour expiration
  - Implement `generateRefreshToken()` function creating 64-character random token
  - Implement `verifyAccessToken(token)` function validating JWT
  - _Requirements: 11.2, 11.5, 12.2, 14.2_

- [x] 6. Implement authentication middleware
  - Create `server/middleware/auth.js` module
  - Implement `authenticate` middleware that extracts Bearer token, verifies it, attaches user to req.user
  - Return 401 error for missing or invalid tokens
  - Implement `requireRole(...roles)` middleware that checks req.user.role against allowed roles
  - Return 403 error for insufficient permissions
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 7. Implement user login endpoint
  - Create POST `/api/v1/auth/login` route in Express
  - Extract email and password from request body
  - Query users table for user with matching email
  - Compare password with stored hash using comparePassword
  - Return 401 error if credentials invalid
  - Generate access token and refresh token
  - Store refresh token in refresh_tokens table with 7-day expiration
  - Return JSON with access_token, refresh_token, and user object (without password_hash)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 8. Implement token refresh endpoint
  - Create POST `/api/v1/auth/refresh` route in Express
  - Extract refresh_token from request body
  - Query refresh_tokens table for matching token
  - Validate token exists, not revoked, and not expired
  - Return 401 error if token invalid
  - Mark old refresh token as revoked
  - Generate new access token
  - Return JSON with new access_token
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 9. Implement logout endpoint
  - Create POST `/api/v1/auth/logout` route in Express
  - Extract refresh_token from request body
  - Update refresh_tokens table to set revoked=true for matching token
  - Return success confirmation
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 10. Implement user registration endpoint (admin only)
  - Create POST `/api/v1/auth/register` route with authenticate and requireRole('ADMIN') middleware
  - Extract name, email, password, role from request body
  - Validate required fields and password complexity
  - Hash password using hashPassword
  - Insert user record into users table
  - Return user object (without password_hash)
  - _Requirements: 14.5_

- [x] 11. Implement houses list endpoint
  - Create GET `/api/v1/houses` route with authenticate middleware
  - If user role is OWNER, query houses table WHERE owner_id = req.user.user_id
  - If user role is ADMIN, query all houses
  - Order by created_at descending
  - Return JSON with items array
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 12. Implement devices list endpoint with filtering and pagination
  - Create GET `/api/v1/devices` route with authenticate middleware
  - Extract query parameters: owner_id, house_id, status, device_type, page (default 1), pageSize (default 50)
  - Build dynamic SQL WHERE clause based on provided filters
  - Add owner access control: if user is OWNER, filter by houses they own
  - Calculate offset from page and pageSize
  - Execute query with LIMIT and OFFSET
  - Query total count for pagination metadata
  - Return JSON with items array, total, page, pageSize
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 13. Implement device registration endpoint
  - Create POST `/api/v1/devices` route with authenticate middleware
  - Extract owner_id, house_id, device_type, name from request body
  - Validate required fields, return 400 if missing
  - Verify user has access to the house (owner or admin)
  - Insert device record with status 'active' and generated device_id
  - Return complete device object
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 14. Implement device detail endpoint
  - Create GET `/api/v1/devices/:id` route with authenticate middleware
  - Extract device_id from URL parameter
  - Query devices table joined with houses table
  - Return 404 if device not found
  - Verify user has access to device's house
  - Query MongoDB telemetry collection for recent metrics summary (last 24 hours)
  - Return JSON with device, house, and telemetry_summary
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 15. Implement telemetry ingestion endpoint
  - Create POST `/api/v1/devices/:id/metrics` route with authenticate middleware
  - Extract device_id from URL parameter and timestamp, metrics from request body
  - Validate device exists in PostgreSQL
  - Insert document into MongoDB telemetry collection with device_id, ts, metrics
  - Update device last_seen timestamp in PostgreSQL
  - Return success confirmation with MongoDB document ID
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 16. Implement alerts-by-day metrics endpoint
  - Create GET `/api/v1/metrics/alerts-by-day` route with authenticate middleware
  - Extract query parameters: owner_id, start_date, end_date (default last 30 days)
  - If user is OWNER, filter by houses they own
  - Query alerts table grouped by DATE(occurred_at)
  - Aggregate counts: total, low, medium, high, critical
  - Order by date ascending
  - Return JSON with items array containing daily metrics
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [x] 17. Implement device metrics endpoint
  - Create GET `/api/v1/metrics/device/:id` route with authenticate middleware
  - Extract device_id from URL parameter
  - Verify user has access to device
  - Calculate uptime percentage from heartbeat/last_seen data
  - Count total alerts generated by device from alerts table
  - Query MongoDB telemetry collection for average SNR over last 7 days
  - Get last_seen timestamp from device record or latest telemetry
  - Return JSON with device_id, uptimePct, alertsGenerated, avgSnr, lastSeen
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [ ] 18. Implement ML prediction endpoint
  - Create POST `/api/v1/ml/predict` route with authenticate middleware
  - Extract device_id, window_uri, timestamp, features from request body
  - For development: return mock prediction with label 'glass_break' and score 0.91
  - Insert inference result into MongoDB ml_inference collection
  - Return JSON with prediction label, score, and inference_id
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

## Phase 2: Alert Management Enhancement

- [ ] 19. Update alert ingestion endpoint with PostgreSQL
  - Update POST `/api/v1/alerts/ingest` route to use PostgreSQL instead of SQLite
  - Add authenticate middleware
  - Validate house_id and device_id exist in database
  - Use ML-based severity decision engine with score, duration, quiet hours
  - Insert alert into PostgreSQL alerts table with UUID primary key
  - Insert history entry into alert_history table
  - Broadcast alert.new event via WebSocket
  - Log notification simulation
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 20. Update alert search endpoint with PostgreSQL
  - Update POST `/api/v1/alerts/search` route to use PostgreSQL
  - Add authenticate middleware
  - Add owner access control: filter by houses user owns if not admin
  - Support filtering by severity, status, state, type, since, house_id, device_id
  - Support pagination with limit parameter
  - Execute query with parameterized SQL
  - Return JSON with items array
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 21. Implement alert stats/KPI endpoint
  - Create GET `/api/v1/alerts/stats` route with authenticate middleware
  - Calculate open alerts count (state IN ('new', 'escalated'))
  - Calculate MTTA in seconds using AVG(acknowledged_at - occurred_at)
  - Calculate MTTR in seconds using AVG(resolved_at - occurred_at)
  - Aggregate severity breakdown with counts by severity level
  - Aggregate state breakdown with counts by state
  - Count total alerts and alerts in last 24 hours
  - Return JSON with openCount, mttaSec, mttrSec, bySeverity, byState, totalAlerts, recentAlerts
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 22. Update alert detail endpoint with PostgreSQL
  - Update GET `/api/v1/alerts/:id` route to use PostgreSQL
  - Add authenticate middleware
  - Verify user has access to alert's house
  - Query alerts table with JOIN to houses and devices for context
  - Query alert_history table for complete history ordered by ts ascending
  - Return JSON with alert object (including house and device info) and history array
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 26.1, 26.2, 26.3, 26.4_

- [ ] 23. Update alert acknowledge endpoint with PostgreSQL
  - Update POST `/api/v1/alerts/:id/ack` route to use PostgreSQL
  - Add authenticate middleware
  - Use req.user.user_id as actor instead of request body
  - Validate state transition (cannot ack if resolved or already acked)
  - Return 409 error for invalid state transitions
  - Update alerts table with state='acked', status='acknowledged', acknowledged_by, acknowledged_at
  - Insert history entry with action='ack'
  - Broadcast alert.acked event via WebSocket
  - Return JSON with state and acknowledged_at
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 28.1, 28.2_

- [ ] 24. Update alert escalate endpoint with PostgreSQL
  - Update POST `/api/v1/alerts/:id/escalate` route to use PostgreSQL
  - Add authenticate middleware
  - Validate state transition (cannot escalate if resolved)
  - Return 409 error for invalid state transitions
  - Increment escalation_level
  - Update alerts table with state='escalated', status='escalated', escalated_at, escalation_level
  - Insert history entry with action='escalate'
  - Broadcast alert.escalated event via WebSocket
  - Return JSON with state and escalation_level
  - _Requirements: 28.3_

- [ ] 25. Update alert resolve endpoint with PostgreSQL
  - Update POST `/api/v1/alerts/:id/resolve` route to use PostgreSQL
  - Add authenticate middleware
  - Require note parameter, return 400 if missing
  - Use req.user.user_id as actor
  - Update alerts table with state='resolved', status='resolved', resolved_by, resolved_at
  - Insert history entry with action='resolve' and note
  - Broadcast alert.resolved event via WebSocket
  - Return JSON with state and resolved_at
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 27.1, 27.2, 27.3, 27.4, 27.5_

## Phase 3: React Dashboard (Sujan's Component)

- [ ] 26. Set up React application structure
  - Create `dashboard/` directory for React app
  - Initialize Vite project with React and TypeScript template
  - Install dependencies: react-router-dom, recharts, date-fns, axios
  - Create folder structure: components/, services/, hooks/, context/, types/
  - Configure Vite proxy to backend API at port 3000
  - _Requirements: 23.1, 24.1, 25.1_

- [ ] 27. Create TypeScript type definitions
  - Create `types/user.ts` with User, UserRole interfaces
  - Create `types/alert.ts` with Alert, AlertHistory, AlertState, Severity interfaces
  - Create `types/device.ts` with Device, DeviceType, Telemetry interfaces
  - Create `types/api.ts` with API response types
  - _Requirements: 23.1, 24.1, 25.1_

- [ ] 28. Implement API service layer
  - Create `services/api.ts` with ApiService class
  - Implement request method with authentication header injection
  - Implement automatic token refresh on 401 responses
  - Implement error handling and retry logic
  - Export singleton instance
  - _Requirements: 14.1, 14.2, 14.3_

- [ ] 29. Implement authentication service
  - Create `services/auth.ts` with login, logout, refresh, register functions
  - Implement token storage in localStorage
  - Implement getCurrentUser function that decodes JWT
  - Export authentication functions
  - _Requirements: 11.1, 12.1, 13.1_

- [ ] 30. Implement alerts service
  - Create `services/alerts.ts` with searchAlerts, getAlert, ackAlert, escalateAlert, resolveAlert, getStats functions
  - Use ApiService for all HTTP requests
  - Export alert service functions
  - _Requirements: 9.1, 4.1, 5.1, 6.1, 23.1_

- [ ] 31. Implement devices service
  - Create `services/devices.ts` with getDevices, getDevice, createDevice, getDeviceMetrics functions
  - Use ApiService for all HTTP requests
  - Export device service functions
  - _Requirements: 16.1, 17.1, 18.1, 21.1_

- [ ] 32. Create AuthContext and provider
  - Create `context/AuthContext.tsx` with user state, login, logout, isAuthenticated
  - Implement useAuth hook for consuming context
  - Wrap App with AuthProvider
  - Persist authentication state across page refreshes
  - _Requirements: 11.1, 13.1, 14.1_

- [ ] 33. Create WebSocket context and hook
  - Create `context/WebSocketContext.tsx` with connection state
  - Implement useWebSocket hook with connect, disconnect, subscribe functions
  - Implement reconnection logic with exponential backoff (max 10 attempts)
  - Emit custom events for WebSocket messages
  - _Requirements: 10.1, 10.2, 10.3, 29.1, 29.2, 29.3, 29.4_

- [ ] 34. Implement LoginForm component
  - Create `components/auth/LoginForm.tsx` with email and password inputs
  - Handle form submission calling auth.login
  - Store tokens in localStorage on success
  - Display error messages for invalid credentials
  - Redirect to dashboard on successful login
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 35. Implement ProtectedRoute component
  - Create `components/auth/ProtectedRoute.tsx` wrapper component
  - Check authentication status from AuthContext
  - Redirect to login if not authenticated
  - Render children if authenticated
  - _Requirements: 14.1, 14.2_

- [ ] 36. Implement KPICard component
  - Create `components/dashboard/KPICard.tsx` with title, value, subtitle props
  - Style with card layout, large value text, and optional trend indicator
  - Support loading state
  - _Requirements: 23.1, 23.2, 23.3_

- [ ] 37. Implement SeverityChart component
  - Create `components/dashboard/SeverityChart.tsx` using Recharts BarChart
  - Accept bySeverity data prop with counts for low, medium, high, critical
  - Use color coding: low=green, medium=yellow, high=orange, critical=red
  - Display tooltip with severity and count
  - _Requirements: 23.4_

- [ ] 38. Implement AlertsTrendChart component
  - Create `components/dashboard/AlertsTrendChart.tsx` using Recharts LineChart
  - Accept alertsByDay data prop with date and count
  - Format dates using date-fns
  - Display tooltip with date and alert count
  - _Requirements: 23.5_

- [ ] 39. Implement DashboardHome page
  - Create `components/dashboard/DashboardHome.tsx` page component
  - Fetch stats from /api/v1/alerts/stats on mount
  - Fetch alerts-by-day from /api/v1/metrics/alerts-by-day for last 7 days
  - Render 4 KPICard components for Open Alerts, MTTA, MTTR, Total Alerts
  - Render SeverityChart with bySeverity data
  - Render AlertsTrendChart with alertsByDay data
  - Subscribe to WebSocket for real-time KPI updates
  - Format MTTA and MTTR in human-readable format (e.g., "5m 30s")
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 40. Implement SeverityChip component
  - Create `components/common/SeverityChip.tsx` with severity prop
  - Render badge with color coding: low=green, medium=yellow, high=orange, critical=red
  - Use consistent styling with padding and border-radius
  - _Requirements: 24.2, 26.2_

- [ ] 41. Implement StateChip component
  - Create `components/common/StateChip.tsx` with state prop
  - Render badge with color coding: new=blue, acked=yellow, escalated=orange, resolved=gray
  - Use consistent styling with padding and border-radius
  - _Requirements: 24.2, 26.2_

- [ ] 42. Implement AlertRow component
  - Create `components/alerts/AlertRow.tsx` with alert prop and action callbacks
  - Display occurred time formatted with date-fns
  - Display house, device, type, SeverityChip, StateChip, score
  - Render inline Acknowledge and Escalate buttons based on state
  - Disable buttons during API requests
  - Call onAck and onEscalate callbacks when buttons clicked
  - _Requirements: 24.2, 24.4, 28.1, 28.2, 28.3_

- [ ] 43. Implement LiveAlertsFeed page
  - Create `components/alerts/LiveAlertsFeed.tsx` page component
  - Fetch initial alerts from /api/v1/alerts/search with state filter (new, escalated)
  - Render table with AlertRow components
  - Subscribe to WebSocket for alert.new, alert.acked, alert.escalated events
  - Prepend new alerts to top of list on alert.new event
  - Update existing rows on alert.acked and alert.escalated events
  - Implement optimistic UI updates for acknowledge and escalate actions
  - Handle errors with toast notifications
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [ ] 44. Implement AlertFilters component
  - Create `components/alerts/AlertFilters.tsx` with filter state and onChange callback
  - Render date range picker for start_date and end_date
  - Render multi-select dropdown for severity (low, medium, high, critical)
  - Render single-select dropdown for state (all, new, acked, escalated, resolved)
  - Render dropdowns for house and device (populated from API)
  - Debounce onChange callback by 300ms to reduce API calls
  - _Requirements: 25.2, 25.3_

- [ ] 45. Implement AlertHistory page
  - Create `components/alerts/AlertHistory.tsx` page component
  - Render AlertFilters component
  - Fetch filtered alerts from /api/v1/alerts/search when filters change
  - Implement pagination with page size selector (25, 50, 100)
  - Render table with checkboxes for row selection
  - Render bulk acknowledge button that calls /api/v1/alerts/:id/ack for selected rows
  - Display loading spinner during API requests
  - Handle errors with toast notifications
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

- [ ] 46. Implement AlertDetailDrawer component
  - Create `components/alerts/AlertDetailDrawer.tsx` with alertId prop and onClose callback
  - Fetch alert details from /api/v1/alerts/:id on mount
  - Render header section with type, SeverityChip, StateChip, timestamps
  - Render context section with house address, device name, ML score if available
  - Render history timeline with action icons, formatted timestamps, actors, notes
  - Render state-aware action buttons: new→Ack+Escalate, acked→Resolve, escalated→Ack+Resolve, resolved→none
  - Implement resolve modal with required note textarea
  - Validate note is not empty before submitting resolve
  - Call appropriate API endpoints for acknowledge, escalate, resolve actions
  - Handle 409 conflicts with toast "Already resolved/acknowledged, refreshing..." and reload alert
  - Refresh alert data after successful actions
  - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 27.1, 27.2, 27.3, 27.4, 27.5, 28.1, 28.2, 28.3, 28.4_

- [ ] 47. Implement Toast notification system
  - Create `components/common/Toast.tsx` component with message, type (success, error, info), duration props
  - Create useToast hook for showing toasts
  - Implement auto-dismiss after duration (default 5 seconds)
  - Support manual dismiss with close button
  - Position toasts in top-right corner with stacking
  - _Requirements: 27.5, 29.1_

- [ ] 48. Implement reconnection banner
  - Create `components/common/ReconnectionBanner.tsx` component
  - Display banner when WebSocket disconnected
  - Show "Reconnecting..." message with attempt count
  - Hide banner when connection restored
  - Style with yellow background and prominent positioning
  - _Requirements: 29.1, 29.2, 29.3_

- [ ] 49. Implement DeviceList component
  - Create `components/devices/DeviceList.tsx` page component
  - Fetch devices from /api/v1/devices with filters
  - Render table with device_id, house, type, status, name, last_seen
  - Implement filters for house, status, device_type
  - Implement pagination
  - Render "Register Device" button opening DeviceForm modal
  - Handle row click to show device metrics
  - _Requirements: 16.1, 16.2, 16.3, 17.1_

- [ ] 50. Implement DeviceForm component
  - Create `components/devices/DeviceForm.tsx` modal component
  - Render form with inputs for house_id, device_type, name
  - Validate required fields
  - Call /api/v1/devices POST endpoint on submit
  - Close modal and refresh device list on success
  - Display validation errors inline
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 51. Implement DeviceMetrics component
  - Create `components/devices/DeviceMetrics.tsx` component with deviceId prop
  - Fetch metrics from /api/v1/metrics/device/:id
  - Display uptime percentage, alerts generated, average SNR, last seen
  - Render small charts for telemetry trends
  - Auto-refresh every 30 seconds
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [ ] 52. Set up React Router with routes
  - Create `App.tsx` with BrowserRouter
  - Define routes: /login, /dashboard, /alerts/live, /alerts/history, /devices
  - Wrap protected routes with ProtectedRoute component
  - Implement navigation menu with links to all pages
  - Add logout button in header
  - _Requirements: 23.1, 24.1, 25.1_

- [ ] 53. Implement accessibility features
  - Add keyboard navigation support to all interactive elements
  - Create ARIA live region for new alert announcements in LiveAlertsFeed
  - Ensure color contrast ratio of 4.5:1 for all text
  - Add visible focus indicators with outline style
  - Add aria-label attributes to all buttons and form inputs
  - Test with keyboard-only navigation
  - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_

- [ ] 54. Add error boundary component
  - Create `components/common/ErrorBoundary.tsx` React error boundary
  - Catch and display errors gracefully
  - Log errors to console
  - Provide "Reload" button to recover
  - _Requirements: 27.5_

- [ ] 55. Implement loading states
  - Create `components/common/LoadingSpinner.tsx` component
  - Add loading states to all data-fetching components
  - Display spinner during API requests
  - Disable buttons during loading
  - _Requirements: 23.1, 24.1, 25.1_

## Phase 4: Integration & Testing

- [ ] 56. Create database seed script
  - Create `server/db/seed.js` script
  - Insert sample users with different roles (owner, admin, caregiver)
  - Insert sample houses for each owner
  - Insert sample devices for each house
  - Insert sample alerts with various states and severities
  - Insert sample alert history entries
  - Insert sample telemetry data into MongoDB
  - _Requirements: 8.1, 15.1, 16.1_

- [ ] 57. Create environment setup documentation
  - Create `README.md` with setup instructions
  - Document PostgreSQL setup and schema initialization
  - Document MongoDB setup
  - Document environment variables in .env file
  - Document how to run seed script
  - Document how to start backend and frontend servers
  - _Requirements: 8.1, 19.1_

- [ ] 58. Implement backend integration tests
  - Create `server/tests/` directory
  - Write test for login endpoint with valid and invalid credentials
  - Write test for token refresh flow
  - Write test for protected endpoint with and without auth
  - Write test for alert ingestion with PostgreSQL
  - Write test for alert search with filters
  - Write test for alert lifecycle (create, ack, escalate, resolve)
  - Write test for device registration and metrics
  - Write test for telemetry ingestion to MongoDB
  - _Requirements: 11.1, 12.1, 7.1, 9.1, 5.1, 6.1, 17.1, 19.1_

- [ ] 59. Implement frontend unit tests
  - Create tests for API service with mocked fetch
  - Create tests for useWebSocket hook with mocked WebSocket
  - Create tests for AlertRow component rendering
  - Create tests for AlertFilters component with debouncing
  - Create tests for state-aware button visibility in AlertDetailDrawer
  - _Requirements: 24.2, 25.2, 28.1, 28.2, 28.3, 28.4_

- [ ] 60. Create end-to-end test scenarios
  - Write E2E test for complete alert lifecycle from dashboard
  - Write E2E test for real-time alert updates via WebSocket
  - Write E2E test for filtering and pagination in alert history
  - Write E2E test for device registration and metrics viewing
  - Write E2E test for authentication flow (login, protected routes, logout)
  - _Requirements: 11.1, 24.3, 25.3, 17.1, 21.1_


