/**
 * Prediction Service - Unified API for making predictions
 */
import { nanoid } from 'nanoid';

export class PredictionService {
  constructor(inferenceEngine, featureProcessor, performanceMonitor) {
    this.inferenceEngine = inferenceEngine;
    this.featureProcessor = featureProcessor;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Single prediction
   */
  async predict(modelId, inputData, version = null) {
    const predictionId = nanoid();
    const timestamp = new Date();
    
    try {
      // Validate input
      await this._validateInput(modelId, inputData);
      
      // Process features
      const features = await this.featureProcessor.processFeatures(
        inputData.features,
        modelId
      );
      
      // Execute inference
      const inferenceResult = await this.inferenceEngine.infer(
        modelId,
        features.features,
        version
      );
      
      // Build result
      const result = {
        predictionId,
        modelId,
        modelVersion: version || 'current',
        prediction: inferenceResult.prediction,
        confidence: inferenceResult.confidence,
        metadata: {
          processingTimeMs: inferenceResult.processingTimeMs,
          timestamp,
          features: features.features,
          ...(inferenceResult.anomaly_score && { anomaly_score: inferenceResult.anomaly_score })
        }
      };
      
      // Log prediction
      await this.performanceMonitor.logPrediction({
        predictionId,
        modelId,
        modelVersion: version || 'current',
        input: inputData,
        output: result,
        timestamp
      });
      
      return result;
    } catch (error) {
      console.error(`[PredictionService] Prediction failed:`, error);
      throw error;
    }
  }

  /**
   * Batch prediction
   */
  async predictBatch(modelId, inputs, version = null) {
    const results = [];
    
    for (const input of inputs) {
      try {
        const result = await this.predict(modelId, input, version);
        results.push(result);
      } catch (error) {
        results.push({
          error: error.message,
          input
        });
      }
    }
    
    return results;
  }

  /**
   * Validate input data against model schema
   */
  async _validateInput(modelId, inputData) {
    const model = await this.inferenceEngine.modelRegistry.getModel(modelId);
    const schema = model.input_schema;
    
    if (!inputData.features) {
      throw new Error('Input data must contain features object');
    }
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in inputData.features)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
    
    // Validate field types
    if (schema.properties) {
      for (const [field, value] of Object.entries(inputData.features)) {
        if (schema.properties[field]) {
          const expectedType = schema.properties[field].type;
          const actualType = typeof value;
          
          if (expectedType === 'number' && actualType !== 'number') {
            throw new Error(`Field ${field} must be a number`);
          }
          if (expectedType === 'string' && actualType !== 'string') {
            throw new Error(`Field ${field} must be a string`);
          }
        }
      }
    }
  }
}
