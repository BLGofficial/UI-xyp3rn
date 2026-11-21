'use client';

import { AlertTriangle, Disc3, FlaskConical, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  connectDawSession,
  decideDawCommand,
  fetchDawOverview,
  grantDawPrepareLease,
  probeDawConnections,
  proposeDawCommand,
  refreshDawSession,
  rollbackDawCommand,
  runDawAgent,
  runDawEvaluation,
  runDawWorkflow,
} from '@/lib/daw-client';
import { buildDawDemoFixtureOverview } from '@/lib/daw-demo-fixtures';
import type { DawAgentRunResultView, DawOverviewPayload } from '@/lib/daw-types';
import { DawAgentsAndWorkflowsPanel } from './DawAgentsAndWorkflowsPanel';
import { DawCommandSafetyPanel } from './DawCommandSafetyPanel';
import { DawOverviewAndConnectionsPanel } from './DawOverviewAndConnectionsPanel';
import { DawPluginAndAudioBrainPanel } from './DawPluginAndAudioBrainPanel';
import { DawSessionAndRoutingPanel } from './DawSessionAndRoutingPanel';
import { DawStatusPill, FreshnessBadge } from './daw-ui-helpers';

export type DawSectionTab =
  | 'overview'
  | 'connections'
  | 'sessions'
  | 'explorer'
  | 'routing'
  | 'plugins'
  | 'audio'
  | 'agents'
  | 'workflows'
  | 'approvals'
  | 'history'
  | 'evaluation';

const DAW_TABS: Array<{ id: DawSectionTab; label: string }> = [
  { id: 'overview', label: '1. OVERVIEW' },
  { id: 'connections', label: '2. CONNECTIONS' },
  { id: 'sessions', label: '3. SESSIONS' },
  { id: 'explorer', label: '4. EXPLORER' },
  { id: 'routing', label: '5. ROUTING' },
  { id: 'plugins', label: '6. PLUGINS' },
  { id: 'audio', label: '7. AUDIO BRAIN' },
  { id: 'agents', label: '8. AGENTS' },
  { id: 'workflows', label: '9. WORKFLOWS' },
  { id: 'approvals', label: '10. APPROVALS' },
  { id: 'history', label: '11. EXECUTION' },
  { id: 'evaluation', label: '12. EVAL & DIAG' },
];

function buildOfflinePlaceholderPayload(): DawOverviewPayload {
  return {
    ok: false,
    generatedAt: new Date().toISOString(),
    dataSource: 'gateway-offline',
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
      adaptersRegistered: 0,
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
  };
}

