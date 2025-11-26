/**
 * Model Registry - Manages ML model storage, versioning, and metadata
 */
import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class ModelRegistry {
  constructor(db, modelsPath = './models') {
    this.db = db; // MongoDB connection
    this.modelsPath = modelsPath;
    this.collection = db.collection('ml_models');
  }

  async initialize() {
    // Create models directory if it doesn't exist
    await fs.mkdir(this.modelsPath, { recursive: true });
    await fs.mkdir(path.join(this.modelsPath, 'built-in'), { recursive: true });
    await fs.mkdir(path.join(this.modelsPath, 'custom'), { recursive: true });
    
    // Create indexes
    await this.collection.createIndex({ model_id: 1 }, { unique: true });
    await this.collection.createIndex({ name: 1 });
    await this.collection.createIndex({ type: 1 });
    await this.collection.createIndex({ status: 1 });
  }

  /**
   * Register a new model
   */
  async registerModel(modelFile, metadata) {
    const modelId = nanoid();
    const version = metadata.version || '1.0.0';
    const modelDir = path.join(this.modelsPath, 'custom', modelId, version);
    
    // Create model directory
    await fs.mkdir(modelDir, { recursive: true });
    
    // Calculate file checksum
    const checksum = crypto.createHash('sha256').update(modelFile).digest('hex');
    
    // Save model file
    const modelPath = path.join(modelDir, `model.${metadata.format}`);
    await fs.writeFile(modelPath, modelFile);
    
    // Create model document
    const modelDoc = {
      model_id: modelId,
      name: metadata.name,
      type: metadata.type,
      format: metadata.format,
      description: metadata.description || '',
      current_version: version,
      status: 'active',
      input_schema: metadata.inputSchema,
      output_schema: metadata.outputSchema,
      model_path: modelPath,
      checksum,
      performance_metrics: metadata.performanceMetrics || {},
      versions: [{
        version,
        model_path: modelPath,
        checksum,
        created_at: new Date(),
        created_by: metadata.createdBy || 'system',
        status: 'active'
      }],
      tags: metadata.tags || [],
      created_at: new Date(),
      updated_at: new Date(),
      created_by: metadata.createdBy || 'system'
    };
    
    await this.collection.insertOne(modelDoc);
    
    console.log(`[ModelRegistry] Registered model ${modelId}: ${metadata.name}`);
    return modelId;
  }

  /**
   * List all registered models
   */
  async listModels(filters = {}) {
    const query = {};
    
    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.tags) query.tags = { $in: filters.tags };
    
    const models = await this.collection
      .find(query)
      .project({
        model_id: 1,
        name: 1,
        version: '$current_version',
        type: 1,
        status: 1,
        created_at: 1,
        updated_at: 1,
        performance_metrics: 1
      })
      .toArray();
    
    return models;
  }

  /**
   * Get model details
   */
  async getModel(modelId) {
    const model = await this.collection.findOne({ model_id: modelId });
    
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    return model;
  }

  /**
   * Update model (creates new version)
   */
  async updateModel(modelId, modelFile, metadata) {
    const existingModel = await this.getModel(modelId);
    
    const newVersion = metadata.version || this._incrementVersion(existingModel.current_version);
    const modelDir = path.join(this.modelsPath, 'custom', modelId, newVersion);
    
    // Create new version directory
    await fs.mkdir(modelDir, { recursive: true });
    
    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(modelFile).digest('hex');
    
    // Save new model file
    const modelPath = path.join(modelDir, `model.${metadata.format || existingModel.format}`);
    await fs.writeFile(modelPath, modelFile);
    
    // Add new version to history
    const versionEntry = {
      version: newVersion,
      model_path: modelPath,
      checksum,
      created_at: new Date(),
      created_by: metadata.createdBy || 'system',
      status: 'active',
      performance_metrics: metadata.performanceMetrics || {}
    };
    
    // Update document
    await this.collection.updateOne(
      { model_id: modelId },
      {
        $set: {
          current_version: newVersion,
          model_path: modelPath,
          checksum,
          updated_at: new Date(),
          ...(metadata.description && { description: metadata.description }),
          ...(metadata.inputSchema && { input_schema: metadata.inputSchema }),
          ...(metadata.outputSchema && { output_schema: metadata.outputSchema })
        },
        $push: { versions: versionEntry }
      }
    );
    
    console.log(`[ModelRegistry] Updated model ${modelId} to version ${newVersion}`);
    return newVersion;
  }

  /**
   * Delete model
   */
  async deleteModel(modelId) {
    const model = await this.getModel(modelId);
    
    // Delete model directory
    const modelDir = path.join(this.modelsPath, 'custom', modelId);
    await fs.rm(modelDir, { recursive: true, force: true });
    
    // Delete from database
    await this.collection.deleteOne({ model_id: modelId });
    
    console.log(`[ModelRegistry] Deleted model ${modelId}`);
  }

  /**
   * Get version history
   */
  async getVersionHistory(modelId) {
    const model = await this.getModel(modelId);
    return model.versions;
  }

  /**
   * Update model status
   */
  async updateStatus(modelId, status) {
    await this.collection.updateOne(
      { model_id: modelId },
      { $set: { status, updated_at: new Date() } }
    );
  }

  /**
   * Update performance metrics
   */
  async updatePerformanceMetrics(modelId, metrics) {
    await this.collection.updateOne(
      { model_id: modelId },
      { 
        $set: { 
          performance_metrics: metrics,
          'performance_metrics.last_evaluated': new Date(),
          updated_at: new Date()
        } 
      }
    );
  }

  _incrementVersion(version) {
    const parts = version.split('.').map(Number);
    parts[2]++; // Increment patch version
    return parts.join('.');
  }
}
