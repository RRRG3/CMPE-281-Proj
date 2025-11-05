# Implementation Plan

- [ ] 1. Set up backend server structure and dependencies
  - Create `server/` directory in project root
  - Create `server/package.json` with Express, better-sqlite3, ws, nanoid, cors dependencies and nodemon dev dependency
  - Create `server/index.js` as main entry point
  - _Requirements: 7.1, 8.1, 10.1_

- [ ] 2. Implement database initialization and schema
  - Initialize SQLite database with better-sqlite3 in `server/index.js`
  - Enable WAL mode with `db.pragma('journal_mode = WAL')`
  - Create `alerts` table with all required columns (id, tenant_id, house_id, device_id, type, severity, status, message, ts, acknowledged_by, acknowledged_at, resolved_by, resolved_at)
  - Create `alert_history` table with columns (id, alert_id, action, actor, note, ts)
  - Create prepared statements for insertAlert, updateAck, updateResolve, selectAlert, insertHistory
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 3. Implement severity rules engine and utility functions
  - Create RULES object mapping alert types to severity levels (glass_break: 'high', smoke_alarm: 'critical', dog_bark: 'low')
  - Implement `nowISO()` function to generate ISO 8601 timestamps
  - Implement `broadcast(type, payload)` function for WebSocket message distribution
  - _Requirements: 7.4, 3.3, 3.4, 3.5_

- [ ] 4. Implement alert ingestion endpoint
  - Create POST `/api/v1/alerts/ingest` route in Express
  - Extract tenant_id, house_id, device_id, type, message from request body with defaults
  - Validate that type parameter is provided, return 400 error if missing
  - Look up severity from RULES object, default to 'low'
  - Generate unique alert ID using nanoid
  - Insert alert record with status 'open' using insertAlert prepared statement
  - Insert history entry with action 'created' and actor 'system'
  - Broadcast alert.created event via WebSocket
  - Log notification message to console (email simulation)
  - Insert history entry with action 'notify'
  - Return JSON response with alert id, severity, and status
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 5. Implement alert search endpoint
  - Create POST `/api/v1/alerts/search` route in Express
  - Extract severity, status, type, limit (default 50), since from request body
  - Build dynamic SQL WHERE clause based on provided filters
  - Execute query with prepared statement using filter parameters
  - Order results by timestamp descending
  - Return JSON response with items array containing matching alerts
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 6. Implement alert detail endpoint
  - Create GET `/api/v1/alerts/:id` route in Express
  - Extract alert ID from URL parameter
  - Query alert using selectAlert prepared statement
  - Return 404 error if alert not found
  - Query alert_history table for all entries matching alert_id, ordered by timestamp ascending
  - Return JSON response with alert object and history array
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Implement alert acknowledge endpoint
  - Create POST `/api/v1/alerts/:id/ack` route in Express
  - Extract alert ID from URL parameter and actor from request body (default 'demoUser')
  - Generate current timestamp
  - Update alert status to 'acknowledged' with acknowledged_by and acknowledged_at using updateAck prepared statement
  - Insert history entry with action 'ack'
  - Retrieve updated alert using selectAlert
  - Broadcast alert.updated event via WebSocket
  - Return JSON response with updated status
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. Implement alert resolve endpoint
  - Create POST `/api/v1/alerts/:id/resolve` route in Express
  - Extract alert ID from URL parameter and actor from request body (default 'demoUser')
  - Generate current timestamp
  - Update alert status to 'resolved' with resolved_by and resolved_at using updateResolve prepared statement
  - Insert history entry with action 'resolve'
  - Retrieve updated alert using selectAlert
  - Broadcast alert.updated event via WebSocket
  - Return JSON response with updated status
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9. Implement WebSocket server
  - Create HTTP server wrapping Express app
  - Create WebSocketServer instance with server and path '/ws'
  - Add connection handler that sends hello message with payload 'connected' to new clients
  - Ensure broadcast function checks ws.readyState === 1 before sending to each client
  - Start server listening on PORT (default 5174)
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 10. Create frontend API utility module
  - Create `assets/js/api.js` file
  - Export API_BASE constant that detects localhost and uses 'http://localhost:5174' or empty string
  - Implement and export `post(path, body)` async function using fetch with POST method, JSON content-type, and body stringification
  - Implement and export `get(path)` async function using fetch with GET method
  - Throw Error with response text for non-ok responses in both functions
  - _Requirements: 1.1, 4.1, 9.1_

- [ ] 11. Create alerts list frontend module
  - Create `assets/js/alerts-list.js` file
  - Import post and API_BASE from api.js
  - Query DOM for #alerts-tbody and #alerts-count elements
  - Implement `rowHtml(alert)` function that generates table row HTML with timestamp, type, house_id, severity pill, status pill, and view link
  - Implement `upsertRow(alert)` function that updates existing row or inserts new row at top of table and updates count
  - Implement `load()` async function that calls search endpoint and populates table with results
  - Call load() on module initialization
  - _Requirements: 1.1, 1.4, 1.5_

