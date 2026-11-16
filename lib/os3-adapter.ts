import { departments as seedDepartments, ui } from '@/data/map';
import { GATEWAY_BASE_URL } from './gateway';
import { MOTION } from './tokens';
import type {
  Department,
  DepartmentId,
  GatewayApprovalItem,
  GatewayMode,
  Job,
  Os3AgentRunRecord,
  Os3AgentSummary,
  Os3JobRecord,
  Os3KnowledgeGraphResponse,
  Os3RecordsOverview,
  Os3ResearchOverview,
  Os3RuntimeEventRecord,
  Os3SystemOverview,
  Os3VaultTreeResponse,
  Os3WorkflowSummary,
  Status,
} from './types';

export const UI_PREFS_STORAGE_KEY = 'xyp3rn.ui.prefs.v1';

export type UiPreferences = {
  expandedSidebar: boolean;
  activeSectorIndex: number;
};

export type ApiAdapterResult<T> = {
  ok: boolean;
  mode: GatewayMode;
  data: T | null;
  error: string | null;
};

export type AdapterOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readUiPreferences(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): UiPreferences {
  const defaults: UiPreferences = { expandedSidebar: false, activeSectorIndex: 0 };
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(UI_PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
    const rec = parsed as Record<string, unknown>;
    return {
      expandedSidebar: typeof rec.expandedSidebar === 'boolean' ? rec.expandedSidebar : false,
      activeSectorIndex:
        typeof rec.activeSectorIndex === 'number' && Number.isInteger(rec.activeSectorIndex) && rec.activeSectorIndex >= 0
          ? rec.activeSectorIndex
          : 0,
    };
  } catch {
    return defaults;
  }
}

export function writeUiPreferences(
  prefs: UiPreferences,
  storage: Pick<Storage, 'setItem'> | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

async function fetchJson<T>(path: string, options: AdapterOptions = {}): Promise<ApiAdapterResult<T>> {
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;
  if (!fetchFn) {
    return { ok: false, mode: 'local-vault', data: null, error: 'Fetch API unavailable in current environment.' };
  }

  const timeoutMs = options.timeoutMs ?? MOTION.gatewayTimeoutMs * 2;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = controller ? globalThis.setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const response = await fetchFn(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        mode: 'local-vault',
        data: null,
        error: `Gateway returned HTTP ${response.status} for ${path}`,
      };
    }
    const payload = (await response.json()) as T & { ok?: boolean; error?: string };
    if (payload && typeof payload === 'object' && payload.ok === false) {
      return {
        ok: false,
        mode: 'local-vault',
        data: null,
        error: typeof payload.error === 'string' ? payload.error : `Gateway rejected ${path}`,
      };
    }
    return { ok: true, mode: 'live-gateway', data: payload, error: null };
  } catch (err) {
    return {
      ok: false,
      mode: 'local-vault',
      data: null,
      error: err instanceof Error ? err.message : 'OS3 gateway unreachable',
    };
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}

export function fetchSystemOverview(options: AdapterOptions = {}): Promise<ApiAdapterResult<Os3SystemOverview>> {
  return fetchJson<Os3SystemOverview>('/api/overview', options);
}

export function fetchVaultTree(
  params: { sector?: DepartmentId; limit?: number } = {},
  options: AdapterOptions = {},
): Promise<ApiAdapterResult<Os3VaultTreeResponse>> {
  const qs = new URLSearchParams();
  if (params.sector) qs.set('sector', params.sector);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return fetchJson<Os3VaultTreeResponse>(`/api/vault/tree${suffix}`, options);
}

export function fetchKnowledgeGraph(
  params: { sector?: DepartmentId; limit?: number } = {},
  options: AdapterOptions = {},
): Promise<ApiAdapterResult<Os3KnowledgeGraphResponse>> {
  const qs = new URLSearchParams();
  if (params.sector) qs.set('sector', params.sector);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return fetchJson<Os3KnowledgeGraphResponse>(`/api/vault/graph${suffix}`, options);
}

export function fetchAgentRegistry(
  options: AdapterOptions = {},
): Promise<ApiAdapterResult<{ ok: boolean; total: number; byClass: Record<string, number>; byDomain: Record<string, number>; agents: Os3AgentSummary[] }>> {
  return fetchJson('/api/agents', options);
}

export function fetchWorkflowRegistry(
  options: AdapterOptions = {},
): Promise<ApiAdapterResult<{ ok: boolean; total: number; workflows: Os3WorkflowSummary[] }>> {
  return fetchJson('/api/workflows', options);
}

export function fetchRuntimeRuns(
  limit = 25,
  options: AdapterOptions = {},
): Promise<ApiAdapterResult<{ ok: boolean; agentRuns: Os3AgentRunRecord[]; jobs: Os3JobRecord[] }>> {
  return fetchJson(`/api/runs?limit=${limit}`, options);
}

export function fetchRuntimeEvents(
  limit = 50,
  options: AdapterOptions = {},
): Promise<ApiAdapterResult<{ ok: boolean; count: number; events: Os3RuntimeEventRecord[] }>> {
  return fetchJson(`/api/events?limit=${limit}`, options);
}

export function fetchApprovalsByStatus(
  status?: 'pending' | 'approved' | 'rejected',
  options: AdapterOptions = {},
): Promise<ApiAdapterResult<{ ok: boolean; count: number; approvals: GatewayApprovalItem[] }>> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchJson(`/api/approvals${suffix}`, options);
}

export function fetchResearchOverview(options: AdapterOptions = {}): Promise<ApiAdapterResult<Os3ResearchOverview>> {
  return fetchJson<Os3ResearchOverview>('/api/research', options);
}

