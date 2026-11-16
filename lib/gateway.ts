import { departments as defaultDepartments, x3liusTracks as defaultTracks } from '@/data/map';
import {
  buildTrackSpectrum,
  isSafeVaultPath,
  parseJarvisCommand,
  resolveContextJobs,
  resolveSafeCopyPath,
} from './jarvis';
import { searchJobs } from './search';
import { LAYOUT } from './tokens';
import type {
  Department,
  GatewayAction,
  GatewayApprovalItem,
  GatewayHealthSnapshot,
  GatewayMode,
  GatewayRequest,
  GatewayResponse,
  JarvisChangeProposal,
  JarvisCitation,
  JarvisExchange,
  JarvisInspectionPayload,
  VaultNotePayload,
  VaultSearchHit,
  X3liusTrack,
} from './types';

export const GATEWAY_BASE_URL = `http://127.0.0.1:${LAYOUT.gatewayPort}`;
export const SESSION_STORAGE_KEY = 'xyp3rn.jarvis.session.v1';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

const LOCAL_HOST_RE = /^(127\.0\.0\.1|localhost)(:\d+)?$/i;
const LOCAL_ORIGIN_RE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Enforces 06_GOVERNANCE/00_Policies/Localhost Binding Policy.md and
 * 06_GOVERNANCE/02_Access_Control/Same-Origin & Host Allowlist.md.
 * @param host HTTP Host header value
 * @param origin optional Origin header value
 */
export function isAllowedGatewayOrigin(host: string, origin?: string | null): boolean {
  if (!LOCAL_HOST_RE.test(host.trim())) return false;
  if (origin === undefined || origin === null || origin === '') return true;
  return LOCAL_ORIGIN_RE.test(origin.trim());
}

function matchTrack(query: string, tracks: readonly X3liusTrack[]): X3liusTrack | undefined {
  const needle = query.trim().toLowerCase();
  if (!needle) return tracks[0];
  return (
    tracks.find((track) => track.id === needle || track.title.toLowerCase() === needle) ??
    tracks.find((track) => track.title.toLowerCase().includes(needle) || needle.includes(track.title.toLowerCase()))
  );
}

let exchangeCounter = 0;

function makeExchangeId(): string {
  exchangeCounter += 1;
  return `jarvis-${Date.now()}-${exchangeCounter}`;
}

/**
 * Deterministic local execution engine backed by the MAIN-XYP3RN-OS-Vault seed in data/map.ts.
 * Enforces path safety, no-overwrite copy numbering, @context injection, and engine routing.
 * @param request operator prompt and active context
 * @param departments vault sectors (defaults to data/map.ts)
 * @param tracks X3LIUS tracks (defaults to data/map.ts)
 */
