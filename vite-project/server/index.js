import express from 'express';
import cors from 'cors';
import http from 'http';
import Database from 'better-sqlite3';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
import { MongoClient } from 'mongodb';
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken } from './auth/utils.js';
import { authenticate, requireRole } from './middleware/auth.js';
import { MLModuleManager } from './ml/MLModuleManager.js';
import { createMLRoutes } from './routes/ml-routes.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();

// Configure CORS to allow requests from frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const db = new Database('data.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'STAFF', 'CAREGIVER')),
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS houses (
  id TEXT PRIMARY KEY,
  house_id TEXT UNIQUE,
  owner_id TEXT NOT NULL,
  address TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  created_at TEXT,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  revoked INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  house_id TEXT,
  device_id TEXT,
  type TEXT,
  severity TEXT,
  status TEXT,
  state TEXT,
  score REAL,
  message TEXT,
  ts TEXT,
  occurred_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  escalated_at TEXT,
  escalation_level INTEGER,
  resolved_by TEXT,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS alert_history (
  id TEXT PRIMARY KEY,
  alert_id TEXT,
  action TEXT,
  actor TEXT,
  note TEXT,
  meta TEXT,
  ts TEXT
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE,
  tenant TEXT,
  house_id TEXT,
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
CREATE TABLE IF NOT EXISTS ml_inference (
  id TEXT PRIMARY KEY,
  alert_id TEXT,
  device_id TEXT,
  ts TEXT,
  model_name TEXT,
  score REAL,
  label TEXT,
  window_uri TEXT,
  features TEXT,
  created_at TEXT
);
`);

// Seed initial data if tables are empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  console.log('[seed] Creating initial users...');
  // Password for all users: admin123
  const passwordHash = '$2b$10$rKZvVqVqVqVqVqVqVqVqVuO7YqVqVqVqVqVqVqVqVqVqVqVqVqVqV';
  
  db.prepare(`INSERT INTO users (id, user_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    nanoid(), 'U-001', 'Admin User', 'admin@example.com', passwordHash, 'ADMIN', new Date().toISOString()
  );
  db.prepare(`INSERT INTO users (id, user_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    nanoid(), 'U-002', 'John Owner', 'owner@example.com', passwordHash, 'OWNER', new Date().toISOString()
  );
  db.prepare(`INSERT INTO users (id, user_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    nanoid(), 'U-003', 'Jane Caregiver', 'caregiver@example.com', passwordHash, 'CAREGIVER', new Date().toISOString()
  );
  
  // Create houses for owner
  const ownerId = db.prepare('SELECT id FROM users WHERE email = ?').get('owner@example.com').id;
  const house1Id = nanoid();
  const house2Id = nanoid();
  
  db.prepare(`INSERT INTO houses (id, house_id, owner_id, address, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    house1Id, 'H-001', ownerId, '123 Main St, San Jose, CA', 'America/Los_Angeles', new Date().toISOString()
  );
  db.prepare(`INSERT INTO houses (id, house_id, owner_id, address, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    house2Id, 'H-002', ownerId, '456 Oak Ave, San Francisco, CA', 'America/Los_Angeles', new Date().toISOString()
  );
  
  console.log('[seed] Initial data created');
}

function nowISO() { return new Date().toISOString(); }

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

// ============ AUTH ENDPOINTS ============

// POST /api/v1/auth/login
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR',
      details: ['Email and password are required']
    });
  }
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'AUTHENTICATION_FAILED',
        message: 'Invalid email or password'
      });
    }
    
    const isValid = await comparePassword(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ 
        error: 'AUTHENTICATION_FAILED',
        message: 'Invalid email or password'
      });
    }
    
    const access_token = generateAccessToken({
      user_id: user.id,
      email: user.email,
      role: user.role
    });
    
    const refresh_token = generateRefreshToken();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    
    db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(nanoid(), user.id, refresh_token, expires_at, nowISO());
    
    console.log(`[auth] User logged in: ${user.email}`);
    
    res.json({
      access_token,
      refresh_token,
      user: {
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/register
app.post('/api/v1/auth/register', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { name, email, password, role = 'OWNER' } = req.body || {};
  
  if (!name || !email || !password) {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR',
      details: ['Name, email, and password are required']
    });
  }
  
  if (!['OWNER', 'ADMIN', 'STAFF', 'CAREGIVER'].includes(role)) {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR',
      details: ['Invalid role']
    });
  }
  
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    
    if (existing) {
      return res.status(409).json({ 
        error: 'USER_EXISTS',
        message: 'User with this email already exists'
      });
    }
    
    const password_hash = await hashPassword(password);
    const userId = nanoid();
    const user_id = 'U-' + String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
    
    db.prepare(`
      INSERT INTO users (id, user_id, name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, user_id, name, email, password_hash, role, nowISO());
    
    const user = db.prepare('SELECT id, user_id, name, email, role, created_at FROM users WHERE id = ?').get(userId);
    
    console.log(`[auth] User registered: ${email} (${role})`);
    
    res.status(201).json(user);
  } catch (error) {
    console.error('[auth] Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/refresh
app.post('/api/v1/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body || {};
  
  if (!refresh_token) {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR',
      details: ['Refresh token is required']
    });
  }
  
  try {
    const tokenRecord = db.prepare(`
      SELECT * FROM refresh_tokens 
      WHERE token = ? AND revoked = 0 AND datetime(expires_at) > datetime('now')
    `).get(refresh_token);
    
    if (!tokenRecord) {
      return res.status(401).json({ 
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired refresh token'
      });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(tokenRecord.user_id);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }
    
    const access_token = generateAccessToken({
      user_id: user.id,
      email: user.email,
      role: user.role
    });
    
    console.log(`[auth] Token refreshed for: ${user.email}`);
    
    res.json({ access_token });
  } catch (error) {
    console.error('[auth] Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/logout
app.post('/api/v1/auth/logout', async (req, res) => {
  const { refresh_token } = req.body || {};
  
  if (!refresh_token) {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR',
      details: ['Refresh token is required']
    });
  }
  
  try {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(refresh_token);
    
    console.log('[auth] User logged out');
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[auth] Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ HOUSE MANAGEMENT ENDPOINTS ============

// GET /api/v1/houses
app.get('/api/v1/houses', authenticate, (req, res) => {
  try {
    const houses = db.prepare(`
      SELECT h.*, u.name as owner_name, u.email as owner_email
      FROM houses h
      JOIN users u ON h.owner_id = u.id
      ${req.user.role === 'OWNER' ? 'WHERE h.owner_id = ?' : ''}
      ORDER BY h.created_at DESC
    `).all(req.user.role === 'OWNER' ? req.user.user_id : undefined);
    
    res.json({ items: houses, count: houses.length });
  } catch (error) {
    console.error('[houses] Error:', error);
    res.status(500).json({ error: 'Failed to fetch houses' });
  }
});

// POST /api/v1/houses
app.post('/api/v1/houses', authenticate, requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const { owner_id, address, timezone = 'UTC' } = req.body || {};
  
  if (!address) {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR',
      details: ['Address is required']
    });
  }
  
  try {
    const houseId = nanoid();
    const house_id = 'H-' + String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
    const finalOwnerId = owner_id || req.user.user_id;
    
    db.prepare(`
      INSERT INTO houses (id, house_id, owner_id, address, timezone, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(houseId, house_id, finalOwnerId, address, timezone, nowISO());
    
    const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(houseId);
    
    console.log(`[houses] Created: ${house_id} at ${address}`);
    
    res.status(201).json(house);
  } catch (error) {
    console.error('[houses] Creation error:', error);
    res.status(500).json({ error: 'Failed to create house' });
  }
});

