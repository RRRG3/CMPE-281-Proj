import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';

// Database connections
import pool from './db/postgres.js';
import { testConnection } from './db/postgres.js';
import { connectMongo, getTelemetryCollection, getMLInferenceCollection } from './db/mongo.js';

// Auth utilities and middleware
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, validatePassword } from './auth/utils.js';
import { authenticate, requireRole } from './middleware/auth.js';

// Services
import { sendAlertNotifications, getAlertRecipients } from './services/notification.js';
import analytics from './services/analytics.js';
import mlPipeline from './services/ml-pipeline.js';

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Utility functions
function nowISO() {
  return new Date().toISOString();
}

// WebSocket broadcast function (will be initialized after server creation)
let wss;
function broadcast(type, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

// ============ AUTH ENDPOINTS ============

// POST /api/v1/auth/login
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['Email and password are required']
      });
    }

    // Query user from database
    const result = await pool.query(
      'SELECT user_id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    const user = result.rows[0];

    // Compare password
    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Generate tokens
    const access_token = generateAccessToken(user);
    const refresh_token = generateRefreshToken();

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.user_id, refresh_token, expiresAt]
    );

    // Remove password_hash from response
    delete user.password_hash;

    console.log(`[auth] User ${email} logged in successfully`);

    res.json({
      access_token,
      refresh_token,
      user
    });
  } catch (error) {
    console.error('[auth/login] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/refresh
app.post('/api/v1/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['Refresh token is required']
      });
    }

    // Query refresh token from database
    const tokenResult = await pool.query(
      `SELECT rt.token_id, rt.user_id, rt.revoked, rt.expires_at, 
              u.user_id, u.name, u.email, u.role
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.user_id
       WHERE rt.token = $1`,
      [refresh_token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        message: 'Refresh token not found'
      });
    }

    const tokenData = tokenResult.rows[0];

    // Check if token is revoked
    if (tokenData.revoked) {
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        message: 'Refresh token has been revoked'
      });
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        message: 'Refresh token has expired'
      });
    }

    // Mark old refresh token as revoked
    await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE token_id = $1',
      [tokenData.token_id]
    );

    // Generate new access token
    const user = {
      user_id: tokenData.user_id,
      email: tokenData.email,
      role: tokenData.role
    };
    const access_token = generateAccessToken(user);

    console.log(`[auth] Token refreshed for user ${user.email}`);

    res.json({ access_token });
  } catch (error) {
    console.error('[auth/refresh] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/logout
app.post('/api/v1/auth/logout', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['Refresh token is required']
      });
    }

    // Mark refresh token as revoked
    await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE token = $1',
      [refresh_token]
    );

    console.log(`[auth] User logged out`);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[auth/logout] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/register (Admin only)
