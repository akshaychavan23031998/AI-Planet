import mongoose from 'mongoose';

let connectionPromise: Promise<typeof mongoose> | undefined;

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export function connectToDatabase(): Promise<typeof mongoose> {
  if (connectionPromise) return connectionPromise;
  if (isDatabaseReady()) return Promise.resolve(mongoose);

  connectionPromise = import('./env.js')
    .then(({ env }) =>
      mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB_NAME,
        // Bound initial startup failure instead of waiting indefinitely.
        serverSelectionTimeoutMS: 10000,
      }),
    )
    .catch(() => {
      // Driver errors can contain connection details; expose only a safe message.
      throw new Error(
        'MongoDB connection failed. Check configuration, credentials, and network access.',
      );
    })
    .finally(() => {
      connectionPromise = undefined;
    });
  return connectionPromise;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (connectionPromise) {
    await connectionPromise.catch(() => undefined);
  }
  await mongoose.disconnect();
}
