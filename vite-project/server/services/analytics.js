/**
 * Analytics Service
 * Provides advanced analytics and reporting for alert monitoring
 */

/**
 * Get alert trends over time
 */
export async function getAlertTrends(pool, options = {}) {
  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate = new Date(),
    groupBy = 'day', // day, hour, week
    houseId = null,
    deviceId = null
  } = options;

  const whereClauses = ['occurred_at >= $1', 'occurred_at <= $2'];
  const params = [startDate, endDate];
  let paramIndex = 3;

  if (houseId) {
    whereClauses.push(`house_id = $${paramIndex++}`);
    params.push(houseId);
  }

  if (deviceId) {
    whereClauses.push(`device_id = $${paramIndex++}`);
    params.push(deviceId);
  }

  const dateFormat = groupBy === 'hour' 
    ? "DATE_TRUNC('hour', occurred_at)" 
    : groupBy === 'week'
    ? "DATE_TRUNC('week', occurred_at)"
    : "DATE(occurred_at)";

  const query = `
    SELECT 
      ${dateFormat} as period,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE severity = 'low') as low,
      COUNT(*) FILTER (WHERE severity = 'medium') as medium,
      COUNT(*) FILTER (WHERE severity = 'high') as high,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical,
      COUNT(*) FILTER (WHERE state = 'resolved') as resolved,
      AVG(score) as avg_score
    FROM alerts
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY period
    ORDER BY period ASC
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get device performance metrics
 */
export async function getDevicePerformance(pool, deviceId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const query = `
    SELECT 
      device_id,
      COUNT(*) as total_alerts,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical_alerts,
      COUNT(*) FILTER (WHERE severity = 'high') as high_alerts,
      AVG(score) as avg_confidence,
      COUNT(DISTINCT DATE(occurred_at)) as active_days,
      MIN(occurred_at) as first_alert,
      MAX(occurred_at) as last_alert
    FROM alerts
    WHERE device_id = $1 AND occurred_at >= $2
    GROUP BY device_id
  `;

  const result = await pool.query(query, [deviceId, startDate]);
  return result.rows[0] || null;
}

/**
 * Get alert response time metrics
 */
export async function getResponseTimeMetrics(pool, options = {}) {
  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate = new Date(),
    houseId = null
  } = options;

  const whereClauses = ['occurred_at >= $1', 'occurred_at <= $2'];
  const params = [startDate, endDate];
  let paramIndex = 3;

  if (houseId) {
    whereClauses.push(`house_id = $${paramIndex++}`);
    params.push(houseId);
  }

  const query = `
    SELECT 
      severity,
      COUNT(*) as total_alerts,
      AVG(EXTRACT(EPOCH FROM (acknowledged_at - occurred_at))) as avg_ack_time_sec,
      AVG(EXTRACT(EPOCH FROM (resolved_at - occurred_at))) as avg_resolve_time_sec,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (acknowledged_at - occurred_at))) as median_ack_time_sec,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - occurred_at))) as median_resolve_time_sec,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (acknowledged_at - occurred_at))) as p95_ack_time_sec,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - occurred_at))) as p95_resolve_time_sec
    FROM alerts
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY severity
    ORDER BY 
      CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Detect alert patterns and anomalies
 */
export async function detectAlertPatterns(pool, options = {}) {
  const {
    days = 7,
    houseId = null,
    deviceId = null
  } = options;

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const whereClauses = ['occurred_at >= $1'];
  const params = [startDate];
  let paramIndex = 2;

  if (houseId) {
    whereClauses.push(`house_id = $${paramIndex++}`);
    params.push(houseId);
  }

  if (deviceId) {
    whereClauses.push(`device_id = $${paramIndex++}`);
    params.push(deviceId);
  }

  // Detect frequent alert types
  const frequentAlertsQuery = `
    SELECT 
      type,
      COUNT(*) as count,
      AVG(score) as avg_score,
      COUNT(*) FILTER (WHERE severity IN ('high', 'critical')) as high_severity_count
    FROM alerts
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY type
    HAVING COUNT(*) > 5
    ORDER BY count DESC
    LIMIT 10
  `;

  const frequentAlerts = await pool.query(frequentAlertsQuery, params);

  // Detect time-based patterns (alerts by hour of day)
  const timePatternQuery = `
    SELECT 
      EXTRACT(HOUR FROM occurred_at) as hour,
      COUNT(*) as count,
      AVG(score) as avg_score
    FROM alerts
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY hour
    ORDER BY hour
  `;

  const timePatterns = await pool.query(timePatternQuery, params);

  // Detect device clusters (devices with similar alert patterns)
  const deviceClusterQuery = `
    SELECT 
      device_id,
      COUNT(*) as alert_count,
      ARRAY_AGG(DISTINCT type) as alert_types,
      AVG(score) as avg_score
    FROM alerts
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY device_id
    HAVING COUNT(*) > 3
    ORDER BY alert_count DESC
  `;

  const deviceClusters = await pool.query(deviceClusterQuery, params);

  return {
    frequent_alerts: frequentAlerts.rows,
    time_patterns: timePatterns.rows,
    device_clusters: deviceClusters.rows
  };
}

