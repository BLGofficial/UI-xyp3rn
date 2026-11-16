import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChromeShell } from '@/components/ChromeShell';
import { DashboardsView } from '@/components/DashboardsView';
import { KnowledgeGraphView } from '@/components/KnowledgeGraphView';
import { SearchBar } from '@/components/SearchBar';
import { SkillViewer } from '@/components/SkillViewer';
import { departments } from '@/data/map';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboards',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockLiveGatewayFetch() {
  const decideCalls: unknown[] = [];
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
          indexStats: { totalFiles: 20354, bySector: { '01_CORE': 120, '05_XYP3RN_RECORDS': 450 } },
          agents: { total: 52, failuresCount: 0, byClass: { Execution: 10 }, byDomain: { CORE: 10 } },
          workflows: { total: 7, names: ['daily-digest'] },
          runtime: { activeLocks: 0, pendingApprovals: 1, totalApprovals: 1, recentRunsCount: 1, recentJobsCount: 1, recentEventsCount: 1 },
          pendingApprovalsList: [],
          recentJobs: [
            { id: 'job-99', kind: 'workflow', name: 'daily-digest', status: 'success', createdAt: '2026-11-16T00:00:00Z', startedAt: '2026-11-16T00:00:00Z', finishedAt: '2026-11-16T00:00:01Z', errorDetail: null },
          ],
          recentAgentRuns: [],
          recentEvents: [
            { id: 1, timestamp: '2026-11-16T01:02:03Z', eventType: 'vault.write', domain: 'CORE', actor: 'jarvis', targetPath: '01_CORE/06_Tasks/sample.md' },
          ],
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
              lastRun: { id: 'run-1', agentName: 'research-orchestrator', status: 'success', startedAt: '2026-11-16T00:00:00Z', finishedAt: '2026-11-16T00:00:01Z', durationMs: 25, errorDetail: null },
            },
          ],
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
              stepCount: 2,
              steps: [{ id: 'retrieve', agent: 'context-retriever', dependsOn: [] }, { id: 'summarize', agent: 'extractive-summarizer', dependsOn: ['retrieve'] }],
              lastJob: null,
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/runs')) {
      return new Response(
        JSON.stringify({
          ok: true,
          jobs: [{ id: 'job-99', kind: 'workflow', name: 'daily-digest', status: 'success', createdAt: '2026-11-16T00:00:00Z', startedAt: '2026-11-16T00:00:00Z', finishedAt: '2026-11-16T00:00:01Z', errorDetail: null }],
          agentRuns: [{ id: 'run-1', agentName: 'research-orchestrator', status: 'success', startedAt: '2026-11-16T00:00:00Z', finishedAt: '2026-11-16T00:00:01Z', durationMs: 25, errorDetail: null }],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/events')) {
      return new Response(JSON.stringify({ ok: true, count: 1, events: [] }), { status: 200 });
    }
    if (url.includes('/api/approvals/decide')) {
      decideCalls.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response(
        JSON.stringify({
          ok: true,
          approval: {
            id: 'apr-1',
            itemType: 'vault_promotion',
            itemId: 'insight-1',
            status: 'approved',
            proposer: 'research-orchestrator',
            approver: 'operator-x3lius',
            reason: 'Verified',
            createdAt: '2026-11-16T00:00:00Z',
            decidedAt: '2026-11-16T00:01:00Z',
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/approvals')) {
      return new Response(
        JSON.stringify({
          ok: true,
          count: 1,
          approvals: [
            {
              id: 'apr-1',
              itemType: 'vault_promotion',
              itemId: 'insight-1',
              status: 'pending',
              proposer: 'research-orchestrator',
              approver: null,
              reason: null,
              createdAt: '2026-11-16T00:00:00Z',
              decidedAt: null,
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/research')) {
      return new Response(
        JSON.stringify({
          ok: true,
          counts: { totalIntelligenceFiles: 40, totalMaterialFiles: 12, projects: 2, questions: 3, sources: 5, evidence: 4, findings: 3, contradictions: 1, experiments: 1, briefs: 4, specialists: 11 },
          projects: [], questions: [], sources: [], evidence: [], findings: [], contradictions: [], experiments: [],
          briefs: [{ vaultPath: '03_RESEARCH_INTELLIGENCE/00_Briefs/sample-brief.md', title: 'Sample Research Brief', docType: 'research_brief', status: 'live', tags: [], sha256: 'abc123', wikilinksCount: 1 }],
          recentRuns: [],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/records')) {
      return new Response(
        JSON.stringify({
          ok: true,
          counts: { totalRecordsFiles: 50, songs: 3, lyrics: 4, vocalDna: 2, sunoPrompts: 5, audioTakes: 3, releases: 1, rightsSplits: 2, catalogAssignments: 2, sessionsDaily: 4, recordAgents: 13 },
          songs: [{ vaultPath: '05_XYP3RN_RECORDS/06_X3LIUS_MUSIC_SYSTEM/00_Songs/neon.md', title: 'Neon Static', docType: 'song', status: 'live', tags: [], sha256: 'def456', wikilinksCount: 1 }],
          lyrics: [], vocalDna: [], sunoPrompts: [], audioTakes: [], releases: [], rightsSplits: [], catalogAssignments: [], sessionsDaily: [], recentRuns: [],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/vault/graph')) {
      return new Response(
        JSON.stringify({
          ok: true,
          sector: null,
          totalIndexed: 20354,
          nodeCount: 2,
          edgeCount: 1,
          nodes: [
            { id: '01_CORE/a.md', title: 'Node Alpha', sector: '01_CORE', domain: 'CORE', docType: 'agent', status: 'live', degree: 1 },
            { id: '03_RESEARCH_INTELLIGENCE/b.md', title: 'Node Beta', sector: '03_RESEARCH_INTELLIGENCE', domain: 'RESEARCH_INTELLIGENCE', docType: 'brief', status: 'live', degree: 1 },
          ],
          edges: [{ source: '01_CORE/a.md', target: '03_RESEARCH_INTELLIGENCE/b.md', rawTarget: 'Node Beta' }],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/vault/note')) {
      return new Response(
        JSON.stringify({
          ok: true,
          note: {
            vaultPath: '01_CORE/a.md',
            sector: '01_CORE',
            isCanonical: true,
            rawContent: '---\ntype: agent\n---\n\n# Live Vault Note\n\n#### Instructions\n\nLive content from Vault.',
            body: '# Live Vault Note\n\nLive content from Vault.',
            sha256: 'deadbeef1234',
            byteSize: 64,
          },
          links: { outgoing: [], backlinks: [] },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/vault/search')) {
      return new Response(
        JSON.stringify({
          ok: true,
          query: 'jarvis',
          count: 1,
          hits: [{ vaultPath: '01_CORE/02_Agents/Jarvis.md', sector: '01_CORE', title: 'Jarvis Operator', sha256: 'abc123', tags: ['core'] }],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ ok: false, error: 'not mocked' }), { status: 404 });
  }) as unknown as typeof fetch;

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, decideCalls };
}

describe('Phase 11 UI-xyp3rn Live Integration', () => {
  it('renders DashboardsView across Overview, Agents, Workflows, Approvals, Research, and Records tabs', async () => {
    const { decideCalls } = mockLiveGatewayFetch();
    render(
      <ChromeShell>
        <DashboardsView />
      </ChromeShell>,
    );

    expect(await screen.findByText('20354')).toBeInTheDocument();
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();

    // Agents tab
    await userEvent.click(screen.getByRole('tab', { name: 'AGENTS' }));
    expect(await screen.findByText('research-orchestrator')).toBeInTheDocument();

    // Workflows tab
    await userEvent.click(screen.getByRole('tab', { name: 'WORKFLOWS & RUNS' }));
    expect(await screen.findByText('retrieve-and-summarize')).toBeInTheDocument();

    // Approvals tab + Human Approve
    await userEvent.click(screen.getByRole('tab', { name: /APPROVALS/i }));
    expect(await screen.findByText('insight-1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'APPROVE' }));
    await waitFor(() => expect(decideCalls).toHaveLength(1));

    // Research & Entity Inspector dialog
    await userEvent.click(screen.getByRole('tab', { name: 'RESEARCH' }));
    await userEvent.click(await screen.findByText('Sample Research Brief'));
    expect(await screen.findByRole('dialog', { name: 'Entity Inspector' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close entity inspector' }));

    // Records tab
    await userEvent.click(screen.getByRole('tab', { name: 'RECORDS' }));
    expect(await screen.findByText('Neon Static')).toBeInTheDocument();
  });

  it('handles gateway failure state cleanly with retry action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Gateway down');
      }),
    );

    render(<DashboardsView />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Gateway down/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RETRY CONNECTION' })).toBeInTheDocument();
  });

  it('renders KnowledgeGraphView with interactive SVG topology, keyboard selection, and Entity Inspector', async () => {
    mockLiveGatewayFetch();
    render(<KnowledgeGraphView />);

    const nodeBtn = await screen.findByRole('button', { name: /Node Alpha, 01_CORE, 1 links/ });
    expect(nodeBtn).toBeInTheDocument();
    await userEvent.click(nodeBtn);
    expect(await screen.findByText(/Live content from Vault/i)).toBeInTheDocument();
  });

  it('loads live Vault Markdown into SkillViewer and SearchBar queries live Vault search', async () => {
    mockLiveGatewayFetch();
    const job = departments[0]!.jobs[1]!;
    render(<SkillViewer job={job} onClose={vi.fn()} />);
    expect(await screen.findByText(/Live content from Vault/i)).toBeInTheDocument();

    render(<SearchBar departments={departments} onHome={vi.fn()} onFly={vi.fn()} />);
    const searchInput = screen.getByRole('searchbox');
    await userEvent.type(searchInput, 'jarvis');
    const resultsList = await screen.findByRole('list', { name: 'Live Vault search results' });
    expect(within(resultsList).getByText('Jarvis Operator')).toBeInTheDocument();
  });
});
