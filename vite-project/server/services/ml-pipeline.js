/**
 * ML Data Pipeline Service
 * Manages ML inference data, model performance tracking, and data preparation
 */

/**
 * Store ML inference result with full metadata
 */
export async function storeInference(mlInferenceCollection, inferenceData) {
  const {
    alert_id = null,
    device_id,
    model_name,
    model_version,
    prediction,
    score,
    confidence,
    features = null,
    window_uri = null,
    processing_time_ms = null
  } = inferenceData;

  const document = {
    alert_id,
    device_id,
    ts: new Date(),
    model_name,
    model_version,
    prediction,
    score,
    confidence,
    features,
    window_uri,
    processing_time_ms,
    created_at: new Date()
  };

  try {
    const result = await mlInferenceCollection.insertOne(document);
    console.log(`[ml-pipeline] Stored inference ${result.insertedId} for device ${device_id}`);
    return result.insertedId.toString();
  } catch (error) {
    console.error('[ml-pipeline] Failed to store inference:', error.message);
    throw error;
  }
}

/**
 * Get inference history for a device
 */
export async function getDeviceInferenceHistory(mlInferenceCollection, deviceId, limit = 100) {
  try {
    const inferences = await mlInferenceCollection
      .find({ device_id: deviceId })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    return inferences;
  } catch (error) {
    console.error('[ml-pipeline] Failed to get inference history:', error.message);
    return [];
  }
}

/**
 * Calculate model accuracy metrics
 */
export async function calculateModelAccuracy(mlInferenceCollection, pool, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Get all inferences with associated alerts
    const inferences = await mlInferenceCollection
      .find({
        ts: { $gte: startDate },
        alert_id: { $ne: null }
      })
      .toArray();

    if (inferences.length === 0) {
      return {
        total_inferences: 0,
        accuracy: null,
        precision_by_class: {},
        message: 'Insufficient data for accuracy calculation'
      };
    }

    // Get corresponding alerts to compare predictions
    const alertIds = inferences.map(i => i.alert_id);
    const alertsResult = await pool.query(
      `SELECT alert_id, type, severity FROM alerts WHERE alert_id = ANY($1)`,
      [alertIds]
    );

    const alertsMap = {};
    alertsResult.rows.forEach(alert => {
      alertsMap[alert.alert_id] = alert;
    });

    // Calculate accuracy (prediction matches alert type)
    let correct = 0;
    const classCounts = {};
    const classCorrect = {};

    inferences.forEach(inference => {
      const alert = alertsMap[inference.alert_id];
      if (!alert) return;

      const predicted = inference.prediction;
      const actual = alert.type;

      if (!classCounts[actual]) {
        classCounts[actual] = 0;
        classCorrect[actual] = 0;
      }

      classCounts[actual]++;

      if (predicted === actual) {
        correct++;
        classCorrect[actual]++;
      }
    });

    const accuracy = (correct / inferences.length * 100).toFixed(2);

    // Calculate precision by class
    const precisionByClass = {};
    Object.keys(classCounts).forEach(className => {
      precisionByClass[className] = {
        total: classCounts[className],
        correct: classCorrect[className],
        precision: (classCorrect[className] / classCounts[className] * 100).toFixed(2)
      };
    });

    return {
      total_inferences: inferences.length,
      correct_predictions: correct,
      accuracy: parseFloat(accuracy),
      precision_by_class: precisionByClass,
      evaluation_period_days: days
    };
  } catch (error) {
    console.error('[ml-pipeline] Failed to calculate accuracy:', error.message);
    return null;
  }
}

/**
 * Get model performance trends over time
 */
export async function getModelPerformanceTrends(mlInferenceCollection, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const trends = await mlInferenceCollection.aggregate([
      {
        $match: {
          ts: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } },
            model: '$model_name'
          },
          count: { $sum: 1 },
          avg_score: { $avg: '$score' },
          avg_processing_time: { $avg: '$processing_time_ms' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]).toArray();

    return trends;
  } catch (error) {
    console.error('[ml-pipeline] Failed to get performance trends:', error.message);
    return [];
  }
}

/**
 * Prepare training data for model retraining
 */
export async function prepareTrainingData(mlInferenceCollection, pool, options = {}) {
  const {
    startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    endDate = new Date(),
    minScore = 0.5,
    includeFeatures = true
  } = options;

  try {
    console.log('[ml-pipeline] Preparing training data...');

    // Get inferences with alerts (labeled data)
    const inferences = await mlInferenceCollection
      .find({
        ts: { $gte: startDate, $lte: endDate },
        alert_id: { $ne: null },
        score: { $gte: minScore }
      })
      .toArray();

    if (inferences.length === 0) {
      return {
        samples: [],
        count: 0,
        message: 'No labeled data available'
      };
    }

    // Get corresponding alerts for labels
    const alertIds = inferences.map(i => i.alert_id);
    const alertsResult = await pool.query(
      `SELECT alert_id, type, severity, score FROM alerts WHERE alert_id = ANY($1)`,
      [alertIds]
    );

    const alertsMap = {};
    alertsResult.rows.forEach(alert => {
      alertsMap[alert.alert_id] = alert;
    });

    // Prepare training samples
    const samples = inferences
      .filter(inf => alertsMap[inf.alert_id])
      .map(inf => {
        const alert = alertsMap[inf.alert_id];
        return {
          inference_id: inf._id.toString(),
          device_id: inf.device_id,
          timestamp: inf.ts,
          features: includeFeatures ? inf.features : null,
          window_uri: inf.window_uri,
          predicted_label: inf.prediction,
          predicted_score: inf.score,
          actual_label: alert.type,
          actual_severity: alert.severity,
          model_name: inf.model_name,
          model_version: inf.model_version
        };
      });

    console.log(`[ml-pipeline] Prepared ${samples.length} training samples`);

    return {
      samples,
      count: samples.length,
      date_range: { start: startDate, end: endDate },
      generated_at: new Date()
    };
  } catch (error) {
    console.error('[ml-pipeline] Failed to prepare training data:', error.message);
    throw error;
  }
}