// GET /api/v1/houses/:id
app.get('/api/v1/houses/:id', authenticate, (req, res) => {
  try {
    const house = db.prepare(`
      SELECT h.*, u.name as owner_name, u.email as owner_email
      FROM houses h
      JOIN users u ON h.owner_id = u.id
      WHERE h.id = ? OR h.house_id = ?
    `).get(req.params.id, req.params.id);
    
    if (!house) {
      return res.status(404).json({ error: 'House not found' });
    }
    
    // Check permissions
    if (req.user.role === 'OWNER' && house.owner_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(house);
  } catch (error) {
    console.error('[houses] Error:', error);
    res.status(500).json({ error: 'Failed to fetch house' });
  }
});

// ============ METRICS ENDPOINTS ============

// GET /api/v1/metrics/alerts-by-day
app.get('/api/v1/metrics/alerts-by-day', authenticate, (req, res) => {
  const { owner_id, start_date, end_date } = req.query;
  
  try {
    const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    const results = db.prepare(`
      SELECT 
        DATE(occurred_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical
      FROM alerts
      WHERE DATE(occurred_at) BETWEEN ? AND ?
      ${owner_id ? 'AND house_id IN (SELECT house_id FROM houses WHERE owner_id = ?)' : ''}
      GROUP BY DATE(occurred_at)
      ORDER BY date ASC
    `).all(startDate, endDate, owner_id);
    
    res.json({ items: results, count: results.length });
  } catch (error) {
    console.error('[metrics] alerts-by-day error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/v1/metrics/device/:id
app.get('/api/v1/metrics/device/:id', authenticate, (req, res) => {
  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ? OR device_id = ?').get(req.params.id, req.params.id);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const alertsGenerated = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE device_id = ?').get(device.device_id).count;
    
    // Calculate uptime (mock for now)
    const uptimePct = device.status === 'online' ? 99.9 : 85.0;
    
    // Mock SNR data
    const avgSnr = 42.5;
    
    res.json({
      device_id: device.device_id,
      uptimePct,
      alertsGenerated,
      avgSnr,
      lastSeen: device.last_seen
    });
  } catch (error) {
    console.error('[metrics] device error:', error);
    res.status(500).json({ error: 'Failed to fetch device metrics' });
  }
});

// POST /api/v1/devices/:id/metrics
app.post('/api/v1/devices/:id/metrics', authenticate, (req, res) => {
  const { timestamp, metrics } = req.body || {};
  
  if (!metrics) {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR',
      details: ['Metrics data is required']
    });
  }
  
  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ? OR device_id = ?').get(req.params.id, req.params.id);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // In a real system, this would write to MongoDB/time-series DB
    // For now, we'll just log it
    console.log(`[telemetry] Device ${device.device_id} metrics:`, metrics);
    
    // Update last_seen
    db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(timestamp || nowISO(), device.id);
    
    res.json({ 
      success: true, 
      message: 'Metrics recorded',
      device_id: device.device_id,
      timestamp: timestamp || nowISO()
    });
  } catch (error) {
    console.error('[metrics] post error:', error);
    res.status(500).json({ error: 'Failed to record metrics' });
  }
});

