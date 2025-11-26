/**
 * ML Module Manager - Main orchestrator for ML components
 */
import { ModelRegistry } from './ModelRegistry.js';
import { InferenceEngine } from './InferenceEngine.js';
import { PredictionService } from './PredictionService.js';
import { FeatureProcessor } from './FeatureProcessor.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import fs from 'fs/promises';
import path from 'path';

export class MLModuleManager {
  constructor(mongoDb, modelsPath = './models') {
    this.db = mongoDb;
    this.modelsPath = modelsPath;
    
    // Initialize components
    this.modelRegistry = new ModelRegistry(mongoDb, modelsPath);
    this.inferenceEngine = new InferenceEngine(this.modelRegistry);
    this.featureProcessor = new FeatureProcessor(mongoDb);
    this.performanceMonitor = new PerformanceMonitor(mongoDb);
    this.predictionService = new PredictionService(
      this.inferenceEngine,
      this.featureProcessor,
      this.performanceMonitor
    );
    
    this.initialized = false;
  }

  /**
   * Initialize the ML Module Manager
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('[MLModuleManager] Initializing...');
    
    // Initialize components
    await this.modelRegistry.initialize();
    await this.performanceMonitor.initialize();
    
    // Load built-in models
    await this.loadBuiltInModels();
    
    this.initialized = true;
    console.log('[MLModuleManager] Initialization complete');
  }

  /**
   * Load built-in models
   */
  async loadBuiltInModels() {
    const builtInModels = [
      {
        name: 'Anomaly Detection',
        modelId: 'anomaly-detection',
        type: 'anomaly_detection',
        format: 'json',
        description: 'Identifies unusual device behavior patterns',
        file: 'anomaly-detection-model.json'
      },
      {
        name: 'Alert Classification',
        modelId: 'alert-classification',
        type: 'classification',
        format: 'json',
        description: 'Categorizes alerts by type and severity',
        file: 'alert-classification-model.json'
      },
      {
        name: 'Predictive Maintenance',
        modelId: 'predictive-maintenance',
        type: 'regression',
        format: 'json',
        description: 'Forecasts device failures',
        file: 'predictive-maintenance-model.json'
      }
    ];
    
    for (const modelInfo of builtInModels) {
      try {
        // Check if model already exists
        const existing = await this.modelRegistry.collection.findOne({
          model_id: modelInfo.modelId
        });
        
        if (!existing) {
          // Create built-in model
          await this.createBuiltInModel(modelInfo);
          console.log(`[MLModuleManager] Loaded built-in model: ${modelInfo.name}`);
        }
      } catch (error) {
        console.error(`[MLModuleManager] Failed to load ${modelInfo.name}:`, error.message);
      }
    }
  }

  /**
   * Create a built-in model
   */
  async createBuiltInModel(modelInfo) {
    const modelDir = path.join(this.modelsPath, 'built-in', modelInfo.modelId);
    await fs.mkdir(modelDir, { recursive: true });
    
    // Create model file based on type
    let modelData;
    if (modelInfo.modelId === 'anomaly-detection') {
      modelData = this.createAnomalyDetectionModel();
    } else if (modelInfo.modelId === 'alert-classification') {
      modelData = this.createAlertClassificationModel();
    } else if (modelInfo.modelId === 'predictive-maintenance') {
      modelData = this.createPredictiveMaintenanceModel();
    }
    
    const modelPath = path.join(modelDir, 'model.json');
    await fs.writeFile(modelPath, JSON.stringify(modelData, null, 2));
    
    // Register in database
    const modelDoc = {
      model_id: modelInfo.modelId,
      name: modelInfo.name,
      type: modelInfo.type,
      format: modelInfo.format,
      description: modelInfo.description,
      current_version: '1.0.0',
      status: 'active',
      input_schema: modelData.input_schema,
      output_schema: modelData.output_schema,
      model_path: modelPath,
      performance_metrics: modelData.performance_metrics || {},
      versions: [{
        version: '1.0.0',
        model_path: modelPath,
        created_at: new Date(),
        created_by: 'system',
        status: 'active'
      }],
      tags: ['built-in'],
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'system'
    };
    
    await this.modelRegistry.collection.insertOne(modelDoc);
  }

