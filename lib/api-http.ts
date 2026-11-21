import { GATEWAY_BASE_URL } from './gateway';
import { MOTION } from './tokens';

export type Os3HttpStatusKind = 'ok' | 'permission-denied' | 'offline' | 'error';

export type Os3HttpOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  bearerToken?: string;
};

export type Os3HttpResult<T> = {
  ok: boolean;
  statusKind: Os3HttpStatusKind;
  statusCode?: number;
  data: T | null;
  error: string | null;
};

/**
 * Shared typed HTTP client for all OS3 Gateway API calls across Constellation
 * (`/api/overview`, `/api/vault/*`, `/api/agents*`, `/api/workflows*`,
 * `/api/governance`, `/api/diagnostics`, `/api/daw/*`).
 */
export async function os3FetchJson<T>(
  path: string,
  init: RequestInit = {},
  options: Os3HttpOptions = {},
): Promise<Os3HttpResult<T>> {
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;
  if (!fetchFn) {
    return {
      ok: false,
      statusKind: 'offline',
      data: null,
      error: 'Fetch API unavailable in current runtime environment.',
    };
  }

  const timeoutMs = options.timeoutMs ?? Math.max(8000, MOTION.gatewayTimeoutMs * 4);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = controller ? globalThis.setTimeout(() => controller.abort(), timeoutMs) : undefined;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.bearerToken ? { Authorization: `Bearer ${options.bearerToken}` } : {}),
  };

  try {
    const response = await fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      signal: controller?.signal,
    });
    const payload = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string; code?: string }) | null;

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        statusKind: 'permission-denied',
        statusCode: response.status,
        data: payload,
        error:
          payload && typeof payload.error === 'string'
            ? payload.error
            : `Permission denied (HTTP ${response.status}) for ${path}`,
      };
    }

    if (!response.ok || (payload && typeof payload === 'object' && payload.ok === false)) {
      return {
        ok: false,
        statusKind: 'error',
        statusCode: response.status,
        data: payload,
        error:
          payload && typeof payload.error === 'string'
            ? payload.error
            : `Gateway returned HTTP ${response.status} for ${path}`,
      };
    }

    return {
      ok: true,
      statusKind: 'ok',
      statusCode: response.status,
      data: payload as T,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      statusKind: 'offline',
      data: null,
      error: (err as Error).message || `OS3 gateway unreachable (${baseUrl}${path})`,
    };
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}
