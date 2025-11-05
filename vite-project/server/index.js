import express from 'express';
import cors from 'cors';
import http from 'http';
import Database from 'better-sqlite3';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';

const PORT = process.env.PORT || 5174;
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

// HTTP + WS
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => ws.send(JSON.stringify({ type: 'hello', payload: 'connected' })));

server.listen(PORT, () => console.log(`API at http://localhost:${PORT}  WS at ws://localhost:${PORT}/ws`));
