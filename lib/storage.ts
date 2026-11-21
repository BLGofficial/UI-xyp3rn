import type { Job, Status } from './types';

/**
 * @deprecated Retained strictly for unit-test compatibility and offline preview rendering.
 * Authoritative operational statuses MUST come from OS3 runtime APIs (`/api/overview`, `/api/runs`, `/api/vault/tree`).
 */
export const STATUS_STORAGE_KEY = 'xyp3rn.constellation.status.v1';

const STATUSES: readonly Status[] = ['not-started', 'in-development', 'live'];

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/** Reading `window.localStorage` itself can throw (sandboxed frames, blocked storage). */
function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Parses a stored payload, keeping only `jobId -> Status` pairs with a known status.
 * @param raw value read from storage, or null
 */
export function parseStatusOverrides(raw: string | null): Record<string, Status> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, Status] => STATUSES.includes(entry[1] as Status)),
    );
  } catch {
    return {};
  }
}

/**
 * Reads the operator's status overrides. Never throws.
 * @param storage defaults to localStorage when available
 */
export function readStatusOverrides(storage: ReadableStorage | undefined = browserStorage()): Record<string, Status> {
  try {
    return parseStatusOverrides(storage?.getItem(STATUS_STORAGE_KEY) ?? null);
  } catch {
    return {};
  }
}

/**
 * Persists status overrides. Never throws.
 * @param overrides full override map
 * @param storage defaults to localStorage when available
 * @returns false when nothing could be written (quota, private mode); the caller keeps its in-memory state
 */
export function writeStatusOverrides(
  overrides: Record<string, Status>,
  storage: WritableStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STATUS_STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    return false;
  }
}

/**
 * Status to render for a job: the operator's override if there is one, else the vault seed.
 * @param job job to resolve
 * @param overrides map from readStatusOverrides
 */
export function resolveStatus(job: Pick<Job, 'id' | 'status'>, overrides: Record<string, Status>): Status {
  return overrides[job.id] ?? job.status;
}
