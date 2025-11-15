import pg from 'pg';
const { Pool } = pg;

const DB_URL = process.env.DB_URL || 'postgresql://postgres:password@localhost:5432/alert_monitoring';

const pool = new Pool({
  connectionString: DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ PostgreSQL pool connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err);
});

// Test the connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection test successful:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error.message);
    throw error;
  }
}

export default pool;

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  console.log('PostgreSQL pool closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  console.log('PostgreSQL pool closed');
  process.exit(0);
});
