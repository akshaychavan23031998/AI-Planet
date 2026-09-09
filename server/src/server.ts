import { app, logger } from './app.js';
import { env } from './env.js';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server listening');
});
server.on('error', (error) => {
  logger.fatal({ err: error }, 'Server failed to start');
  process.exitCode = 1;
});
