import { createApp } from './app.js';
import { ConfigurationError, loadConfig, loadDotEnv } from './config/env.js';
import { createContext } from './context.js';

loadDotEnv();

try {
  const config = loadConfig();
  const ctx = createContext({ config });
  const app = createApp(ctx);

  const server = app.listen(config.port, () => {
    console.log(`[recipelens] API listening on http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(`[recipelens] database: ${config.databaseFile}`);
    if (ctx.ai) {
      console.log(`[recipelens] AI provider: ${ctx.ai.providerName} (model ${ctx.ai.model})`);
    } else {
      console.warn(`[recipelens] AI disabled — ${ctx.aiDisabledReason}`);
    }
  });

  const shutdown = (signal: string) => {
    console.log(`[recipelens] ${signal} received, shutting down.`);
    server.close(() => {
      ctx.db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(`\n[recipelens] Configuration error: ${error.message}\n`);
    console.error('Copy recipelens/.env.example to recipelens/.env and fill in the required values.\n');
    process.exit(1);
  }
  throw error;
}
