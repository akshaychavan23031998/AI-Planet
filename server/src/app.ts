import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiDocument } from './openapi/document.js';
import cors from 'cors';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import type { env } from './env.js';
import { apiV1 } from './api/v1/router.js';
import { errorHandler } from './errorHandler.js';
import { isDatabaseReady } from './database.js';

export const logger = pino();
export function createApp(
  config: Pick<typeof env, 'NODE_ENV' | 'CLIENT_ORIGIN'>,
) {
  const app = express();

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
  if (config.NODE_ENV === 'development') {
    app.use(cors({ origin: config.CLIENT_ORIGIN }));
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
  app.get('/openapi.json', (_req, res) => res.json(openapiDocument));
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: 'AI Planet Expense Reimbursement API',
      swaggerOptions: {
        url: '/openapi.json',
        persistAuthorization: true,
        validatorUrl: null,
      },
    }),
  );
  app.use('/api/v1', express.json({ limit: '64kb' }), apiV1);
  app.use(errorHandler);
  return app;
}
