import { describe, expect, it, vi } from 'vitest';
import { departments as seedDepartments } from '@/data/map';
import {
  fetchAgentRegistry,
  fetchKnowledgeGraph,
  fetchRecordsOverview,
  fetchResearchOverview,
  fetchRuntimeEvents,
  fetchRuntimeRuns,
  fetchSystemOverview,
  fetchVaultTree,
  fetchWorkflowRegistry,
  mergeVaultTreeIntoDepartments,
  readUiPreferences,
  UI_PREFS_STORAGE_KEY,
  writeUiPreferences,
} from '@/lib/os3-adapter';

describe('os3-adapter API clients and preferences', () => {
  it('parses live gateway responses for all OS3 UI endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/overview')) {
        return new Response(
          JSON.stringify({
            ok: true,
            service: 'xyp3rn-os3-gateway',
            vaultRoot: 'C:/Vault',
            sqliteOpen: true,
            integrityOk: true,
            schemaVersion: 1,
            indexStats: { totalFiles: 200, bySector: { '01_CORE': 30 } },
            agents: { total: 52, failuresCount: 0, byClass: {}, byDomain: {} },
            workflows: { total: 7, names: ['daily-digest'] },
            runtime: { activeLocks: 0, pendingApprovals: 1, totalApprovals: 1, recentRunsCount: 2, recentJobsCount: 1, recentEventsCount: 3 },
            pendingApprovalsList: [],
            recentJobs: [],
            recentAgentRuns: [],
            recentEvents: [],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/vault/tree')) {
        return new Response(JSON.stringify({ ok: true, totalFiles: 10, bySector: {}, sectors: [] }), { status: 200 });
      }
      if (url.includes('/api/vault/graph')) {
        return new Response(JSON.stringify({ ok: true, sector: null, totalIndexed: 10, nodeCount: 1, edgeCount: 0, nodes: [], edges: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ ok: true, total: 1, agents: [], workflows: [], jobs: [], agentRuns: [], events: [], counts: {}, projects: [], questions: [], sources: [], evidence: [], findings: [], contradictions: [], experiments: [], briefs: [], songs: [], lyrics: [], vocalDna: [], sunoPrompts: [], audioTakes: [], releases: [], rightsSplits: [], catalogAssignments: [], sessionsDaily: [], recentRuns: [] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const opts = { fetchImpl: fetchMock, baseUrl: 'http://127.0.0.1:8077' };
    expect((await fetchSystemOverview(opts)).ok).toBe(true);
    expect((await fetchVaultTree({}, opts)).ok).toBe(true);
    expect((await fetchKnowledgeGraph({}, opts)).ok).toBe(true);
    expect((await fetchAgentRegistry(opts)).ok).toBe(true);
    expect((await fetchWorkflowRegistry(opts)).ok).toBe(true);
    expect((await fetchRuntimeRuns(10, opts)).ok).toBe(true);
    expect((await fetchRuntimeEvents(10, opts)).ok).toBe(true);
    expect((await fetchResearchOverview(opts)).ok).toBe(true);
    expect((await fetchRecordsOverview(opts)).ok).toBe(true);
  });

  it('handles HTTP errors and network failures gracefully without throwing', async () => {
    const failingFetch = vi.fn(async () => new Response('Server error', { status: 500 })) as unknown as typeof fetch;
    const res500 = await fetchSystemOverview({ fetchImpl: failingFetch, baseUrl: 'http://127.0.0.1:8077' });
    expect(res500.ok).toBe(false);
    expect(res500.mode).toBe('local-vault');
    expect(res500.error).toContain('HTTP 500');

    const networkErrorFetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const resErr = await fetchVaultTree({}, { fetchImpl: networkErrorFetch, baseUrl: 'http://127.0.0.1:8077' });
    expect(resErr.ok).toBe(false);
    expect(resErr.error).toContain('ECONNREFUSED');
  });

  it('persists only UI preferences safely and merges live Vault tree nodes with seed departments', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
    expect(writeUiPreferences({ expandedSidebar: true, activeSectorIndex: 3 }, storage)).toBe(true);
    expect(map.has(UI_PREFS_STORAGE_KEY)).toBe(true);
    expect(readUiPreferences(storage)).toEqual({ expandedSidebar: true, activeSectorIndex: 3 });

    const merged = mergeVaultTreeIntoDepartments(
      seedDepartments,
      {
        ok: true,
        totalFiles: 1,
        bySector: { '03_RESEARCH_INTELLIGENCE': 1 },
        sectors: [
          {
            sector: '03_RESEARCH_INTELLIGENCE',
            totalIndexed: 1,
            returnedCount: 1,
            folders: [
              {
                folder: '00_Briefs',
                count: 1,
                notes: [
                  {
                    vaultPath: '03_RESEARCH_INTELLIGENCE/00_Briefs/live-synth.md',
                    title: 'Live Research Synthesis',
                    domain: 'RESEARCH_INTELLIGENCE',
                    docType: 'research_brief',
                    status: 'live',
                    tags: ['research'],
                    sha256: 'abcdef123456',
                    wikilinksCount: 2,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        jobs: [
          {
            id: 'job-1',
            kind: 'workflow',
            name: 'daily-digest',
            status: 'success',
            createdAt: '2026-11-16T00:00:00Z',
            startedAt: '2026-11-16T00:00:01Z',
            finishedAt: '2026-11-16T00:00:02Z',
            errorDetail: null,
          },
        ],
      },
    );

    const researchSector = merged.departments.find((d) => d.id === '03_RESEARCH_INTELLIGENCE')!;
    expect(researchSector.jobs.some((j) => j.title === 'Live Research Synthesis')).toBe(true);
  });
});