/**
 * Get ML model performance metrics
 */
export async function getMLModelMetrics(mlInferenceCollection, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const metrics = await mlInferenceCollection.aggregate([
      {
        $match: {
          ts: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$label',
          count: { $sum: 1 },
          avg_score: { $avg: '$score' },
          min_score: { $min: '$score' },
          max_score: { $max: '$score' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();

    // Calculate overall accuracy (mock for now)
    const totalPredictions = metrics.reduce((sum, m) => sum + m.count, 0);
    const avgConfidence = metrics.reduce((sum, m) => sum + (m.avg_score * m.count), 0) / totalPredictions;

    return {
      total_predictions: totalPredictions,
      avg_confidence: avgConfidence,
      predictions_by_label: metrics,
      model_version: 'audio_classifier_v3'
    };
  } catch (error) {
    console.error('[analytics] ML metrics error:', error.message);
    return null;
  }
}

/**
 * Generate comprehensive alert report
 */
export async function generateAlertReport(pool, mlInferenceCollection, options = {}) {
  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate = new Date(),
    houseId = null
  } = options;

  console.log('[analytics] Generating comprehensive alert report...');

  const [
    trends,
    responseMetrics,
    patterns,
    mlMetrics
  ] = await Promise.all([
    getAlertTrends(pool, { startDate, endDate, houseId }),
    getResponseTimeMetrics(pool, { startDate, endDate, houseId }),
    detectAlertPatterns(pool, { days: 30, houseId }),
    mlInferenceCollection ? getMLModelMetrics(mlInferenceCollection, 30) : null
  ]);

  // Calculate summary statistics
  const totalAlerts = trends.reduce((sum, t) => sum + parseInt(t.total), 0);
  const criticalAlerts = trends.reduce((sum, t) => sum + parseInt(t.critical), 0);
  const resolvedAlerts = trends.reduce((sum, t) => sum + parseInt(t.resolved), 0);
  const resolutionRate = totalAlerts > 0 ? (resolvedAlerts / totalAlerts * 100).toFixed(2) : 0;

  return {
    report_period: {
      start: startDate,
      end: endDate,
      days: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    },
    summary: {
      total_alerts: totalAlerts,
      critical_alerts: criticalAlerts,
      resolved_alerts: resolvedAlerts,
      resolution_rate: parseFloat(resolutionRate)
    },
    trends,
    response_metrics: responseMetrics,
    patterns,
    ml_metrics: mlMetrics,
    generated_at: new Date().toISOString()
  };
}

/**
 * Get real-time alert statistics
 */
export async function getRealTimeStats(pool) {
  const query = `
    SELECT 
      COUNT(*) FILTER (WHERE state IN ('new', 'escalated')) as active_alerts,
      COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '1 hour') as alerts_last_hour,
      COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '24 hours') as alerts_last_24h,
      COUNT(*) FILTER (WHERE severity = 'critical' AND state IN ('new', 'escalated')) as critical_active,
      AVG(EXTRACT(EPOCH FROM (NOW() - occurred_at))) FILTER (WHERE state IN ('new', 'escalated')) as avg_age_seconds
    FROM alerts
  `;

  const result = await pool.query(query);
  return result.rows[0];
}

export default {
  getAlertTrends,
  getDevicePerformance,
  getResponseTimeMetrics,
  detectAlertPatterns,
  getMLModelMetrics,
  generateAlertReport,
  getRealTimeStats
};
