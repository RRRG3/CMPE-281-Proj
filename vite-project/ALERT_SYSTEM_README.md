# Alert Monitoring System - Local Demo

## ✅ System is Running!

Both servers are now running:
- **Backend API**: http://localhost:5174
- **WebSocket**: ws://localhost:5174/ws
- **Frontend**: http://localhost:5173

## 🚀 Quick Test

1. **Open the Owner Dashboard**:
   - Navigate to: http://localhost:5173/owner-dashboard.html
   - Click on the "Live Alerts" tab in the navigation

2. **Generate Test Alerts**:
   - Click "Generate Glass Break" → Creates a HIGH severity alert
   - Click "Generate Smoke Alarm" → Creates a CRITICAL severity alert
   - Click "Generate Dog Bark" → Creates a LOW severity alert
   - Watch the alerts appear instantly via WebSocket! ⚡

3. **View Alert Details**:
   - Click "View" on any alert
   - You'll see the alert detail page with full information
   - Click "Acknowledge" to mark the alert as acknowledged
   - Click "Resolve" to mark it as resolved
   - Watch the history timeline update in real-time

4. **Filter Alerts**:
   - Use the Status dropdown to filter by: All, open, acknowledged, resolved
   - The table updates instantly

## 📁 Files Created

### Backend (`server/`)
- `package.json` - Dependencies and scripts
- `index.js` - Express server with SQLite database and WebSocket
- `data.db` - SQLite database (auto-created on first run)

### Frontend (`src/assets/js/`)
- `api.js` - HTTP and WebSocket utility functions
- `alerts-list.js` - Live alerts table with real-time updates
- `alert-detail-live.js` - Alert detail page with acknowledge/resolve

### Styles (`src/assets/css/`)
- Added pill badges and table styles to `base.css`

## 🔧 How It Works

1. **Alert Ingestion**: IoT devices (or test buttons) POST to `/api/v1/alerts/ingest`
2. **Database Storage**: Alerts stored in SQLite with full audit trail
3. **WebSocket Broadcast**: All connected clients receive real-time updates
4. **Frontend Updates**: UI updates instantly without page refresh
5. **Lifecycle Management**: Acknowledge → Resolve workflow with history tracking

## 📊 API Endpoints

- `POST /api/v1/alerts/ingest` - Create new alert
- `POST /api/v1/alerts/search` - Search/filter alerts
- `GET /api/v1/alerts/:id` - Get alert details + history
- `POST /api/v1/alerts/:id/ack` - Acknowledge alert
- `POST /api/v1/alerts/:id/resolve` - Resolve alert

## 🎯 Severity Rules

- `glass_break` → HIGH
- `smoke_alarm` → CRITICAL
- `dog_bark` → LOW
- Unknown types → LOW (default)

## 🔍 Console Logs

Check the backend terminal for notification logs:
```
[notify] would email owner@example.com about smoke_alarm (critical)
```

## 🛑 Stop Servers

To stop the servers, press `Ctrl+C` in each terminal window.

## 🚀 Restart Servers

Backend:
```bash
cd server
npm run dev
```

Frontend:
```bash
cd vite-project
npm run dev
```

## 💡 Tips

- The WebSocket connection is automatic - no manual connection needed
- Alerts persist in the SQLite database across server restarts
- Open multiple browser tabs to see real-time sync across clients
- Check browser console for any errors or WebSocket messages

Enjoy your real-time alert monitoring system! 🎉
