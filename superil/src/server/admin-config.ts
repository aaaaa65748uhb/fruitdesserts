import "server-only";

/**
 * Whether the admin area is enabled. Only reads the environment (no crypto, no request APIs), so it can be used
 * by start-up configuration checks. The token value itself is never returned to callers outside the server
 * auth code and never logged.
 */
export const MIN_ADMIN_TOKEN_LENGTH = 24;

export function adminToken(): string | undefined {
  const t = process.env.ADMIN_TOKEN;
  return t && t.length >= MIN_ADMIN_TOKEN_LENGTH ? t : undefined;
}

export function adminEnabled(): boolean {
  return !!adminToken();
}
