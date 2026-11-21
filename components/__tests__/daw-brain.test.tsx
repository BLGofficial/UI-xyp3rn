import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChromeShell } from '@/components/ChromeShell';
import { DawBrainWorkspace } from '@/components/daw/DawBrainWorkspace';
import { buildDawDemoFixtureOverview } from '@/lib/daw-demo-fixtures';

vi.mock('next/navigation', () => ({
  usePathname: () => '/daw',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function buildLiveGatewayOverviewFixture(stale = false) {
  const base = buildDawDemoFixtureOverview(stale ? 'stale_drift' : 'connected_fl_studio');
  return {
    ...base,
    dataSource: 'os3-gateway-live' as const,
    isDemoFixture: false as const,
    fixtureNotice: undefined,
    connectionSummary: {
      ...base.connectionSummary,
      currentDaw: 'FL Studio 2025 Producer Edition',
      currentVersion: '24.2.1.4501',
      currentProject: 'Live_Session_Studio_v2.flp',
    },
  };
}

describe('Phase 21 — XYP3RN DAW Brain Constellation UI Integration', () => {
  it('preserves Constellation ChromeShell navigation with /daw pill and traverses all 12 DAW Brain interface areas cleanly', async () => {
    const livePayload = buildLiveGatewayOverviewFixture(false);
    const decideCalls: unknown[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/daw/overview')) {
        return new Response(JSON.stringify(livePayload), { status: 200 });
      }
      if (url.includes('/api/daw/commands/decide')) {
        decideCalls.push(JSON.parse(String(init?.body ?? '{}')));
        return new Response(JSON.stringify({ ok: true, approvalId: 'apr-demo-mix-1', decision: 'approved', executionResult: { ok: true } }), { status: 200 });
      }
      if (url.includes('/api/daw/agents/run')) {
        return new Response(
          JSON.stringify({
            ok: true,
            selectedAgent: 'daw-operator',
            agentClass: 'Execution',
            domain: 'TECH',
            mode: 'analyze',
            toolsInvoked: ['daw_session_analyze'],
            findings: ['Verified live FL Studio session graph'],
            recommendations: [],
            evidence: [],
            limitations: [],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/daw/evaluate')) {
        return new Response(JSON.stringify({ ok: true, evaluationScope: 'verified-fixtures-and-adapters', report: livePayload.evaluation }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    vi.stubGlobal('fetch', fetchMock);

    render(
      <ChromeShell>
        <DawBrainWorkspace />
      </ChromeShell>,
    );

    // Preserved Constellation top nav bar includes MAP, DASHBOARDS, CHART, and DAW
    const nav = screen.getByRole('navigation', { name: 'Views' });
    expect(within(nav).getByRole('link', { name: 'MAP' })).toHaveAttribute('href', '/map');
    expect(within(nav).getByRole('link', { name: 'DASHBOARDS' })).toHaveAttribute('href', '/dashboards');
    expect(within(nav).getByRole('link', { name: 'CHART' })).toHaveAttribute('href', '/chart');
    expect(within(nav).getByRole('link', { name: 'DAW' })).toHaveAttribute('aria-current', 'page');

    // Area 1: Overview shows live header, DAW & version, project, freshness, and separated Available vs Unsupported capabilities
    expect(await screen.findByRole('heading', { level: 1, name: 'Live_Session_Studio_v2.flp' })).toBeInTheDocument();
    expect(screen.getByText('OS3 GATEWAY LIVE')).toBeInTheDocument();
    expect(screen.getAllByText('OBSERVATION · READ-ONLY').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('daw.audio.destructive_process')).toBeInTheDocument();

    // Area 2 & 3: Connections & Sessions
    await userEvent.click(screen.getByRole('tab', { name: '2. CONNECTIONS' }));
    expect(screen.getByText('2. DAW Connections & Host Discovery')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '3. SESSIONS' }));
    expect(screen.getByText(/3\. Active Sessions/)).toBeInTheDocument();

    // Area 4 & 5: Session Explorer & Track/Routing Inspector
    await userEvent.click(screen.getByRole('tab', { name: '4. EXPLORER' }));
    expect(screen.getByText('128 BPM')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '5. ROUTING' }));
    expect(screen.getByText('5. Track & Mixer Inspector')).toBeInTheDocument();
    expect(screen.getByText(/mix-5 → mix-0/)).toBeInTheDocument();

    // Area 6: Plugin Brain (edition restrictions clearly separated)
    await userEvent.click(screen.getByRole('tab', { name: '6. PLUGINS' }));
    expect(screen.getByText('Fruity Parametric EQ 2')).toBeInTheDocument();
    expect(screen.getByText('NewTime')).toBeInTheDocument();
    expect(screen.getAllByText('excluded_by_edition').length).toBeGreaterThanOrEqual(1);

    // Area 7: Audio Brain (DSP + explicitly labeled probabilistic MIR)
    await userEvent.click(screen.getByRole('tab', { name: '7. AUDIO BRAIN' }));
    expect(screen.getByText('-10.1 LUFS')).toBeInTheDocument();
    expect(screen.getByText(/PROBABILISTIC MIR ESTIMATES/i)).toBeInTheDocument();

    // Area 8: DAW Agent Console + dispatch
    await userEvent.click(screen.getByRole('tab', { name: '8. AGENTS' }));
    await userEvent.click(screen.getByRole('button', { name: /DISPATCH DAW AGENT/i }));
    expect(await screen.findByText(/Verified live FL Studio session graph/)).toBeInTheDocument();

    // Area 9: Production Workflows
    await userEvent.click(screen.getByRole('tab', { name: '9. WORKFLOWS' }));
    expect(screen.getByText('DAW Session Audit Workflow')).toBeInTheDocument();

    // Area 10: Command Approval Queue (safe visual separation & dangerous confirmation gate)
    await userEvent.click(screen.getByRole('tab', { name: '10. APPROVALS' }));
    const dangerBtn = screen.getByRole('button', { name: 'APPROVE & EXECUTE DANGEROUS ACTION' });
    expect(dangerBtn).toBeDisabled(); // Requires explicit confirmation checkbox!

    const dangerCheckbox = screen.getByRole('checkbox');
    await userEvent.click(dangerCheckbox);
    expect(dangerBtn).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'APPROVE & EXECUTE' }));
    await waitFor(() => expect(decideCalls).toHaveLength(1));

    // Area 11: Execution History
    await userEvent.click(screen.getByRole('tab', { name: '11. EXECUTION' }));
    expect(screen.getByText('rcpt-demo-001', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ROLLBACK/ })).toBeEnabled();

    // Area 12: Evaluation & Diagnostics
    await userEvent.click(screen.getByRole('tab', { name: '12. EVAL & DIAG' }));
    expect(screen.getByText('BASELINE PASS')).toBeInTheDocument();
  });

  it('shows honest disconnected state when OS3 Gateway is offline without fabricating live data, and labels demo fixtures clearly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:8077');
      }),
    );

    render(<DawBrainWorkspace />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/ECONNREFUSED 127\.0\.0\.1:8077/)).toBeInTheDocument();
    expect(screen.getAllByText('DISCONNECTED').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('GATEWAY OFFLINE')).toBeInTheDocument();
    expect(screen.getByText('No Active DAW Project Connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RETRY CONNECTION' })).toBeInTheDocument();

    // Explicitly opting into Demo Fixture displays unmissable DEMONSTRATION FIXTURE notice
    await userEvent.click(screen.getByRole('button', { name: 'LOAD DEMO FIXTURE' }));
    expect(screen.getByText('DEMONSTRATION FIXTURE')).toBeInTheDocument();
    expect(screen.getByText(/DEMONSTRATION FIXTURE — NOT LIVE DAW DATA/i)).toBeInTheDocument();
  });

  it('prominently warns on stale DAW observations and backend error rejections', async () => {
    const stalePayload = buildLiveGatewayOverviewFixture(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/daw/overview')) {
          return new Response(JSON.stringify(stalePayload), { status: 200 });
        }
        if (url.includes('/api/daw/commands/decide')) {
          return new Response(
            JSON.stringify({ ok: false, error: 'SELF_APPROVAL_FORBIDDEN: Agent cannot approve command' }),
            { status: 403 },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    render(<DawBrainWorkspace />);
    expect(await screen.findByText(/STALE STATE DETECTED/i)).toBeInTheDocument();
    expect(screen.getAllByText('STALE · STALE').length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByRole('tab', { name: '10. APPROVALS' }));
    await userEvent.click(screen.getByRole('button', { name: 'APPROVE & EXECUTE' }));
    expect(await screen.findByText(/SELF_APPROVAL_FORBIDDEN/i)).toBeInTheDocument();
  });
});
