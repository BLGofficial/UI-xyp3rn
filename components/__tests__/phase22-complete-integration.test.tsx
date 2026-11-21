import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromeShell } from '@/components/ChromeShell';
import { DashboardsView } from '@/components/DashboardsView';
import { KnowledgeGraphView } from '@/components/KnowledgeGraphView';
import { MapScreen } from '@/components/MapScreen';
import { departments, ui } from '@/data/map';
import { os3FetchJson } from '@/lib/api-http';
import { STATUS_STORAGE_KEY } from '@/lib/storage';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboards',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  window.localStorage.clear();
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 20 })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        setTransform: vi.fn(),
      }) as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function buildCompleteMockFetch(options: { readonly staleDiagnostics?: boolean } = {}) {
  const agentRunCalls: unknown[] = [];
  const workflowRunCalls: unknown[] = [];
  const generatedAt = options.staleDiagnostics ? '2026-01-01T00:00:00.000Z' : new Date().toISOString();

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
          indexStats: { totalFiles: 20354, bySector: { '01_CORE': 120, '09_X3LIUS_MUSIC': 45 } },
          agents: { total: 52, failuresCount: 0, byClass: { Execution: 10, Research: 14 }, byDomain: { CORE: 10 } },
          workflows: { total: 7, names: ['retrieve-and-summarize'] },
          runtime: { activeLocks: 1, pendingApprovals: 1, totalApprovals: 2, recentRunsCount: 1, recentJobsCount: 1, recentEventsCount: 2 },
          pendingApprovalsList: [],
          recentJobs: [
            { id: 'job-22', kind: 'workflow', name: 'retrieve-and-summarize', status: 'success', createdAt: '2026-11-21T00:00:00Z', startedAt: '2026-11-21T00:00:00Z', finishedAt: '2026-11-21T00:00:01Z', errorDetail: null },
          ],
          recentAgentRuns: [
            { id: 'run-22', agentName: 'research-orchestrator', status: 'success', startedAt: '2026-11-21T00:00:00Z', finishedAt: '2026-11-21T00:00:01Z', durationMs: 14, errorDetail: null },
          ],
          recentEvents: [
            { id: 101, timestamp: '2026-11-21T00:01:00Z', eventType: 'vault.write', domain: 'CORE', actor: 'jarvis', targetPath: '01_CORE/a.md' },
            { id: 102, timestamp: '2026-11-21T00:02:00Z', eventType: 'daw.session.observed', domain: 'DAW', actor: 'daw-gateway', targetPath: null },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/health')) {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'xyp3rn-os3-gateway',
          vaultRoot: 'C:/Vault',
          agentsCount: 52,
          pendingApprovals: 1,
          totalIndexedFiles: 20354,
          bySector: { '01_CORE': 120 },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/modules')) {
      return new Response(
        JSON.stringify({
          ok: true,
          generatedAt,
          modules: [
            { id: 'context-engine', name: 'Context Engine', sector: '02_KNOWLEDGE', status: 'healthy', summary: 'SQLite FTS5 + Vault watcher active', sourcePath: 'core/context-engine' },
            { id: 'daw-brain', name: 'DAW Brain', sector: '10_DAW_BRAIN', status: 'healthy', summary: 'Universal session & routing kernel', sourcePath: 'core/daw-brain' },
            { id: 'plugin-brain', name: 'Plugin Brain', sector: '10_DAW_BRAIN', status: 'healthy', summary: 'Verified parameter intelligence', sourcePath: 'core/daw-brain/plugin-brain' },
            { id: 'audio-brain', name: 'Audio Brain', sector: '10_DAW_BRAIN', status: 'healthy', summary: 'DSP feature & MIR extraction', sourcePath: 'core/daw-brain/audio-brain' },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/vault/tree')) {
      return new Response(
        JSON.stringify({
          ok: true,
          totalFiles: 20354,
          sectors: [
            {
              sector: '03_RESEARCH_INTELLIGENCE',
              totalIndexed: 40,
              folders: [
                {
                  folder: '00_Briefs',
                  count: 1,
                  notes: [
                    { vaultPath: '03_RESEARCH_INTELLIGENCE/00_Briefs/p22-brief.md', title: 'Phase 22 Research Brief', docType: 'research_brief', status: 'live' },
                  ],
                },
              ],
            },
            {
              sector: '09_X3LIUS_MUSIC',
              totalIndexed: 25,
              folders: [
                {
                  folder: '00_Songs',
                  count: 1,
                  notes: [
                    { vaultPath: '09_X3LIUS_MUSIC/00_Songs/night-grid.md', title: 'Night Grid Master', docType: 'song', status: 'live' },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/vault/search')) {
      return new Response(
        JSON.stringify({
          ok: true,
          query: 'night',
          count: 1,
          hits: [
            { vaultPath: '09_X3LIUS_MUSIC/00_Songs/night-grid.md', sector: '09_X3LIUS_MUSIC', title: 'Night Grid Master', sha256: 'aa1122', tags: ['song'] },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/vault/note')) {
      return new Response(
        JSON.stringify({
          ok: true,
          note: {
            vaultPath: '09_X3LIUS_MUSIC/00_Songs/night-grid.md',
            sector: '09_X3LIUS_MUSIC',
            isCanonical: true,
            rawContent: '# Night Grid Master\n\nVerified Vault note.',
            body: 'Verified Vault note.',
            sha256: 'deadbeef9999',
            byteSize: 48,
          },
          links: { outgoing: [], backlinks: [] },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/agents/run')) {
      const payload = JSON.parse(String(init?.body ?? '{}')) as { agentName?: string; mode?: string };
      agentRunCalls.push(payload);
      if (payload.mode === 'execute') {
        return new Response(
          JSON.stringify({ ok: false, code: 'PERMISSION_DENIED', error: '403 FORBIDDEN: Research agent cannot execute mutating actions' }),
          { status: 403 },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          run: { id: 'run-p22-1', agentName: payload.agentName, status: 'success', startedAt: generatedAt, finishedAt: generatedAt, durationMs: 9, errorDetail: null },
          output: { agent: payload.agentName, class: 'Research', domain: 'RESEARCH_INTELLIGENCE', mode: 'analyze', summary: 'Completed grounded analysis', evidencePaths: ['01_CORE/a.md'] },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/agents')) {
      return new Response(
        JSON.stringify({
          ok: true,
          total: 1,
          byClass: { Research: 1 },
          byDomain: { RESEARCH_INTELLIGENCE: 1 },
          agents: [
            {
              name: 'research-orchestrator',
              class: 'Research',
              domain: 'RESEARCH_INTELLIGENCE',
              model: 'claude-sonnet-4-6',
              tools: ['vault.read', 'vault.search'],
              role: 'Coordinates evidence-grounded synthesis',
              contract: 'Returns brief',
              refuses: 'Direct overwrite',
              path: '04_AGENTS/research-orchestrator.agent.md',
              lastRun: null,
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/workflows/run')) {
      const payload = JSON.parse(String(init?.body ?? '{}'));
      workflowRunCalls.push(payload);
      return new Response(
        JSON.stringify({
          ok: true,
          job: { id: 'job-wf-22', kind: 'workflow', name: payload.workflowName, status: 'success', createdAt: generatedAt, startedAt: generatedAt, finishedAt: generatedAt, errorDetail: null },
          steps: [{ stepId: 'retrieve', agent: 'context-retriever', status: 'success', runId: 'run-s1' }],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/workflows')) {
      return new Response(
        JSON.stringify({
          ok: true,
          total: 1,
          workflows: [
            {
              name: 'retrieve-and-summarize',
              description: 'Retrieves Vault context and summarizes.',
              sourcePath: '05_WORKFLOWS/DEFINITIONS/retrieve-and-summarize.workflow.yaml',
              requiredInputs: ['query'],
              stepCount: 1,
              steps: [{ id: 'retrieve', agent: 'context-retriever', dependsOn: [] }],
              lastJob: null,
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/governance')) {
      return new Response(
        JSON.stringify({
          ok: true,
          generatedAt,
          enforcedInvariants: [
            { id: 'F35', name: 'Protected Path Ownership', enforced: true, detail: 'Governance & Core require approval' },
            { id: 'D2', name: 'Approval Before Mutation', enforced: true, detail: 'Pending approvals gate writes' },
          ],
          counts: { policies: 1, standards: 0, totalGovNotes: 1, activeLocks: 1, pendingApprovals: 1, approvedCount: 1, rejectedCount: 0, securityEventsCount: 1 },
          policies: [{ vaultPath: '08_GOVERNANCE/00_Policies/Localhost_Binding.md', title: 'Localhost Binding Policy', docType: 'policy', status: 'canonical', tags: ['security'], sha256: 'p1', wikilinksCount: 0 }],
          standards: [],
          activeLocks: [{ resourceKey: 'vault:01_CORE/a.md', ownerId: 'agent-alpha', acquiredAt: generatedAt, expiresAt: generatedAt }],
          recentSecurityEvents: [],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/diagnostics')) {
      return new Response(
        JSON.stringify({
          ok: true,
          generatedAt,
          sqlite: { open: true, integrityOk: true, schemaVersion: 1, dbPath: 'C:/Vault/.xyp3rn/os3.sqlite' },
          vault: { vaultRoot: 'C:/Vault', totalIndexedFiles: 20354, sectorsCount: 10 },
          agents: { loadedCount: 52, failuresCount: 0, failures: [], skippedCount: 0 },
          runtimeHealth: { failedRunsCount: 0, failedJobsCount: 0, activeLocksCount: 1 },
          dawHealth: { state: 'disconnected', stale: false, adaptersRegistered: 2, reachableInstances: 0, hostProbes: [] },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/events')) {
      return new Response(
        JSON.stringify({
          ok: true,
          count: 2,
          events: [
            { id: 101, timestamp: '2026-11-21T00:01:00Z', eventType: 'vault.write', domain: 'CORE', actor: 'jarvis', targetPath: '01_CORE/a.md' },
            { id: 102, timestamp: '2026-11-21T00:02:00Z', eventType: 'daw.session.observed', domain: 'DAW', actor: 'daw-gateway', targetPath: null },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/approvals')) {
      return new Response(JSON.stringify({ ok: true, count: 0, approvals: [] }), { status: 200 });
    }
    if (url.includes('/api/research')) {
      return new Response(
        JSON.stringify({
          ok: true,
          counts: { totalIntelligenceFiles: 1, totalMaterialFiles: 0, projects: 0, questions: 0, sources: 0, evidence: 0, findings: 0, contradictions: 0, experiments: 0, briefs: 0, specialists: 1 },
          projects: [], questions: [], sources: [], evidence: [], findings: [], contradictions: [], experiments: [], briefs: [], recentRuns: [],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/records')) {
      return new Response(
        JSON.stringify({
          ok: true,
          counts: { totalRecordsFiles: 1, songs: 0, lyrics: 0, vocalDna: 0, sunoPrompts: 0, audioTakes: 0, releases: 0, rightsSplits: 0, catalogAssignments: 0, sessionsDaily: 0, recordAgents: 1 },
          songs: [], lyrics: [], vocalDna: [], sunoPrompts: [], audioTakes: [], releases: [], rightsSplits: [], catalogAssignments: [], sessionsDaily: [], recentRuns: [],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ ok: false, error: 'not found' }), { status: 404 });
  }) as unknown as typeof fetch;

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, agentRunCalls, workflowRunCalls };
}

describe('Phase 22 — Complete UI-xyp3rn + OS3 Integration', () => {
  it('distinguishes 401/403 permission-denied, offline, and server error in shared os3FetchJson transport', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: '403 Forbidden policy' }), { status: 403 })),
    );
    const denied = await os3FetchJson('/api/modules');
    expect(denied.ok).toBe(false);
    expect(denied.statusKind).toBe('permission-denied');
    expect(denied.statusCode).toBe(403);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const offline = await os3FetchJson('/api/modules');
    expect(offline.ok).toBe(false);
    expect(offline.statusKind).toBe('offline');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'SQLite crashed' }), { status: 500 })),
    );
    const serverErr = await os3FetchJson('/api/modules');
    expect(serverErr.ok).toBe(false);
    expect(serverErr.statusKind).toBe('error');
    expect(serverErr.statusCode).toBe(500);
  });

  it('exposes Core Modules, Vault Browser, Knowledge Search, Agent/Workflow execution, Governance, Events, Diagnostics, and stale indicator', async () => {
    const { agentRunCalls, workflowRunCalls } = buildCompleteMockFetch({ staleDiagnostics: true });

    render(
      <ChromeShell>
        <DashboardsView />
      </ChromeShell>,
    );

    // Overview Core Modules summary & Stale Telemetry badge
    expect(await screen.findByText('Context Engine')).toBeInTheDocument();
    expect(screen.getByText('DAW Brain')).toBeInTheDocument();
    expect(screen.getByText('Plugin Brain')).toBeInTheDocument();
    expect(screen.getByText('Audio Brain')).toBeInTheDocument();
    expect(screen.getByText('STALE TELEMETRY')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /DAW · PLUGIN · AUDIO BRAIN/i })).toHaveAttribute('href', '/daw');

    // Core & Vault tab: Vault Browser + Live Search + Entity Inspector
    await userEvent.click(screen.getByRole('tab', { name: 'CORE & VAULT' }));
    expect(await screen.findByRole('button', { name: /09_X3LIUS_MUSIC/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /09_X3LIUS_MUSIC/ }));
    expect(await screen.findByText('Night Grid Master')).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Search OS3 Knowledge Vault');
    await userEvent.type(searchInput, 'night');
    await userEvent.click(screen.getByRole('button', { name: 'SEARCH VAULT' }));
    const searchRegion = screen.getByRole('region', { name: 'Knowledge Search' });
    const hitBtn = await within(searchRegion).findByRole('button', { name: /Night Grid Master/ });
    await userEvent.click(hitBtn);
    expect(await screen.findByRole('dialog', { name: 'Entity Inspector' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close entity inspector' }));

    // Agents tab: Live Agent execution + 403 Permission Denied path
    await userEvent.click(screen.getByRole('tab', { name: 'AGENTS' }));
    await userEvent.click(screen.getByRole('button', { name: 'EXECUTE AGENT' }));
    await waitFor(() => expect(agentRunCalls).toHaveLength(1));
    expect(await screen.findByText(/Agent Executed · research-orchestrator/i)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Agent execution mode'), 'execute');
    await userEvent.click(screen.getByRole('button', { name: 'EXECUTE AGENT' }));
    await waitFor(() => expect(agentRunCalls).toHaveLength(2));
    expect(await screen.findByText('PERMISSION DENIED (403)')).toBeInTheDocument();

    // Workflows tab: Live /api/workflows/run trigger + runtime jobs list
    await userEvent.click(screen.getByRole('tab', { name: 'WORKFLOWS & RUNS' }));
    await userEvent.click(screen.getByRole('button', { name: 'TRIGGER' }));
    await waitFor(() => expect(workflowRunCalls).toHaveLength(1));
    expect(workflowRunCalls[0]).toEqual({
      workflowName: 'retrieve-and-summarize',
      inputs: { query: 'architecture' },
    });
    expect(await screen.findByText(/Workflow Job Completed · retrieve-and-summarize/i)).toBeInTheDocument();
    expect(screen.getByText('RECENT RUNTIME JOBS')).toBeInTheDocument();

    // Governance & Events tab: F35 invariant, SQLite lock, filterable runtime events
    await userEvent.click(screen.getByRole('tab', { name: 'GOVERNANCE & EVENTS' }));
    expect(await screen.findByText(/F35: Protected Path Ownership/i)).toBeInTheDocument();
    expect(screen.getByText('vault:01_CORE/a.md')).toBeInTheDocument();
    expect(screen.getByText('daw.session.observed')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'DAW' }));
    expect(screen.getByText('daw.session.observed')).toBeInTheDocument();
    expect(screen.queryByText('vault.write')).not.toBeInTheDocument();

    // Diagnostics tab
    await userEvent.click(screen.getByRole('tab', { name: 'DIAGNOSTICS' }));
    expect(await screen.findByText('VERIFIED OK')).toBeInTheDocument();
    expect(screen.getByText('20354 NOTES')).toBeInTheDocument();
    expect(screen.getByText('52 LOADED')).toBeInTheDocument();
    expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
  });

  it('surfaces explicit permission-denied and empty states in KnowledgeGraphView', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Bearer token invalid' }), { status: 401 })),
    );
    const { rerender } = render(<KnowledgeGraphView />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('PERMISSION DENIED (401/403)')).toBeInTheDocument();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: true, sector: 'ALL', totalIndexed: 0, nodeCount: 0, edgeCount: 0, nodes: [], edges: [] }),
          { status: 200 },
        ),
      ),
    );
    rerender(<KnowledgeGraphView />);
    await userEvent.click(screen.getByRole('button', { name: 'RELOAD' }));
    expect(await screen.findByText(/No Vault nodes matched this sector filter/i)).toBeInTheDocument();
  });

  it('refuses silent offline operational status persistence on MapScreen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    render(
      <ChromeShell>
        <MapScreen />
      </ChromeShell>,
    );
    const targetJob = departments[0]!.jobs[0]!;
    const searchInput = screen.getByRole('searchbox');
    await userEvent.type(searchInput, `${targetJob.title}{enter}`);

    const statusGroup = await screen.findByRole('group', { name: ui.status.label });
    await userEvent.click(within(statusGroup).getByRole('button', { name: ui.status.options.live }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((el) => /cannot be persisted cleanly/i.test(el.textContent ?? ''))).toBe(true);
    expect(window.localStorage.getItem(STATUS_STORAGE_KEY)).toBeNull();
  });
});
