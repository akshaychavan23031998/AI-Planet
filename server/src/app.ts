import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiDocument } from './openapi/document.js';
import cors from 'cors';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import type { env } from './env.js';
import { apiV1 } from './api/v1/router.js';
import { errorHandler } from './errorHandler.js';
import { connectToDatabase, isDatabaseReady } from './database.js';

export const logger = pino();

export function createApp(
  config: Pick<typeof env, 'NODE_ENV' | 'CLIENT_ORIGIN'>,
) {
  const app = express();

  app.disable('x-powered-by');

  // Keep request headers, query strings and bodies out of routine access logs.
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          path: req.url?.split('?')[0],
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    }),
  );

  /**
   * The browser is allowed to call the API only from the configured frontend
   * origin. This applies in both local development and production.
   *
   * CLIENT_ORIGIN:
   *   local      -> http://localhost:5173
   *   production -> https://<frontend-project>.vercel.app
   *
   * Do not replace this with wildcard CORS.
   */
  app.use(
    cors({
      origin: config.CLIENT_ORIGIN,
    }),
  );

  /**
   * Liveness intentionally does not depend on MongoDB.
   *
   * A running HTTP function can therefore still report itself alive while
   * /ready reports that its database dependency is unavailable.
   */
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /**
   * Local development connects to MongoDB before app.listen() in server.ts.
   *
   * Vercel may load this exported Express application directly instead of
   * running the local HTTP-listener startup path. In production, readiness
   * therefore ensures that the reusable MongoDB connection is initialized.
   */
  app.get('/ready', async (_req, res) => {
    if (config.NODE_ENV === 'production' && !isDatabaseReady()) {
      try {
        await connectToDatabase();
      } catch {
        res.status(503).json({
          status: 'not_ready',
          database: 'disconnected',
        });
        return;
      }
    }

    const ready = isDatabaseReady();

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      database: ready ? 'connected' : 'disconnected',
    });
  });

  /**
   * OpenAPI JSON is intentionally independent of MongoDB.
   */
  app.get('/openapi.json', (_req, res) => {
    res.json(openapiDocument);
  });

  /**
   * swagger-ui-express works normally during local development and tests.
   *
   * On Vercel production deployments, its static JavaScript assets may not be
   * included in the serverless bundle. When that happens the browser receives
   * HTML for requests such as /docs/swagger-ui-bundle.js and fails with:
   *
   *   Unexpected token '<'
   *
   * Production therefore serves a small Swagger UI shell backed by pinned CDN
   * assets while continuing to use this application's authoritative
   * /openapi.json document.
   */
  if (config.NODE_ENV === 'production') {
    const swaggerUiVersion = '5.32.15';

    const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <title>AI Planet Expense Reimbursement API</title>

    <link
      rel="stylesheet"
      href="https://unpkg.com/swagger-ui-dist@${swaggerUiVersion}/swagger-ui.css"
    />
  </head>

  <body>
    <div id="swagger-ui"></div>

    <script
      src="https://unpkg.com/swagger-ui-dist@${swaggerUiVersion}/swagger-ui-bundle.js"
      crossorigin="anonymous"
    ></script>

    <script
      src="https://unpkg.com/swagger-ui-dist@${swaggerUiVersion}/swagger-ui-standalone-preset.js"
      crossorigin="anonymous"
    ></script>

    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: '/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          persistAuthorization: true,
          validatorUrl: null,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: 'StandaloneLayout'
        });
      };
    </script>
  </body>
</html>`;

    app.get(['/docs', '/docs/'], (_req, res) => {
      res.type('html').send(swaggerHtml);
    });
  } else {
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
  }

  /**
   * On production Vercel instances, establish/reuse MongoDB before entering
   * database-backed feature routes.
   *
   * connectToDatabase() reuses active and in-flight Mongoose connections,
   * therefore this does not deliberately create a new connection per request.
   *
   * Local development continues using server.ts startup connection behavior.
   * Tests remain offline and keep their existing mocked persistence boundary.
   */
  app.use('/api/v1', async (_req, _res, next) => {
    if (config.NODE_ENV !== 'production' || isDatabaseReady()) {
      next();
      return;
    }

    try {
      await connectToDatabase();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1', express.json({ limit: '64kb' }), apiV1);

  app.use(errorHandler);

  return app;
}

/**
 * Vercel recognizes src/app.ts as an Express entrypoint and requires the
 * application instance to be available as the module's default export.
 *
 * We intentionally avoid importing the runtime env object here because that
 * module validates MongoDB configuration eagerly. Keeping this default export
 * lightweight preserves the distinction between:
 *
 *   /health -> HTTP application liveness
 *   /ready  -> MongoDB readiness
 *
 * Local development still uses server.ts, where the complete environment is
 * validated before the server begins listening.
 */
const runtimeNodeEnv: 'development' | 'test' | 'production' =
  process.env.NODE_ENV === 'production'
    ? 'production'
    : process.env.NODE_ENV === 'test'
      ? 'test'
      : 'development';

const runtimeClientOrigin =
  process.env.CLIENT_ORIGIN?.trim() || 'http://localhost:5173';

const app = createApp({
  NODE_ENV: runtimeNodeEnv,
  CLIENT_ORIGIN: runtimeClientOrigin,
});

export default app;