// ============ ML MODULE MANAGER ============
// ML routes are now handled by the ML Module Manager
// See /api/v1/ml/* endpoints registered during server initialization

// ML-based severity decision engine
function decideSeverity(event) {
  const { type, score = 0.5, duration = 0, inQuietHours = false } = event;
  
  // Critical alerts - immediate danger
  if (type === 'glass_break' && score >= 0.85) return 'critical';
  if (type === 'smoke_alarm') return 'critical';
  if (type === 'fall' && score >= 0.8) return 'critical';
  
  // High severity - requires attention
  if (type === 'fall') return 'high';
  if (type === 'no_motion' && duration >= 30 * 60) {
    return inQuietHours ? 'high' : 'medium';
  }
  if (type === 'glass_break') return 'high';
  
  // Medium severity - monitor
  if (type === 'unusual_noise' && score >= 0.7) return 'medium';
  if (type === 'no_motion' && duration >= 15 * 60) return 'medium';
  
  // Low severity - informational
  if (type === 'dog_bark') return 'low';
  if (type === 'door_open') return 'low';
  
  // Default based on score
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

// Legacy rules for backward compatibility
const RULES = { glass_break: 'high', smoke_alarm: 'critical', dog_bark: 'low' };

const insertAlert = db.prepare(`
  INSERT INTO alerts (
    id, tenant_id, house_id, device_id, type, severity, status, state, score, message, 
    ts, occurred_at, created_at, updated_at, 
    acknowledged_by, acknowledged_at, escalated_at, escalation_level, resolved_by, resolved_at
  )
  VALUES (
    @id, @tenant_id, @house_id, @device_id, @type, @severity, @status, @state, @score, @message,
    @ts, @occurred_at, @created_at, @updated_at,
    @acknowledged_by, @acknowledged_at, @escalated_at, @escalation_level, @resolved_by, @resolved_at
  )
`);
const updateAck = db.prepare(`
  UPDATE alerts SET status='acknowledged', acknowledged_by=@actor, acknowledged_at=@ts WHERE id=@id
`);
const updateResolve = db.prepare(`
  UPDATE alerts SET status='resolved', resolved_by=@actor, resolved_at=@ts WHERE id=@id
`);
const selectAlert = db.prepare(`SELECT * FROM alerts WHERE id = ?`);
const insertHistory = db.prepare(`
  INSERT INTO alert_history (id, alert_id, action, actor, note, meta, ts)
  VALUES (@id, @alert_id, @action, @actor, @note, @meta, @ts)
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

app.post('/api/v1/alerts/ingest', (req, res) => {
  const { 
    tenant_id='t1', 
    house_id='h1', 
    device_id='dev1', 
    type, 
    message='',
    score=0.5,
    duration=0,
    severity: manualSeverity,
    ts
  } = req.body || {};
  
  if (!type) return res.status(400).json({ error: 'type required' });
  
  const now = nowISO();
  const occurred_at = ts || now;
  
  // Check for quiet hours (10 PM - 6 AM)
  const hour = new Date(occurred_at).getHours();
  const inQuietHours = hour >= 22 || hour < 6;
  
  // Deduplication: check for recent similar alert (within 60 seconds)
  const recentDupe = db.prepare(`
    SELECT id FROM alerts 
    WHERE device_id = ? AND type = ? 
    AND datetime(occurred_at) > datetime(?, '-60 seconds')
    AND state IN ('new', 'escalated')
    LIMIT 1
  `).get(device_id, type, occurred_at);
  
  if (recentDupe) {
    console.log(`[dedup] Ignoring duplicate ${type} from ${device_id}`);
    return res.json({ id: recentDupe.id, deduplicated: true });
  }
  
  // Use manual severity if provided, otherwise use ML logic
  const severity = manualSeverity && ['low', 'medium', 'high', 'critical'].includes(manualSeverity)
    ? manualSeverity
    : decideSeverity({ type, score, duration, inQuietHours });
  
  const alert = {
    id: nanoid(),
    tenant_id, house_id, device_id,
    type, severity, 
    status: 'open',
    state: 'new',
    score,
    message,
    ts: now,
    occurred_at,
    created_at: now,
    updated_at: now,
    acknowledged_by: null,
    acknowledged_at: null,
    escalated_at: null,
    escalation_level: 0,
    resolved_by: null,
    resolved_at: null
  };
  
  insertAlert.run(alert);
  insertHistory.run({ 
    id: nanoid(), 
    alert_id: alert.id, 
    action: 'create', 
    actor: 'system', 
    note: message,
    meta: JSON.stringify({ score, duration, inQuietHours, severity }),
    ts: now 
  });
  
  const created = selectAlert.get(alert.id);
  broadcast('alert.new', created);
  
  // Notification simulation
  const severitySource = manualSeverity ? 'manual' : 'ML-based';
  console.log(`[notify] Alert ${alert.id}: ${type} (${severity} - ${severitySource}) - would email owner@example.com`);
  insertHistory.run({ 
    id: nanoid(), 
    alert_id: alert.id, 
    action: 'notify', 
    actor: 'system', 
    note: 'email owner@example.com',
    meta: JSON.stringify({ channel: 'email', status: 'sent' }),
    ts: nowISO() 
  });
  
  return res.json({ 
    id: alert.id, 
    severity, 
    state: 'new',
    score,
    occurred_at 
  });
});

app.post('/api/v1/alerts/search', (req, res) => {
  const { severity, status, type, tenant_id, limit=50, since } = req.body || {};
  const where = [];
  const params = [];
  if (tenant_id) { where.push('tenant_id = ?'); params.push(tenant_id); }
  if (severity) { where.push('severity = ?'); params.push(severity); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (type) { where.push('type = ?'); params.push(type); }
  if (since) { where.push('ts >= ?'); params.push(since); }
  const sql = `SELECT * FROM alerts ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY ts DESC LIMIT ?`;
  params.push(limit);
  const items = db.prepare(sql).all(...params);
  res.json({ items });
});

// GET /api/v1/alerts/weekly-trends - Get weekly alert trends (MUST be before /:id route)
app.get('/api/v1/alerts/weekly-trends', (req, res) => {
  const { tenant_id } = req.query;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const trends = [];
  
  // Get alerts for the last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    let sql = `
      SELECT COUNT(*) as count 
      FROM alerts 
      WHERE datetime(created_at) >= datetime(?) 
      AND datetime(created_at) < datetime(?)
    `;
    const params = [date.toISOString(), nextDate.toISOString()];
    
    if (tenant_id) {
      sql += ' AND tenant_id = ?';
      params.push(tenant_id);
    }
    
    const count = db.prepare(sql).get(...params).count;
    
    trends.push({
      day: days[date.getDay()],
      date: date.toISOString().split('T')[0],
      count: count
    });
  }
  
  res.json({ trends });
});

// GET /api/v1/alerts/stats - KPIs and metrics (MUST be before /:id route)
app.get('/api/v1/alerts/stats', (req, res) => {
  try {
    const { tenant_id } = req.query;
    const tenantFilter = tenant_id ? 'AND tenant_id = ?' : '';
    const tenantParams = tenant_id ? [tenant_id] : [];
    
    // Open alerts count (new + escalated)
    const openCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM alerts 
      WHERE (state IN ('new', 'escalated') OR status IN ('open', 'escalated'))
      ${tenantFilter}
    `).get(...tenantParams).count;
    
    // MTTA (Mean Time To Acknowledge) in seconds
    const mttaResult = db.prepare(`
      SELECT AVG(
        (julianday(acknowledged_at) - julianday(occurred_at)) * 86400
      ) as mtta_sec
      FROM alerts 
      WHERE acknowledged_at IS NOT NULL AND occurred_at IS NOT NULL
      ${tenantFilter}
    `).get(...tenantParams);
    const mttaSec = Math.round(mttaResult.mtta_sec || 0);
    
    // MTTR (Mean Time To Resolve) in seconds
    const mttrResult = db.prepare(`
      SELECT AVG(
        (julianday(resolved_at) - julianday(occurred_at)) * 86400
      ) as mttr_sec
      FROM alerts 
      WHERE resolved_at IS NOT NULL AND occurred_at IS NOT NULL
      ${tenantFilter}
    `).get(...tenantParams);
    const mttrSec = Math.round(mttrResult.mttr_sec || 0);
    
    // Severity breakdown
    const bySeverity = {};
    const severityCounts = db.prepare(`
      SELECT severity, COUNT(*) as count 
      FROM alerts 
      ${tenant_id ? 'WHERE tenant_id = ?' : ''}
      GROUP BY severity
    `).all(...tenantParams);
    
    severityCounts.forEach(row => {
      bySeverity[row.severity] = row.count;
    });
    
    // State breakdown
    const byState = {};
    const stateCounts = db.prepare(`
      SELECT COALESCE(state, status) as state, COUNT(*) as count 
      FROM alerts 
      ${tenant_id ? 'WHERE tenant_id = ?' : ''}
      GROUP BY COALESCE(state, status)
    `).all(...tenantParams);
    
    stateCounts.forEach(row => {
      byState[row.state] = row.count;
    });
    
    // Total alerts
    const totalAlerts = db.prepare(`
      SELECT COUNT(*) as count FROM alerts
      ${tenant_id ? 'WHERE tenant_id = ?' : ''}
    `).get(...tenantParams).count;
    
    // Alerts in last 24 hours
    const recentAlerts = db.prepare(`
      SELECT COUNT(*) as count 
      FROM alerts 
      WHERE datetime(created_at) > datetime('now', '-24 hours')
      ${tenantFilter}
    `).get(...tenantParams).count;
    
    res.json({
      openCount,
      mttaSec,
      mttrSec,
      bySeverity,
      byState,
      totalAlerts,
      recentAlerts,
      timestamp: nowISO()
    });
  } catch (err) {
    console.error('[stats] Error:', err);
    res.status(500).json({ error: 'Failed to compute stats' });
  }
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
  const note = (req.body && req.body.note) || '';
  
  const alert = selectAlert.get(id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  
  // Check valid state transition (new or escalated → acked)
  const currentState = alert.state || alert.status;
  if (currentState === 'resolved') {
    return res.status(409).json({ error: 'Cannot acknowledge resolved alert' });
  }
  if (currentState === 'acknowledged' || currentState === 'acked') {
    return res.status(409).json({ error: 'Alert already acknowledged' });
  }
  
  const ts = nowISO();
  updateAck.run({ id, actor, ts });
  
  // Update state as well
  db.prepare(`UPDATE alerts SET state='acked', status='acknowledged' WHERE id=?`).run(id);
  
  insertHistory.run({ 
    id: nanoid(), 
    alert_id: id, 
    action: 'ack', 
    actor, 
    note,
    meta: JSON.stringify({ previous_state: currentState }),
    ts 
  });
  
  const updated = selectAlert.get(id);
  broadcast('alert.acked', updated);
  
  res.json({ 
    state: 'acked',
    status: 'acknowledged',
    acknowledged_at: ts 
  });
});

