import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

const db = new Database('data.db');

const seedDevices = [
  {
    device_id: 'DEV-LR-001',
    tenant: 'Johnson Residence (T-001)',
    location: 'Living Room',
    type: 'Audio Sensor',
    status: 'online',
    heartbeat: '30 seconds ago',
    firmware: 'v2.4.1'
  },
  {
    device_id: 'DEV-BED-002',
    tenant: 'Johnson Residence (T-001)',
    location: 'Bedroom',
    type: 'Video Camera',
    status: 'online',
    heartbeat: '1 minute ago',
    firmware: 'v2.4.1'
  },
  {
    device_id: 'DEV-KIT-003',
    tenant: 'Johnson Residence (T-001)',
    location: 'Kitchen',
    type: 'Audio/Motion',
    status: 'offline',
    heartbeat: '2 hours ago',
    firmware: 'v2.3.8'
  },
  {
    device_id: 'DEV-GV-104',
    tenant: 'Green Valley Senior (T-002)',
    location: 'Common Area',
    type: 'Multi-Sensor',
    status: 'online',
    heartbeat: '15 seconds ago',
    firmware: 'v2.4.0'
  },
  {
    device_id: 'DEV-GV-105',
    tenant: 'Green Valley Senior (T-002)',
    location: 'Room 101',
    type: 'Audio Sensor',
    status: 'warning',
    heartbeat: '5 minutes ago',
    firmware: 'v2.2.5'
  },
  {
    device_id: 'DEV-SR-201',
    tenant: 'Sunrise Assisted (T-003)',
    location: 'Building A',
    type: 'Video Camera',
    status: 'online',
    heartbeat: '45 seconds ago',
    firmware: 'v2.4.1'
  },
  {
    device_id: 'DEV-SR-202',
    tenant: 'Sunrise Assisted (T-003)',
    location: 'Building B',
    type: 'Multi-Sensor',
    status: 'online',
    heartbeat: '22 seconds ago',
    firmware: 'v2.4.1'
  },
  {
    device_id: 'DEV-OT-301',
    tenant: 'Oak Tree Manor (T-004)',
    location: 'Main Hall',
    type: 'Audio Sensor',
    status: 'offline',
    heartbeat: '3 hours ago',
    firmware: 'v2.3.5'
  }
];

const insertDevice = db.prepare(`
  INSERT OR IGNORE INTO devices (id, device_id, tenant, location, type, status, heartbeat, firmware, config, last_seen, created_at, updated_at)
  VALUES (@id, @device_id, @tenant, @location, @type, @status, @heartbeat, @firmware, @config, @last_seen, @created_at, @updated_at)
`);

const now = new Date().toISOString();

seedDevices.forEach(device => {
  insertDevice.run({
    id: nanoid(),
    device_id: device.device_id,
    tenant: device.tenant,
    location: device.location,
    type: device.type,
    status: device.status,
    heartbeat: device.heartbeat,
    firmware: device.firmware,
    config: JSON.stringify({ sensitivity: 0.8, threshold: -40 }),
    last_seen: now,
    created_at: now,
    updated_at: now
  });
  console.log(`✓ Seeded device: ${device.device_id}`);
});

console.log(`\n✅ Seeded ${seedDevices.length} devices successfully!`);
db.close();
