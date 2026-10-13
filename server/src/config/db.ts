import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI?.trim();

  if (uri) {
    try {
      console.log(`[DB] Attempting connection to configured MongoDB: ${uri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`[DB] Connected successfully to configured MongoDB host: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.warn(`[DB] Configured MONGODB_URI failed to connect (${(err as Error).message}). Falling back to embedded MongoMemoryServer...`);
    }
  }

  // Fallback: start MongoMemoryServer
  try {
    console.log('[DB] Launching embedded MongoDB instance (MongoMemoryServer)...');
    mongoMemoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'plant_care_companion',
      },
    });
    const memoryUri = mongoMemoryServer.getUri();
    console.log(`[DB] Embedded MongoDB running at: ${memoryUri}`);
    const conn = await mongoose.connect(memoryUri);
    console.log('[DB] Connected successfully to embedded MongoDB instance.');
    return conn;
  } catch (err) {
    console.error('[DB] Failed to launch embedded MongoDB instance:', err);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}
