/**
 * ML Module Manager API Routes
 */
import express from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

export function createMLRoutes(mlManager, authenticate, requireRole) {
  
  // ============ MODEL MANAGEMENT ENDPOINTS ============
  
  // GET /api/v1/ml/models - List all models
  router.get('/models', authenticate, async (req, res) => {
    try {
      const { type, status, tags } = req.query;
      const filters = {};
      
      if (type) filters.type = type;
      if (status) filters.status = status;
      if (tags) filters.tags = tags.split(',');
      
      const models = await mlManager.modelRegistry.listModels(filters);
      
      res.json({
        models,
        count: models.length
      });
    } catch (error) {
      console.error('[ML API] List models error:', error);
      res.status(500).json({ error: 'Failed to list models' });
    }
  });
  
  // GET /api/v1/ml/models/:id - Get model details
  router.get('/models/:id', authenticate, async (req, res) => {
    try {
      const model = await mlManager.modelRegistry.getModel(req.params.id);
      res.json(model);
    } catch (error) {
      console.error('[ML API] Get model error:', error);
      res.status(404).json({ error: 'Model not found' });
    }
  });
  
  // POST /api/v1/ml/models - Register new model
  router.post('/models', authenticate, requireRole('ADMIN'), upload.single('model'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Model file is required' });
      }
      
      const metadata = {
        name: req.body.name,
        type: req.body.type,
        format: req.body.format,
        description: req.body.description,
        inputSchema: JSON.parse(req.body.inputSchema || '{}'),
        outputSchema: JSON.parse(req.body.outputSchema || '{}'),
        tags: req.body.tags ? req.body.tags.split(',') : [],
        createdBy: req.user.email
      };
      
      const modelId = await mlManager.modelRegistry.registerModel(
        req.file.buffer,
        metadata
      );
      
      res.status(201).json({
        model_id: modelId,
        message: 'Model registered successfully'
      });
    } catch (error) {
      console.error('[ML API] Register model error:', error);
      res.status(500).json({ error: 'Failed to register model' });
    }
  });
  
  // PUT /api/v1/ml/models/:id - Update model
  router.put('/models/:id', authenticate, requireRole('ADMIN'), upload.single('model'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Model file is required' });
      }
      
      const metadata = {
        version: req.body.version,
        format: req.body.format,
        description: req.body.description,
        inputSchema: req.body.inputSchema ? JSON.parse(req.body.inputSchema) : undefined,
        outputSchema: req.body.outputSchema ? JSON.parse(req.body.outputSchema) : undefined,
        createdBy: req.user.email
      };
      
      const newVersion = await mlManager.modelRegistry.updateModel(
        req.params.id,
        req.file.buffer,
        metadata
      );
      
      res.json({
        model_id: req.params.id,
        version: newVersion,
        message: 'Model updated successfully'
      });
    } catch (error) {
      console.error('[ML API] Update model error:', error);
      res.status(500).json({ error: 'Failed to update model' });
    }
  });
  
  // DELETE /api/v1/ml/models/:id - Delete model
  router.delete('/models/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
      await mlManager.modelRegistry.deleteModel(req.params.id);
      res.json({ message: 'Model deleted successfully' });
    } catch (error) {
      console.error('[ML API] Delete model error:', error);
      res.status(500).json({ error: 'Failed to delete model' });
    }
  });
  
  // GET /api/v1/ml/models/:id/versions - Get version history
  router.get('/models/:id/versions', authenticate, async (req, res) => {
    try {
      const versions = await mlManager.modelRegistry.getVersionHistory(req.params.id);
      res.json({ versions });
    } catch (error) {
      console.error('[ML API] Get versions error:', error);
      res.status(404).json({ error: 'Model not found' });
    }
  });
  
  // ============ PREDICTION ENDPOINTS ============
  
  // POST /api/v1/ml/predict - Make prediction
  router.post('/predict', authenticate, async (req, res) => {
    try {
      const { model_id, input, version } = req.body;
      
      if (!model_id || !input) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: ['model_id and input are required']
        });
      }
      
      const result = await mlManager.predictionService.predict(
        model_id,
        input,
        version
      );
      
      res.json(result);
    } catch (error) {
      console.error('[ML API] Prediction error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: 'Model not found' });
      }
      if (error.message.includes('validation') || error.message.includes('required')) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Prediction failed' });
    }
  });
  
  // POST /api/v1/ml/predict/batch - Batch prediction
  router.post('/predict/batch', authenticate, async (req, res) => {
    try {
      const { model_id, inputs, version } = req.body;
      
      if (!model_id || !inputs || !Array.isArray(inputs)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: ['model_id and inputs array are required']
        });
      }
      
      const results = await mlManager.predictionService.predictBatch(
        model_id,
        inputs,
        version
      );
      
      res.json({
        results,
        count: results.length
      });
    } catch (error) {
      console.error('[ML API] Batch prediction error:', error);
      res.status(500).json({ error: 'Batch prediction failed' });
    }
  });
  
  // ============ PERFORMANCE MONITORING ENDPOINTS ============
  
  // GET /api/v1/ml/models/:id/metrics - Get performance metrics
  router.get('/models/:id/metrics', authenticate, async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      
      const timeRange = {
        start: start_date ? new Date(start_date) : undefined,
        end: end_date ? new Date(end_date) : undefined
      };
      
      const metrics = await mlManager.performanceMonitor.getMetrics(
        req.params.id,
        timeRange
      );
      
      res.json(metrics);
    } catch (error) {
      console.error('[ML API] Get metrics error:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });
  
  // GET /api/v1/ml/models/:id/drift - Detect model drift
  router.get('/models/:id/drift', authenticate, async (req, res) => {
    try {
      const windowDays = parseInt(req.query.window_days) || 7;
      
      const driftReport = await mlManager.performanceMonitor.detectDrift(
        req.params.id,
        windowDays
      );
      
      res.json(driftReport);
    } catch (error) {
      console.error('[ML API] Drift detection error:', error);
      res.status(500).json({ error: 'Failed to detect drift' });
    }
  });
  
  // GET /api/v1/ml/models/:id/trends - Get performance trends
  router.get('/models/:id/trends', authenticate, async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      
      const trends = await mlManager.performanceMonitor.getPerformanceTrends(
        req.params.id,
        days
      );
      
      res.json({ trends });
    } catch (error) {
      console.error('[ML API] Get trends error:', error);
      res.status(500).json({ error: 'Failed to get trends' });
    }
  });
  
  // POST /api/v1/ml/predictions/:id/ground-truth - Update ground truth
  router.post('/predictions/:id/ground-truth', authenticate, async (req, res) => {
    try {
      const { actual_label } = req.body;
      
      if (actual_label === undefined) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: ['actual_label is required']
        });
      }
      
      const result = await mlManager.performanceMonitor.updateGroundTruth(
        req.params.id,
        actual_label
      );
      
      res.json(result);
    } catch (error) {
      console.error('[ML API] Update ground truth error:', error);
      res.status(404).json({ error: 'Prediction not found' });
    }
  });
  
  // ============ SYSTEM STATUS ENDPOINTS ============
  
  // GET /api/v1/ml/status - Get ML system status
  router.get('/status', authenticate, async (req, res) => {
    try {
      const loadedModels = mlManager.inferenceEngine.getLoadedModels();
      const modelCount = await mlManager.modelRegistry.collection.countDocuments();
      
      res.json({
        status: 'operational',
        initialized: mlManager.initialized,
        loaded_models: loadedModels.length,
        total_models: modelCount,
        loaded_models_info: loadedModels
      });
    } catch (error) {
      console.error('[ML API] Status error:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });
  
  return router;
}
