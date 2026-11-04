import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

export async function connectDb(url) {
  await mongoose.connect(url, { serverSelectionTimeoutMS: 10_000 });
  // Build declared indexes (text, geo, unique partial booking index).
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export function dbState() {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
}