export function DawBrainWorkspace() {
  const [activeTab, setActiveTab] = useState<DawSectionTab>('overview');
  const [liveData, setLiveData] = useState<DawOverviewPayload | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<'off' | 'connected_fl_studio' | 'stale_drift'>('off');
  const [loading, setLoading] = useState(true);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadLiveOverview = useCallback(async () => {
    setLoading(true);
    setGatewayError(null);
    const res = await fetchDawOverview();
    if (!res.ok || !res.data) {
      setLiveData(null);
      setGatewayError(res.error ?? 'OS3 DAW Gateway unreachable.');
    } else {
      setLiveData(res.data);
      if (res.data.connectionSummary.activeSessionId) {
        setSelectedSessionId((prev) => prev ?? res.data!.connectionSummary.activeSessionId);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLiveOverview();
  }, [loadLiveOverview]);

  const effectiveData: DawOverviewPayload = useMemo(() => {
    if (demoMode !== 'off') return buildDawDemoFixtureOverview(demoMode);
    return liveData ?? buildOfflinePlaceholderPayload();
  }, [demoMode, liveData]);

  const activeSession = useMemo(() => {
    const id = selectedSessionId ?? effectiveData.connectionSummary.activeSessionId;
    return effectiveData.sessions.find((s) => s.sessionId === id) ?? effectiveData.sessions[0] ?? null;
  }, [effectiveData, selectedSessionId]);

  const handleProbe = async () => {
    setBusyAction('probe');
    const res = await probeDawConnections();
    setActionFeedback({ ok: res.ok, message: res.ok ? 'Host discovery refreshed.' : (res.error ?? 'Probe failed') });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const handleConnect = async (adapterId: string) => {
    setBusyAction(`connect:${adapterId}`);
    const res = await connectDawSession({ adapterId, actor: 'operator:UI-xyp3rn' });
    setActionFeedback({ ok: res.ok, message: res.ok ? `Connected ${adapterId} read-only.` : (res.error ?? 'Connect failed') });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const handleRefreshSession = async (sessionId: string) => {
    setBusyAction(`refresh:${sessionId}`);
    const res = await refreshDawSession(sessionId);
    setActionFeedback({ ok: res.ok, message: res.ok ? `Refreshed session ${sessionId}.` : (res.error ?? 'Refresh failed') });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const handleGrantPrepareLease = async (sessionId: string) => {
    setBusyAction(`lease:${sessionId}`);
    const res = await grantDawPrepareLease({ sessionId, grantedBy: 'blago-operator' });
    setActionFeedback({
      ok: res.ok,
      message: res.ok ? `Prepare lease ${res.data?.lease.id} granted.` : (res.error ?? 'Lease denied'),
    });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const handleRunAgent = async (input: {
    agentName: string;
    goal: string;
    mode: 'analyze' | 'recommend' | 'prepare';
    sessionId?: string;
  }): Promise<DawAgentRunResultView | null> => {
    setBusyAction('agent:run');
    const res = await runDawAgent(input);
    setActionFeedback({
      ok: res.ok,
      message: res.ok ? `Agent ${input.agentName} completed (${input.mode}).` : (res.error ?? 'Agent dispatch failed'),
    });
    await loadLiveOverview();
    setBusyAction(null);
    return res.data;
  };

  const handleRunWorkflow = async (input: { workflowId: string; sessionId?: string }) => {
    setBusyAction(`wf:${input.workflowId}`);
    const res = await runDawWorkflow(input);
    setActionFeedback({
      ok: res.ok,
      message: res.ok
        ? `Workflow ${input.workflowId} completed (${res.data?.result.status}).`
        : (res.error ?? 'Workflow execution failed'),
    });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const handlePropose = async (input: {
    sessionId: string;
    kind: string;
    capabilityId: string;
    targetRef: string;
    params: Record<string, unknown>;
  }) => {
    setBusyAction('propose');
    const res = await proposeDawCommand({ ...input, proposer: 'operator:UI-xyp3rn' });
    setActionFeedback({
      ok: res.ok,
      message: res.ok ? `Queued dry-run approval ${res.data?.approvalId}.` : (res.error ?? 'Proposal failed'),
    });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const handleDecide = async (input: {
    approvalId: string;
    decision: 'approved' | 'rejected';
    approver: string;
    reason: string;
    confirmDangerous: boolean;
  }) => {
    setBusyAction(`decide:${input.approvalId}`);
    const res = await decideDawCommand(input);
    setActionFeedback({
      ok: res.ok,
      message: res.ok
        ? `Command ${input.approvalId} ${input.decision}.`
        : (res.error ?? 'Approval decision rejected'),
    });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const handleRollback = async (input: { receiptId: string; actor: string; reason: string }) => {
    setBusyAction(`rollback:${input.receiptId}`);
    const res = await rollbackDawCommand(input);
    setActionFeedback({
      ok: res.ok,
      message: res.ok ? `Rolled back ${input.receiptId}.` : (res.error ?? 'Rollback failed'),
    });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const handleRunEval = async () => {
    setBusyAction('eval');
    const res = await runDawEvaluation();
    setActionFeedback({
      ok: res.ok,
      message: res.ok
        ? `Benchmark passed ${res.data?.report.passedCases}/${res.data?.report.totalCases} cases.`
        : (res.error ?? 'Evaluation failed'),
    });
    await loadLiveOverview();
    setBusyAction(null);
  };

  const cs = effectiveData.connectionSummary;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-20 pt-20 sm:px-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Disc3 size={18} className="text-s05_records" aria-hidden="true" />
                <span className="micro text-s05_records">XYP3RN DAW BRAIN · CONSTELLATION INTEGRATION</span>
                <DawStatusPill tone={cs.state === 'connected' ? 'ok' : cs.state === 'degraded' ? 'warn' : 'danger'}>
                  {cs.state.toUpperCase()}
                </DawStatusPill>
                <FreshnessBadge freshness={cs.freshness} stale={cs.stale} />
                {effectiveData.isDemoFixture ? (
                  <DawStatusPill tone="warn">DEMONSTRATION FIXTURE</DawStatusPill>
                ) : (
                  <DawStatusPill tone={effectiveData.dataSource === 'os3-gateway-live' ? 'ok' : 'neutral'}>
                    {effectiveData.dataSource === 'os3-gateway-live' ? 'OS3 GATEWAY LIVE' : 'GATEWAY OFFLINE'}
                  </DawStatusPill>
                )}
              </div>
              <h1 className="mt-2 font-serif text-2xl text-ink sm:text-3xl">
                {cs.currentProject ?? 'No Active DAW Project Connected'}
              </h1>
              <p className="mt-1 font-mono text-xs text-ink-dim">
                DAW: {cs.currentDaw ?? 'disconnected'} · Version: {cs.currentVersion ?? 'n/a'} · Observed: {cs.lastObservedAt ?? 'never'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadLiveOverview()}
                disabled={loading}
                className="chip inline-flex items-center gap-1.5 hover:border-white/30"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                REFRESH OS3 API
              </button>
              <button
                type="button"
                onClick={() => setDemoMode((m) => (m === 'off' ? 'connected_fl_studio' : 'off'))}
                className={`chip inline-flex items-center gap-1.5 ${
                  demoMode !== 'off' ? 'border-amber-400/50 bg-amber-500/15 text-amber-100' : 'hover:border-white/30'
                }`}
              >
                <FlaskConical size={12} aria-hidden="true" />
                {demoMode === 'off' ? 'LOAD DEMO FIXTURE' : 'EXIT DEMO FIXTURE'}
              </button>
              {demoMode !== 'off' && (
                <button
                  type="button"
                  onClick={() => setDemoMode((m) => (m === 'stale_drift' ? 'connected_fl_studio' : 'stale_drift'))}
                  className="chip border-amber-400/40 text-amber-100"
                >
                  {demoMode === 'stale_drift' ? 'SWITCH DEMO: FRESH' : 'SIMULATE STALE DRIFT'}
                </button>
              )}
            </div>
          </div>

          {effectiveData.isDemoFixture && (
            <div
              role="note"
              className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/45 bg-amber-500/15 px-3.5 py-2.5 font-mono text-xs text-amber-100"
            >
              <FlaskConical size={15} className="shrink-0 text-amber-300" aria-hidden="true" />
              <span>{effectiveData.fixtureNotice}</span>
            </div>
          )}

          {gatewayError && demoMode === 'off' && (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/12 px-3.5 py-2.5 text-xs text-rose-100"
            >
              <div className="flex items-center gap-2 font-mono">
                <AlertTriangle size={15} className="shrink-0 text-rose-300" aria-hidden="true" />
                <span>OS3 Gateway Unavailable: {gatewayError}. Disconnected state shown honestly without mock substitution.</span>
              </div>
              <button type="button" onClick={() => void loadLiveOverview()} className="chip border-rose-400/40 text-rose-100">
                RETRY CONNECTION
              </button>
            </div>
          )}

          {cs.stale && (
            <div
              role="status"
              className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/12 px-3.5 py-2 font-mono text-xs text-amber-100"
            >
              <ShieldAlert size={15} className="shrink-0 text-amber-300" aria-hidden="true" />
              <span>STALE STATE DETECTED: Live DAW state may have drifted since {cs.lastObservedAt}; refresh observation before executing commands.</span>
            </div>
          )}

          {actionFeedback && (
            <div
              role="status"
              className={`mt-3 rounded-xl border px-3.5 py-2 font-mono text-xs ${
                actionFeedback.ok
                  ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-100'
                  : 'border-rose-500/45 bg-rose-500/15 text-rose-100'
              }`}
            >
              {actionFeedback.message}
            </div>
          )}
        </header>

        <nav
          aria-label="DAW Brain sections"
          role="tablist"
          className="frost flex gap-1.5 overflow-x-auto rounded-2xl p-1.5"
        >
          {DAW_TABS.map((t) => {
            const selected = activeTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActiveTab(t.id)}
                className={`micro shrink-0 whitespace-nowrap rounded-xl px-3 py-2 transition ${
                  selected ? 'bg-ink font-bold text-bg' : 'text-ink-dim hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {(activeTab === 'overview' || activeTab === 'connections' || activeTab === 'sessions') && (
          <DawOverviewAndConnectionsPanel
            data={effectiveData}
            areaFilter={activeTab}
            selectedSessionId={activeSession?.sessionId ?? null}
            onSelectSession={setSelectedSessionId}
            onProbeHosts={() => void handleProbe()}
            onConnectAdapter={(adapterId) => void handleConnect(adapterId)}
            onRefreshSession={(sid) => void handleRefreshSession(sid)}
            onGrantPrepareLease={(sid) => void handleGrantPrepareLease(sid)}
            busyAction={busyAction}
          />
        )}

        {(activeTab === 'explorer' || activeTab === 'routing') && (
          <DawSessionAndRoutingPanel
            data={effectiveData}
            activeSession={activeSession}
            areaFilter={activeTab}
          />
        )}

        {(activeTab === 'plugins' || activeTab === 'audio') && (
          <DawPluginAndAudioBrainPanel
            data={effectiveData}
            areaFilter={activeTab}
          />
        )}

        {(activeTab === 'agents' || activeTab === 'workflows') && (
          <DawAgentsAndWorkflowsPanel
            data={effectiveData}
            activeSession={activeSession}
            areaFilter={activeTab}
            onRunAgent={handleRunAgent}
            onRunWorkflow={handleRunWorkflow}
            busyAction={busyAction}
          />
        )}

        {(activeTab === 'approvals' || activeTab === 'history' || activeTab === 'evaluation') && (
          <DawCommandSafetyPanel
            data={effectiveData}
            activeSession={activeSession}
            areaFilter={activeTab}
            onProposeCommand={handlePropose}
            onDecideApproval={handleDecide}
            onRollbackReceipt={handleRollback}
            onRunEvaluation={handleRunEval}
            busyAction={busyAction}
          />
        )}
      </div>
    </div>
  );
}
