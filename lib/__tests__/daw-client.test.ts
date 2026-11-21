import { describe, expect, it, vi } from 'vitest';
import {
  decideDawCommand,
  fetchDawOverview,
  grantDawPrepareLease,
  probeDawConnections,
  proposeDawCommand,
  rollbackDawCommand,
  runDawAgent,
  runDawEvaluation,
} from '@/lib/daw-client';
import { buildDawDemoFixtureOverview } from '@/lib/daw-demo-fixtures';

describe('daw-client OS3 Gateway API client & fixture isolation', () => {
  it('parses live /api/daw/overview and action responses from OS3 Gateway', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/daw/overview')) {
        return new Response(
          JSON.stringify({
            ok: true,
            generatedAt: '2026-11-21T07:00:00Z',
            dataSource: 'os3-gateway-live',
            isDemoFixture: false,
            connectionSummary: {
              state: 'disconnected',
              connectedSessions: 0,
              totalSessions: 0,
              activeSessionId: null,
              currentDaw: null,
              currentVersion: null,
              currentProject: null,
              lastObservedAt: null,
              freshness: 'unknown',
              stale: false,
              adaptersRegistered: 2,
              reachableInstances: 0,
            },
            hostProbes: [],
            adapters: [],
            discoveredInstances: [],
            sessions: [],
            capabilities: { available: [], unsupported: [], readOnlyCount: 0, mutableCount: 0 },
            activeOperations: [],
            pendingApprovals: [],
            executionHistory: [],
            sessionIntelligence: null,
            pluginBrain: { profiles: [], chainGraphs: [], chainReports: [] },
            audioBrain: { recentAnalyses: [] },
            agents: [],
            workflows: [],
            evaluation: null,
            events: [],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/daw/evaluate')) {
        return new Response(
          JSON.stringify({
            ok: true,
            evaluationScope: 'verified-fixtures-and-adapters',
            report: { evaluationId: 'eval-1', overallPassed: true, totalCases: 12, passedCases: 12, failedCases: 0, categories: [] },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, hostProbes: [], discoveredInstances: [], approvalId: 'apr-1', decision: 'approved', lease: { id: 'l1' }, result: {} }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const opts = { fetchImpl: fetchMock, baseUrl: 'http://127.0.0.1:8077' };
    const ov = await fetchDawOverview(opts);
    expect(ov.ok).toBe(true);
    expect(ov.data?.isDemoFixture).toBe(false);
    expect(ov.data?.connectionSummary.state).toBe('disconnected');

    expect((await probeDawConnections(opts)).ok).toBe(true);
    expect((await grantDawPrepareLease({ sessionId: 's1', grantedBy: 'blago-operator' }, opts)).ok).toBe(true);
    expect((await proposeDawCommand({ sessionId: 's1', kind: 'mixer.volume_pan_mute', capabilityId: 'daw.mixer.fader_pan_mute', targetRef: 'mixer:insert:1', params: { deltaDb: -1 } }, opts)).ok).toBe(true);
    expect((await decideDawCommand({ approvalId: 'apr-1', decision: 'approved', approver: 'blago-operator', reason: 'ok' }, opts)).ok).toBe(true);
    expect((await rollbackDawCommand({ receiptId: 'rcpt-1', actor: 'blago-operator', reason: 'revert' }, opts)).ok).toBe(true);
    expect((await runDawAgent({ agentName: 'daw-session-analyst', goal: 'audit', mode: 'analyze' }, opts)).ok).toBe(true);
    expect((await runDawEvaluation(opts)).data?.report.totalCases).toBe(12);
  });

  it('handles HTTP 403/500 & network offline errors cleanly without synthesizing live DAW data', async () => {
    const fetch403 = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'SELF_APPROVAL_FORBIDDEN' }), { status: 403 })) as unknown as typeof fetch;
    const denied = await decideDawCommand(
      { approvalId: 'apr-1', decision: 'approved', approver: 'agent:auto', reason: 'nope' },
      { fetchImpl: fetch403, baseUrl: 'http://127.0.0.1:8077' },
    );
    expect(denied.ok).toBe(false);
    expect(denied.statusCode).toBe(403);
    expect(denied.error).toContain('SELF_APPROVAL_FORBIDDEN');

    const netDown = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof fetch;
    const off = await fetchDawOverview({ fetchImpl: netDown, baseUrl: 'http://127.0.0.1:8077' });
    expect(off.ok).toBe(false);
    expect(off.mode).toBe('gateway-offline');
    expect(off.data).toBeNull();
  });

  it('explicitly tags demonstration fixtures so they can never be mistaken for live DAW state', () => {
    const freshDemo = buildDawDemoFixtureOverview('connected_fl_studio');
    expect(freshDemo.isDemoFixture).toBe(true);
    expect(freshDemo.dataSource).toBe('demonstration-fixture');
    expect(freshDemo.fixtureNotice).toContain('NOT LIVE DAW DATA');

    const staleDemo = buildDawDemoFixtureOverview('stale_drift');
    expect(staleDemo.connectionSummary.stale).toBe(true);
    expect(staleDemo.connectionSummary.freshness).toBe('stale');
  });
});
