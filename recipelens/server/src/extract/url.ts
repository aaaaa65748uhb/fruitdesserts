/**
 * URL safety + fetching.
 *
 * Every outbound request the user can trigger goes through here: the scheme,
 * the resolved IP (SSRF guard) and every redirect hop are checked, the
 * response is size-capped and the whole thing is time-boxed.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import { ApiError } from '../lib/errors.js';

const MAX_REDIRECTS = 4;
const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT = 'RecipeLensBot/1.0 (+recipe import; respects robots)';

export interface FetchTextOptions {
  timeoutMs?: number;
  maxBytes?: number;
  /** Only enabled for automated tests, which serve fixtures from 127.0.0.1. */
  allowPrivateNetwork?: boolean;
  fetchImpl?: typeof fetch;
  accept?: string;
}

export function parseHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ApiError(400, 'BAD_REQUEST', 'That does not look like a valid URL.', {
      recovery: ['Check the link and try again', 'Paste the recipe text instead'],
    });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError(400, 'SOURCE_UNSUPPORTED', 'Only http:// and https:// links can be imported.', {
      recovery: ['Paste the recipe text instead'],
    });
  }
  if (url.username || url.password) {
    throw new ApiError(400, 'BAD_REQUEST', 'Links containing credentials are not accepted.');
  }
  return url;
}

function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    const addr = address.toLowerCase();
    if (addr === '::1' || addr === '::') return true;
    if (addr.startsWith('fe80') || addr.startsWith('fc') || addr.startsWith('fd')) return true;
    if (addr.startsWith('::ffff:')) return isPrivateAddress(addr.slice('::ffff:'.length));
    return false;
  }
  return false;
}

export async function assertPublicUrl(url: URL, allowPrivateNetwork = false): Promise<void> {
  if (allowPrivateNetwork) return;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const literal = net.isIP(host);
  if (literal) {
    if (isPrivateAddress(host)) throw privateError(url);
    return;
  }
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw privateError(url);

  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new ApiError(400, 'SOURCE_UNREACHABLE', 'That link could not be resolved.', {
      recovery: ['Check the link', 'Paste the recipe text instead'],
    });
  }
  if (records.some((r) => isPrivateAddress(r.address))) throw privateError(url);
}

function privateError(url: URL): ApiError {
  return new ApiError(400, 'SOURCE_UNSUPPORTED', `Links to internal addresses are not allowed (${url.hostname}).`);
}

export interface FetchedDocument {
  url: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
}

/**
 * GET a URL as text. Redirects are followed manually so each hop is
 * re-validated against the SSRF guard.
 */
export async function fetchText(rawUrl: string, options: FetchTextOptions = {}): Promise<FetchedDocument> {
  const timeoutMs = options.timeoutMs ?? 12000;
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const doFetch = options.fetchImpl ?? fetch;

  let current = parseHttpUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(current, options.allowPrivateNetwork);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    let response: Response;
    try {
      response = await doFetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: options.accept ?? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'en,he;q=0.8',
        },
      });
    } catch (cause) {
      clearTimeout(timer);
      const timedOut = controller.signal.aborted;
      throw new ApiError(
        502,
        'SOURCE_UNREACHABLE',
        timedOut ? 'The source took too long to respond.' : 'The source could not be reached.',
        {
          cause,
          retryable: true,
          recovery: ['Try again', 'Upload a screenshot of the recipe', 'Paste the recipe text instead'],
        },
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      current = parseHttpUrl(new URL(location, current).toString());
      continue;
    }

    if (response.status === 404 || response.status === 410) {
      throw new ApiError(404, 'SOURCE_UNREACHABLE', 'That link no longer exists.', {
        recovery: ['Check the link', 'Paste the recipe text instead'],
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(403, 'SOURCE_UNSUPPORTED', 'That source does not allow automated access to its content.', {
        recovery: ['Upload the video', 'Upload a screenshot', 'Paste the recipe text instead'],
      });
    }
    if (response.status === 429) {
      throw new ApiError(429, 'RATE_LIMITED', 'The source is rate limiting requests. Try again in a moment.', {
        retryable: true,
        recovery: ['Try again shortly', 'Paste the recipe text instead'],
      });
    }
    if (!response.ok) {
      throw new ApiError(502, 'SOURCE_UNREACHABLE', `The source responded with an error (HTTP ${response.status}).`, {
        retryable: response.status >= 500,
        recovery: ['Try again', 'Paste the recipe text instead'],
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    const { text, truncated } = await readCapped(response, maxBytes);
    return { url: current.toString(), status: response.status, contentType, body: text, truncated };
  }

  throw new ApiError(502, 'SOURCE_UNREACHABLE', 'The source redirected too many times.', {
    recovery: ['Paste the recipe text instead'],
  });
}

async function readCapped(response: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  const body = response.body;
  if (!body) return { text: await response.text(), truncated: false };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.slice(0, Math.max(0, value.byteLength - (total - maxBytes))));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { text: buffer.toString('utf8'), truncated };
}
