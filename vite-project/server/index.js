import express from 'express';
import cors from 'cors';
import http from 'http';
import Database from 'better-sqlite3';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('data.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  house_id TEXT,
  device_id TEXT,
  type TEXT,
  severity TEXT,
  status TEXT,
  message TEXT,
  ts TEXT,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolved_by TEXT,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS alert_history (
  id TEXT PRIMARY KEY,
  alert_id TEXT,
  action TEXT,
  actor TEXT,
  note TEXT,
  ts TEXT
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE,
  tenant TEXT,
  location TEXT,
  type TEXT,
  status TEXT,
  heartbeat TEXT,
  firmware TEXT,
  config TEXT,
  last_seen TEXT,
  created_at TEXT,
  updated_at TEXT
);
`);

const RULES = { glass_break: 'high', smoke_alarm: 'critical', dog_bark: 'low' };

const insertAlert = db.prepare(`
  INSERT INTO alerts (id, tenant_id, house_id, device_id, type, severity, status, message, ts)
  VALUES (@id, @tenant_id, @house_id, @device_id, @type, @severity, 'open', @message, @ts)
`);
const updateAck = db.prepare(`
  UPDATE alerts SET status='acknowledged', acknowledged_by=@actor, acknowledged_at=@ts WHERE id=@id
`);
const updateResolve = db.prepare(`
  UPDATE alerts SET status='resolved', resolved_by=@actor, resolved_at=@ts WHERE id=@id
`);
const selectAlert = db.prepare(`SELECT * FROM alerts WHERE id = ?`);
const insertHistory = db.prepare(`
  INSERT INTO alert_history (id, alert_id, action, actor, note, ts)
  VALUES (@id, @alert_id, @action, @actor, @note, @ts)
`);

// Device prepared statements
const insertDevice = db.prepare(`
  INSERT INTO devices (id, device_id, tenant, location, type, status, heartbeat, firmware, config, last_seen, created_at, updated_at)
  VALUES (@id, @device_id, @tenant, @location, @type, @status, @heartbeat, @firmware, @config, @last_seen, @created_at, @updated_at)
`);
const updateDevice = db.prepare(`
  UPDATE devices SET tenant=@tenant, location=@location, type=@type, status=@status, 
    heartbeat=@heartbeat, firmware=@firmware, config=@config, last_seen=@last_seen, updated_at=@updated_at
  WHERE id=@id
`);
const selectDevice = db.prepare(`SELECT * FROM devices WHERE id = ?`);
const selectAllDevices = db.prepare(`SELECT * FROM devices ORDER BY created_at DESC`);

function nowISO() { return new Date().toISOString(); }

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

app.post('/api/v1/alerts/ingest', (req, res) => {
  const { tenant_id='t1', house_id='h1', device_id='dev1', type, message='' } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type required' });
  const severity = RULES[type] || 'low';
  const alert = {
    id: nanoid(),
    tenant_id, house_id, device_id,
    type, severity, message,
    ts: nowISO()
  };
  insertAlert.run(alert);
  insertHistory.run({ id: nanoid(), alert_id: alert.id, action: 'created', actor: 'system', note: message, ts: alert.ts });
  broadcast('alert.created', selectAlert.get(alert.id));
  // "Notification" log for demo (email would be here)
  console.log(`[notify] would email owner@example.com about ${type} (${severity})`);
  insertHistory.run({ id: nanoid(), alert_id: alert.id, action: 'notify', actor: 'system', note: 'email owner@example.com', ts: nowISO() });
  return res.json({ id: alert.id, severity, status: 'open' });
});

app.post('/api/v1/alerts/search', (req, res) => {
  const { severity, status, type, limit=50, since } = req.body || {};
  const where = [];
  const params = [];
  if (severity) { where.push('severity = ?'); params.push(severity); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (type) { where.push('type = ?'); params.push(type); }
  if (since) { where.push('ts >= ?'); params.push(since); }
  const sql = `SELECT * FROM alerts ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY ts DESC LIMIT ?`;
  params.push(limit);
  const items = db.prepare(sql).all(...params);
  res.json({ items });
});

app.get('/api/v1/alerts/:id', (req, res) => {
  const alert = selectAlert.get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'not found' });
  const history = db.prepare(`SELECT * FROM alert_history WHERE alert_id=? ORDER BY ts ASC`).all(alert.id);
  res.json({ alert, history });
});

app.post('/api/v1/alerts/:id/ack', (req, res) => {
  const id = req.params.id;
  const actor = (req.body && req.body.actor) || 'demoUser';
  const ts = nowISO();
  updateAck.run({ id, actor, ts });
  insertHistory.run({ id: nanoid(), alert_id: id, action: 'ack', actor, note: '', ts });
  const updated = selectAlert.get(id);
  broadcast('alert.updated', updated);
  res.json({ status: updated?.status || 'acknowledged' });
});

app.post('/api/v1/alerts/:id/resolve', (req, res) => {
  const id = req.params.id;
  const actor = (req.body && req.body.actor) || 'demoUser';
  const ts = nowISO();
  updateResolve.run({ id, actor, ts });
  insertHistory.run({ id: nanoid(), alert_id: id, action: 'resolve', actor, note: '', ts });
  const updated = selectAlert.get(id);
  broadcast('alert.updated', updated);
  res.json({ status: updated?.status || 'resolved' });
});

// ============ DEVICE MANAGEMENT ENDPOINTS ============

// POST /api/v1/devices - Register a new device
app.post('/api/v1/devices', (req, res) => {
  const { deviceId, tenant, location, type, status='online', firmware='v2.4.1', config={} } = req.body || {};
  
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  if (!tenant) return res.status(400).json({ error: 'tenant required' });
  if (!location) return res.status(400).json({ error: 'location required' });
  if (!type) return res.status(400).json({ error: 'type required' });
  
  const device = {
    id: nanoid(),
    device_id: deviceId,
    tenant,
    location,
    type,
    status,
    heartbeat: 'Just registered',
    firmware,
    config: JSON.stringify(config),
    last_seen: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO()
  };
  
  try {
    insertDevice.run(device);
    const created = selectDevice.get(device.id);
    console.log(`[device] Registered ${deviceId} for ${tenant} at ${location}`);
    broadcast('device.created', created);
    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Device ID already exists' });
    }
    console.error('Device creation error:', err);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

// GET /api/v1/devices - List all devices
app.get('/api/v1/devices', (req, res) => {
  const devices = selectAllDevices.all();
  res.json({ items: devices, count: devices.length });
});

// GET /api/v1/devices/:id - Get device details
app.get('/api/v1/devices/:id', (req, res) => {
  const device = selectDevice.get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

// PUT /api/v1/devices/:id - Update device configuration
app.put('/api/v1/devices/:id', (req, res) => {
  const id = req.params.id;
  const existing = selectDevice.get(id);
  
  if (!existing) return res.status(404).json({ error: 'Device not found' });
  
  const { tenant, location, type, status, firmware, config } = req.body || {};
  
  const updated = {
    id,
    tenant: tenant || existing.tenant,
    location: location || existing.location,
    type: type || existing.type,
    status: status || existing.status,
    heartbeat: existing.heartbeat,
    firmware: firmware || existing.firmware,
    config: config ? JSON.stringify(config) : existing.config,
    last_seen: nowISO(),
    updated_at: nowISO()
  };
  
  updateDevice.run(updated);
  const result = selectDevice.get(id);
  console.log(`[device] Updated ${result.device_id}: config=${updated.config}`);
  broadcast('device.updated', result);
  res.json(result);
});

// DELETE /api/v1/devices/:id - Remove device
app.delete('/api/v1/devices/:id', (req, res) => {
  const device = selectDevice.get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  
  db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  console.log(`[device] Deleted ${device.device_id}`);
  broadcast('device.deleted', { id: req.params.id });
  res.json({ success: true, message: 'Device deleted' });
});

// POST /api/v1/devices/:id/heartbeat - Simulate device heartbeat (MQTT simulation)
app.post('/api/v1/devices/:id/heartbeat', (req, res) => {
  const device = selectDevice.get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  
  const { status='online' } = req.body || {};
  const ts = nowISO();
  
  db.prepare('UPDATE devices SET status=?, last_seen=?, heartbeat=? WHERE id=?')
    .run(status, ts, 'Just now', req.params.id);
  
  const updated = selectDevice.get(req.params.id);
  console.log(`[mqtt-sim] device/${device.device_id}/status: ${status} at ${ts}`);
  broadcast('device.heartbeat', updated);
  res.json({ success: true, last_seen: ts, status });
});

// HTTP + WS
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => ws.send(JSON.stringify({ type: 'hello', payload: 'connected' })));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 API: http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket: ws://0.0.0.0:${PORT}/ws`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