app.post('/api/v1/auth/register', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['Name, email, password, and role are required']
      });
    }

    // Validate role
    const validRoles = ['OWNER', 'ADMIN', 'STAFF', 'CAREGIVER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: [`Role must be one of: ${validRoles.join(', ')}`]
      });
    }

    // Validate password complexity
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: passwordValidation.errors
      });
    }

    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Email already exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING user_id, name, email, role, created_at`,
      [name, email, password_hash, role]
    );

    const user = result.rows[0];

    console.log(`[auth] New user registered: ${email} (${role}) by admin ${req.user.email}`);

    res.status(201).json({ user });
  } catch (error) {
    console.error('[auth/register] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ HOUSE ENDPOINTS ============

// GET /api/v1/houses
app.get('/api/v1/houses', authenticate, async (req, res) => {
  try {
    let query;
    let params;

    if (req.user.role === 'ADMIN') {
      // Admins can see all houses
      query = `
        SELECT h.house_id, h.owner_id, h.address, h.timezone, h.created_at,
               u.name as owner_name, u.email as owner_email
        FROM houses h
        JOIN users u ON h.owner_id = u.user_id
        ORDER BY h.created_at DESC
      `;
      params = [];
    } else {
      // Owners can only see their own houses
      query = `
        SELECT h.house_id, h.owner_id, h.address, h.timezone, h.created_at,
               u.name as owner_name, u.email as owner_email
        FROM houses h
        JOIN users u ON h.owner_id = u.user_id
        WHERE h.owner_id = $1
        ORDER BY h.created_at DESC
      `;
      params = [req.user.user_id];
    }

    const result = await pool.query(query, params);

    res.json({ items: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('[houses] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ DEVICE ENDPOINTS ============

// GET /api/v1/devices
app.get('/api/v1/devices', authenticate, async (req, res) => {
  try {
    const { owner_id, house_id, status, device_type, page = 1, pageSize = 50 } = req.query;

    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    // Build WHERE clause based on filters
    if (house_id) {
      whereClauses.push(`d.house_id = $${paramIndex++}`);
      params.push(house_id);
    }

    if (status) {
      whereClauses.push(`d.status = $${paramIndex++}`);
      params.push(status);
    }

    if (device_type) {
      whereClauses.push(`d.device_type = $${paramIndex++}`);
      params.push(device_type);
    }

    // Access control: non-admins can only see devices in their houses
    if (req.user.role !== 'ADMIN') {
      whereClauses.push(`h.owner_id = $${paramIndex++}`);
      params.push(req.user.user_id);
    } else if (owner_id) {
      whereClauses.push(`h.owner_id = $${paramIndex++}`);
      params.push(owner_id);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Calculate pagination
    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;

    // Query devices
    const query = `
      SELECT d.device_id, d.house_id, d.device_type, d.status, d.name, 
             d.firmware, d.config, d.last_seen, d.created_at, d.updated_at,
             h.address as house_address
      FROM devices d
      JOIN houses h ON d.house_id = h.house_id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM devices d
      JOIN houses h ON d.house_id = h.house_id
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      items: result.rows,
      total,
      page: parseInt(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('[devices] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/devices
app.post('/api/v1/devices', authenticate, async (req, res) => {
  try {
    const { house_id, device_type, name, firmware, config } = req.body;

    // Validate required fields
    if (!house_id || !device_type || !name) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['house_id, device_type, and name are required']
      });
    }

    // Verify user has access to the house
    const houseResult = await pool.query(
      'SELECT house_id, owner_id FROM houses WHERE house_id = $1',
      [house_id]
    );

    if (houseResult.rows.length === 0) {
      return res.status(404).json({ error: 'House not found' });
    }

    const house = houseResult.rows[0];

    // Check access control
    if (req.user.role !== 'ADMIN' && house.owner_id !== req.user.user_id) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: 'You can only add devices to your own houses'
      });
    }

    // Insert device
    const result = await pool.query(
      `INSERT INTO devices (house_id, device_type, name, firmware, config, status, last_seen, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $6, $6)
       RETURNING *`,
      [house_id, device_type, name, firmware || 'v1.0.0', config ? JSON.stringify(config) : null, nowISO()]
    );

    const device = result.rows[0];

    console.log(`[devices] New device registered: ${name} (${device_type}) in house ${house_id}`);

    broadcast('device.created', device);

    res.status(201).json(device);
  } catch (error) {
    console.error('[devices/create] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/devices/:id
app.get('/api/v1/devices/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Query device with house info
    const result = await pool.query(
      `SELECT d.*, h.address as house_address, h.owner_id, h.timezone
       FROM devices d
       JOIN houses h ON d.house_id = h.house_id
       WHERE d.device_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = result.rows[0];

    // Check access control
    if (req.user.role !== 'ADMIN' && device.owner_id !== req.user.user_id) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: 'You can only view devices in your own houses'
      });
    }

    // Get telemetry summary from MongoDB (last 24 hours)
    try {
      const telemetryCollection = getTelemetryCollection();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const telemetrySummary = await telemetryCollection.aggregate([
        {
          $match: {
            device_id: id,
            ts: { $gte: oneDayAgo }
          }
        },
        {
          $group: {
            _id: null,
            avgSnr: { $avg: '$metrics.snr' },
            avgRms: { $avg: '$metrics.rms' },
            avgDecibel: { $avg: '$metrics.decibel' },
            count: { $sum: 1 },
            lastSeen: { $max: '$ts' }
          }
        }
      ]).toArray();

      device.telemetry_summary = telemetrySummary.length > 0 ? telemetrySummary[0] : null;
    } catch (mongoError) {
      console.warn('[devices/:id] MongoDB query failed:', mongoError.message);
      device.telemetry_summary = null;
    }

    res.json(device);
  } catch (error) {
    console.error('[devices/:id] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/devices/:id/metrics
app.post('/api/v1/devices/:id/metrics', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { timestamp, metrics } = req.body;

    if (!metrics) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['metrics object is required']
      });
    }

    // Verify device exists
    const deviceResult = await pool.query(
      'SELECT device_id FROM devices WHERE device_id = $1',
      [id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Insert telemetry into MongoDB
    const telemetryCollection = getTelemetryCollection();
    const telemetryDoc = {
      device_id: id,
      ts: timestamp ? new Date(timestamp) : new Date(),
      metrics: metrics
    };

    const insertResult = await telemetryCollection.insertOne(telemetryDoc);

    // Update device last_seen in PostgreSQL
    await pool.query(
      'UPDATE devices SET last_seen = $1, updated_at = $1 WHERE device_id = $2',
      [nowISO(), id]
    );

    console.log(`[telemetry] Metrics ingested for device ${id}`);

    res.json({ 
      success: true, 
      doc_id: insertResult.insertedId.toString()
    });
  } catch (error) {
    console.error('[devices/:id/metrics] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ METRICS ENDPOINTS ============

// GET /api/v1/metrics/alerts-by-day
app.get('/api/v1/metrics/alerts-by-day', authenticate, async (req, res) => {
  try {
    const { owner_id, start_date, end_date } = req.query;

    // Default to last 30 days if not specified
    const endDate = end_date ? new Date(end_date) : new Date();
    const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const whereClauses = ['occurred_at >= $1', 'occurred_at <= $2'];
    const params = [startDate, endDate];
    let paramIndex = 3;

    // Access control
    if (req.user.role !== 'ADMIN') {
      whereClauses.push(`house_id IN (SELECT house_id FROM houses WHERE owner_id = $${paramIndex++})`);
      params.push(req.user.user_id);
    } else if (owner_id) {
      whereClauses.push(`house_id IN (SELECT house_id FROM houses WHERE owner_id = $${paramIndex++})`);
      params.push(owner_id);
    }

    const query = `
      SELECT 
        DATE(occurred_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'low') as low,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical
      FROM alerts
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY DATE(occurred_at)
      ORDER BY date ASC
    `;

    const result = await pool.query(query, params);

    res.json({ items: result.rows });
  } catch (error) {
    console.error('[metrics/alerts-by-day] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/metrics/device/:id
app.get('/api/v1/metrics/device/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify device exists and user has access
    const deviceResult = await pool.query(
      `SELECT d.device_id, d.last_seen, h.owner_id
       FROM devices d
       JOIN houses h ON d.house_id = h.house_id
       WHERE d.device_id = $1`,
      [id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = deviceResult.rows[0];

    // Check access control
    if (req.user.role !== 'ADMIN' && device.owner_id !== req.user.user_id) {
      return res.status(403).json({ 
        error: 'Insufficient permissions'
      });
    }

    // Calculate uptime percentage (simplified - based on last_seen within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const uptimePct = device.last_seen && new Date(device.last_seen) > fiveMinutesAgo ? 100 : 0;

    // Count alerts generated by device
    const alertsResult = await pool.query(
      'SELECT COUNT(*) as count FROM alerts WHERE device_id = $1',
      [id]
    );
    const alertsGenerated = parseInt(alertsResult.rows[0].count);

    // Get average SNR from MongoDB (last 7 days)
    let avgSnr = null;
    let lastSeen = device.last_seen;

    try {
      const telemetryCollection = getTelemetryCollection();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const telemetryStats = await telemetryCollection.aggregate([
        {
          $match: {
            device_id: id,
            ts: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            avgSnr: { $avg: '$metrics.snr' },
            lastSeen: { $max: '$ts' }
          }
        }
      ]).toArray();

      if (telemetryStats.length > 0) {
        avgSnr = telemetryStats[0].avgSnr;
        if (telemetryStats[0].lastSeen) {
          lastSeen = telemetryStats[0].lastSeen;
        }
      }
    } catch (mongoError) {
      console.warn('[metrics/device/:id] MongoDB query failed:', mongoError.message);
    }

    res.json({
      device_id: id,
      uptimePct,
      alertsGenerated,
      avgSnr: avgSnr ? Math.round(avgSnr * 100) / 100 : null,
      lastSeen
    });
  } catch (error) {
    console.error('[metrics/device/:id] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ML ENDPOINTS ============

// POST /api/v1/ml/predict
app.post('/api/v1/ml/predict', authenticate, async (req, res) => {
  try {
    const { device_id, window_uri, ts, features, alert_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['device_id is required']
      });
    }

    // Verify device exists
    const deviceResult = await pool.query(
      'SELECT device_id FROM devices WHERE device_id = $1',
      [device_id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Mock ML prediction for development
    // In production, this would call an actual ML service
    const mockPredictions = [
      { label: 'glass_break', score: 0.91, confidence: 'high' },
      { label: 'smoke_alarm', score: 0.95, confidence: 'high' },
      { label: 'dog_bark', score: 0.78, confidence: 'medium' },
      { label: 'fall', score: 0.88, confidence: 'high' },
      { label: 'unusual_noise', score: 0.72, confidence: 'medium' },
      { label: 'door_open', score: 0.65, confidence: 'medium' },
      { label: 'normal', score: 0.45, confidence: 'low' }
    ];

    const prediction = mockPredictions[Math.floor(Math.random() * mockPredictions.length)];

    // Store inference in MongoDB
    try {
      const mlInferenceCollection = getMLInferenceCollection();
      const inferenceDoc = {
        alert_id: alert_id || null,
        device_id,
        ts: ts ? new Date(ts) : new Date(),
        model_name: 'audio_classifier_v3',
        model_version: '3.2.1',
        score: prediction.score,
        label: prediction.label,
        confidence: prediction.confidence,
        window_uri: window_uri || null,
        features: features || null,
        created_at: new Date()
      };

      const insertResult = await mlInferenceCollection.insertOne(inferenceDoc);

      console.log(`[ml/predict] Prediction for device ${device_id}: ${prediction.label} (score: ${prediction.score}, confidence: ${prediction.confidence})`);

      res.json({
        prediction: prediction.label,
        score: prediction.score,
        confidence: prediction.confidence,
        inference_id: insertResult.insertedId.toString(),
        model: 'audio_classifier_v3',
        timestamp: nowISO()
      });
    } catch (mongoError) {
      // If MongoDB is not available, still return prediction but log warning
      console.warn('[ml/predict] MongoDB not available, prediction not stored:', mongoError.message);
      
      res.json({
        prediction: prediction.label,
        score: prediction.score,
        confidence: prediction.confidence,
        inference_id: null,
        model: 'audio_classifier_v3',
        timestamp: nowISO(),
        warning: 'Prediction not persisted - MongoDB unavailable'
      });
    }
  } catch (error) {
    console.error('[ml/predict] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ML-BASED SEVERITY DECISION ENGINE ============

/**
 * ML-based severity decision engine
 * Determines alert severity based on event type, ML score, duration, and context
 */
function decideSeverity(event) {
  const { type, score = 0.5, duration = 0, inQuietHours = false } = event;
  
  // Critical alerts - immediate danger, requires immediate action
  if (type === 'smoke_alarm') return 'critical';
  if (type === 'glass_break' && score >= 0.85) return 'critical';
  if (type === 'fall' && score >= 0.8) return 'critical';
  if (type === 'fire' || type === 'gas_leak') return 'critical';
  
  // High severity - requires prompt attention
  if (type === 'fall') return 'high';
  if (type === 'glass_break') return 'high';
  if (type === 'no_motion' && duration >= 30 * 60) {
    // No motion for 30+ minutes
    return inQuietHours ? 'high' : 'medium';
  }
  if (type === 'unusual_noise' && score >= 0.85) return 'high';
  
  // Medium severity - monitor and investigate
  if (type === 'unusual_noise' && score >= 0.7) return 'medium';
  if (type === 'no_motion' && duration >= 15 * 60) return 'medium';
  if (type === 'door_open' && inQuietHours) return 'medium';
  
  // Low severity - informational
  if (type === 'dog_bark') return 'low';
  if (type === 'door_open') return 'low';
  if (type === 'normal') return 'low';
  
  // Default based on ML confidence score
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'medium';
  if (score >= 0.5) return 'low';
  
  return 'low';
}

/**
 * Check if current time is in quiet hours (10 PM - 6 AM)
 */
function isQuietHours(timestamp) {
  const date = new Date(timestamp);
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

// ============ ALERT MANAGEMENT ENDPOINTS ============

// POST /api/v1/alerts/ingest
app.post('/api/v1/alerts/ingest', authenticate, async (req, res) => {
  try {
    const { 
      house_id, 
      device_id, 
      type, 
      message = '',
      score = 0.5,
      duration = 0,
      severity: manualSeverity,
      ts
    } = req.body;

    if (!type) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['type is required']
      });
    }

    if (!house_id || !device_id) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['house_id and device_id are required']
      });
    }

    // Verify house exists
    const houseResult = await pool.query(
      'SELECT house_id, owner_id FROM houses WHERE house_id = $1',
      [house_id]
    );

    if (houseResult.rows.length === 0) {
      return res.status(404).json({ error: 'House not found' });
    }

    // Verify device exists
    const deviceResult = await pool.query(
      'SELECT device_id FROM devices WHERE device_id = $1',
      [device_id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const occurred_at = ts || nowISO();
    const inQuietHours = isQuietHours(occurred_at);

    // Deduplication: check for recent similar alert (within 60 seconds)
    const dedupeResult = await pool.query(
      `SELECT alert_id FROM alerts 
       WHERE device_id = $1 AND type = $2 
       AND occurred_at > $3::timestamp - interval '60 seconds'
       AND state IN ('new', 'escalated')
       LIMIT 1`,
      [device_id, type, occurred_at]
    );

    if (dedupeResult.rows.length > 0) {
      console.log(`[dedup] Ignoring duplicate ${type} from ${device_id}`);
      return res.json({ 
        alert_id: dedupeResult.rows[0].alert_id, 
        deduplicated: true 
      });
    }

    // Use manual severity if provided, otherwise use ML-based decision
    const severity = manualSeverity && ['low', 'medium', 'high', 'critical'].includes(manualSeverity)
      ? manualSeverity
      : decideSeverity({ type, score, duration, inQuietHours });

    // Insert alert
    const insertResult = await pool.query(
      `INSERT INTO alerts (
        house_id, device_id, type, severity, state, status, score, message, occurred_at
      ) VALUES ($1, $2, $3, $4, 'new', 'open', $5, $6, $7)
      RETURNING *`,
      [house_id, device_id, type, severity, score, message, occurred_at]
    );

    const alert = insertResult.rows[0];

    // Insert history entry
    await pool.query(
      `INSERT INTO alert_history (alert_id, action, actor, note, meta)
       VALUES ($1, 'created', $2, $3, $4)`,
      [
        alert.alert_id,
        null, // system created
        message,
        JSON.stringify({ score, duration, inQuietHours, severity, ml_based: !manualSeverity })
      ]
    );

    // Broadcast via WebSocket
    broadcast('alert.new', alert);

    // Send notifications
    const severitySource = manualSeverity ? 'manual' : 'ML-based';
    console.log(`[alert/ingest] Alert ${alert.alert_id}: ${type} (${severity} - ${severitySource}, score: ${score})`);
    
    // Get recipients and send notifications asynchronously
    getAlertRecipients(alert, pool)
      .then(recipients => sendAlertNotifications(alert, recipients, pool))
      .catch(err => console.error('[alert/ingest] Notification error:', err.message));

    res.json({ 
      alert_id: alert.alert_id,
      severity, 
      state: 'new',
      score,
      occurred_at: alert.occurred_at
    });
  } catch (error) {
    console.error('[alert/ingest] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/alerts/search
app.post('/api/v1/alerts/search', authenticate, async (req, res) => {
  try {
    const { severity, status, state, type, since, house_id, device_id, limit = 50 } = req.body;

    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    // Access control: non-admins can only see alerts from their houses
    if (req.user.role !== 'ADMIN') {
      whereClauses.push(`house_id IN (SELECT house_id FROM houses WHERE owner_id = $${paramIndex++})`);
      params.push(req.user.user_id);
    }

    // Apply filters
    if (severity) {
      whereClauses.push(`severity = $${paramIndex++}`);
      params.push(severity);
    }

    if (status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (state) {
      whereClauses.push(`state = $${paramIndex++}`);
      params.push(state);
    }

    if (type) {
      whereClauses.push(`type = $${paramIndex++}`);
      params.push(type);
    }

    if (since) {
      whereClauses.push(`occurred_at >= $${paramIndex++}`);
      params.push(since);
    }

    if (house_id) {
      whereClauses.push(`house_id = $${paramIndex++}`);
      params.push(house_id);
    }

    if (device_id) {
      whereClauses.push(`device_id = $${paramIndex++}`);
      params.push(device_id);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT * FROM alerts
      ${whereClause}
      ORDER BY occurred_at DESC
      LIMIT $${paramIndex}
    `;

    params.push(limit);

    const result = await pool.query(query, params);

    res.json({ items: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('[alert/search] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/alerts/stats
app.get('/api/v1/alerts/stats', authenticate, async (req, res) => {
  try {
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    // Access control
    if (req.user.role !== 'ADMIN') {
      whereClauses.push(`house_id IN (SELECT house_id FROM houses WHERE owner_id = $${paramIndex++})`);
      params.push(req.user.user_id);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Open alerts count
    const openCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM alerts 
       ${whereClause} ${whereClauses.length > 0 ? 'AND' : 'WHERE'} state IN ('new', 'escalated')`,
      params
    );
    const openCount = parseInt(openCountResult.rows[0].count);

    // MTTA (Mean Time To Acknowledge) in seconds
    const mttaResult = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (acknowledged_at - occurred_at))) as mtta_sec
       FROM alerts 
       ${whereClause} ${whereClauses.length > 0 ? 'AND' : 'WHERE'} acknowledged_at IS NOT NULL`,
      params
    );
    const mttaSec = Math.round(mttaResult.rows[0].mtta_sec || 0);

    // MTTR (Mean Time To Resolve) in seconds
    const mttrResult = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - occurred_at))) as mttr_sec
       FROM alerts 
       ${whereClause} ${whereClauses.length > 0 ? 'AND' : 'WHERE'} resolved_at IS NOT NULL`,
      params
    );
    const mttrSec = Math.round(mttrResult.rows[0].mttr_sec || 0);

    // Severity breakdown
    const severityResult = await pool.query(
      `SELECT severity, COUNT(*) as count FROM alerts ${whereClause} GROUP BY severity`,
      params
    );
    const bySeverity = {};
    severityResult.rows.forEach(row => {
      bySeverity[row.severity] = parseInt(row.count);
    });

    // State breakdown
    const stateResult = await pool.query(
      `SELECT state, COUNT(*) as count FROM alerts ${whereClause} GROUP BY state`,
      params
    );
    const byState = {};
    stateResult.rows.forEach(row => {
      byState[row.state] = parseInt(row.count);
    });

    // Total alerts
    const totalResult = await pool.query(
      `SELECT COUNT(*) as count FROM alerts ${whereClause}`,
      params
    );
    const totalAlerts = parseInt(totalResult.rows[0].count);

    // Recent alerts (last 24 hours)
    const recentResult = await pool.query(
      `SELECT COUNT(*) as count FROM alerts 
       ${whereClause} ${whereClauses.length > 0 ? 'AND' : 'WHERE'} 
       occurred_at > NOW() - INTERVAL '24 hours'`,
      params
    );
    const recentAlerts = parseInt(recentResult.rows[0].count);

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
  } catch (error) {
    console.error('[alert/stats] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/alerts/:id
app.get('/api/v1/alerts/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get alert with house and device info
    const alertResult = await pool.query(
      `SELECT a.*, 
              h.address as house_address, h.owner_id, h.timezone,
              d.name as device_name, d.device_type
       FROM alerts a
       JOIN houses h ON a.house_id = h.house_id
       JOIN devices d ON a.device_id = d.device_id
       WHERE a.alert_id = $1`,
      [id]
    );

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = alertResult.rows[0];

    // Check access control
    if (req.user.role !== 'ADMIN' && alert.owner_id !== req.user.user_id) {
      return res.status(403).json({ 
        error: 'Insufficient permissions'
      });
    }

    // Get alert history
    const historyResult = await pool.query(
      `SELECT * FROM alert_history 
       WHERE alert_id = $1 
       ORDER BY ts ASC`,
      [id]
    );

    res.json({ 
      alert, 
      history: historyResult.rows 
    });
  } catch (error) {
    console.error('[alert/:id] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/alerts/:id/ack
app.post('/api/v1/alerts/:id/ack', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { note = '' } = req.body;
    const actor = req.user.user_id;

    // Get alert
    const alertResult = await pool.query(
      `SELECT a.*, h.owner_id FROM alerts a
       JOIN houses h ON a.house_id = h.house_id
       WHERE a.alert_id = $1`,
      [id]
    );

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = alertResult.rows[0];

    // Check access control
    if (req.user.role !== 'ADMIN' && alert.owner_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check valid state transition
    if (alert.state === 'resolved') {
      return res.status(409).json({ error: 'Cannot acknowledge resolved alert' });
    }

    if (alert.state === 'acked') {
      return res.status(409).json({ error: 'Alert already acknowledged' });
    }

    const acknowledgedAt = nowISO();

    // Update alert
    await pool.query(
      `UPDATE alerts 
       SET state = 'acked', status = 'acknowledged', 
           acknowledged_by = $1, acknowledged_at = $2, updated_at = $2
       WHERE alert_id = $3`,
      [actor, acknowledgedAt, id]
    );

    // Insert history
    await pool.query(
      `INSERT INTO alert_history (alert_id, action, actor, note, meta)
       VALUES ($1, 'ack', $2, $3, $4)`,
      [id, actor, note, JSON.stringify({ previous_state: alert.state })]
    );

    // Get updated alert
    const updatedResult = await pool.query(
      'SELECT * FROM alerts WHERE alert_id = $1',
      [id]
    );

    broadcast('alert.acked', updatedResult.rows[0]);

    console.log(`[alert/ack] Alert ${id} acknowledged by ${actor}`);

    res.json({ 
      state: 'acked',
      status: 'acknowledged',
      acknowledged_at: acknowledgedAt
    });
  } catch (error) {
    console.error('[alert/:id/ack] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/alerts/:id/escalate
app.post('/api/v1/alerts/:id/escalate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { note = 'No response - escalating' } = req.body;
    const actor = req.user.user_id;

    // Get alert
    const alertResult = await pool.query(
      `SELECT a.*, h.owner_id FROM alerts a
       JOIN houses h ON a.house_id = h.house_id
       WHERE a.alert_id = $1`,
      [id]
    );

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = alertResult.rows[0];

    // Check access control
    if (req.user.role !== 'ADMIN' && alert.owner_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check valid state transition
    if (alert.state === 'resolved') {
      return res.status(409).json({ error: 'Cannot escalate resolved alert' });
    }

    const escalatedAt = nowISO();
    const escalationLevel = (alert.escalation_level || 0) + 1;

    // Update alert
    await pool.query(
      `UPDATE alerts 
       SET state = 'escalated', status = 'escalated', 
           escalated_at = $1, escalation_level = $2, updated_at = $1
       WHERE alert_id = $3`,
      [escalatedAt, escalationLevel, id]
    );

    // Insert history
    await pool.query(
      `INSERT INTO alert_history (alert_id, action, actor, note, meta)
       VALUES ($1, 'escalate', $2, $3, $4)`,
      [id, actor, note, JSON.stringify({ escalation_level: escalationLevel, previous_state: alert.state })]
    );

    // Get updated alert
    const updatedResult = await pool.query(
      'SELECT * FROM alerts WHERE alert_id = $1',
      [id]
    );

    broadcast('alert.escalated', updatedResult.rows[0]);

    console.log(`[alert/escalate] Alert ${id} escalated to level ${escalationLevel} by ${actor}`);

    res.json({ 
      state: 'escalated',
      escalation_level: escalationLevel,
      escalated_at: escalatedAt
    });
  } catch (error) {
    console.error('[alert/:id/escalate] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/alerts/:id/resolve
app.post('/api/v1/alerts/:id/resolve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const actor = req.user.user_id;

    if (!note) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        details: ['Resolution note is required']
      });
    }

    // Get alert
    const alertResult = await pool.query(
      `SELECT a.*, h.owner_id FROM alerts a
       JOIN houses h ON a.house_id = h.house_id
       WHERE a.alert_id = $1`,
      [id]
    );

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = alertResult.rows[0];

    // Check access control
    if (req.user.role !== 'ADMIN' && alert.owner_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check if already resolved
    if (alert.state === 'resolved') {
      return res.status(409).json({ error: 'Alert already resolved' });
    }

    const resolvedAt = nowISO();

    // Update alert
    await pool.query(
      `UPDATE alerts 
       SET state = 'resolved', status = 'resolved', 
           resolved_by = $1, resolved_at = $2, updated_at = $2
       WHERE alert_id = $3`,
      [actor, resolvedAt, id]
    );

    // Insert history
    await pool.query(
      `INSERT INTO alert_history (alert_id, action, actor, note, meta)
       VALUES ($1, 'resolve', $2, $3, $4)`,
      [id, actor, note, JSON.stringify({ resolution_note: note, previous_state: alert.state })]
    );

    // Get updated alert
    const updatedResult = await pool.query(
      'SELECT * FROM alerts WHERE alert_id = $1',
      [id]
    );

    broadcast('alert.resolved', updatedResult.rows[0]);

    console.log(`[alert/resolve] Alert ${id} resolved by ${actor}`);

    res.json({ 
      state: 'resolved',
      status: 'resolved',
      resolved_at: resolvedAt
    });
  } catch (error) {
    console.error('[alert/:id/resolve] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ANALYTICS ENDPOINTS ============

// GET /api/v1/analytics/trends
app.get('/api/v1/analytics/trends', authenticate, async (req, res) => {
  try {
    const { days = 30, groupBy = 'day', house_id, device_id } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const trends = await analytics.getAlertTrends(pool, {
      startDate,
      endDate: new Date(),
      groupBy,
      houseId: house_id,
      deviceId: device_id
    });

    res.json({ trends, period_days: parseInt(days) });
  } catch (error) {
    console.error('[analytics/trends] Error:', error);
    res.status(500).json({ error: 'Failed to get trends' });
  }
});

// GET /api/v1/analytics/device/:id/performance
app.get('/api/v1/analytics/device/:id/performance', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const performance = await analytics.getDevicePerformance(pool, id, parseInt(days));

    if (!performance) {
      return res.status(404).json({ error: 'No data found for device' });
    }

    res.json(performance);
  } catch (error) {
    console.error('[analytics/device/performance] Error:', error);
    res.status(500).json({ error: 'Failed to get device performance' });
  }
});

// GET /api/v1/analytics/response-times
app.get('/api/v1/analytics/response-times', authenticate, async (req, res) => {
  try {
    const { days = 30, house_id } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const metrics = await analytics.getResponseTimeMetrics(pool, {
      startDate,
      endDate: new Date(),
      houseId: house_id
    });

    res.json({ metrics, period_days: parseInt(days) });
  } catch (error) {
    console.error('[analytics/response-times] Error:', error);
    res.status(500).json({ error: 'Failed to get response time metrics' });
  }
});

// GET /api/v1/analytics/patterns
app.get('/api/v1/analytics/patterns', authenticate, async (req, res) => {
  try {
    const { days = 7, house_id, device_id } = req.query;

    const patterns = await analytics.detectAlertPatterns(pool, {
      days: parseInt(days),
      houseId: house_id,
      deviceId: device_id
    });

    res.json(patterns);
  } catch (error) {
    console.error('[analytics/patterns] Error:', error);
    res.status(500).json({ error: 'Failed to detect patterns' });
  }
});

// GET /api/v1/analytics/report
app.get('/api/v1/analytics/report', authenticate, async (req, res) => {
  try {
    const { days = 30, house_id } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    let mlInferenceCollection = null;
    try {
      mlInferenceCollection = getMLInferenceCollection();
    } catch (err) {
      console.warn('[analytics/report] MongoDB not available');
    }

    const report = await analytics.generateAlertReport(pool, mlInferenceCollection, {
      startDate,
      endDate: new Date(),
      houseId: house_id
    });

    res.json(report);
  } catch (error) {
    console.error('[analytics/report] Error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/v1/analytics/realtime
app.get('/api/v1/analytics/realtime', authenticate, async (req, res) => {
  try {
    const stats = await analytics.getRealTimeStats(pool);
    res.json(stats);
  } catch (error) {
    console.error('[analytics/realtime] Error:', error);
    res.status(500).json({ error: 'Failed to get real-time stats' });
  }
});

// ============ ML PIPELINE ENDPOINTS ============

// GET /api/v1/ml/inference/history/:device_id
app.get('/api/v1/ml/inference/history/:device_id', authenticate, async (req, res) => {
  try {
    const { device_id } = req.params;
    const { limit = 100 } = req.query;

    const mlInferenceCollection = getMLInferenceCollection();
    const history = await mlPipeline.getDeviceInferenceHistory(
      mlInferenceCollection,
      device_id,
      parseInt(limit)
    );

    res.json({ device_id, history, count: history.length });
  } catch (error) {
    console.error('[ml/inference/history] Error:', error);
    res.status(500).json({ error: 'Failed to get inference history' });
  }
});

// GET /api/v1/ml/model/accuracy
app.get('/api/v1/ml/model/accuracy', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const mlInferenceCollection = getMLInferenceCollection();
    const accuracy = await mlPipeline.calculateModelAccuracy(
      mlInferenceCollection,
      pool,
      parseInt(days)
    );

    res.json(accuracy);
  } catch (error) {
    console.error('[ml/model/accuracy] Error:', error);
    res.status(500).json({ error: 'Failed to calculate model accuracy' });
  }
});

// GET /api/v1/ml/model/performance
app.get('/api/v1/ml/model/performance', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const mlInferenceCollection = getMLInferenceCollection();
    const trends = await mlPipeline.getModelPerformanceTrends(
      mlInferenceCollection,
      parseInt(days)
    );

    res.json({ trends, period_days: parseInt(days) });
  } catch (error) {
    console.error('[ml/model/performance] Error:', error);
    res.status(500).json({ error: 'Failed to get model performance' });
  }
});

// GET /api/v1/ml/model/drift
app.get('/api/v1/ml/model/drift', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { window_days = 7 } = req.query;

    const mlInferenceCollection = getMLInferenceCollection();
    const drift = await mlPipeline.detectModelDrift(
      mlInferenceCollection,
      pool,
      parseInt(window_days)
    );

    res.json(drift);
  } catch (error) {
    console.error('[ml/model/drift] Error:', error);
    res.status(500).json({ error: 'Failed to detect model drift' });
  }
});

// GET /api/v1/ml/features/importance
app.get('/api/v1/ml/features/importance', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const mlInferenceCollection = getMLInferenceCollection();
    const analysis = await mlPipeline.analyzeFeatureImportance(
      mlInferenceCollection,
      parseInt(days)
    );

    res.json(analysis);
  } catch (error) {
    console.error('[ml/features/importance] Error:', error);
    res.status(500).json({ error: 'Failed to analyze feature importance' });
  }
});

// POST /api/v1/ml/training-data/prepare
app.post('/api/v1/ml/training-data/prepare', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { days = 90, min_score = 0.5, include_features = true } = req.body;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const mlInferenceCollection = getMLInferenceCollection();
    const trainingData = await mlPipeline.prepareTrainingData(
      mlInferenceCollection,
      pool,
      {
        startDate,
        endDate: new Date(),
        minScore: parseFloat(min_score),
        includeFeatures: include_features
      }
    );

    res.json(trainingData);
  } catch (error) {
    console.error('[ml/training-data/prepare] Error:', error);
    res.status(500).json({ error: 'Failed to prepare training data' });
  }
});

// GET /api/v1/ml/data/export
app.get('/api/v1/ml/data/export', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { days = 30, format = 'json' } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const mlInferenceCollection = getMLInferenceCollection();
    const exportData = await mlPipeline.exportMLData(
      mlInferenceCollection,
      pool,
      {
        startDate,
        endDate: new Date(),
        format
      }
    );

    if (format === 'csv') {
      // Return as CSV file
      const csvRows = [exportData.headers.join(',')];
      exportData.rows.forEach(row => {
        csvRows.push(row.map(val => `"${val}"`).join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ml-data-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      res.json(exportData);
    }
  } catch (error) {
    console.error('[ml/data/export] Error:', error);
    res.status(500).json({ error: 'Failed to export ML data' });
  }
});

// ============ SERVER INITIALIZATION ============

async function startServer() {
  try {
    // Try PostgreSQL connection (optional for demo)
    try {
      await testConnection();
      console.log('✅ Using PostgreSQL database');
    } catch (pgError) {
      console.warn('⚠️  PostgreSQL not available, some features may be limited');
      console.warn('   To enable full functionality, start PostgreSQL and run:');
      console.warn('   createdb alert_monitoring');
      console.warn('   psql -d alert_monitoring -f db/schema.sql');
    }

    // Try MongoDB connection (optional for demo)
    try {
      await connectMongo();
      console.log('✅ Using MongoDB for telemetry');
    } catch (mongoError) {
      console.warn('⚠️  MongoDB not available, telemetry features disabled');
      console.warn('   To enable telemetry, start MongoDB');
    }

    // Create HTTP server
    const server = http.createServer(app);

    // Create WebSocket server
    wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'hello', payload: 'connected' }));
      console.log('[ws] Client connected');
    });

    // Start listening
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📡 API: http://0.0.0.0:${PORT}`);
      console.log(`🔌 WebSocket: ws://0.0.0.0:${PORT}/ws`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('📝 Note: For full functionality, ensure PostgreSQL and MongoDB are running');
      console.log('   See server/README.md for setup instructions');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
