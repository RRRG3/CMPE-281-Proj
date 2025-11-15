-- PostgreSQL Schema for Alert Monitoring System
-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS houses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'STAFF', 'CAREGIVER')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Houses table
CREATE TABLE houses (
  house_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devices table
CREATE TABLE devices (
  device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES houses(house_id) ON DELETE CASCADE,
  device_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'decommissioned')),
  name VARCHAR(255) NOT NULL,
  firmware VARCHAR(50),
  config JSONB,
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES houses(house_id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  state VARCHAR(20) NOT NULL CHECK (state IN ('new', 'acked', 'escalated', 'resolved')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'acknowledged', 'escalated', 'resolved')),
  score REAL,
  message TEXT,
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by UUID REFERENCES users(user_id),
  acknowledged_at TIMESTAMP,
  escalated_at TIMESTAMP,
  escalation_level INTEGER DEFAULT 0,
  resolved_by UUID REFERENCES users(user_id),
  resolved_at TIMESTAMP
);

-- Alert history table
CREATE TABLE alert_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(alert_id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor UUID REFERENCES users(user_id),
  note TEXT,
  meta JSONB,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_alerts_house_id ON alerts(house_id);
CREATE INDEX idx_alerts_device_id ON alerts(device_id);
CREATE INDEX idx_alerts_state ON alerts(state);
CREATE INDEX idx_alerts_occurred_at ON alerts(occurred_at DESC);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_devices_house_id ON devices(house_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_houses_owner_id ON houses(owner_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token) WHERE NOT revoked;
CREATE INDEX idx_alert_history_alert_id ON alert_history(alert_id);

-- Insert sample admin user (password: admin123)
-- Password hash generated with bcrypt, salt rounds = 10
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin User', 'admin@example.com', '$2b$10$rKZvVqVqVqVqVqVqVqVqVuO7YqVqVqVqVqVqVqVqVqVqVqVqVqVqV', 'ADMIN'),
  ('John Owner', 'owner@example.com', '$2b$10$rKZvVqVqVqVqVqVqVqVqVuO7YqVqVqVqVqVqVqVqVqVqVqVqVqVqV', 'OWNER'),
  ('Jane Caregiver', 'caregiver@example.com', '$2b$10$rKZvVqVqVqVqVqVqVqVqVuO7YqVqVqVqVqVqVqVqVqVqVqVqVqVqV', 'CAREGIVER');

-- Insert sample houses
INSERT INTO houses (owner_id, address, timezone) 
SELECT user_id, '123 Main St, San Jose, CA', 'America/Los_Angeles' 
FROM users WHERE email = 'owner@example.com';

INSERT INTO houses (owner_id, address, timezone) 
SELECT user_id, '456 Oak Ave, San Francisco, CA', 'America/Los_Angeles' 
FROM users WHERE email = 'owner@example.com';

-- Insert sample devices
INSERT INTO devices (house_id, device_type, status, name, firmware)
SELECT house_id, 'microphone', 'active', 'Living Room Mic', 'v2.4.1'
FROM houses WHERE address LIKE '123 Main%';

INSERT INTO devices (house_id, device_type, status, name, firmware)
SELECT house_id, 'camera', 'active', 'Front Door Camera', 'v1.8.3'
FROM houses WHERE address LIKE '123 Main%';

INSERT INTO devices (house_id, device_type, status, name, firmware)
SELECT house_id, 'microphone', 'active', 'Bedroom Mic', 'v2.4.1'
FROM houses WHERE address LIKE '456 Oak%';
