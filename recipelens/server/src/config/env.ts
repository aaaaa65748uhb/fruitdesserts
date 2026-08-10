/**
 * Environment loading and validation.
 *
 * A missing *required* variable fails loudly at boot; a missing *optional*
 * one (the AI credentials) leaves the matching feature explicitly disabled so
 * the API can answer with a clear configuration error instead of pretending.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '../..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

/** Minimal .env reader (no dependency): `KEY=value`, `#` comments, quotes. */
export function loadDotEnv(file = path.join(REPO_ROOT, '.env')): void {
  if (!existsSync(file)) return;
  const content = readFileSync(file, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().optional(),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(60 * 60 * 24 * 90).default(60 * 60 * 24 * 7),
  DATABASE_URL: z.string().default('file:./data/recipelens.db'),
  AI_PROVIDER: z.string().default('openai-compatible'),
  AI_API_KEY: z.string().optional(),
  AI_API_BASE_URL: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(45000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(100 * 1024 * 1024).default(10 * 1024 * 1024),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_JWKS_URL: z.string().optional(),
});

export interface AiConfig {
  provider: string;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  /** False when credentials are absent — routes answer 503, never fake data. */
  configured: boolean;
  /** Human readable reason shown to operators (never contains secrets). */
  disabledReason: string | null;
}

export interface GoogleConfig {
  clientId: string | null;
  jwksUrl: string | undefined;
  configured: boolean;
  disabledReason: string | null;
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  isTest: boolean;
  port: number;
  webOrigins: string[];
  sessionSecret: string;
  sessionTtlSeconds: number;
  databaseFile: string;
  maxUploadBytes: number;
  ai: AiConfig;
  google: GoogleConfig;
}

export class ConfigurationError extends Error {
  override name = 'ConfigurationError';
}

function resolveDatabaseFile(databaseUrl: string): string {
  let raw = databaseUrl.trim();
  if (raw === ':memory:' || raw === 'file::memory:') return ':memory:';
  if (raw.startsWith('file:')) raw = raw.slice('file:'.length);
  if (raw.startsWith('sqlite:')) raw = raw.slice('sqlite:'.length);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new ConfigurationError(
      `DATABASE_URL "${raw.split('://')[0]}://…" is not supported. RecipeLens uses SQLite: use ":memory:" or "file:./data/recipelens.db".`,
    );
  }
  return path.isAbsolute(raw) ? raw : path.resolve(SERVER_ROOT, raw);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigurationError(`Invalid environment configuration — ${details}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';

  let sessionSecret = e.SESSION_SECRET?.trim() ?? '';
  if (!sessionSecret) {
    if (isProduction) {
      throw new ConfigurationError(
        'SESSION_SECRET is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
      );
    }
    sessionSecret = randomBytes(48).toString('base64url');
    if (e.NODE_ENV !== 'test') {
      console.warn('[config] SESSION_SECRET is not set — using a random development secret. Sessions reset on restart.');
    }
  } else if (sessionSecret.length < 32 && isProduction) {
    throw new ConfigurationError('SESSION_SECRET must be at least 32 characters long.');
  }

  const apiKey = e.AI_API_KEY?.trim() || null;
  const baseUrl = (e.AI_API_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = e.AI_MODEL?.trim() || 'gpt-4o-mini';

  const missing: string[] = [];
  if (!apiKey) missing.push('AI_API_KEY');
  if (!e.AI_API_BASE_URL?.trim()) missing.push('AI_API_BASE_URL');
  if (!e.AI_MODEL?.trim()) missing.push('AI_MODEL');
  const configured = apiKey != null;

  const ai: AiConfig = {
    provider: e.AI_PROVIDER,
    apiKey,
    baseUrl,
    model,
    timeoutMs: e.AI_TIMEOUT_MS,
    maxRetries: e.AI_MAX_RETRIES,
    configured,
    disabledReason: configured
      ? null
      : `AI provider is not configured. Missing environment variable(s): ${missing.join(', ')}.`,
  };

  // Capacitor serves the APK's assets from these origins. They are safe to
  // allow because native clients authenticate with a bearer token, never with
  // a cookie, so they cannot be used for a cross-site request forgery.
  const nativeOrigins = ['https://localhost', 'capacitor://localhost'];
  const configuredOrigins = e.WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

  const googleClientId = e.GOOGLE_CLIENT_ID?.trim() || null;
  const google: GoogleConfig = {
    clientId: googleClientId,
    jwksUrl: e.GOOGLE_JWKS_URL?.trim() || undefined,
    configured: googleClientId !== null,
    disabledReason: googleClientId
      ? null
      : 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID to the OAuth client ID of your Android app / web client.',
  };

  return {
    nodeEnv: e.NODE_ENV,
    isProduction,
    isTest: e.NODE_ENV === 'test',
    port: e.PORT,
    webOrigins: [...new Set([...configuredOrigins, ...nativeOrigins])],
    sessionSecret,
    sessionTtlSeconds: e.SESSION_TTL_SECONDS,
    databaseFile: resolveDatabaseFile(e.DATABASE_URL),
    maxUploadBytes: e.MAX_UPLOAD_BYTES,
    ai,
    google,
  };
}