export function executeVaultCommand(
  request: GatewayRequest,
  departments: readonly Department[] = defaultDepartments,
  tracks: readonly X3liusTrack[] = defaultTracks,
): GatewayResponse {
  const parsed = parseJarvisCommand(request.prompt, request.engine);
  const contextJobs = resolveContextJobs(parsed.contextRefs, departments);
  const allJobs = departments.flatMap((dept) => dept.jobs);
  const existingPaths = new Set(allJobs.map((job) => job.file));

  let ok = true;
  let reply = '';
  let action: GatewayAction | undefined;
  let referencedJobId = contextJobs[0]?.id;
  let trackId: string | undefined;

  switch (parsed.kind) {
    case 'status': {
      const liveCount = allJobs.filter((job) => job.status === 'live').length;
      const inDevCount = allJobs.filter((job) => job.status === 'in-development').length;
      reply = [
        `XYP3RN.CORE status: ${departments.length} sectors online · ${allJobs.length} vault jobs indexed (${liveCount} live, ${inDevCount} in-development).`,
        `Routing gateway bound to 127.0.0.1:${LAYOUT.gatewayPort} · Active engine: ${parsed.engine.toUpperCase()} · ${LAYOUT.mcpConnectorTotal}/${LAYOUT.mcpConnectorTotal} MCP connectors healthy.`,
      ].join(' ');
      break;
    }

    case 'read': {
      const path = parsed.targetPath ?? '';
      if (!isSafeVaultPath(path)) {
        ok = false;
        reply = `403 FORBIDDEN · Path Safety & Extension Standard rejected "${path}". Only vault-relative paths inside 01_CORE..06_GOVERNANCE with allowed extensions are permitted.`;
        break;
      }
      const hit = allJobs.find((job) => job.file.toLowerCase() === path.toLowerCase());
      if (!hit) {
        ok = false;
        reply = `404 NOT FOUND · No vault note at "${path}".`;
        break;
      }
      referencedJobId = hit.id;
      action = { type: 'select-job', jobId: hit.id };
      reply = `${hit.title} (${hit.file}) — ${hit.summary}`;
      break;
    }

    case 'write': {
      const path = parsed.targetPath ?? '';
      if (!isSafeVaultPath(path)) {
        ok = false;
        reply = `403 FORBIDDEN · Path Safety & Extension Standard rejected "${path}".`;
        break;
      }
      const safeTarget = resolveSafeCopyPath(path, existingPaths);
      const guardNote =
        safeTarget === path
          ? `Created "${safeTarget}".`
          : `No-Overwrite Guard preserved "${path}" and wrote numbered copy "${safeTarget}".`;
      reply = `vault.write complete · ${guardNote}`;
      break;
    }

    case 'append': {
      const path = parsed.targetPath ?? '';
      if (!isSafeVaultPath(path)) {
        ok = false;
        reply = `403 FORBIDDEN · Path Safety & Extension Standard rejected "${path}".`;
        break;
      }
      const hit = allJobs.find((job) => job.file.toLowerCase() === path.toLowerCase());
      if (hit) {
        referencedJobId = hit.id;
        action = { type: 'select-job', jobId: hit.id };
      }
      reply = `vault.append complete · Appended entry to "${path}".`;
      break;
    }

    case 'search': {
      const hits = searchJobs(departments, parsed.args, 5);
      if (hits.length === 0) {
        reply = `vault.search (BM25) found 0 matches for "${parsed.args}".`;
      } else {
        const top = hits[0]!.job;
        referencedJobId = top.id;
        action = { type: 'select-job', jobId: top.id };
        reply = `vault.search (BM25) top hits for "${parsed.args}": ${hits.map((h) => `${h.job.title} (${h.job.file})`).join(' · ')}.`;
      }
      break;
    }

    case 'flow': {
      const lower = parsed.args.toLowerCase();
      if (lower.startsWith('daily-digest')) {
        referencedJobId = 'daily-digest-workflow';
        action = { type: 'select-job', jobId: 'daily-digest-workflow' };
        reply = `Workflow daily-digest executed (vault.search -> scribe-agent -> vault.append) for ${parsed.args.slice('daily-digest'.length).trim() || 'today'}. Appended to 05_XYP3RN_RECORDS/00_Daily_Notes/2026-10-15.md.`;
      } else if (lower.startsWith('research-brief')) {
        referencedJobId = 'research-brief-workflow';
        action = { type: 'select-job', jobId: 'research-brief-workflow' };
        reply = `Workflow research-brief executed (vault.search -> researcher-agent -> vault.write). Filed brief in 03_RESEARCH_INTELLIGENCE/00_Briefs/.`;
      } else {
        reply = `Dispatched workflow: ${parsed.args}.`;
      }
      break;
    }

    case 'task-new':
    case 'task-run': {
      referencedJobId = 'map-vault-task';
      action = { type: 'select-job', jobId: 'map-vault-task' };
      reply =
        parsed.kind === 'task-run'
          ? `Task Orchestrator running "${parsed.args || 'map-the-vault'}" with Researcher Agent.`
          : `Task queued in 01_CORE/06_Tasks/ from Task.md template: ${parsed.args}.`;
      break;
    }

    case 'registry': {
      referencedJobId = 'task-board-dashboard';
      action = { type: 'select-job', jobId: 'task-board-dashboard' };
      reply = 'Regenerated Task Board.md and Agent Registry.md in 01_CORE/05_Dashboards/.';
      break;
    }

    case 'promote': {
      referencedJobId = 'knowledge-promotion-framework';
      action = { type: 'select-job', jobId: 'knowledge-promotion-framework' };
      reply = `Knowledge Promotion Framework (Evidence -> Quote Verification -> Contradiction Check -> Atomic Notes) processed "${parsed.args}" and logged to 03_RESEARCH_INTELLIGENCE/01_Analyses/Evidence Ledger.md.`;
      break;
    }

    case 'connections': {
      referencedJobId = 'mcp-connector-health-standard';
      action = { type: 'select-job', jobId: 'mcp-connector-health-standard' };
      reply = `MCP Connector Health check complete: ${LAYOUT.mcpConnectorTotal}/${LAYOUT.mcpConnectorTotal} connectors healthy across galaxy.config.json.`;
      break;
    }

    case 'specialists': {
      const count = departments.find((d) => d.id === '03_RESEARCH_INTELLIGENCE')?.jobs.filter((j) => j.cluster === '06_Specialists').length ?? 20;
      referencedJobId = 'spec-systems-thinker';
      action = { type: 'focus-sector', sectorId: '03_RESEARCH_INTELLIGENCE' };
      reply = `${count} Research Intelligence specialists online (Competitive Intelligence, Data Analyst, Devil's Advocate, Economist, Methodologist, Systems Thinker, ...).`;
      break;
    }

    case 'research': {
      referencedJobId = 'on-device-music-brief';
      action = { type: 'select-job', jobId: 'on-device-music-brief' };
      reply = `Research Orchestrator synthesized specialist lenses on "${parsed.args}" -> see 03_RESEARCH_INTELLIGENCE/00_Briefs/2026-10-15 on-device-music-model.md.`;
      break;
    }

    case 'record':
    case 'records': {
      referencedJobId = 'night-signals-ep-release';
      action = { type: 'focus-sector', sectorId: '05_XYP3RN_RECORDS' };
      reply = parsed.args
        ? `Filed record in 05_XYP3RN_RECORDS/: ${parsed.args}.`
        : '05_XYP3RN_RECORDS indexed: Daily Notes, Session Logs, ADRs, Projects, Meetings, Releases, and X3LIUS Music System.';
      break;
    }

    case 'song-new':
    case 'compose': {
      const track = matchTrack(parsed.args, tracks) ?? tracks[0]!;
      trackId = track.id;
      referencedJobId = track.promptJobId;
      action = { type: 'compose-track', trackId: track.id };
      reply = `X3LIUS Songwriter (Claude Opus · ADR-0001) prepared Suno prompt for "${track.title}" (${track.bpm} BPM): ${track.stylePrompt}`;
      break;
    }

    case 'play': {
      const track = matchTrack(parsed.args, tracks) ?? tracks[0]!;
      trackId = track.id;
      referencedJobId = track.songJobId;
      action = { type: 'play-track', trackId: track.id };
      reply = `X3LIUS Player streaming "${track.title}" (${track.format.toUpperCase()} · ${track.bpm} BPM · ${track.release}) with /api/music/pulse spectrum relay.`;
      break;
    }

    case 'gemini': {
      referencedJobId = contextJobs[0]?.id ?? 'analyst-gemini';
      action = { type: 'select-job', jobId: referencedJobId };
      reply = `Analyst (Gemini · gemini-3.8-flash) second opinion on "${parsed.args}": Cross-checked against 06_GOVERNANCE policies (localhost binding 127.0.0.1, path safety, no-overwrite guard).`;
      break;
    }

    case 'run':
    case 'chat': {
      const lower = parsed.args.toLowerCase();
      if (lower.startsWith('play ')) {
        const track = matchTrack(parsed.args.slice(5), tracks) ?? tracks[0]!;
        trackId = track.id;
        referencedJobId = track.songJobId;
        action = { type: 'play-track', trackId: track.id };
        reply = `X3LIUS Player streaming "${track.title}" (${track.bpm} BPM).`;
        break;
      }
      if (contextJobs.length > 0) {
        const first = contextJobs[0]!;
        referencedJobId = first.id;
        action = { type: 'select-job', jobId: first.id };
        const summaries = contextJobs.map((job) => `${job.title} [${job.file}]: ${job.summary}`).join(' | ');
        reply = `Jarvis (${parsed.engine}) injected ${contextJobs.length} @context note(s) — ${summaries}`;
        break;
      }
      const hits = searchJobs(departments, parsed.args, 3);
      if (hits.length > 0) {
        const top = hits[0]!.job;
        referencedJobId = top.id;
        action = { type: 'select-job', jobId: top.id };
        reply = `Jarvis (${parsed.engine}) routed to ${top.title} (${top.file}): ${top.summary}`;
      } else {
        referencedJobId = 'jarvis-agent';
        reply = `Jarvis Operator (${parsed.engine}) standing by across 6 sectors and ${allJobs.length} vault jobs. Try "xyp3rn> status", "@01_CORE/00_Identity/Mission.md", or "play Neon Static".`;
      }
      break;
    }
  }

  const exchange: JarvisExchange = {
    id: makeExchangeId(),
    timestamp: new Date().toISOString(),
    prompt: request.prompt.trim(),
    reply,
    commandKind: parsed.kind,
    engine: parsed.engine,
    mode: 'local-vault',
    contextJobs: contextJobs.map((job) => job.id),
    referencedJobId,
    trackId,
  };

  return {
    ok,
    exchange,
    connectorCount: LAYOUT.mcpConnectorTotal,
    connectorHealthy: LAYOUT.mcpConnectorTotal,
    status: 'healthy',
    action,
  };
}