- [ ] 12. Implement WebSocket connection in alerts list module
  - Create WebSocket connection to `ws://${location.hostname}:5174/ws` in alerts-list.js
  - Add onmessage handler that parses JSON and calls upsertRow for alert.created and alert.updated message types
  - _Requirements: 1.2, 1.3, 10.1, 10.2, 10.3_

- [ ] 13. Implement alert generators in alerts list module
  - Add click event listener to #gen-glass button that posts to ingest endpoint with type 'glass_break' and message 'Glass shatter in living room'
  - Add click event listener to #gen-smoke button that posts to ingest endpoint with type 'smoke_alarm' and message 'Smoke detected in kitchen'
  - Add click event listener to #gen-dog button that posts to ingest endpoint with type 'dog_bark' and message 'Dog barking at backyard'
  - Use optional chaining for querySelector to handle missing elements
  - _Requirements: 3.1, 3.2_

- [ ] 14. Implement status filter in alerts list module
  - Add change event listener to #filter-status select element
  - Extract selected value (or undefined for empty string)
  - Call search endpoint with status filter and limit 100
  - Update table HTML with filtered results
  - Update count display
  - Use optional chaining for querySelector
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 15. Create alert detail frontend module
  - Create `assets/js/alert-detail.js` file
  - Import get and post from api.js
  - Extract alert ID from URL query parameter using URLSearchParams
  - Query DOM for #alert-meta and #alert-history elements
  - Implement `refresh()` async function that fetches alert and history from detail endpoint
  - In refresh(), populate #alert-meta with alert type, severity, status, message, and formatted creation timestamp
  - In refresh(), populate #alert-history with list items showing formatted timestamp, action, actor, and optional note
  - Call refresh() on module initialization
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 16. Implement acknowledge and resolve actions in alert detail module
  - Add click event listener to #btn-ack button that posts to ack endpoint with actor 'rusheek' and calls refresh()
  - Add click event listener to #btn-resolve button that posts to resolve endpoint with actor 'rusheek' and calls refresh()
  - Use optional chaining for querySelector
  - _Requirements: 5.1, 5.5, 6.1, 6.5_

- [ ] 17. Update owner-dashboard.html with alerts section
  - Add alerts section with h2 containing "Alerts" text and span#alerts-count for count display
  - Add toolbar div with three generator buttons (#gen-glass, #gen-smoke, #gen-dog) with appropriate labels
  - Add status filter label with select#filter-status containing options for "All", "open", "acknowledged", "resolved"
  - Add table with class "table" containing thead with columns for Time, Type, House, Severity, Status, and empty column for actions
  - Add tbody with id "alerts-tbody"
  - Add script tag with type="module" and src="assets/js/alerts-list.js"
  - _Requirements: 1.1, 1.4, 2.1, 3.1_

- [ ] 18. Update alert-detail.html with dynamic containers
  - Add section with h2 "Alert Detail"
  - Add div#alert-meta with class "card" for alert metadata display
  - Add actions div with button#btn-ack labeled "Acknowledge", button#btn-resolve labeled "Resolve", and back link to owner-dashboard.html
  - Add h3 "History"
  - Add ul#alert-history for history entries
  - Add script tag with type="module" and src="assets/js/alert-detail.js"
  - _Requirements: 4.1, 4.5, 5.1, 6.1_

- [ ] 19. Add CSS styles for alert components
  - Add .pill class for badge styling with padding, border-radius, and inline-block display
  - Add .pill-low class with green/success color scheme
  - Add .pill-high class with orange/warning color scheme
  - Add .pill-critical class with red/danger color scheme
  - Add .pill-open class with blue/info color scheme
  - Add .pill-acknowledged class with yellow/warning color scheme
  - Add .pill-resolved class with gray/muted color scheme
  - Add .toolbar class for button/filter layout with flexbox and spacing
  - Add .card class for alert-meta container with padding and border
  - _Requirements: 1.4, 4.1_

- [ ] 20. Create backend integration tests
  - Write test for alert ingestion endpoint verifying database insertion and WebSocket broadcast
  - Write test for search endpoint with various filter combinations
  - Write test for alert detail endpoint including 404 case
  - Write test for acknowledge endpoint verifying status update and history entry
  - Write test for resolve endpoint verifying status update and history entry
  - Write test for severity rules engine with all alert types
  - _Requirements: 7.1, 9.1, 4.1, 5.2, 6.2_

- [ ] 21. Create frontend unit tests
  - Write test for rowHtml function output structure
  - Write test for upsertRow DOM manipulation
  - Write test for API utility functions with mocked fetch
  - Write test for URL parameter extraction in alert detail module
  - _Requirements: 1.4, 4.1_