export function fetchRecordsOverview(options: AdapterOptions = {}): Promise<ApiAdapterResult<Os3RecordsOverview>> {
  return fetchJson<Os3RecordsOverview>('/api/records', options);
}

function mapVaultStatus(raw: string | null | undefined, fallback: Status): Status {
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (lower === 'live' || lower === 'active' || lower === 'canonical' || lower === 'success' || lower === 'approved') {
    return 'live';
  }
  if (lower === 'in-development' || lower === 'in-progress' || lower === 'running' || lower === 'queued' || lower === 'draft') {
    return 'in-development';
  }
  if (lower === 'not-started' || lower === 'open' || lower === 'stub') {
    return 'not-started';
  }
  return fallback;
}

function slugId(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'vault-note'
  );
}

/**
 * Merges live indexed Vault tree entries and recent runtime jobs/agent runs into the
 * visual Department[] constellation model while preserving seed layout IDs and geometry.
 */
export function mergeVaultTreeIntoDepartments(
  baseDepartments: readonly Department[] = seedDepartments,
  tree: Os3VaultTreeResponse | null,
  runs?: { agentRuns?: readonly Os3AgentRunRecord[]; jobs?: readonly Os3JobRecord[] } | null,
): { departments: Department[]; liveStatuses: Record<string, Status> } {
  const treeSectorMap = new Map((tree?.sectors ?? []).map((sec) => [sec.sector, sec] as const));
  const latestJobStatus = new Map<string, Status>();

  for (const job of runs?.jobs ?? []) {
    const key = job.name.toLowerCase();
    if (!latestJobStatus.has(key)) {
      latestJobStatus.set(key, job.status === 'success' ? 'live' : job.status === 'running' || job.status === 'queued' ? 'in-development' : 'not-started');
    }
  }
  for (const run of runs?.agentRuns ?? []) {
    const key = run.agentName.toLowerCase();
    if (!latestJobStatus.has(key)) {
      latestJobStatus.set(key, run.status === 'success' ? 'live' : run.status === 'running' ? 'in-development' : 'not-started');
    }
  }

  const liveStatuses: Record<string, Status> = {};
  const merged = baseDepartments.map((dept) => {
    const liveSector = treeSectorMap.get(dept.id);
    if (!liveSector) {
      return dept;
    }

    const byVaultPath = new Map<string, { status: string | null; sha256: string; title: string; docType: string | null }>();
    for (const folder of liveSector.folders) {
      for (const note of folder.notes) {
        byVaultPath.set(note.vaultPath.toLowerCase(), note);
      }
    }

    const updatedJobs: Job[] = dept.jobs.map((job) => {
      const liveNote = byVaultPath.get(job.file.toLowerCase());
      const runtimeMatch =
        latestJobStatus.get(job.id.toLowerCase()) ??
        latestJobStatus.get(job.id.replace(/-(workflow|agent)$/, '').toLowerCase());
      const resolved = runtimeMatch ?? mapVaultStatus(liveNote?.status, job.status);
      liveStatuses[job.id] = resolved;

      if (!liveNote) return job;
      return {
        ...job,
        status: resolved,
        stub: false,
      };
    });

    const existingPaths = new Set(updatedJobs.map((j) => j.file.toLowerCase()));
    const existingIds = new Set(updatedJobs.map((j) => j.id));
    let addedForSector = 0;

    for (const folder of liveSector.folders) {
      for (const note of folder.notes) {
        if (addedForSector >= 6) break;
        if (existingPaths.has(note.vaultPath.toLowerCase())) continue;
        if (!note.vaultPath.endsWith('.md')) continue;
        const candidateId = `vault-${slugId(note.vaultPath)}`;
        if (existingIds.has(candidateId)) continue;
        existingPaths.add(note.vaultPath.toLowerCase());
        existingIds.add(candidateId);
        addedForSector += 1;
        const noteStatus = mapVaultStatus(note.status, 'live');
        liveStatuses[candidateId] = noteStatus;
        updatedJobs.push({
          id: candidateId,
          title: note.title || note.vaultPath.split('/').at(-1)?.replace(/\.md$/, '') || 'Vault Note',
          cluster: folder.folder || 'Vault',
          file: note.vaultPath,
          icon: ui.sectorIcons[dept.id] ?? 'FileText',
          summary: `Indexed OS3 Vault entity (${note.docType ?? 'note'}) · sha256:${note.sha256.slice(0, 12)}`,
          autonomy: 'human-assisted',
          status: noteStatus,
          startHere: false,
          stub: false,
          breaksInto: note.tags.slice(0, 4),
          buildsOn: [],
          replaces: 'Manual Vault tracking outside OS3 index.',
          human: 'Review linked Vault notes and govern promotion via Approvals.',
          buildNotes: `Loaded live from Vault Engine (${note.vaultPath}).`,
          ladder: {
            'human-led': 'Inspect raw Markdown entity via Vault Engine.',
            'human-assisted': 'Query and cross-link with @context references in Jarvis.',
            'fully-autonomous': 'Indexed continuously by Structural Index and Context Engine.',
          },
          skill: {
            name: note.vaultPath.split('/').at(-1) ?? 'note.md',
            blurb: `Live Vault document in ${dept.id}/${folder.folder}.`,
            installCmd: `xyp3rn> read ${note.vaultPath}`,
            markdown: `# ${note.title}\n\nVault path: \`${note.vaultPath}\`\n\nOpening live note from OS3 Gateway...`,
          },
        });
      }
    }

    return {
      ...dept,
      jobs: updatedJobs,
    };
  });

  return { departments: merged, liveStatuses };
}
