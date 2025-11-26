/**
 * Performance Monitor - Tracks model performance and detects drift
 */

export class PerformanceMonitor {
  constructor(db) {
    this.db = db;
    this.collection = db.collection('prediction_logs');
  }

  async initialize() {
    // Create indexes
    await this.collection.createIndex({ model_id: 1, timestamp: -1 });
    await this.collection.createIndex({ prediction_id: 1 }, { unique: true });
    await this.collection.createIndex({ timestamp: -1 });
  }

  /**
   * Log prediction
   */
  async logPrediction(log) {
    const document = {
      prediction_id: log.predictionId,
      model_id: log.modelId,
      model_version: log.modelVersion,
      device_id: log.input.deviceId,
      input_features: log.input.features,
      prediction: log.output.prediction,
      confidence: log.output.confidence,
      raw_output: log.output.metadata,
      processing_time_ms: log.output.metadata.processingTimeMs,
      actual_label: null,
      correct: null,
      timestamp: log.timestamp,
      created_at: new Date()
    };
    
    await this.collection.insertOne(document);
  }

  /**
   * Get performance metrics
   */
  async getMetrics(modelId, timeRange) {
    const startDate = timeRange.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = timeRange.end || new Date();
    
    const predictions = await this.collection
      .find({
        model_id: modelId,
        timestamp: { $gte: startDate, $lte: endDate }
      })
      .toArray();
    
    if (predictions.length === 0) {
      return {
        total_predictions: 0,
        avg_latency_ms: 0,
        throughput: 0
      };
    }
    
    // Calculate metrics
    const totalLatency = predictions.reduce((sum, p) => sum + (p.processing_time_ms || 0), 0);
    const avgLatency = totalLatency / predictions.length;
    
    const timeRangeMs = endDate - startDate;
    const throughput = (predictions.length / timeRangeMs) * 1000; // predictions per second
    
    // Calculate accuracy if ground truth available
    const labeled = predictions.filter(p => p.actual_label != null);
    let accuracy = null;
    let precision = null;
    let recall = null;
    
    if (labeled.length > 0) {
      const correct = labeled.filter(p => p.correct).length;
      accuracy = (correct / labeled.length) * 100;
      
      // Calculate precision and recall per class
      const classes = [...new Set(labeled.map(p => p.actual_label))];
      const precisionByClass = {};
      const recallByClass = {};
      
      for (const cls of classes) {
        const truePositives = labeled.filter(p => p.prediction === cls && p.actual_label === cls).length;
        const falsePositives = labeled.filter(p => p.prediction === cls && p.actual_label !== cls).length;
        const falseNegatives = labeled.filter(p => p.prediction !== cls && p.actual_label === cls).length;
        
        precisionByClass[cls] = truePositives / (truePositives + falsePositives) || 0;
        recallByClass[cls] = truePositives / (truePositives + falseNegatives) || 0;
      }
      
      // Average precision and recall
      precision = Object.values(precisionByClass).reduce((a, b) => a + b, 0) / classes.length;
      recall = Object.values(recallByClass).reduce((a, b) => a + b, 0) / classes.length;
    }
    
    return {
      total_predictions: predictions.length,
      labeled_predictions: labeled.length,
      accuracy: accuracy ? parseFloat(accuracy.toFixed(2)) : null,
      precision: precision ? parseFloat((precision * 100).toFixed(2)) : null,
      recall: recall ? parseFloat((recall * 100).toFixed(2)) : null,
      avg_latency_ms: parseFloat(avgLatency.toFixed(2)),
      throughput: parseFloat(throughput.toFixed(2)),
      time_range: { start: startDate, end: endDate }
    };
  }

  /**
   * Detect model drift
   */
  async detectDrift(modelId, windowDays = 7) {
    const now = new Date();
    const recentStart = new Date(now - windowDays * 24 * 60 * 60 * 1000);
    const historicalStart = new Date(now - 2 * windowDays * 24 * 60 * 60 * 1000);
    
    // Get recent metrics
    const recentMetrics = await this.getMetrics(modelId, {
      start: recentStart,
      end: now
    });
    
    // Get historical metrics
    const historicalMetrics = await this.getMetrics(modelId, {
      start: historicalStart,
      end: recentStart
    });
    
    if (!recentMetrics.accuracy || !historicalMetrics.accuracy) {
      return {
        drift_detected: false,
        message: 'Insufficient labeled data for drift detection'
      };
    }
    
    const accuracyDrop = historicalMetrics.accuracy - recentMetrics.accuracy;
    const driftThreshold = 5.0; // 5% accuracy drop
    
    const driftDetected = accuracyDrop > driftThreshold;
    
    return {
      drift_detected: driftDetected,
      recent_accuracy: recentMetrics.accuracy,
      historical_accuracy: historicalMetrics.accuracy,
      accuracy_drop: parseFloat(accuracyDrop.toFixed(2)),
      threshold: driftThreshold,
      recommendation: driftDetected
        ? 'Model retraining recommended due to performance degradation'
        : 'Model performance is stable',
      window_days: windowDays,
      recent_predictions: recentMetrics.total_predictions,
      historical_predictions: historicalMetrics.total_predictions
    };
  }

  /**
   * Update with ground truth
   */
  async updateGroundTruth(predictionId, actualLabel) {
    const prediction = await this.collection.findOne({ prediction_id: predictionId });
    
    if (!prediction) {
      throw new Error(`Prediction not found: ${predictionId}`);
    }
    
    const correct = prediction.prediction === actualLabel;
    
    await this.collection.updateOne(
      { prediction_id: predictionId },
      {
        $set: {
          actual_label: actualLabel,
          correct,
          updated_at: new Date()
        }
      }
    );
    
    console.log(`[PerformanceMonitor] Updated ground truth for ${predictionId}: ${correct ? 'correct' : 'incorrect'}`);
    
    return { correct };
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(modelId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const trends = await this.collection.aggregate([
      {
        $match: {
          model_id: modelId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
          },
          count: { $sum: 1 },
          avg_confidence: { $avg: '$confidence' },
          avg_processing_time: { $avg: '$processing_time_ms' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]).toArray();
    
    return trends;
  }
}
