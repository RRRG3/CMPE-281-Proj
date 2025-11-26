import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

const db = new Database('./data.db');

// Disable foreign keys temporarily
db.pragma('foreign_keys = OFF');

// Delete existing data
db.prepare('DELETE FROM refresh_tokens').run();
db.prepare('DELETE FROM houses').run();
db.prepare('DELETE FROM users').run();

// Re-enable foreign keys
db.pragma('foreign_keys = ON');

// Create users with correct password hash for "admin123"
const passwordHash = '$2b$10$AgILMR4Zuq6vnwomvceD..XS5y8xswIe/N2if1EXx0imQJ2S.4kEu';

console.log('Creating users...');

db.prepare(`INSERT INTO users (id, user_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  nanoid(), 'U-001', 'Admin User', 'admin@example.com', passwordHash, 'ADMIN', new Date().toISOString()
);

db.prepare(`INSERT INTO users (id, user_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  nanoid(), 'U-002', 'John Owner', 'owner@example.com', passwordHash, 'OWNER', new Date().toISOString()
);

db.prepare(`INSERT INTO users (id, user_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  nanoid(), 'U-003', 'Jane Caregiver', 'caregiver@example.com', passwordHash, 'CAREGIVER', new Date().toISOString()
);

console.log('✅ Users created successfully!');
console.log('');
console.log('Login credentials:');
console.log('  Email: admin@example.com');
console.log('  Password: admin123');
console.log('');
console.log('  Email: owner@example.com');
console.log('  Password: admin123');
console.log('');
console.log('  Email: caregiver@example.com');
console.log('  Password: admin123');

db.close();