/**
 * Detect model drift (performance degradation over time)
 */
export async function detectModelDrift(mlInferenceCollection, pool, windowDays = 7) {
  try {
    const now = new Date();
    const recentStart = new Date(now - windowDays * 24 * 60 * 60 * 1000);
    const historicalStart = new Date(now - 2 * windowDays * 24 * 60 * 60 * 1000);

    // Calculate accuracy for recent period
    const recentAccuracy = await calculateModelAccuracy(
      mlInferenceCollection,
      pool,
      windowDays
    );

    // Calculate accuracy for historical period
    const historicalAccuracy = await calculateModelAccuracy(
      mlInferenceCollection,
      pool,
      windowDays * 2
    );

    if (!recentAccuracy || !historicalAccuracy) {
      return {
        drift_detected: false,
        message: 'Insufficient data for drift detection'
      };
    }

    const accuracyDrop = historicalAccuracy.accuracy - recentAccuracy.accuracy;
    const driftThreshold = 5.0; // 5% accuracy drop

    const driftDetected = accuracyDrop > driftThreshold;

    return {
      drift_detected: driftDetected,
      recent_accuracy: recentAccuracy.accuracy,
      historical_accuracy: historicalAccuracy.accuracy,
      accuracy_drop: accuracyDrop.toFixed(2),
      threshold: driftThreshold,
      recommendation: driftDetected 
        ? 'Model retraining recommended due to performance degradation'
        : 'Model performance is stable',
      window_days: windowDays
    };
  } catch (error) {
    console.error('[ml-pipeline] Failed to detect drift:', error.message);
    return null;
  }
}

/**
 * Get feature importance analysis
 */
export async function analyzeFeatureImportance(mlInferenceCollection, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Aggregate feature statistics
    const inferences = await mlInferenceCollection
      .find({
        ts: { $gte: startDate },
        features: { $ne: null }
      })
      .limit(1000)
      .toArray();

    if (inferences.length === 0) {
      return {
        message: 'No feature data available',
        features: []
      };
    }

    // Extract and analyze features
    const featureStats = {};

    inferences.forEach(inf => {
      if (!inf.features) return;

      Object.keys(inf.features).forEach(featureName => {
        if (!featureStats[featureName]) {
          featureStats[featureName] = {
            count: 0,
            sum: 0,
            min: Infinity,
            max: -Infinity,
            values: []
          };
        }

        const value = inf.features[featureName];
        if (typeof value === 'number') {
          featureStats[featureName].count++;
          featureStats[featureName].sum += value;
          featureStats[featureName].min = Math.min(featureStats[featureName].min, value);
          featureStats[featureName].max = Math.max(featureStats[featureName].max, value);
          featureStats[featureName].values.push(value);
        }
      });
    });

    // Calculate statistics
    const features = Object.keys(featureStats).map(name => {
      const stats = featureStats[name];
      const mean = stats.sum / stats.count;
      
      // Calculate standard deviation
      const variance = stats.values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / stats.count;
      const stdDev = Math.sqrt(variance);

      return {
        name,
        count: stats.count,
        mean: mean.toFixed(4),
        std_dev: stdDev.toFixed(4),
        min: stats.min.toFixed(4),
        max: stats.max.toFixed(4)
      };
    });

    return {
      features,
      total_samples: inferences.length,
      analysis_period_days: days
    };
  } catch (error) {
    console.error('[ml-pipeline] Failed to analyze features:', error.message);
    return null;
  }
}

/**
 * Export ML data for external analysis
 */
export async function exportMLData(mlInferenceCollection, pool, options = {}) {
  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate = new Date(),
    format = 'json' // json or csv
  } = options;

  try {
    const trainingData = await prepareTrainingData(mlInferenceCollection, pool, {
      startDate,
      endDate,
      includeFeatures: true
    });

    if (format === 'csv') {
      // Convert to CSV format
      const headers = [
        'inference_id', 'device_id', 'timestamp', 'predicted_label', 
        'predicted_score', 'actual_label', 'actual_severity', 
        'model_name', 'model_version'
      ];

      const rows = trainingData.samples.map(sample => [
        sample.inference_id,
        sample.device_id,
        sample.timestamp,
        sample.predicted_label,
        sample.predicted_score,
        sample.actual_label,
        sample.actual_severity,
        sample.model_name,
        sample.model_version
      ]);

      return {
        format: 'csv',
        headers,
        rows,
        count: rows.length
      };
    }

    return {
      format: 'json',
      data: trainingData.samples,
      count: trainingData.count
    };
  } catch (error) {
    console.error('[ml-pipeline] Failed to export data:', error.message);
    throw error;
  }
}

export default {
  storeInference,
  getDeviceInferenceHistory,
  calculateModelAccuracy,
  getModelPerformanceTrends,
  prepareTrainingData,
  detectModelDrift,
  analyzeFeatureImportance,
  exportMLData
};