/**
 * Dispatches a prompt to the XYP3RN Command Center gateway at 127.0.0.1:8077/api/jarvis.
 * Falls back deterministically to the local vault execution engine when 127.0.0.1:8077 is offline.
 * Never throws.
 * @param request gateway request payload
 * @param options injectable fetch, baseUrl and seed data for testing
 */
export async function dispatchJarvis(
  request: GatewayRequest,
  options: {
    fetchImpl?: typeof fetch;
    baseUrl?: string;
    departments?: readonly Department[];
    tracks?: readonly X3liusTrack[];
  } = {},
): Promise<GatewayResponse> {
  const departments = options.departments ?? defaultDepartments;
  const tracks = options.tracks ?? defaultTracks;
  const local = executeVaultCommand(request, departments, tracks);
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;

  if (!fetchFn) return local;

  try {
    const response = await fetchFn(`${baseUrl}/api/jarvis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) return local;
    const payload = (await response.json()) as Partial<{
      ok: boolean;
      reply: string;
      engine: JarvisExchange['engine'];
      connectorCount: number;
      connectorHealthy: number;
      action: GatewayAction;
      citations: JarvisCitation[];
      proposal: JarvisChangeProposal;
      requiresReadAcceptance: boolean;
    }>;
    if (typeof payload.reply !== 'string' || !payload.reply.trim()) {
      return local;
    }
    const mode: GatewayMode = 'live-gateway';
    return {
      ok: payload.ok ?? true,
      exchange: {
        ...local.exchange,
        reply: payload.reply,
        engine: payload.engine ?? local.exchange.engine,
        mode,
        citations: Array.isArray(payload.citations) ? payload.citations : undefined,
        proposal: payload.proposal,
        requiresReadAcceptance: payload.requiresReadAcceptance,
      },
      connectorCount: payload.connectorCount ?? LAYOUT.mcpConnectorTotal,
      connectorHealthy: payload.connectorHealthy ?? LAYOUT.mcpConnectorTotal,
      status:
        (payload.connectorHealthy ?? LAYOUT.mcpConnectorTotal) < (payload.connectorCount ?? LAYOUT.mcpConnectorTotal)
          ? 'amber'
          : 'healthy',
      action: payload.action ?? local.action,
    };
  } catch {
    return local;
  }
}

/**
 * Queries `/api/music/pulse` on 127.0.0.1:8077 for 24-band spectrum levels, falling back to
 * deterministic beat-synced spectrum generation when offline. Never throws.
 * @param trackId canonical track id
 * @param bpm track BPM
 * @param progress playback position in seconds
 * @param playing whether playback is active
 * @param options injectable fetch and baseUrl
 */
export async function fetchTrackPulse(
  trackId: string,
  bpm: number,
  progress: number,
  playing: boolean,
  options: { fetchImpl?: typeof fetch; baseUrl?: string } = {},
): Promise<number[]> {
  const fallback = buildTrackSpectrum(trackId, bpm, progress, playing);
  if (!playing) return fallback;
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;
  if (!fetchFn) return fallback;

  try {
    const response = await fetchFn(
      `${baseUrl}/api/music/pulse?track=${encodeURIComponent(trackId)}&t=${progress.toFixed(2)}`,
    );
    if (!response.ok) return fallback;
    const data = (await response.json()) as Partial<{ spectrum: number[] }>;
    if (Array.isArray(data.spectrum) && data.spectrum.length === LAYOUT.playerSpectrumBars) {
      return data.spectrum.map((n) => Math.min(1, Math.max(0, Number(n) || 0)));
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function isExchange(item: unknown): item is JarvisExchange {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.prompt === 'string' &&
    typeof candidate.reply === 'string' &&
    typeof candidate.engine === 'string' &&
    Array.isArray(candidate.contextJobs)
  );
}

/**
 * Parses stored session log JSON into validated JarvisExchange entries.
 * @param raw raw string from storage
 */
export function parseSessionLogs(raw: string | null): JarvisExchange[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isExchange).slice(-LAYOUT.sessionLogMax);
  } catch {
    return [];
  }
}

/**
 * Reads persisted Jarvis session logs (05_XYP3RN_RECORDS/01_Session_Logs/). Never throws.
 * @param storage defaults to localStorage
 */
export function readSessionLogs(storage: ReadableStorage | undefined = browserStorage()): JarvisExchange[] {
  try {
    return parseSessionLogs(storage?.getItem(SESSION_STORAGE_KEY) ?? null);
  } catch {
    return [];
  }
}

/**
 * Writes Jarvis session logs to storage, capped at LAYOUT.sessionLogMax. Never throws.
 * @param logs exchanges to persist
 * @param storage defaults to localStorage
 */
export function writeSessionLogs(
  logs: readonly JarvisExchange[],
  storage: WritableStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(logs.slice(-LAYOUT.sessionLogMax)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Appends a single exchange to the persisted session log and returns the updated list.
 * @param exchange new exchange
 * @param storage optional storage override
 */
export function appendSessionLog(
  exchange: JarvisExchange,
  storage: (ReadableStorage & WritableStorage) | undefined = browserStorage(),
): JarvisExchange[] {
  const next = [...readSessionLogs(storage), exchange].slice(-LAYOUT.sessionLogMax);
  writeSessionLogs(next, storage);
  return next;
}

/**
 * Clears persisted session logs. Never throws.
 * @param storage defaults to localStorage
 */
export function clearSessionLogs(storage: WritableStorage | undefined = browserStorage()): void {
  if (!storage) return;
  try {
    if (storage.removeItem) storage.removeItem(SESSION_STORAGE_KEY);
    else storage.setItem(SESSION_STORAGE_KEY, '[]');
  } catch {
    // Ignore storage restriction errors.
  }
}

/**
 * Fetches live OS 3.0 Gateway health and Vault index metrics from `127.0.0.1:8077/api/health`,
 * falling back deterministically to the local seed summary when offline. Never throws.
 * @param options injectable fetch, baseUrl and seed departments
 */
export async function fetchGatewayHealth(
  options: {
    fetchImpl?: typeof fetch;
    baseUrl?: string;
    departments?: readonly Department[];
  } = {},
): Promise<GatewayHealthSnapshot> {
  const departments = options.departments ?? defaultDepartments;
  const bySector: Record<string, number> = {};
  let totalSeed = 0;
  for (const dept of departments) {
    bySector[dept.id] = dept.jobs.length;
    totalSeed += dept.jobs.length;
  }

  const fallback: GatewayHealthSnapshot = {
    ok: true,
    mode: 'local-vault',
    service: 'xyp3rn-local-seed',
    vaultRoot: 'MAIN-XYP3RN-OS-Vault',
    agentsCount: 52,
    pendingApprovals: 0,
    totalIndexedFiles: totalSeed,
    bySector,
  };

  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;
  if (!fetchFn) return fallback;

  try {
    const response = await fetchFn(`${baseUrl}/api/health`);
    if (!response.ok) return fallback;
    const data = (await response.json()) as Partial<{
      ok: boolean;
      service: string;
      vaultRoot: string;
      agentsCount: number;
      pendingApprovals: number;
      indexStats: { totalFiles: number; bySector: Record<string, number> };
    }>;
    if (!data.ok || !data.indexStats) return fallback;
    return {
      ok: true,
      mode: 'live-gateway',
      service: data.service ?? 'xyp3rn-os3-gateway',
      vaultRoot: data.vaultRoot ?? fallback.vaultRoot,
      agentsCount: data.agentsCount ?? 52,
      pendingApprovals: data.pendingApprovals ?? 0,
      totalIndexedFiles: data.indexStats.totalFiles ?? totalSeed,
      bySector: data.indexStats.bySector ?? bySector,
    };
  } catch {
    return fallback;
  }
}

/**
 * Reads a note and its incoming/outgoing wikilinks from `127.0.0.1:8077/api/vault/note`,
 * falling back to the seed job's Markdown in `data/map.ts` when offline. Never throws.
 * @param relPath vault-relative file path
 * @param options injectable fetch, baseUrl and seed departments
 */
export async function fetchVaultNote(
  relPath: string,
  options: {
    fetchImpl?: typeof fetch;
    baseUrl?: string;
    departments?: readonly Department[];
  } = {},
): Promise<VaultNotePayload | null> {
  const departments = options.departments ?? defaultDepartments;
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;

  if (fetchFn) {
    try {
      const response = await fetchFn(`${baseUrl}/api/vault/note?path=${encodeURIComponent(relPath)}`);
      if (response.ok) {
        const data = (await response.json()) as Partial<{
          ok: boolean;
          note: {
            vaultPath: string;
            sector: string;
            isCanonical: boolean;
            rawContent: string;
            body: string;
            sha256: string;
            byteSize: number;
          };
          links: { outgoing: string[]; backlinks: string[] };
        }>;
        if (data.ok && data.note) {
          return {
            vaultPath: data.note.vaultPath,
            sector: data.note.sector,
            isCanonical: data.note.isCanonical,
            rawContent: data.note.rawContent,
            body: data.note.body,
            sha256: data.note.sha256,
            byteSize: data.note.byteSize,
            outgoingLinks: data.links?.outgoing ?? [],
            backlinks: data.links?.backlinks ?? [],
            mode: 'live-gateway',
          };
        }
      }
    } catch {
      // Fall back to local seed below when gateway is unreachable.
    }
  }

  const allJobs = departments.flatMap((dept) => dept.jobs.map((job) => ({ job, deptId: dept.id })));
  const hit = allJobs.find((item) => item.job.file.toLowerCase() === relPath.trim().toLowerCase());
  if (!hit) return null;

  return {
    vaultPath: hit.job.file,
    sector: hit.deptId,
    isCanonical: true,
    rawContent: hit.job.skill.markdown,
    body: hit.job.skill.markdown,
    sha256: 'seed',
    byteSize: hit.job.skill.markdown.length,
    outgoingLinks: hit.job.breaksInto,
    backlinks: hit.job.buildsOn,
    mode: 'local-vault',
  };
}

/**
 * Searches the live Obsidian Vault index via `127.0.0.1:8077/api/vault/search`,
 * falling back to BM25 `searchJobs` over `data/map.ts` when offline. Never throws.
 * @param query search query string
 * @param options sector filter, result limit, injectable fetch, baseUrl and seed departments
 */
export async function searchLiveVault(
  query: string,
  options: {
    sector?: string;
    limit?: number;
    fetchImpl?: typeof fetch;
    baseUrl?: string;
    departments?: readonly Department[];
  } = {},
): Promise<VaultSearchHit[]> {
  const departments = options.departments ?? defaultDepartments;
  const limit = options.limit ?? 10;
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;

  if (fetchFn) {
    try {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (options.sector) params.set('sector', options.sector);
      const response = await fetchFn(`${baseUrl}/api/vault/search?${params.toString()}`);
      if (response.ok) {
        const data = (await response.json()) as Partial<{
          ok: boolean;
          hits: Array<{ vaultPath: string; sector: string; title: string; sha256: string; tags: string[] }>;
        }>;
        if (data.ok && Array.isArray(data.hits)) {
          return data.hits.map((h) => ({
            vaultPath: h.vaultPath,
            sector: h.sector,
            title: h.title,
            sha256: h.sha256,
            tags: h.tags ?? [],
            mode: 'live-gateway',
          }));
        }
      }
    } catch {
      // Fall back to local BM25 seed search below.
    }
  }

  return searchJobs(departments, query, limit).map((hit) => ({
    vaultPath: hit.job.file,
    sector: hit.department.id,
    title: hit.job.title,
    sha256: 'seed',
    tags: [hit.job.cluster],
    mode: 'local-vault',
  }));
}

/**
 * Lists human approval queue items from `127.0.0.1:8077/api/approvals`. Never throws.
 * @param status optional status filter ('pending' | 'approved' | 'rejected')
 * @param options injectable fetch and baseUrl
 */
export async function fetchPendingApprovals(
  status: 'pending' | 'approved' | 'rejected' = 'pending',
  options: { fetchImpl?: typeof fetch; baseUrl?: string } = {},
): Promise<GatewayApprovalItem[]> {
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;
  if (!fetchFn) return [];

  try {
    const response = await fetchFn(`${baseUrl}/api/approvals?status=${encodeURIComponent(status)}`);
    if (!response.ok) return [];
    const data = (await response.json()) as Partial<{ ok: boolean; approvals: GatewayApprovalItem[] }>;
    return data.ok && Array.isArray(data.approvals) ? data.approvals : [];
  } catch {
    return [];
  }
}

/**
 * Submits a human operator approval or rejection decision to `127.0.0.1:8077/api/approvals/decide`.
 * Never throws.
 * @param input approval decision payload
 * @param options injectable fetch and baseUrl
 */
export async function decideGatewayApproval(
  input: {
    approvalId: string;
    decision: 'approved' | 'rejected';
    approver: string;
    reason: string;
  },
  options: { fetchImpl?: typeof fetch; baseUrl?: string } = {},
): Promise<GatewayApprovalItem | null> {
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;
  if (!fetchFn) return null;

  try {
    const response = await fetchFn(`${baseUrl}/api/approvals/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<{ ok: boolean; approval: GatewayApprovalItem }>;
    return data.ok && data.approval ? data.approval : null;
  } catch {
    return null;
  }
}

/**
 * Directly reads and inspects a file/note across the Obsidian Vault or Whole OS codebase via `127.0.0.1:8077/api/jarvis/inspect`.
 */
export async function inspectJarvisSource(
  scope: 'vault' | 'os',
  relPath: string,
  options: { fetchImpl?: typeof fetch; baseUrl?: string } = {},
): Promise<JarvisInspectionPayload | null> {
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;
  if (!fetchFn) return null;
  try {
    const response = await fetchFn(
      `${baseUrl}/api/jarvis/inspect?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(relPath)}`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<JarvisInspectionPayload>;
    return data.ok ? (data as JarvisInspectionPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Applies or declines a proposed Jarvis change via `127.0.0.1:8077/api/jarvis/proposal/decide`.
 */
export async function decideJarvisProposal(
  input: {
    proposalId: string;
    decision: 'approved' | 'rejected';
    approver?: string;
    reason?: string;
  },
  options: { fetchImpl?: typeof fetch; baseUrl?: string } = {},
): Promise<{
  ok: boolean;
  applied: boolean;
  decision: 'approved' | 'rejected';
  vaultPath?: string;
  sha256?: string;
  message: string;
} | null> {
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const baseUrl = options.baseUrl ?? GATEWAY_BASE_URL;
  if (!fetchFn) return null;
  try {
    const response = await fetchFn(`${baseUrl}/api/jarvis/proposal/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId: input.proposalId,
        decision: input.decision,
        approver: input.approver ?? 'operator',
        reason: input.reason ?? '',
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<{
      ok: boolean;
      applied: boolean;
      decision: 'approved' | 'rejected';
      vaultPath: string;
      sha256: string;
      message: string;
    }>;
    return data.ok ? (data as NonNullable<Awaited<ReturnType<typeof decideJarvisProposal>>>) : null;
  } catch {
    return null;
  }
}