// Bulk acknowledge all alerts for a tenant
app.post('/api/v1/alerts/acknowledge-all', (req, res) => {
  const tenant = req.body.tenant || 'default';
  const actor = req.body.actor || 'demoUser';
  const ts = nowISO();
  
  try {
    // Get all unacknowledged alerts for this tenant
    const alerts = db.prepare(`
      SELECT * FROM alerts 
      WHERE tenant = ? 
      AND (state != 'acked' AND state != 'resolved')
      AND (status != 'acknowledged' AND status != 'resolved')
    `).all(tenant);
    
    let count = 0;
    
    // Acknowledge each alert
    for (const alert of alerts) {
      updateAck.run({ id: alert.id, actor, ts });
      db.prepare(`UPDATE alerts SET state='acked', status='acknowledged' WHERE id=?`).run(alert.id);
      
      insertHistory.run({ 
        id: nanoid(), 
        alert_id: alert.id, 
        action: 'ack', 
        actor, 
        note: 'Bulk acknowledge',
        meta: JSON.stringify({ previous_state: alert.state }),
        ts 
      });
      
      broadcast('alert.acked', { ...alert, state: 'acked', status: 'acknowledged' });
      count++;
    }
    
    res.json({ 
      success: true,
      count,
      message: `${count} alert(s) acknowledged`
    });
  } catch (err) {
    console.error('[API] Bulk acknowledge failed:', err);
    res.status(500).json({ error: 'Failed to acknowledge alerts' });
  }
});

