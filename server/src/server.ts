import type { Server } from 'node:http';
import { createApp, logger } from './app.js';
import { env } from './env.js';
import { connectToDatabase, disconnectFromDatabase } from './database.js';

const app = createApp(env);

let server: Server | undefined;
let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutdown initiated');
  // Bound shutdown if an HTTP request or database close stalls.
  const timeout = setTimeout(() => {
    logger.error('Shutdown timed out');
    process.exit(1);
  }, 10000);
  timeout.unref();

  try {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } catch {
    logger.error('HTTP shutdown failed');
    process.exitCode = 1;
  } finally {
    try {
      await disconnectFromDatabase();
      logger.info('MongoDB disconnected');
    } catch {
      logger.error('MongoDB disconnect failed');
      process.exitCode = 1;
    }
    clearTimeout(timeout);
  }
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

async function start(): Promise<void> {
  try {
    await connectToDatabase();
    if (shuttingDown) return;
    logger.info('MongoDB connection established');
    server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, 'Server listening');
    });
    server.on('error', () => {
      logger.fatal('HTTP listener failed; check port availability');
      process.exitCode = 1;
      void shutdown();
    });
  } catch {
    logger.fatal(
      'MongoDB startup failed; check configuration, credentials, and network access',
    );
    process.exitCode = 1;
    await shutdown();
  }
}

void start();
