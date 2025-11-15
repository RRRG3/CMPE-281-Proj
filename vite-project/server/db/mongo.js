import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/alert_monitoring';

let client;
let db;
let telemetryCollection;
let mlInferenceCollection;

export async function connectMongo() {
  try {
    client = new MongoClient(MONGO_URL, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    console.log('✅ MongoDB connected successfully');

    db = client.db();
    
    // Get or create collections
    telemetryCollection = db.collection('telemetry');
    mlInferenceCollection = db.collection('ml_inference');

    // Create indexes for performance
    await telemetryCollection.createIndex({ device_id: 1, ts: -1 });
    await telemetryCollection.createIndex({ ts: -1 });
    await mlInferenceCollection.createIndex({ device_id: 1, ts: -1 });
    await mlInferenceCollection.createIndex({ alert_id: 1 });

    console.log('✅ MongoDB collections and indexes created');

    return { db, telemetryCollection, mlInferenceCollection };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export function getTelemetryCollection() {
  if (!telemetryCollection) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return telemetryCollection;
}

export function getMLInferenceCollection() {
  if (!mlInferenceCollection) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return mlInferenceCollection;
}

export function getMongoDb() {
  if (!db) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeMongo();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeMongo();
  process.exit(0);
});
