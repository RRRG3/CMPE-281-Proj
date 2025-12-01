/**
 * Health Check Endpoint
 * Provides detailed health status for load balancer monitoring
 */

import Database from 'better-sqlite3';

let db;
let mongoClient;

export function initHealthCheck(database, mongo) {
  db = database;
  mongoClient = mongo;
}

export async function healthCheck(req, res) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    instance: process.env.INSTANCE_ID || 'unknown',
    uptime: process.uptime(),
    checks: {}
  };

  try {
    // Check SQLite database
    try {
      db.prepare('SELECT 1').get();
      health.checks.sqlite = { status: 'up', latency: 0 };
    } catch (error) {
      health.checks.sqlite = { status: 'down', error: error.message };
      health.status = 'unhealthy';
    }

    // Check MongoDB
    if (mongoClient) {
      try {
        const start = Date.now();
        await mongoClient.db().admin().ping();
        health.checks.mongodb = { status: 'up', latency: Date.now() - start };
      } catch (error) {
        health.checks.mongodb = { status: 'down', error: error.message };
        health.status = 'degraded';
      }
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    health.checks.memory = {
      status: 'up',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
    };

    // CPU usage (simple check)
    const cpuUsage = process.cpuUsage();
    health.checks.cpu = {
      status: 'up',
      user: cpuUsage.user,
      system: cpuUsage.system
    };

    // Response
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}
