import { describe, expect, it, vi } from 'vitest';
import { departments, x3liusTracks } from '@/data/map';
import {
  SESSION_STORAGE_KEY,
  appendSessionLog,
  clearSessionLogs,
  decideGatewayApproval,
  dispatchJarvis,
  executeVaultCommand,
  fetchGatewayHealth,
  fetchPendingApprovals,
  fetchTrackPulse,
  fetchVaultNote,
  isAllowedGatewayOrigin,
  parseSessionLogs,
  readSessionLogs,
  searchLiveVault,
} from '@/lib/gateway';
import {
  buildTrackSpectrum,
  buildVisualizerBars,
  buildVisualizerRings,
  extractContextRefs,
  isSafeVaultPath,
  parseJarvisCommand,
  resolveContextJobs,
  resolveSafeCopyPath,
  routeEngine,
} from '@/lib/jarvis';
import { LAYOUT } from '@/lib/tokens';

describe('path safety & no-overwrite guard', () => {
  it('accepts valid vault-relative paths inside the six sectors', () => {
    expect(isSafeVaultPath('01_CORE/00_Identity/Mission.md')).toBe(true);
    expect(isSafeVaultPath('05_XYP3RN_RECORDS/06_X3LIUS_MUSIC_SYSTEM/06_Audio/uk-drill-type-render.wav')).toBe(true);
    expect(isSafeVaultPath('02_KNOWLEDGE_LAYER/01_Concepts/New.md')).toBe(true);
  });

  it('rejects traversal, absolute paths, hidden segments and disallowed extensions', () => {
    expect(isSafeVaultPath('')).toBe(false);
    expect(isSafeVaultPath('/01_CORE/00_Identity/Mission.md')).toBe(false);
    expect(isSafeVaultPath('C:\\Users\\blago\\secret.md')).toBe(false);
    expect(isSafeVaultPath('01_CORE/../06_GOVERNANCE/secret.md')).toBe(false);
    expect(isSafeVaultPath('01_CORE/.env/secret.md')).toBe(false);
    expect(isSafeVaultPath('01_CORE/00_Identity/.hidden.md')).toBe(false);
    expect(isSafeVaultPath('99_UNKNOWN/00_Identity/Mission.md')).toBe(false);
    expect(isSafeVaultPath('01_CORE/00_Identity/exploit.exe')).toBe(false);
  });

  it('never overwrites an existing vault path, numbering copies sequentially', () => {
    const existing = new Set([
      '02_KNOWLEDGE_LAYER/01_Concepts/New.md',
      '02_KNOWLEDGE_LAYER/01_Concepts/New (2).md',
    ]);
    expect(resolveSafeCopyPath('02_KNOWLEDGE_LAYER/01_Concepts/Fresh.md', existing)).toBe(
      '02_KNOWLEDGE_LAYER/01_Concepts/Fresh.md',
    );
    expect(resolveSafeCopyPath('02_KNOWLEDGE_LAYER/01_Concepts/New.md', existing)).toBe(
      '02_KNOWLEDGE_LAYER/01_Concepts/New (3).md',
    );
  });
});

describe('command parser, engine routing and @context injection', () => {
  it('routes Gemini and analytical second-opinion queries to gemini-api and others to claude-code-cli', () => {
    expect(routeEngine('xyp3rn> gemini "Analyze architectural risks"')).toBe('gemini-api');
    expect(routeEngine('Give me a Gemini second opinion on multimodal latency')).toBe('gemini-api');
    expect(routeEngine('xyp3rn> run Summarise @01_CORE/00_Identity/Mission.md')).toBe('claude-code-cli');
    expect(routeEngine('Summarise mission', 'gemini-api')).toBe('gemini-api');
  });

  it('extracts @path and @agent references and resolves them to vault jobs', () => {
    const refs = extractContextRefs('xyp3rn> run Summarise @01_CORE/00_Identity/Mission.md with @researcher and @scribe');
    expect(refs).toEqual(['01_CORE/00_Identity/Mission.md', 'researcher', 'scribe']);
    const jobs = resolveContextJobs(refs, departments);
    expect(jobs.map((job) => job.id)).toEqual(['mission-identity', 'researcher-agent', 'scribe-agent']);
  });

  it('parses CLI commands and natural voice intents', () => {
    expect(parseJarvisCommand('xyp3rn> status').kind).toBe('status');
    expect(parseJarvisCommand('xyp3rn> read 01_CORE/00_Identity/Mission.md')).toMatchObject({
      kind: 'read',
      targetPath: '01_CORE/00_Identity/Mission.md',
    });
    expect(parseJarvisCommand('xyp3rn> write 02_KNOWLEDGE_LAYER/01_Concepts/New.md "Content"')).toMatchObject({
      kind: 'write',
      targetPath: '02_KNOWLEDGE_LAYER/01_Concepts/New.md',
    });
    expect(parseJarvisCommand('xyp3rn> flow daily-digest "music production"').kind).toBe('flow');
    expect(parseJarvisCommand('xyp3rn> play "Neon Static"')).toMatchObject({
      kind: 'play',
      args: 'Neon Static',
    });
    expect(parseJarvisCommand('Play Glass Orbit now').kind).toBe('play');
    expect(parseJarvisCommand('xyp3rn> compose "-FREE- Uk Drill Type"').kind).toBe('compose');
    expect(parseJarvisCommand('xyp3rn> connections refresh').kind).toBe('connections');
  });
});