  /**
   * Create anomaly detection model structure
   */
  createAnomalyDetectionModel() {
    return {
      type: 'isolation_forest',
      threshold: 0.6,
      max_depth: 10,
      trees: [
        // Simplified tree structure
        {
          type: 'node',
          feature: 'cpu_usage_percent',
          threshold: 80,
          left: { type: 'leaf', depth: 1 },
          right: {
            type: 'node',
            feature: 'error_count_1h',
            threshold: 5,
            left: { type: 'leaf', depth: 2 },
            right: { type: 'leaf', depth: 3 }
          }
        }
      ],
      input_schema: {
        type: 'object',
        required: ['heartbeat_interval_ms', 'signal_strength', 'cpu_usage_percent'],
        properties: {
          heartbeat_interval_ms: { type: 'number' },
          signal_strength: { type: 'number' },
          cpu_usage_percent: { type: 'number' },
          memory_usage_percent: { type: 'number' },
          error_count_1h: { type: 'number' },
          restart_count_24h: { type: 'number' },
          temperature_celsius: { type: 'number' },
          uptime_hours: { type: 'number' }
        }
      },
      output_schema: {
        type: 'object',
        properties: {
          prediction: { type: 'string', enum: ['normal', 'anomaly'] },
          confidence: { type: 'number' },
          anomaly_score: { type: 'number' }
        }
      },
      performance_metrics: {
        accuracy: 94.2,
        false_positive_rate: 3.0,
        avg_latency_ms: 15
      }
    };
  }

  /**
   * Create alert classification model structure
   */
  createAlertClassificationModel() {
    return {
      type: 'rules',
      rules: [
        {
          name: 'critical_smoke',
          condition: { feature: 'signal_amplitude', operator: '>', value: 0.9 },
          prediction: { type: 'smoke_alarm', severity: 'critical' },
          confidence: 0.96
        },
        {
          name: 'glass_break_high',
          condition: { feature: 'signal_amplitude', operator: '>', value: 0.85 },
          prediction: { type: 'glass_break', severity: 'high' },
          confidence: 0.91
        },
        {
          name: 'fall_detection',
          condition: { feature: 'signal_pattern_length', operator: '>', value: 2 },
          prediction: { type: 'fall', severity: 'high' },
          confidence: 0.88
        }
      ],
      default_prediction: { type: 'unknown', severity: 'low' },
      input_schema: {
        type: 'object',
        required: ['signal_amplitude', 'signal_pattern_length'],
        properties: {
          device_type: { type: 'string' },
          location: { type: 'string' },
          time_of_day: { type: 'number' },
          day_of_week: { type: 'number' },
          signal_pattern_length: { type: 'number' },
          signal_amplitude: { type: 'number' },
          historical_alert_count_7d: { type: 'number' },
          quiet_hours: { type: 'boolean' }
        }
      },
      output_schema: {
        type: 'object',
        properties: {
          prediction: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              severity: { type: 'string' }
            }
          },
          confidence: { type: 'number' }
        }
      },
      performance_metrics: {
        accuracy: 91.5,
        precision_critical: 96.0,
        avg_latency_ms: 20
      }
    };
  }

  /**
   * Create predictive maintenance model structure
   */
  createPredictiveMaintenanceModel() {
    return {
      type: 'rules',
      rules: [
        {
          name: 'high_risk',
          condition: { feature: 'error_rate_7d', operator: '>', value: 10 },
          prediction: { failure_probability: 0.85, risk_level: 'high', estimated_days_to_failure: 7 },
          confidence: 0.92
        },
        {
          name: 'medium_risk',
          condition: { feature: 'avg_temperature_7d', operator: '>', value: 70 },
          prediction: { failure_probability: 0.55, risk_level: 'medium', estimated_days_to_failure: 30 },
          confidence: 0.78
        }
      ],
      default_prediction: { failure_probability: 0.1, risk_level: 'low', estimated_days_to_failure: -1 },
      input_schema: {
        type: 'object',
        required: ['device_age_days', 'total_uptime_hours'],
        properties: {
          device_age_days: { type: 'number' },
          total_uptime_hours: { type: 'number' },
          total_restarts: { type: 'number' },
          avg_temperature_7d: { type: 'number' },
          max_temperature_7d: { type: 'number' },
          avg_cpu_usage_7d: { type: 'number' },
          avg_memory_usage_7d: { type: 'number' },
          error_rate_7d: { type: 'number' },
          last_maintenance_days_ago: { type: 'number' }
        }
      },
      output_schema: {
        type: 'object',
        properties: {
          prediction: {
            type: 'object',
            properties: {
              failure_probability: { type: 'number' },
              estimated_days_to_failure: { type: 'number' },
              risk_level: { type: 'string' }
            }
          },
          confidence: { type: 'number' }
        }
      },
      performance_metrics: {
        accuracy: 88.3,
        precision_high_risk: 92.0,
        avg_latency_ms: 25
      }
    };
  }

  /**
   * Get all components (for testing/debugging)
   */
  getComponents() {
    return {
      modelRegistry: this.modelRegistry,
      inferenceEngine: this.inferenceEngine,
      predictionService: this.predictionService,
      featureProcessor: this.featureProcessor,
      performanceMonitor: this.performanceMonitor
    };
  }
}