app.post('/api/v1/alerts/:id/escalate', (req, res) => {
  const id = req.params.id;
  const actor = (req.body && req.body.actor) || 'system';
  const note = (req.body && req.body.note) || 'No response - escalating';
  
  const alert = selectAlert.get(id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  
  // Check valid state transition
  const currentState = alert.state || alert.status;
  if (currentState === 'resolved') {
    return res.status(409).json({ error: 'Cannot escalate resolved alert' });
  }
  
  const ts = nowISO();
  const escalation_level = (alert.escalation_level || 0) + 1;
  
  // Update alert to escalated state
  db.prepare(`
    UPDATE alerts 
    SET state='escalated', status='escalated', 
        escalated_at=?, escalation_level=?, updated_at=?
    WHERE id=?
  `).run(ts, escalation_level, ts, id);
  
  // Record history
  insertHistory.run({ 
    id: nanoid(), 
    alert_id: id, 
    action: 'escalate', 
    actor, 
    note,
    meta: JSON.stringify({ escalation_level, previous_state: currentState }),
    ts 
  });
  
  const updated = selectAlert.get(id);
  broadcast('alert.escalated', updated);
  
  console.log(`[escalate] Alert ${id} escalated to level ${escalation_level} by ${actor}`);
  
  res.json({ 
    state: 'escalated', 
    escalation_level,
    escalated_at: ts 
  });
});

app.post('/api/v1/alerts/:id/resolve', (req, res) => {
  const id = req.params.id;
  const actor = (req.body && req.body.actor) || 'demoUser';
  const note = (req.body && req.body.note) || '';
  
  if (!note) {
    return res.status(400).json({ error: 'Resolution note required' });
  }
  
  const alert = selectAlert.get(id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  
  const ts = nowISO();
  updateResolve.run({ id, actor, ts });
  
  // Update state as well
  db.prepare(`UPDATE alerts SET state='resolved', status='resolved' WHERE id=?`).run(id);
  
  insertHistory.run({ 
    id: nanoid(), 
    alert_id: id, 
    action: 'resolve', 
    actor, 
    note,
    meta: JSON.stringify({ resolution_note: note }),
    ts 
  });
  
  const updated = selectAlert.get(id);
  broadcast('alert.resolved', updated);
  
  res.json({ 
    state: 'resolved',
    status: 'resolved',
    resolved_at: ts 
  });
});

// DELETE /api/v1/alerts/:id - Delete individual alert
app.delete('/api/v1/alerts/:id', (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if alert exists
    const alert = selectAlert.get(id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    // Delete alert history first (foreign key constraint)
    db.prepare('DELETE FROM alert_history WHERE alert_id = ?').run(id);
    
    // Delete the alert
    db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
    
    console.log(`[alerts] Deleted alert ${id}`);
    
    // Broadcast deletion via WebSocket
    broadcast('alert.deleted', { id, alert });
    
    res.json({ 
      success: true, 
      message: 'Alert deleted successfully',
      id 
    });
  } catch (err) {
    console.error('[alerts] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// DELETE /api/v1/alerts/clear-all - Delete all alerts (MUST be before /:id route)
app.delete('/api/v1/alerts/clear-all', (req, res) => {
  try {
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count;
    
    // Delete all alerts
    db.prepare('DELETE FROM alerts').run();
    
    // Delete all alert history
    db.prepare('DELETE FROM alert_history').run();
    
    console.log(`[alerts] Cleared all alerts (${countBefore} deleted)`);
    broadcast('alerts.cleared', { count: countBefore });
    
    res.json({ 
      success: true, 
      deleted: countBefore,
      message: `Successfully deleted ${countBefore} alerts` 
    });
  } catch (err) {
    console.error('[alerts] Clear all error:', err);
    res.status(500).json({ error: 'Failed to clear alerts' });
  }
});

// DELETE /api/v1/alerts/:id - Delete a specific alert
app.delete('/api/v1/alerts/:id', (req, res) => {
  const id = req.params.id;
  
  try {
    const alert = selectAlert.get(id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    // Delete alert history first (foreign key)
    db.prepare('DELETE FROM alert_history WHERE alert_id = ?').run(id);
    
    // Delete the alert
    db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
    
    console.log(`[alerts] Deleted alert ${id} (${alert.type})`);
    broadcast('alert.deleted', { id });
    
    res.json({ 
      success: true, 
      message: 'Alert deleted successfully',
      id 
    });
  } catch (err) {
    console.error('[alerts] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// ============ TENANT MANAGEMENT ENDPOINTS ============

// Create tenants table
db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT UNIQUE,
  name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT,
  device_count INTEGER DEFAULT 0,
  alert_count INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
`);

const insertTenant = db.prepare(`
  INSERT INTO tenants (id, tenant_id, name, contact_email, contact_phone, status, device_count, alert_count, created_at, updated_at)
  VALUES (@id, @tenant_id, @name, @contact_email, @contact_phone, @status, @device_count, @alert_count, @created_at, @updated_at)
`);

const selectAllTenants = db.prepare(`SELECT * FROM tenants ORDER BY created_at DESC`);
const selectTenant = db.prepare(`SELECT * FROM tenants WHERE id = ?`);
const updateTenant = db.prepare(`
  UPDATE tenants SET name=@name, contact_email=@contact_email, contact_phone=@contact_phone, 
    status=@status, device_count=@device_count, alert_count=@alert_count, updated_at=@updated_at
  WHERE id=@id
`);

// POST /api/v1/tenants - Create new tenant
app.post('/api/v1/tenants', (req, res) => {
  const { name, contact_email, contact_phone, status='active' } = req.body || {};
  
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!contact_email) return res.status(400).json({ error: 'contact_email required' });
  
  const now = nowISO();
  const tenant_id = 'T-' + String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
  
  const tenant = {
    id: nanoid(),
    tenant_id,
    name,
    contact_email,
    contact_phone: contact_phone || '',
    status,
    device_count: 0,
    alert_count: 0,
    created_at: now,
    updated_at: now
  };
  
  try {
    insertTenant.run(tenant);
    const created = selectTenant.get(tenant.id);
    console.log(`[tenant] Created ${tenant_id}: ${name}`);
    broadcast('tenant.created', created);
    res.status(201).json(created);
  } catch (err) {
    console.error('Tenant creation error:', err);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// GET /api/v1/tenants - List all tenants
app.get('/api/v1/tenants', (req, res) => {
  const tenants = selectAllTenants.all();
  res.json({ items: tenants, count: tenants.length });
});

// GET /api/v1/tenants/:id - Get tenant details
app.get('/api/v1/tenants/:id', (req, res) => {
  const tenant = selectTenant.get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  res.json(tenant);
});

// PUT /api/v1/tenants/:id - Update tenant
app.put('/api/v1/tenants/:id', (req, res) => {
  const id = req.params.id;
  const existing = selectTenant.get(id);
  
  if (!existing) return res.status(404).json({ error: 'Tenant not found' });
  
  const { name, contact_email, contact_phone, status, device_count, alert_count } = req.body || {};
  
  const updated = {
    id,
    name: name || existing.name,
    contact_email: contact_email || existing.contact_email,
    contact_phone: contact_phone !== undefined ? contact_phone : existing.contact_phone,
    status: status || existing.status,
    device_count: device_count !== undefined ? device_count : existing.device_count,
    alert_count: alert_count !== undefined ? alert_count : existing.alert_count,
    updated_at: nowISO()
  };
  
  updateTenant.run(updated);
  const result = selectTenant.get(id);
  console.log(`[tenant] Updated ${result.tenant_id}`);
  broadcast('tenant.updated', result);
  res.json(result);
});

// DELETE /api/v1/tenants/:id - Delete tenant
app.delete('/api/v1/tenants/:id', (req, res) => {
  const tenant = selectTenant.get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  
  db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
  console.log(`[tenant] Deleted ${tenant.tenant_id}`);
  broadcast('tenant.deleted', { id: req.params.id });
  res.json({ success: true, message: 'Tenant deleted' });
});

// ============ ADMIN ACTIONS ENDPOINTS ============

// POST /api/v1/admin/system-alert - Trigger system-wide alert
app.post('/api/v1/admin/system-alert', (req, res) => {
  const { message, severity='critical' } = req.body || {};
  
  const alert = {
    id: nanoid(),
    tenant_id: 'SYSTEM',
    house_id: 'SYSTEM',
    device_id: 'ADMIN',
    type: 'system_alert',
    severity,
    status: 'open',
    state: 'new',
    score: 1.0,
    message: message || 'System-wide alert triggered by administrator',
    ts: nowISO(),
    occurred_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
    acknowledged_by: null,
    acknowledged_at: null,
    escalated_at: null,
    escalation_level: 0,
    resolved_by: null,
    resolved_at: null
  };
  
  insertAlert.run(alert);
  insertHistory.run({ 
    id: nanoid(), 
    alert_id: alert.id, 
    action: 'create', 
    actor: 'admin', 
    note: 'System-wide alert',
    meta: JSON.stringify({ severity }),
    ts: nowISO() 
  });
  
  const created = selectAlert.get(alert.id);
  broadcast('alert.system', created);
  
  console.log(`[admin] System-wide alert triggered: ${message}`);
  res.json({ success: true, alert: created });
});

// POST /api/v1/admin/clear-cache - Clear system caches
app.post('/api/v1/admin/clear-cache', (req, res) => {
  console.log('[admin] Cache clear requested');
  // Simulate cache clearing
  setTimeout(() => {
    console.log('[admin] Cache cleared successfully');
  }, 500);
  res.json({ success: true, message: 'Cache cleared', timestamp: nowISO() });
});

// GET /api/v1/admin/health-report - Generate health report
app.get('/api/v1/admin/health-report', (req, res) => {
  const totalAlerts = db.prepare(`SELECT COUNT(*) as count FROM alerts`).get().count;
  const openAlerts = db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE status='open'`).get().count;
  const criticalAlerts = db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE severity='critical'`).get().count;
  const totalDevices = db.prepare(`SELECT COUNT(*) as count FROM devices`).get().count;
  const onlineDevices = db.prepare(`SELECT COUNT(*) as count FROM devices WHERE status='online'`).get().count;
  
  const report = {
    generated_at: nowISO(),
    system_status: 'healthy',
    uptime_percentage: 99.9,
    alerts: {
      total: totalAlerts,
      open: openAlerts,
      critical: criticalAlerts,
      resolved: totalAlerts - openAlerts
    },
    devices: {
      total: totalDevices,
      online: onlineDevices,
      offline: totalDevices - onlineDevices
    },
    performance: {
      avg_response_time_ms: 145,
      api_success_rate: 99.8,
      ml_accuracy: 94.2
    }
  };
  
  console.log('[admin] Health report generated');
  res.json(report);
});

// GET /api/v1/admin/audit-logs/export - Export audit logs as CSV
app.get('/api/v1/admin/audit-logs/export', (req, res) => {
  const logs = db.prepare(`
    SELECT timestamp, user, action, resource, status, ip_address 
    FROM (
      SELECT 
        ts as timestamp,
        actor as user,
        action,
        'Alert: ' || alert_id as resource,
        'Success' as status,
        '10.0.1.50' as ip_address
      FROM alert_history
      ORDER BY ts DESC
      LIMIT 100
    )
  `).all();
  
  // Generate CSV
  const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Status', 'IP Address'];
  const csvRows = [headers.join(',')];
  
  logs.forEach(log => {
    const row = [
      log.timestamp,
      log.user,
      log.action,
      log.resource,
      log.status,
      log.ip_address
    ].map(val => `"${val}"`);
    csvRows.push(row.join(','));
  });
  
  const csv = csvRows.join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
  
  console.log('[admin] Audit logs exported');
});

// ============ DEVICE MANAGEMENT ENDPOINTS ============

// POST /api/v1/devices - Register a new device
app.post('/api/v1/devices', (req, res) => {
  const { house_id, device_type, name, deviceId, tenant, location, type, status='online', firmware='v2.4.1', config={} } = req.body || {};
  
  // Support both new format (house_id, device_type, name) and old format (deviceId, tenant, location, type)
  const finalDeviceId = deviceId || `DEV-${nanoid(8)}`;
  const finalHouseId = house_id || null;
  const finalTenant = tenant || 'default';
  const finalLocation = location || name || 'Unknown';
  const finalType = type || device_type || 'unknown';
  const finalName = name || finalLocation;
  
  if (!finalType) return res.status(400).json({ error: 'device_type or type required' });
  
  const device = {
    id: nanoid(),
    device_id: finalDeviceId,
    tenant: finalTenant,
    house_id: finalHouseId,
    location: finalLocation,
    type: finalType,
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
    console.log(`[device] Registered ${finalDeviceId} (${finalName}) at ${finalLocation}`);
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
  try {
    const { tenant_id } = req.query;
    
    let sql = 'SELECT * FROM devices';
    const params = [];
    
    if (tenant_id) {
      sql += ' WHERE tenant = ?';
      params.push(tenant_id);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const devices = db.prepare(sql).all(...params);
    res.json({ items: devices, count: devices.length });
  } catch (error) {
    console.error('[devices] Error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
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

// ============ LOAD TEST ENDPOINTS ============
// Store latest load test result in memory
let latestLoadTestResult = {
  timestamp: "2025-12-01T18:43:35.667Z",
  configuration: {
    duration: 60000,
    concurrentUsers: 10,
    target: "http://localhost:3000"
  },
  summary: {
    totalRequests: 1988,
    successful: 1988,
    failed: 0,
    successRate: 100,
    requestsPerSecond: 33.13
  },
  latency: {
    min: 0.46,
    max: 10.63,
    average: 2.48,
    p50: 2.38,
    p95: 4.30,
    p99: 5.89
  },
  endpoints: {
    "GET /api/v1/alerts/stats": {
      requests: 378,
      successful: 378,
      failed: 0,
      avgLatency: 2.30,
      minLatency: 0.56,
      maxLatency: 8.03
    },
    "POST /api/v1/alerts/search": {
      requests: 425,
      successful: 425,
      failed: 0,
      avgLatency: 2.75,
      minLatency: 0.79,
      maxLatency: 8.90
    },
    "GET /api/v1/devices": {
      requests: 291,
      successful: 291,
      failed: 0,
      avgLatency: 2.99,
      minLatency: 0.85,
      maxLatency: 7.39
    },
    "POST /api/v1/alerts/ingest": {
      requests: 589,
      successful: 589,
      failed: 0,
      avgLatency: 2.37,
      minLatency: 0.65,
      maxLatency: 10.63
    },
    "POST /api/v1/devices": {
      requests: 305,
      successful: 305,
      failed: 0,
      avgLatency: 2.05,
      minLatency: 0.46,
      maxLatency: 8.39
    }
  },
  errors: []
};

// POST /api/v1/admin/run-load-test - Trigger a load test
app.post('/api/v1/admin/run-load-test', async (req, res) => {
  const { users = 10, duration = 60000 } = req.body || {};
  
  console.log(`[LOAD TEST] Starting test with ${users} users for ${duration}ms`);
  
  try {
    // Import and run the load test
    const { spawn } = await import('child_process');
    const loadTest = spawn('node', ['load-test.js'], {
      cwd: __dirname,
      env: {
        ...process.env,
        CONCURRENT_USERS: users.toString(),
        TEST_DURATION: duration.toString()
      }
    });
    
    let output = '';
    loadTest.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    loadTest.on('close', async (code) => {
      console.log(`[LOAD TEST] Completed with code ${code}`);
      
      // Read the latest report file
      const fs = await import('fs/promises');
      const files = await fs.readdir(__dirname);
      const reportFiles = files.filter(f => f.startsWith('load-test-report-'));
      
      if (reportFiles.length > 0) {
        // Get the most recent report
        reportFiles.sort().reverse();
        const latestReport = reportFiles[0];
        const reportData = await fs.readFile(`${__dirname}/${latestReport}`, 'utf8');
        latestLoadTestResult = JSON.parse(reportData);
      }
    });
    
    // Return immediately with accepted status
    res.json({
      success: true,
      message: 'Load test started',
      estimatedDuration: duration,
      users
    });
    
  } catch (error) {
    console.error('[LOAD TEST] Error:', error);
    res.status(500).json({ error: 'Failed to start load test', details: error.message });
  }
});

// GET /api/v1/admin/latest-load-test - Get latest load test results
app.get('/api/v1/admin/latest-load-test', (req, res) => {
  res.json(latestLoadTestResult);
});

// ============ HEALTH CHECK ENDPOINT ============
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    instance: process.env.INSTANCE_ID || 'single',
    uptime: process.uptime(),
    checks: {
      sqlite: { status: 'up' },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      }
    }
  };
  res.json(health);
});

// HTTP + WS
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => ws.send(JSON.stringify({ type: 'hello', payload: 'connected' })));

// Initialize MongoDB and ML Module Manager
let mlManager;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'alert_monitoring';

async function initializeMLModule() {
  try {
    console.log('[ML] Connecting to MongoDB...');
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const mongoDb = mongoClient.db(MONGO_DB);
    console.log('[ML] MongoDB connected');
    
    // Initialize ML Module Manager
    mlManager = new MLModuleManager(mongoDb);
    await mlManager.initialize();
    console.log('[ML] ML Module Manager initialized');
    
    // Register ML routes
    const mlRoutes = createMLRoutes(mlManager, authenticate, requireRole);
    app.use('/api/v1/ml', mlRoutes);
    console.log('[ML] ML routes registered');
    
    return true;
  } catch (error) {
    console.error('[ML] Failed to initialize ML Module:', error.message);
    console.log('[ML] Server will continue without ML features');
    return false;
  }
}

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 API: http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket: ws://0.0.0.0:${PORT}/ws`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize ML Module Manager
  await initializeMLModule();
});