describe('visualizer and spectrum math', () => {
  it('builds deterministic radial bars and concentric rings for the Jarvis orb', () => {
    const idleBars = buildVisualizerBars('idle', 0.1, 0);
    const activeBars = buildVisualizerBars('speaking', 0.9, 1.2);
    expect(idleBars).toHaveLength(LAYOUT.jarvisBarCount);
    expect(activeBars).toHaveLength(LAYOUT.jarvisBarCount);
    expect(buildVisualizerBars('speaking', 0.9, 1.2)).toEqual(activeBars);

    const avgIdle = idleBars.reduce((sum, bar) => sum + bar.amplitude, 0) / idleBars.length;
    const avgActive = activeBars.reduce((sum, bar) => sum + bar.amplitude, 0) / activeBars.length;
    expect(avgActive).toBeGreaterThan(avgIdle);

    const rings = buildVisualizerRings('listening', 0.75);
    expect(rings).toHaveLength(LAYOUT.jarvisRingCount);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i]!.radius).toBeGreaterThan(rings[i - 1]!.radius);
    }
  });

  it('builds deterministic 24-band spectrum values for X3LIUS tracks', () => {
    const paused = buildTrackSpectrum('neon-static', 128, 12.5, false);
    const playing = buildTrackSpectrum('neon-static', 128, 12.5, true);
    expect(paused).toHaveLength(LAYOUT.playerSpectrumBars);
    expect(playing).toHaveLength(LAYOUT.playerSpectrumBars);
    expect(buildTrackSpectrum('neon-static', 128, 12.5, true)).toEqual(playing);
    playing.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
    const sumPaused = paused.reduce((a, b) => a + b, 0);
    const sumPlaying = playing.reduce((a, b) => a + b, 0);
    expect(sumPlaying).toBeGreaterThan(sumPaused);
  });
});

