import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

const db = new Database('data.db');

function nowISO() { return new Date().toISOString(); }

// Create tenants table if not exists
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
  INSERT OR REPLACE INTO tenants (id, tenant_id, name, contact_email, contact_phone, status, device_count, alert_count, created_at, updated_at)
  VALUES (@id, @tenant_id, @name, @contact_email, @contact_phone, @status, @device_count, @alert_count, @created_at, @updated_at)
`);

const tenants = [
  {
    id: nanoid(),
    tenant_id: 'T-001',
    name: 'Johnson Residence',
    contact_email: 'owner@johnson.com',
    contact_phone: '+1-555-0101',
    status: 'active',
    device_count: 8,
    alert_count: 32,
    created_at: '2025-01-15T10:00:00.000Z',
    updated_at: nowISO()
  },
  {
    id: nanoid(),
    tenant_id: 'T-002',
    name: 'Green Valley Senior',
    contact_email: 'admin@greenvalley.com',
    contact_phone: '+1-555-0102',
    status: 'active',
    device_count: 12,
    alert_count: 45,
    created_at: '2025-02-01T10:00:00.000Z',
    updated_at: nowISO()
  },
  {
    id: nanoid(),
    tenant_id: 'T-003',
    name: 'Sunrise Assisted',
    contact_email: 'contact@sunrise.com',
    contact_phone: '+1-555-0103',
    status: 'active',
    device_count: 24,
    alert_count: 67,
    created_at: '2025-03-10T10:00:00.000Z',
    updated_at: nowISO()
  },
  {
    id: nanoid(),
    tenant_id: 'T-004',
    name: 'Oak Tree Manor',
    contact_email: 'info@oaktree.com',
    contact_phone: '+1-555-0104',
    status: 'trial',
    device_count: 6,
    alert_count: 18,
    created_at: '2025-10-01T10:00:00.000Z',
    updated_at: nowISO()
  }
];

console.log('Seeding tenants...');
tenants.forEach(tenant => {
  insertTenant.run(tenant);
  console.log(`✓ Created tenant: ${tenant.tenant_id} - ${tenant.name}`);
});

console.log(`\n✅ Seeded ${tenants.length} tenants successfully!`);
db.close();
