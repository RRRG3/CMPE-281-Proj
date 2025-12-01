/**
 * Load Testing Script for Alert Monitoring System
 * Tests API performance under various load conditions
 */

import http from 'http';
import { performance } from 'perf_hooks';

const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = process.env.API_PORT || 3000;
const TEST_DURATION = parseInt(process.env.TEST_DURATION) || 60000; // 60 seconds
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS) || 10;

// Test credentials
const TEST_USER = {
  email: 'owner@example.com',
  password: 'admin123'
};

// Performance metrics
const metrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0
  },
  latency: {
    min: Infinity,
    max: 0,
    sum: 0,
    samples: []
  },
  endpoints: {},
  errors: []
};

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const startTime = performance.now();
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        resolve({
          statusCode: res.statusCode,
          body: body ? JSON.parse(body) : null,
          latency
        });
      });
    });

    req.on('error', (error) => {
      const endTime = performance.now();
      reject({
        error: error.message,
        latency: endTime - startTime
      });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Record metric
 */
function recordMetric(endpoint, latency, success) {
  metrics.requests.total++;
  if (success) {
    metrics.requests.successful++;
  } else {
    metrics.requests.failed++;
  }

  // Update latency stats
  metrics.latency.min = Math.min(metrics.latency.min, latency);
  metrics.latency.max = Math.max(metrics.latency.max, latency);
  metrics.latency.sum += latency;
  metrics.latency.samples.push(latency);

  // Update endpoint stats
  if (!metrics.endpoints[endpoint]) {
    metrics.endpoints[endpoint] = {
      requests: 0,
      successful: 0,
      failed: 0,
      avgLatency: 0,
      minLatency: Infinity,
      maxLatency: 0
    };
  }

  const ep = metrics.endpoints[endpoint];
  ep.requests++;
  if (success) ep.successful++;
  else ep.failed++;
  ep.minLatency = Math.min(ep.minLatency, latency);
  ep.maxLatency = Math.max(ep.maxLatency, latency);
  ep.avgLatency = ((ep.avgLatency * (ep.requests - 1)) + latency) / ep.requests;
}

/**
 * Login and get token
 */
async function login() {
  try {
    const result = await makeRequest('POST', '/api/v1/auth/login', TEST_USER);
    if (result.statusCode === 200) {
      return result.body.access_token;
    }
    throw new Error('Login failed');
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

/**
 * Test scenario: Alert ingestion
 */
async function testAlertIngestion(token) {
  const alertTypes = ['glass_break', 'smoke_alarm', 'dog_bark', 'fall', 'door_open'];
  const severities = ['low', 'medium', 'high', 'critical'];
  
  const alertData = {
    tenant_id: 't1',
    house_id: 'h1',
    device_id: `dev-${Math.random().toString(36).substr(2, 9)}`,
    type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    message: 'Load test alert',
    score: Math.random()
  };

  try {
    const result = await makeRequest('POST', '/api/v1/alerts/ingest', alertData, token);
    recordMetric('POST /api/v1/alerts/ingest', result.latency, result.statusCode === 200);
    return result.statusCode === 200;
  } catch (error) {
    recordMetric('POST /api/v1/alerts/ingest', error.latency, false);
    metrics.errors.push({ endpoint: 'POST /api/v1/alerts/ingest', error: error.error });
    return false;
  }
}

/**
 * Test scenario: Alert search
 */
async function testAlertSearch(token) {
  const searchData = {
    limit: 50,
    severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)]
  };

  try {
    const result = await makeRequest('POST', '/api/v1/alerts/search', searchData, token);
    recordMetric('POST /api/v1/alerts/search', result.latency, result.statusCode === 200);
    return result.statusCode === 200;
  } catch (error) {
    recordMetric('POST /api/v1/alerts/search', error.latency, false);
    metrics.errors.push({ endpoint: 'POST /api/v1/alerts/search', error: error.error });
    return false;
  }
}

/**
 * Test scenario: Alert stats
 */
async function testAlertStats(token) {
  try {
    const result = await makeRequest('GET', '/api/v1/alerts/stats', null, token);
    recordMetric('GET /api/v1/alerts/stats', result.latency, result.statusCode === 200);
    return result.statusCode === 200;
  } catch (error) {
    recordMetric('GET /api/v1/alerts/stats', error.latency, false);
    metrics.errors.push({ endpoint: 'GET /api/v1/alerts/stats', error: error.error });
    return false;
  }
}

/**
 * Test scenario: Device registration
 */
async function testDeviceRegistration(token) {
  const deviceData = {
    deviceId: `DEV-${Math.random().toString(36).substr(2, 9)}`,
    tenant: 't1',
    location: 'Load Test Room',
    type: 'microphone',
    status: 'online'
  };

  try {
    const result = await makeRequest('POST', '/api/v1/devices', deviceData, token);
    recordMetric('POST /api/v1/devices', result.latency, result.statusCode === 201);
    return result.statusCode === 201;
  } catch (error) {
    recordMetric('POST /api/v1/devices', error.latency, false);
    metrics.errors.push({ endpoint: 'POST /api/v1/devices', error: error.error });
    return false;
  }
}

/**
 * Test scenario: List devices
 */
async function testListDevices(token) {
  try {
    const result = await makeRequest('GET', '/api/v1/devices', null, token);
    recordMetric('GET /api/v1/devices', result.latency, result.statusCode === 200);
    return result.statusCode === 200;
  } catch (error) {
    recordMetric('GET /api/v1/devices', error.latency, false);
    metrics.errors.push({ endpoint: 'GET /api/v1/devices', error: error.error });
    return false;
  }
}

/**
 * Simulate user session
 */
async function simulateUser(userId, duration) {
  console.log(`[User ${userId}] Starting session...`);
  
  // Login
  const token = await login();
  if (!token) {
    console.error(`[User ${userId}] Failed to login`);
    return;
  }

  const startTime = Date.now();
  let requestCount = 0;

  while (Date.now() - startTime < duration) {
    // Random action selection
    const action = Math.random();
    
    if (action < 0.3) {
      await testAlertIngestion(token);
    } else if (action < 0.5) {
      await testAlertSearch(token);
    } else if (action < 0.7) {
      await testAlertStats(token);
    } else if (action < 0.85) {
      await testListDevices(token);
    } else {
      await testDeviceRegistration(token);
    }

    requestCount++;
    
    // Random delay between requests (100-500ms)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
  }

  console.log(`[User ${userId}] Session complete. Made ${requestCount} requests.`);
}

/**
 * Calculate percentiles
 */
function calculatePercentile(arr, percentile) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Generate report
 */
function generateReport() {
  const avgLatency = metrics.latency.sum / metrics.latency.samples.length;
  const p50 = calculatePercentile(metrics.latency.samples, 50);
  const p95 = calculatePercentile(metrics.latency.samples, 95);
  const p99 = calculatePercentile(metrics.latency.samples, 99);
  
  const successRate = (metrics.requests.successful / metrics.requests.total * 100).toFixed(2);
  const requestsPerSecond = (metrics.requests.total / (TEST_DURATION / 1000)).toFixed(2);

  console.log('\n' + '='.repeat(80));
  console.log('LOAD TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`\nTest Configuration:`);
  console.log(`  Duration: ${TEST_DURATION / 1000}s`);
  console.log(`  Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`  Target: http://${API_HOST}:${API_PORT}`);
  
  console.log(`\nOverall Performance:`);
  console.log(`  Total Requests: ${metrics.requests.total}`);
  console.log(`  Successful: ${metrics.requests.successful} (${successRate}%)`);
  console.log(`  Failed: ${metrics.requests.failed}`);
  console.log(`  Requests/sec: ${requestsPerSecond}`);
  
  console.log(`\nLatency Statistics (ms):`);
  console.log(`  Min: ${metrics.latency.min.toFixed(2)}`);
  console.log(`  Max: ${metrics.latency.max.toFixed(2)}`);
  console.log(`  Average: ${avgLatency.toFixed(2)}`);
  console.log(`  Median (P50): ${p50.toFixed(2)}`);
  console.log(`  P95: ${p95.toFixed(2)}`);
  console.log(`  P99: ${p99.toFixed(2)}`);
  
  console.log(`\nEndpoint Performance:`);
  Object.entries(metrics.endpoints).forEach(([endpoint, stats]) => {
    const epSuccessRate = (stats.successful / stats.requests * 100).toFixed(2);
    console.log(`\n  ${endpoint}:`);
    console.log(`    Requests: ${stats.requests}`);
    console.log(`    Success Rate: ${epSuccessRate}%`);
    console.log(`    Avg Latency: ${stats.avgLatency.toFixed(2)}ms`);
    console.log(`    Min Latency: ${stats.minLatency.toFixed(2)}ms`);
    console.log(`    Max Latency: ${stats.maxLatency.toFixed(2)}ms`);
  });

  if (metrics.errors.length > 0) {
    console.log(`\nErrors (showing first 10):`);
    metrics.errors.slice(0, 10).forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.endpoint}: ${err.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Save results to file
  const report = {
    timestamp: new Date().toISOString(),
    configuration: {
      duration: TEST_DURATION,
      concurrentUsers: CONCURRENT_USERS,
      target: `http://${API_HOST}:${API_PORT}`
    },
    summary: {
      totalRequests: metrics.requests.total,
      successful: metrics.requests.successful,
      failed: metrics.requests.failed,
      successRate: parseFloat(successRate),
      requestsPerSecond: parseFloat(requestsPerSecond)
    },
    latency: {
      min: metrics.latency.min,
      max: metrics.latency.max,
      average: avgLatency,
      p50,
      p95,
      p99
    },
    endpoints: metrics.endpoints,
    errors: metrics.errors
  };

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting load test...');
  console.log(`Configuration: ${CONCURRENT_USERS} concurrent users for ${TEST_DURATION / 1000}s`);
  console.log(`Target: http://${API_HOST}:${API_PORT}\n`);

  // Start concurrent user sessions
  const users = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    users.push(simulateUser(i + 1, TEST_DURATION));
  }

  // Wait for all users to complete
  await Promise.all(users);

  // Generate and save report
  const report = generateReport();
  
  // Save to file
  const fs = await import('fs/promises');
  const reportPath = `load-test-report-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

// Run the test
main().catch(console.error);