describe('typed server gateway & session logs', () => {
  it('enforces localhost binding and same-origin allowlist', () => {
    expect(isAllowedGatewayOrigin('127.0.0.1:8077', 'http://127.0.0.1:3000')).toBe(true);
    expect(isAllowedGatewayOrigin('localhost:3000', 'http://localhost:3000')).toBe(true);
    expect(isAllowedGatewayOrigin('0.0.0.0:8077', 'http://127.0.0.1:3000')).toBe(false);
    expect(isAllowedGatewayOrigin('127.0.0.1:8077', 'https://evil.example.com')).toBe(false);
  });

  it('executes vault commands locally with path guards, context injection and actions', () => {
    const statusRes = executeVaultCommand({ prompt: 'xyp3rn> status' }, departments, x3liusTracks);
    expect(statusRes.ok).toBe(true);
    expect(statusRes.exchange.reply).toContain('137');
    expect(statusRes.connectorCount).toBe(21);

    const unsafeRead = executeVaultCommand({ prompt: 'xyp3rn> read ../secret.env' }, departments, x3liusTracks);
    expect(unsafeRead.ok).toBe(false);
    expect(unsafeRead.exchange.reply).toContain('403');

    const safeWrite = executeVaultCommand(
      { prompt: 'xyp3rn> write 01_CORE/00_Identity/Mission.md "Updated"' },
      departments,
      x3liusTracks,
    );
    expect(safeWrite.ok).toBe(true);
    expect(safeWrite.exchange.reply).toContain('01_CORE/00_Identity/Mission (2).md');

    const contextRun = executeVaultCommand(
      { prompt: 'xyp3rn> run Summarise @01_CORE/00_Identity/Mission.md' },
      departments,
      x3liusTracks,
    );
    expect(contextRun.exchange.contextJobs).toContain('mission-identity');
    expect(contextRun.action).toEqual({ type: 'select-job', jobId: 'mission-identity' });

    const playCmd = executeVaultCommand({ prompt: 'xyp3rn> play "Neon Static"' }, departments, x3liusTracks);
    expect(playCmd.action).toEqual({ type: 'play-track', trackId: 'neon-static' });
  });

  it('uses live gateway when 127.0.0.1:8077 responds and falls back to local-vault when offline', async () => {
    const liveFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        reply: 'Live gateway response from 127.0.0.1:8077',
        engine: 'gemini-api',
        connectorCount: 21,
        connectorHealthy: 21,
      }),
    });
    const live = await dispatchJarvis(
      { prompt: 'xyp3rn> gemini "Analyze risks"' },
      { fetchImpl: liveFetch as unknown as typeof fetch },
    );
    expect(live.exchange.mode).toBe('live-gateway');
    expect(live.exchange.reply).toBe('Live gateway response from 127.0.0.1:8077');

    const offlineFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const fallback = await dispatchJarvis(
      { prompt: 'xyp3rn> status' },
      { fetchImpl: offlineFetch as unknown as typeof fetch },
    );
    expect(fallback.exchange.mode).toBe('local-vault');
    expect(fallback.ok).toBe(true);
  });

  it('fetches track pulse spectrum with automatic local fallback', async () => {
    const offlineFetch = vi.fn().mockRejectedValue(new Error('offline'));
    const bars = await fetchTrackPulse('uk-drill', 140, 4.2, true, {
      fetchImpl: offlineFetch as unknown as typeof fetch,
    });
    expect(bars).toHaveLength(LAYOUT.playerSpectrumBars);
  });

  it('persists and clears session logs safely', () => {
    expect(parseSessionLogs(null)).toEqual([]);
    expect(parseSessionLogs('{bad')).toEqual([]);
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    const res = executeVaultCommand({ prompt: 'xyp3rn> status' }, departments, x3liusTracks);
    const logs = appendSessionLog(res.exchange, storage);
    expect(logs).toHaveLength(1);
    expect(store.has(SESSION_STORAGE_KEY)).toBe(true);
    expect(readSessionLogs(storage)).toHaveLength(1);
    clearSessionLogs(storage);
    expect(readSessionLogs(storage)).toEqual([]);
  });

  it('connects to OS 3.0 Gateway endpoints (/api/health, /api/vault/note, /api/vault/search, /api/approvals) with offline fallback', async () => {
    const offlineFetch = vi.fn().mockRejectedValue(new Error('offline'));

    // 1. Health fallback vs live
    const offlineHealth = await fetchGatewayHealth({ fetchImpl: offlineFetch as unknown as typeof fetch });
    expect(offlineHealth.mode).toBe('local-vault');
    expect(offlineHealth.totalIndexedFiles).toBe(137);

    const liveHealthFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        service: 'xyp3rn-os3-gateway',
        vaultRoot: 'C:\\Users\\blago\\Desktop\\XYP3RN-Suno-KB-v1.2-Brain',
        agentsCount: 52,
        pendingApprovals: 1,
        indexStats: { totalFiles: 20161, bySector: { '01_CORE': 103, ROOT_KB: 19632 } },
      }),
    });
    const liveHealth = await fetchGatewayHealth({ fetchImpl: liveHealthFetch as unknown as typeof fetch });
    expect(liveHealth.mode).toBe('live-gateway');
    expect(liveHealth.totalIndexedFiles).toBe(20161);
    expect(liveHealth.pendingApprovals).toBe(1);

    // 2. Vault note fallback vs live
    const seedNote = await fetchVaultNote('01_CORE/00_Identity/Mission.md', {
      fetchImpl: offlineFetch as unknown as typeof fetch,
    });
    expect(seedNote?.mode).toBe('local-vault');
    expect(seedNote?.vaultPath).toBe('01_CORE/00_Identity/Mission.md');

    const liveNoteFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        note: {
          vaultPath: '01_CORE/02_Agents/x3lius-lyrics.md',
          sector: '01_CORE',
          isCanonical: false,
          rawContent: '# x3lius-lyrics',
          body: '# x3lius-lyrics',
          sha256: 'abc123',
          byteSize: 15,
        },
        links: { outgoing: ['Vocal DNA'], backlinks: [] },
      }),
    });
    const liveNote = await fetchVaultNote('01_CORE/02_Agents/x3lius-lyrics.md', {
      fetchImpl: liveNoteFetch as unknown as typeof fetch,
    });
    expect(liveNote?.mode).toBe('live-gateway');
    expect(liveNote?.outgoingLinks).toEqual(['Vocal DNA']);

    // 3. Search fallback vs live
    const fallbackHits = await searchLiveVault('Mission', {
      fetchImpl: offlineFetch as unknown as typeof fetch,
    });
    expect(fallbackHits.length).toBeGreaterThan(0);
    expect(fallbackHits[0]!.mode).toBe('local-vault');

    // 4. Approvals queue and decision
    const approvalsFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        approvals: [
          {
            id: 'app-1',
            itemType: 'vault_promotion',
            itemId: 'cand-1',
            status: 'pending',
            proposer: 'research-orchestrator',
            approver: null,
            reason: null,
            createdAt: '2026-11-16T00:00:00Z',
            decidedAt: null,
          },
        ],
      }),
    });
    const pending = await fetchPendingApprovals('pending', {
      fetchImpl: approvalsFetch as unknown as typeof fetch,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe('app-1');

    const decideFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        approval: {
          id: 'app-1',
          itemType: 'vault_promotion',
          itemId: 'cand-1',
          status: 'approved',
          proposer: 'research-orchestrator',
          approver: 'blago',
          reason: 'verified',
          createdAt: '2026-11-16T00:00:00Z',
          decidedAt: '2026-11-16T01:00:00Z',
        },
      }),
    });
    const decided = await decideGatewayApproval(
      { approvalId: 'app-1', decision: 'approved', approver: 'blago', reason: 'verified' },
      { fetchImpl: decideFetch as unknown as typeof fetch },
    );
    expect(decided?.status).toBe('approved');
    expect(decided?.approver).toBe('blago');
  });
});

