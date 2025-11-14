// MQTT Device Status Simulator
// Simulates IoT devices publishing status updates via MQTT topics
// In production, this would be AWS IoT Core handling device/{id}/status messages

import Database from 'better-sqlite3';

const db = new Database('data.db');
const API_BASE = 'http://localhost:5174';

const devices = db.prepare('SELECT * FROM devices').all();

console.log('🔌 MQTT Device Simulator Started');
console.log(`📡 Simulating ${devices.length} devices publishing to MQTT topics\n`);

// Simulate periodic heartbeats
setInterval(async () => {
  // Pick a random device
  const device = devices[Math.floor(Math.random() * devices.length)];
  const statuses = ['online', 'online', 'online', 'warning']; // Bias toward online
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  console.log(`📤 MQTT Publish: device/${device.device_id}/status → ${status}`);
  
  try {
    const response = await fetch(`${API_BASE}/api/v1/devices/${device.id}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✓ Device ${device.device_id} heartbeat acknowledged: ${result.status} at ${result.last_seen}\n`);
    }
  } catch (err) {
    console.error(`✗ Failed to send heartbeat for ${device.device_id}:`, err.message);
  }
}, 5000); // Every 5 seconds

console.log('Press Ctrl+C to stop the simulator\n');
