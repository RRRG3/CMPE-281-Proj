/**
 * Inference Engine - Loads and executes ML models
 */
import fs from 'fs/promises';
import path from 'path';

export class InferenceEngine {
  constructor(modelRegistry) {
    this.modelRegistry = modelRegistry;
    this.loadedModels = new Map(); // Cache for loaded models
    this.adapters = new Map(); // Model format adapters
    
    // Register default adapters
    this.registerAdapter('json', new JSONModelAdapter());
  }

  /**
   * Register a custom model adapter
   */
  registerAdapter(format, adapter) {
    this.adapters.set(format, adapter);
    console.log(`[InferenceEngine] Registered adapter for format: ${format}`);
  }

  /**
   * Load model into memory
   */
  async loadModel(modelId, version = null) {
    const cacheKey = version ? `${modelId}:${version}` : modelId;
    
    // Check if already loaded
    if (this.loadedModels.has(cacheKey)) {
      console.log(`[InferenceEngine] Model ${cacheKey} already loaded`);
      return;
    }
    
    // Get model metadata
    const modelMeta = await this.modelRegistry.getModel(modelId);
    
    // Determine model path
    let modelPath = modelMeta.model_path;
    if (version) {
      const versionEntry = modelMeta.versions.find(v => v.version === version);
      if (!versionEntry) {
        throw new Error(`Version ${version} not found for model ${modelId}`);
      }
      modelPath = versionEntry.model_path;
    }
    
    // Get appropriate adapter
    const adapter = this.adapters.get(modelMeta.format);
    if (!adapter) {
      throw new Error(`No adapter found for format: ${modelMeta.format}`);
    }
    
    // Load model using adapter
    const loadedModel = await adapter.load(modelPath);
    
    // Verify model integrity
    const isValid = await adapter.verify(loadedModel, modelMeta);
    if (!isValid) {
      throw new Error(`Model integrity verification failed: ${modelId}`);
    }
    
    // Cache loaded model
    this.loadedModels.set(cacheKey, {
      model: loadedModel,
      adapter,
      metadata: modelMeta,
      loadedAt: new Date()
    });
    
    console.log(`[InferenceEngine] Loaded model ${cacheKey}`);
  }

  /**
   * Unload model from memory
   */
  async unloadModel(modelId) {
    const keysToRemove = [];
    for (const key of this.loadedModels.keys()) {
      if (key.startsWith(modelId)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => this.loadedModels.delete(key));
    console.log(`[InferenceEngine] Unloaded model ${modelId}`);
  }

  /**
   * Execute inference
   */
  async infer(modelId, features, version = null, timeout = 30000) {
    const cacheKey = version ? `${modelId}:${version}` : modelId;
    
    // Load model if not already loaded
    if (!this.loadedModels.has(cacheKey)) {
      await this.loadModel(modelId, version);
    }
    
    const { model, adapter, metadata } = this.loadedModels.get(cacheKey);
    
    // Execute with timeout
    const inferencePromise = adapter.predict(model, features, metadata);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Inference timeout')), timeout)
    );
    
    const startTime = Date.now();
    const result = await Promise.race([inferencePromise, timeoutPromise]);
    const processingTime = Date.now() - startTime;
    
    return {
      ...result,
      processingTimeMs: processingTime
    };
  }

  /**
   * Get loaded models info
   */
  getLoadedModels() {
    const info = [];
    for (const [key, value] of this.loadedModels.entries()) {
      info.push({
        key,
        modelId: value.metadata.model_id,
        name: value.metadata.name,
        loadedAt: value.loadedAt
      });
    }
    return info;
  }
}

/**
 * JSON Model Adapter - For lightweight decision trees and rule-based models
 */
class JSONModelAdapter {
  async load(modelPath) {
    const content = await fs.readFile(modelPath, 'utf-8');
    return JSON.parse(content);
  }

  async verify(model, metadata) {
    // Basic verification - check model structure
    return model && typeof model === 'object';
  }

  async predict(model, features, metadata) {
    // Handle different JSON model types
    if (model.type === 'decision_tree') {
      return this._predictDecisionTree(model, features);
    } else if (model.type === 'rules') {
      return this._predictRules(model, features);
    } else if (model.type === 'isolation_forest') {
      return this._predictIsolationForest(model, features);
    }
    
    throw new Error(`Unsupported JSON model type: ${model.type}`);
  }

  _predictDecisionTree(model, features) {
    let node = model.tree;
    
    while (node.type !== 'leaf') {
      const featureValue = features[node.feature];
      if (featureValue <= node.threshold) {
        node = node.left;
      } else {
        node = node.right;
      }
    }
    
    return {
      prediction: node.value,
      confidence: node.confidence || 1.0
    };
  }

  _predictRules(model, features) {
    // Evaluate rules in order
    for (const rule of model.rules) {
      if (this._evaluateCondition(rule.condition, features)) {
        return {
          prediction: rule.prediction,
          confidence: rule.confidence || 1.0,
          rule: rule.name
        };
      }
    }
    
    // Default prediction
    return {
      prediction: model.default_prediction,
      confidence: 0.5
    };
  }

  _predictIsolationForest(model, features) {
    // Simplified isolation forest scoring
    let anomalyScore = 0;
    
    for (const tree of model.trees) {
      const depth = this._getPathLength(tree, features);
      anomalyScore += depth;
    }
    
    anomalyScore /= model.trees.length;
    
    // Normalize score
    const normalizedScore = Math.min(1.0, anomalyScore / model.max_depth);
    const isAnomaly = normalizedScore > model.threshold;
    
    return {
      prediction: isAnomaly ? 'anomaly' : 'normal',
      confidence: Math.abs(normalizedScore - model.threshold),
      anomaly_score: normalizedScore
    };
  }

  _getPathLength(node, features, depth = 0) {
    if (node.type === 'leaf') {
      return depth;
    }
    
    const featureValue = features[node.feature];
    if (featureValue <= node.threshold) {
      return this._getPathLength(node.left, features, depth + 1);
    } else {
      return this._getPathLength(node.right, features, depth + 1);
    }
  }

  _evaluateCondition(condition, features) {
    const { feature, operator, value } = condition;
    const featureValue = features[feature];
    
    switch (operator) {
      case '>': return featureValue > value;
      case '>=': return featureValue >= value;
      case '<': return featureValue < value;
      case '<=': return featureValue <= value;
      case '==': return featureValue == value;
      case '!=': return featureValue != value;
      default: return false;
    }
  }
}
