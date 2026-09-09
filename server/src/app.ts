import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { errorHandler } from './errorHandler.js';
import { isDatabaseReady } from './database.js';

export const logger = pino();
export const app = express();

app.disable('x-powered-by');
// Keep request headers, query strings, and bodies out of routine access logs.
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        path: req.url?.split('?')[0],
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);
if (env.NODE_ENV === 'development') {
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
}
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.get('/ready', (_req, res) => {
  const ready = isDatabaseReady();
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    database: ready ? 'connected' : 'disconnected',
  });
});
app.use(errorHandler);
