import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'data.db'));

function nowISO() {
  return new Date().toISOString();
}

console.log('🌱 Seeding tenant-specific data...');

// Get all tenants
const tenants = db.prepare('SELECT * FROM tenants').all();

if (tenants.length === 0) {
  console.log('❌ No tenants found. Please run the server first to create tenants.');
  process.exit(1);
}

// Clear existing data
console.log('🗑️  Clearing existing alerts and devices...');
db.prepare('DELETE FROM alert_history').run();
db.prepare('DELETE FROM alerts').run();
db.prepare('DELETE FROM devices').run();

// Device types and locations for variety
const deviceTypes = ['microphone', 'camera', 'motion_sensor', 'door_sensor'];
const locations = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Hallway', 'Entrance', 'Garage', 'Backyard'];
const alertTypes = ['glass_break', 'smoke_alarm', 'dog_bark', 'fall', 'no_motion', 'unusual_noise', 'door_open'];
const severities = ['low', 'medium', 'high', 'critical'];

// Create devices and alerts for each tenant
tenants.forEach((tenant, index) => {
  console.log(`\n📦 Creating data for ${tenant.name} (${tenant.tenant_id})...`);
  
  // Create 4-8 devices per tenant
  const deviceCount = 4 + Math.floor(Math.random() * 5);
  const tenantDevices = [];
  
  for (let i = 0; i < deviceCount; i++) {
    const deviceType = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
    const location = locations[i % locations.length];
    const deviceId = `${tenant.tenant_id}-DEV-${String(i + 1).padStart(3, '0')}`;
    
    const device = {
      id: nanoid(),
      device_id: deviceId,
      tenant: tenant.tenant_id,
      location,
      type: deviceType,
      status: Math.random() > 0.1 ? 'online' : 'offline',
      heartbeat: 'Active',
      firmware: `v2.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`,
      config: JSON.stringify({ sensitivity: Math.random() > 0.5 ? 'high' : 'medium' }),
      last_seen: nowISO(),
      created_at: nowISO(),
      updated_at: nowISO()
    };
    
    db.prepare(`
      INSERT INTO devices (id, device_id, tenant, location, type, status, heartbeat, firmware, config, last_seen, created_at, updated_at)
      VALUES (@id, @device_id, @tenant, @location, @type, @status, @heartbeat, @firmware, @config, @last_seen, @created_at, @updated_at)
    `).run(device);
    
    tenantDevices.push(device);
  }
  
  console.log(`  ✅ Created ${deviceCount} devices`);
  
  // Create 5-15 alerts per tenant
  const alertCount = 5 + Math.floor(Math.random() * 11);
  
  for (let i = 0; i < alertCount; i++) {
    const device = tenantDevices[Math.floor(Math.random() * tenantDevices.length)];
    const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const status = Math.random() > 0.3 ? 'open' : (Math.random() > 0.5 ? 'acknowledged' : 'resolved');
    
    // Create alert timestamp within last 7 days
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() - daysAgo);
    alertDate.setHours(alertDate.getHours() - hoursAgo);
    
    const alert = {
      id: nanoid(),
      tenant_id: tenant.tenant_id,
      house_id: tenant.tenant_id,
      device_id: device.device_id,
      type: alertType,
      severity,
      status,
      state: status === 'resolved' ? 'resolved' : (status === 'acknowledged' ? 'acked' : 'new'),
      score: 0.5 + Math.random() * 0.5,
      message: `${alertType.replace(/_/g, ' ')} detected in ${device.location}`,
      ts: alertDate.toISOString(),
      occurred_at: alertDate.toISOString(),
      created_at: alertDate.toISOString(),
      updated_at: nowISO(),
      acknowledged_by: status !== 'open' ? 'owner' : null,
      acknowledged_at: status !== 'open' ? alertDate.toISOString() : null,
      escalated_at: null,
      escalation_level: 0,
      resolved_by: status === 'resolved' ? 'owner' : null,
      resolved_at: status === 'resolved' ? alertDate.toISOString() : null
    };
    
    db.prepare(`
      INSERT INTO alerts (
        id, tenant_id, house_id, device_id, type, severity, status, state, score, message,
        ts, occurred_at, created_at, updated_at,
        acknowledged_by, acknowledged_at, escalated_at, escalation_level, resolved_by, resolved_at
      ) VALUES (
        @id, @tenant_id, @house_id, @device_id, @type, @severity, @status, @state, @score, @message,
        @ts, @occurred_at, @created_at, @updated_at,
        @acknowledged_by, @acknowledged_at, @escalated_at, @escalation_level, @resolved_by, @resolved_at
      )
    `).run(alert);
    
    // Add history entry
    db.prepare(`
      INSERT INTO alert_history (id, alert_id, action, actor, note, meta, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nanoid(), alert.id, 'create', 'system', alert.message, JSON.stringify({ severity }), alert.ts);
  }
  
  console.log(`  ✅ Created ${alertCount} alerts`);
  
  // Update tenant counts
  const deviceCountActual = db.prepare('SELECT COUNT(*) as count FROM devices WHERE tenant = ?').get(tenant.tenant_id).count;
  const alertCountActual = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE tenant_id = ?').get(tenant.tenant_id).count;
  
  db.prepare('UPDATE tenants SET device_count = ?, alert_count = ? WHERE tenant_id = ?')
    .run(deviceCountActual, alertCountActual, tenant.tenant_id);
});

// Summary
console.log('\n📊 Summary:');
const totalDevices = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
const totalAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count;

console.log(`  Total Devices: ${totalDevices}`);
console.log(`  Total Alerts: ${totalAlerts}`);
console.log(`  Tenants: ${tenants.length}`);

console.log('\n✅ Tenant data seeding complete!');
console.log('🔄 Restart the server to see the changes.\n');

db.close();
