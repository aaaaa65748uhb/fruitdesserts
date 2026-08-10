import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { SERVER_ROOT } from './config/env.js';
import type { AppContext } from './context.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { cors, csrfGuard, securityHeaders } from './middleware/security.js';
import { optionalAuth } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { recipeRoutes } from './routes/recipes.js';
import { shoppingRoutes } from './routes/shopping.js';
import { collectionRoutes } from './routes/collections.js';
import { cookingRoutes } from './routes/cooking.js';
import { importRoutes } from './routes/import.js';

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.locals.ctx = ctx;
  app.disable('x-powered-by');
  app.set('trust proxy', ctx.config.isProduction ? 1 : false);

  // The strict "nothing may load" policy applies to the JSON API only; the
  // static client gets its own policy below.
  app.use('/api', securityHeaders);
  app.use(cors);
  app.use(cookieParser());
  // The body cap also bounds base64 screenshot uploads.
  app.use(express.json({ limit: ctx.config.maxUploadBytes }));
  app.use(csrfGuard);
  app.use(optionalAuth);

  app.get('/api/health', (_req, res) => {
    let database: 'ok' | 'error' = 'ok';
    try {
      ctx.db.prepare('SELECT 1').get();
    } catch {
      database = 'error';
    }
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      ai: { configured: Boolean(ctx.ai), provider: ctx.ai?.providerName ?? null, model: ctx.ai?.model ?? null },
      version: '1.0.0',
    });
  });

  app.use('/api/auth', authRoutes());
  app.use('/api/recipes', recipeRoutes());
  app.use('/api/shopping-list', shoppingRoutes());
  app.use('/api/collections', collectionRoutes());
  app.use('/api/cooking', cookingRoutes());
  app.use('/api/import', importRoutes());

  serveWebClient(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Serve the built client when it exists, so a production deployment is a
 * single process. In development Vite serves the client and proxies /api here.
 */
function serveWebClient(app: Express): void {
  const dist = path.resolve(SERVER_ROOT, '../web/dist');
  const indexFile = path.join(dist, 'index.html');
  if (!existsSync(indexFile)) return;

  const clientHeaders = (res: express.Response) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
  };

  app.use(
    express.static(dist, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        clientHeaders(res);
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );

  // Client-side routing: every non-API GET renders the app shell.
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') {
      next();
      return;
    }
    clientHeaders(res);
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}
