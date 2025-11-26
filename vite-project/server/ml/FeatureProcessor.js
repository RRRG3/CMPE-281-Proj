/**
 * Feature Processor - Transforms raw data into model-ready features
 */

export class FeatureProcessor {
  constructor(db) {
    this.db = db;
    this.collection = db.collection('feature_transforms');
    this.cache = new Map(); // In-memory cache for transform params
  }

  /**
   * Process features for inference
   */
  async processFeatures(rawData, modelId) {
    // Get cached transformation parameters
    const transformParams = await this.getTransformParams(modelId);
    
    if (!transformParams) {
      // No transformations defined, return raw data
      return {
        features: rawData,
        metadata: {
          transformVersion: 'none',
          timestamp: new Date()
        }
      };
    }
    
    const processedFeatures = { ...rawData };
    
    // Apply transformations in order
    for (const transform of transformParams.transformations) {
      try {
        this._applyTransformation(processedFeatures, transform, transformParams);
      } catch (error) {
        console.error(`[FeatureProcessor] Transform failed:`, error);
        throw new Error(`Feature processing failed: ${error.message}`);
      }
    }
    
    return {
      features: processedFeatures,
      metadata: {
        transformVersion: transformParams.transform_version,
        timestamp: new Date()
      }
    };
  }

  /**
   * Fit transformation parameters (for training)
   */
  async fitTransform(rawDataArray, config) {
    const transformParams = {
      model_id: config.modelId,
      transform_version: config.version || '1.0.0',
      transformations: config.transformations,
      feature_stats: {},
      encodings: {},
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Calculate statistics for each feature
    for (const transform of config.transformations) {
      if (transform.type === 'normalize' || transform.type === 'standardize') {
        for (const field of transform.inputFields) {
          const values = rawDataArray.map(data => data[field]).filter(v => v != null);
          
          if (values.length > 0) {
            const stats = this._calculateStats(values);
            transformParams.feature_stats[field] = stats;
          }
        }
      } else if (transform.type === 'encode') {
        for (const field of transform.inputFields) {
          const uniqueValues = [...new Set(rawDataArray.map(data => data[field]))];
          const encoding = {};
          uniqueValues.forEach((val, idx) => {
            encoding[val] = idx;
          });
          transformParams.encodings[field] = encoding;
        }
      }
    }
    
    // Save to database
    await this.collection.updateOne(
      { model_id: config.modelId },
      { $set: transformParams },
      { upsert: true }
    );
    
    // Update cache
    this.cache.set(config.modelId, transformParams);
    
    console.log(`[FeatureProcessor] Fitted transforms for model ${config.modelId}`);
    
    return transformParams;
  }

  /**
   * Get cached transformation parameters
   */
  async getTransformParams(modelId) {
    // Check in-memory cache first
    if (this.cache.has(modelId)) {
      return this.cache.get(modelId);
    }
    
    // Load from database
    const params = await this.collection.findOne({ model_id: modelId });
    
    if (params) {
      this.cache.set(modelId, params);
    }
    
    return params;
  }

  /**
   * Apply a single transformation
   */
  _applyTransformation(features, transform, transformParams) {
    switch (transform.type) {
      case 'normalize':
        this._normalize(features, transform, transformParams.feature_stats);
        break;
      case 'standardize':
        this._standardize(features, transform, transformParams.feature_stats);
        break;
      case 'encode':
        this._encode(features, transform, transformParams.encodings);
        break;
      case 'extract':
        this._extract(features, transform);
        break;
      default:
        throw new Error(`Unknown transformation type: ${transform.type}`);
    }
  }

  /**
   * Normalize features to [0, 1] range
   */
  _normalize(features, transform, stats) {
    for (const field of transform.inputFields) {
      if (features[field] != null && stats[field]) {
        const { min, max } = stats[field];
        const range = max - min;
        if (range > 0) {
          features[field] = (features[field] - min) / range;
        }
      }
    }
  }

  /**
   * Standardize features (z-score normalization)
   */
  _standardize(features, transform, stats) {
    for (const field of transform.inputFields) {
      if (features[field] != null && stats[field]) {
        const { mean, std } = stats[field];
        if (std > 0) {
          features[field] = (features[field] - mean) / std;
        }
      }
    }
  }

  /**
   * Encode categorical features
   */
  _encode(features, transform, encodings) {
    for (const field of transform.inputFields) {
      if (features[field] != null && encodings[field]) {
        const encoded = encodings[field][features[field]];
        if (encoded !== undefined) {
          features[transform.outputField || field] = encoded;
        } else {
          // Unknown category - use default encoding
          features[transform.outputField || field] = -1;
        }
      }
    }
  }

  /**
   * Extract derived features
   */
  _extract(features, transform) {
    // Example: extract hour from timestamp
    if (transform.params.type === 'hour_of_day' && features[transform.inputFields[0]]) {
      const date = new Date(features[transform.inputFields[0]]);
      features[transform.outputField] = date.getHours();
    }
    // Example: calculate ratio
    else if (transform.params.type === 'ratio' && transform.inputFields.length === 2) {
      const [field1, field2] = transform.inputFields;
      if (features[field1] != null && features[field2] != null && features[field2] !== 0) {
        features[transform.outputField] = features[field1] / features[field2];
      }
    }
  }

  /**
   * Calculate statistics for a feature
   */
  _calculateStats(values) {
    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const std = Math.sqrt(variance);
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { mean, std, min, max, count: n };
  }
}
