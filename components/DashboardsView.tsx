'use client';

import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  FileText,
  FlaskConical,
  GitBranch,
  Layers,
  Music,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSeedDashboardBundle } from '@/lib/dashboard-seed';
import {
  decideGatewayApprovalDetailed,
  decideJarvisProposal,
  dispatchJarvis,
  fetchGatewayHealth,
  fetchVaultNote,
} from '@/lib/gateway';
import {
  executeRegisteredAgent,
  executeWorkflowDefinition,
  fetchAgentRegistry,
  fetchApprovalsByStatus,
  fetchCoreModulesOverview,
  fetchDiagnosticsOverview,
  fetchGovernanceOverview,
  fetchRecordsOverview,
  fetchResearchOverview,
  fetchRuntimeEvents,
  fetchSystemOverview,
  fetchVaultTree,
  fetchWorkflowRegistry,
} from '@/lib/os3-adapter';
import { SECTOR_COLORS } from '@/lib/tokens';
import type {
  DepartmentId,
  GatewayApprovalItem,
  GatewayHealthSnapshot,
  Os3AgentSummary,
  Os3CoreModulesOverview,
  Os3DiagnosticsOverview,
  Os3DomainEntrySummary,
  Os3GovernanceOverview,
  Os3RecordsOverview,
  Os3ResearchOverview,
  Os3RuntimeEventRecord,
  Os3SystemOverview,
  Os3VaultTreeResponse,
  Os3WorkflowSummary,
  VaultNotePayload,
} from '@/lib/types';
import { Os3CoreModulesAndVaultPanel } from './os3/Os3CoreModulesAndVaultPanel';
import { Os3DiagnosticsPanel, Os3GovernancePanel } from './os3/Os3GovernanceAndDiagnosticsPanel';

type DashboardTab =
  | 'overview'
  | 'core-vault'
  | 'agents'
  | 'workflows'
  | 'approvals'
  | 'research'
  | 'records'
  | 'governance'
  | 'diagnostics';

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: 'overview', label: 'SYSTEM OVERVIEW' },
  { id: 'core-vault', label: 'CORE & VAULT' },
  { id: 'agents', label: 'AGENTS' },
  { id: 'workflows', label: 'WORKFLOWS & RUNS' },
  { id: 'approvals', label: 'APPROVALS' },
  { id: 'research', label: 'RESEARCH' },
  { id: 'records', label: 'RECORDS' },
  { id: 'governance', label: 'GOVERNANCE & EVENTS' },
  { id: 'diagnostics', label: 'DIAGNOSTICS' },
];

const CARD = 'glass-card rounded-2xl p-4 sm:p-5';

function uniqueEntries(items: Os3DomainEntrySummary[]): Os3DomainEntrySummary[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.vaultPath)) return false;
    seen.add(item.vaultPath);
    return true;
  });
}

function statusTone(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'success' || s === 'approved' || s === 'live' || s === 'canonical' || s === 'released') {
    return 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200';
  }
  if (s === 'running' || s === 'pending' || s === 'queued' || s === 'in-development') {
    return 'border-amber-400/40 bg-amber-500/12 text-amber-200';
  }
  if (s === 'error' || s === 'rejected' || s === 'failed') {
    return 'border-rose-400/40 bg-rose-500/12 text-rose-200';
  }
  return 'border-white/15 bg-white/5 text-ink-dim';
}

function SectorDistributionBar({ sector, count, maxCount }: { sector: string; count: number; maxCount: number }) {
  const color = SECTOR_COLORS[sector as DepartmentId] ?? '#9B8CFF';
  const pct = maxCount > 0 ? Math.max(6, Math.round((count / maxCount) * 100)) : 0;
  return (
    <div className="group flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.025] p-3 transition hover:border-white/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          />
          <span className="truncate font-mono text-xs text-ink">{sector}</span>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-ink">{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
        />
      </div>
    </div>
  );
}

export function DashboardsView() {
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [permissionDeniedError, setPermissionDeniedError] = useState<string | null>(null);
  const [isSeedMode, setIsSeedMode] = useState(false);

  const [overview, setOverview] = useState<Os3SystemOverview | null>(null);
  const [health, setHealth] = useState<GatewayHealthSnapshot | null>(null);
  const [approvals, setApprovals] = useState<GatewayApprovalItem[]>([]);
  const [agents, setAgents] = useState<Os3AgentSummary[]>([]);
  const [workflows, setWorkflows] = useState<Os3WorkflowSummary[]>([]);
  const [research, setResearch] = useState<Os3ResearchOverview | null>(null);
  const [records, setRecords] = useState<Os3RecordsOverview | null>(null);
  const [modules, setModules] = useState<Os3CoreModulesOverview | null>(null);
  const [vaultTree, setVaultTree] = useState<Os3VaultTreeResponse | null>(null);
  const [governance, setGovernance] = useState<Os3GovernanceOverview | null>(null);
  const [diagnostics, setDiagnostics] = useState<Os3DiagnosticsOverview | null>(null);
  const [runtimeEvents, setRuntimeEvents] = useState<Os3RuntimeEventRecord[]>([]);

  const [agentRunName, setAgentRunName] = useState('');
  const [agentRunGoal, setAgentRunGoal] = useState('Verify Vault readiness and summarize findings');
  const [agentRunMode, setAgentRunMode] = useState<'analyze' | 'execute'>('analyze');
  const [workflowInputsRaw, setWorkflowInputsRaw] = useState('{"query":"architecture"}');

  const [filterText, setFilterText] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<{ ok: boolean; title: string; detail: string } | null>(null);

  const [inspectedPath, setInspectedPath] = useState<string | null>(null);
  const [inspectedNote, setInspectedNote] = useState<VaultNotePayload | null>(null);
  const [inspectedLoading, setInspectedLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setGatewayError(null);
    setPermissionDeniedError(null);

    try {
      const [ovRes, hlRes, apRes, agRes, wfRes, rsRes, rcRes, modRes, treeRes, govRes, diagRes, evRes] = await Promise.all([
        fetchSystemOverview(),
        fetchGatewayHealth(),
        fetchApprovalsByStatus(),
        fetchAgentRegistry(),
        fetchWorkflowRegistry(),
        fetchResearchOverview(),
        fetchRecordsOverview(),
        fetchCoreModulesOverview(),
        fetchVaultTree({ limit: 200 }),
        fetchGovernanceOverview(),
        fetchDiagnosticsOverview(),
        fetchRuntimeEvents(80),
      ]);

      const seed = buildSeedDashboardBundle();
      const deniedRes = [ovRes, apRes, agRes, wfRes, rsRes, rcRes, modRes, treeRes, govRes, diagRes, evRes].find(
        (r) => r.statusKind === 'permission-denied',
      );
      if (deniedRes) {
        setPermissionDeniedError(deniedRes.error ?? 'Access denied by OS3 Gateway policy.');
      }

      if (!ovRes.ok || !ovRes.data) {
        setGatewayError(ovRes.error ?? 'OS3 Gateway unreachable.');
        setIsSeedMode(true);
        setOverview(seed.overview);
        setAgents(agRes.ok && agRes.data ? agRes.data.agents : seed.agents);
        setWorkflows(wfRes.ok && wfRes.data ? wfRes.data.workflows : seed.workflows);
        setResearch(rsRes.ok && rsRes.data ? rsRes.data : seed.research);
        setRecords(rcRes.ok && rcRes.data ? rcRes.data : seed.records);
        setApprovals(apRes.ok && apRes.data ? apRes.data.approvals : []);
        setModules(modRes.ok && modRes.data ? modRes.data : null);
        setVaultTree(treeRes.ok && treeRes.data ? treeRes.data : null);
        setGovernance(govRes.ok && govRes.data ? govRes.data : null);
        setDiagnostics(diagRes.ok && diagRes.data ? diagRes.data : null);
        setRuntimeEvents(evRes.ok && evRes.data ? evRes.data.events : []);
      } else {
        setIsSeedMode(false);
        setOverview(ovRes.data);
        setHealth(hlRes.mode === 'live-gateway' ? hlRes : null);
        setApprovals(apRes.ok && apRes.data ? apRes.data.approvals : ovRes.data.pendingApprovalsList ?? []);
        setAgents(agRes.ok && agRes.data ? agRes.data.agents : seed.agents);
        setWorkflows(wfRes.ok && wfRes.data ? wfRes.data.workflows : seed.workflows);
        setResearch(rsRes.ok && rsRes.data ? rsRes.data : seed.research);
        setRecords(rcRes.ok && rcRes.data ? rcRes.data : seed.records);
        setModules(modRes.ok && modRes.data ? modRes.data : null);
        setVaultTree(treeRes.ok && treeRes.data ? treeRes.data : null);
        setGovernance(govRes.ok && govRes.data ? govRes.data : null);
        setDiagnostics(diagRes.ok && diagRes.data ? diagRes.data : null);
        setRuntimeEvents(evRes.ok && evRes.data ? evRes.data.events : ovRes.data.recentEvents ?? []);
      }
    } catch (err) {
      const seed = buildSeedDashboardBundle();
      setGatewayError((err as Error).message || 'Failed to load OS3 Dashboard telemetry.');
      setIsSeedMode(true);
      setOverview(seed.overview);
      setAgents(seed.agents);
      setWorkflows(seed.workflows);
      setResearch(seed.research);
      setRecords(seed.records);
      setApprovals([]);
      setModules(null);
      setVaultTree(null);
      setGovernance(null);
      setDiagnostics(null);
      setRuntimeEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll, refreshTick]);

  const openEntityInspector = async (vaultPath: string) => {
    setInspectedPath(vaultPath);
    setInspectedNote(null);
    setInspectedLoading(true);
    try {
      const note = await fetchVaultNote(vaultPath);
      setInspectedNote(note);
    } finally {
      setInspectedLoading(false);
    }
  };

  const handleDecideApproval = async (approval: GatewayApprovalItem, decision: 'approved' | 'rejected') => {
    setActionBusyId(approval.id);
    try {
      if (approval.itemType === 'jarvis_change_proposal') {
        const res = await decideJarvisProposal({
          proposalId: approval.id,
          decision,
          approver: 'operator:UI-xyp3rn',
          reason: 'Dashboard governance decision',
        });
        if (res?.ok) {
          setApprovals((prev) =>
            prev.map((a) =>
              a.id === approval.id ? { ...a, status: decision, decidedAt: new Date().toISOString() } : a,
            ),
          );
          setCommandStatus({
            ok: true,
            title: decision === 'approved' ? 'Proposal Applied & Approved' : 'Proposal Declined',
            detail: res.message,
          });
          setRefreshTick((t) => t + 1);
        } else {
          setCommandStatus({
            ok: false,
            title: 'Proposal Decision Failed',
            detail: 'Could not reach /api/jarvis/proposal/decide on OS3 Gateway.',
          });
        }
      } else {
        const res = await decideGatewayApprovalDetailed({
          approvalId: approval.id,
          decision,
          approver: 'operator:UI-xyp3rn',
          reason: 'Dashboard governance decision',
        });
        if (res.ok && res.data?.approval) {
          const updated = res.data.approval;
          setApprovals((prev) => prev.map((a) => (a.id === approval.id ? updated : a)));
          setCommandStatus({
            ok: true,
            title: decision === 'approved' ? 'Governance Approval Confirmed' : 'Governance Request Rejected',
            detail: `${approval.itemId} (${approval.itemType}) updated cleanly.`,
          });
          setRefreshTick((t) => t + 1);
        } else {
          setCommandStatus({
            ok: false,
            title: res.statusKind === 'permission-denied' ? 'PERMISSION DENIED (403)' : 'Governance Decision Failed',
            detail: res.error ?? 'Could not reach /api/approvals/decide on OS3 Gateway.',
          });
        }
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDispatchCommand = async (id: string, label: string, prompt: string) => {
    setActionBusyId(id);
    try {
      const res = await dispatchJarvis({
        prompt,
        engine: 'claude-code-cli',
        activeSector: '01_CORE',
        selectedJobId: null,
      });
      setCommandStatus({
        ok: res.ok,
        title: `${label} (${res.exchange.mode})`,
        detail: res.exchange.reply,
      });
      if (res.exchange.mode === 'live-gateway') {
        setRefreshTick((t) => t + 1);
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleExecuteRegisteredAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetName = agentRunName || agents[0]?.name || '';
    if (!targetName) return;
    setActionBusyId('agent-console-exec');
    try {
      const res = await executeRegisteredAgent({
        agentName: targetName,
        goal: agentRunGoal,
        mode: agentRunMode,
      });
      if (res.ok && res.data) {
        setCommandStatus({
          ok: true,
          title: `Agent Executed · ${res.data.output.agent}`,
          detail: `${res.data.output.summary} (Run ID: ${res.data.run.id})`,
        });
        setRefreshTick((t) => t + 1);
      } else {
        setCommandStatus({
          ok: false,
          title: res.statusKind === 'permission-denied' ? 'PERMISSION DENIED (403)' : 'Agent Execution Failed',
          detail: res.error ?? 'Could not execute agent via OS3 Gateway.',
        });
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRunWorkflowApi = async (workflowName: string) => {
    setActionBusyId(`wf-api:${workflowName}`);
    try {
      let parsedInputs: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(workflowInputsRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedInputs = parsed as Record<string, unknown>;
        }
      } catch {
        setCommandStatus({ ok: false, title: 'Invalid Workflow Inputs JSON', detail: 'Provide valid JSON object for workflow inputs.' });
        return;
      }
      const res = await executeWorkflowDefinition({ workflowName, inputs: parsedInputs });
      if (res.ok && res.data) {
        setCommandStatus({
          ok: true,
          title: `Workflow Job Completed · ${res.data.job.name}`,
          detail: `Job ${res.data.job.id} ran ${res.data.steps.length} steps (${res.data.job.status}).`,
        });
        setRefreshTick((t) => t + 1);
      } else {
        setCommandStatus({
          ok: false,
          title: 'Workflow Execution Rejected',
          detail: res.error ?? 'Workflow execution failed via /api/workflows/run.',
        });
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const pendingApprovals = useMemo(() => approvals.filter((a) => a.status === 'pending'), [approvals]);
  const needle = filterText.trim().toLowerCase();

  const filteredAgents = useMemo(() => {
    if (!needle) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(needle) ||
        a.domain.toLowerCase().includes(needle) ||
        a.role.toLowerCase().includes(needle),
    );
  }, [agents, needle]);

  const filteredWorkflows = useMemo(() => {
    if (!needle) return workflows;
    return workflows.filter(
      (w) => w.name.toLowerCase().includes(needle) || w.description.toLowerCase().includes(needle),
    );
  }, [workflows, needle]);

  const sectorPairs = useMemo(() => {
    if (!overview) return [];
    const pairs = Object.entries(overview.indexStats.bySector);
    pairs.sort((a, b) => b[1] - a[1]);
    return pairs;
  }, [overview]);

  const maxSectorCount = useMemo(
    () => (sectorPairs.length > 0 ? Math.max(...sectorPairs.map(([, c]) => c), 1) : 1),
    [sectorPairs],
  );

  const renderEntryCard = (entry: Os3DomainEntrySummary, accent: string, tagLabel?: string) => (
    <button
      key={entry.vaultPath}
      type="button"
      onClick={() => void openEntityInspector(entry.vaultPath)}
      className="group flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-semibold text-ink group-hover:text-accent">{entry.title}</span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusTone(entry.status)}`}>
          {entry.status ?? tagLabel ?? entry.docType ?? 'indexed'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink-dim">
        <span className="truncate">{entry.vaultPath}</span>
        <span className="shrink-0 tabular-nums" style={{ color: accent }}>
          {entry.wikilinksCount} links
        </span>
      </div>
    </button>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-ink">
      {/* Sticky Frosted Glass Command Header */}
      <header className="frost z-10 shrink-0 border-x-0 border-t-0 px-4 pb-4 pt-16 sm:px-8 sm:pt-20">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-accent/40 bg-accent/15 text-accent shadow-[0_0_24px_rgba(255,172,94,0.22)]">
              <Activity size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                  XYP3RN OS 3.0 OPERATOR DASHBOARDS
                </h1>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${
                    isSeedMode
                      ? 'border-amber-400/35 bg-amber-500/12 text-amber-200'
                      : 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
                  }`}
                >
                  {isSeedMode ? 'LOCAL SEED' : 'OS3 LIVE'}
                </span>
                {!isSeedMode &&
                  diagnostics?.generatedAt &&
                  Number.isFinite(Date.parse(diagnostics.generatedAt)) &&
                  Date.now() - Date.parse(diagnostics.generatedAt) > 120_000 && (
                    <span
                      role="status"
                      className="rounded-full border border-amber-400/45 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] text-amber-200"
                    >
                      STALE TELEMETRY
                    </span>
                  )}
              </div>
              <p className="mt-0.5 font-mono text-xs text-ink-dim">
                {overview ? `${overview.service} · ${overview.vaultRoot}` : 'Synchronizing live OS 3.0 Vault & Runtime…'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
              <input
                type="search"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter agents, flows, notes…"
                aria-label="Filter dashboard entries"
                className="w-52 rounded-xl border border-white/15 bg-black/30 py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-dim/80 focus:border-accent/60 focus:outline-none sm:w-64"
              />
            </div>

            {health && (
              <span className="hidden rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 font-mono text-xs text-emerald-200 sm:inline-flex">
                SQLite + Vault {health.totalIndexedFiles}
              </span>
            )}

            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2 font-mono text-xs text-ink transition hover:border-accent/50 hover:bg-white/[0.1]"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-accent' : 'text-accent'} />
              REFRESH
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          aria-label="Dashboard sections"
          role="tablist"
          className="mx-auto mt-4 flex max-w-[1440px] flex-wrap gap-2 border-t border-white/10 pt-3"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const label =
              t.id === 'approvals' && pendingApprovals.length > 0 ? `${t.label} (${pendingApprovals.length})` : t.label;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-3.5 py-2 font-mono text-xs transition ${
                  active
                    ? 'border border-accent/60 bg-accent/18 font-semibold text-ink shadow-[0_0_20px_rgba(255,172,94,0.18)]'
                    : 'border border-transparent text-ink-dim hover:border-white/15 hover:bg-white/[0.05] hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Scrollable Dashboard Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 pb-8">
          {permissionDeniedError && (
            <div
              role="alert"
              className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border-rose-500/55 bg-rose-950/50 px-4 py-3.5 text-sm text-rose-100"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert size={18} className="shrink-0 text-rose-300" />
                <div>
                  <p className="font-mono text-xs font-semibold text-rose-200">PERMISSION DENIED (401/403)</p>
                  <p className="text-xs text-rose-100/90">{permissionDeniedError}</p>
                </div>
              </div>
            </div>
          )}

          {gatewayError && !permissionDeniedError && (
            <div
              role="alert"
              className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border-rose-400/40 bg-rose-950/35 px-4 py-3.5 text-sm text-rose-100"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="shrink-0 text-rose-300" />
                <div>
                  <p className="font-mono text-xs font-semibold text-rose-200">
                    GATEWAY CONNECTION WARNING · SHOWING LOCAL SEED TELEMETRY (DEV FIXTURE ONLY)
                  </p>
                  <p className="text-xs text-rose-100/90">{gatewayError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRefreshTick((t) => t + 1)}
                className="rounded-xl border border-rose-300/40 bg-rose-500/20 px-3.5 py-2 font-mono text-xs font-semibold text-rose-100 transition hover:bg-rose-500/35"
              >
                RETRY CONNECTION
              </button>
            </div>
          )}

          {commandStatus && (
            <div
              role="status"
              className={`glass-card flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-xs ${
                commandStatus.ok ? 'border-emerald-400/35' : 'border-amber-400/35'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="font-mono font-semibold text-ink">{commandStatus.title}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-ink-dim">{commandStatus.detail}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss status notice"
                onClick={() => setCommandStatus(null)}
                className="rounded-lg p-1 text-ink-dim hover:bg-white/10 hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {loading && !overview && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`${CARD} animate-pulse`}>
                  <div className="h-3 w-28 rounded bg-white/10" />
                  <div className="mt-3 h-8 w-20 rounded bg-white/15" />
                  <div className="mt-2 h-3 w-36 rounded bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {/* TAB 1: SYSTEM OVERVIEW */}
          {tab === 'overview' && overview && (
            <div className="flex flex-col gap-6">
              <section aria-label="System KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className={CARD}>
                  <div className="flex items-center justify-between text-ink-dim">
                    <span className="micro">INDEXED VAULT FILES</span>
                    <Database size={16} className="text-sky-400" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-ink">{overview.indexStats.totalFiles}</p>
                  <p className="mt-1.5 font-mono text-xs text-ink-dim">
                    Integrity:{' '}
                    <span className={overview.integrityOk ? 'font-semibold text-emerald-300' : 'text-rose-300'}>
                      {overview.integrityOk ? 'VERIFIED' : 'CHECK REQUIRED'}
                    </span>
                  </p>
                </div>

                <div className={CARD}>
                  <div className="flex items-center justify-between text-ink-dim">
                    <span className="micro">AGENTS</span>
                    <Bot size={16} className="text-violet-400" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-ink">{overview.agents.total}</p>
                  <p className="mt-1.5 font-mono text-xs text-ink-dim">
                    Failures logged: <span className="text-ink">{overview.agents.failuresCount}</span>
                  </p>
                </div>

                <div className={CARD}>
                  <div className="flex items-center justify-between text-ink-dim">
                    <span className="micro">WORKFLOWS</span>
                    <GitBranch size={16} className="text-teal-300" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-ink">{overview.workflows.total}</p>
                  <p className="mt-1.5 font-mono text-xs text-ink-dim">
                    Jobs executed: <span className="text-ink">{overview.runtime.recentJobsCount}</span>
                  </p>
                </div>

                <div className={CARD}>
                  <div className="flex items-center justify-between text-ink-dim">
                    <span className="micro">GOVERNANCE APPROVALS</span>
                    <ShieldCheck size={16} className="text-amber-300" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-ink">{pendingApprovals.length}</p>
                  <p className="mt-1.5 font-mono text-xs text-ink-dim">
                    Active locks: <span className="text-ink">{overview.runtime.activeLocks}</span>
                  </p>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className="micro mb-4 flex items-center gap-2 text-accent">
                    <Layers size={14} /> VAULT SECTOR DISTRIBUTION
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    {sectorPairs.map(([sector, count]) => (
                      <SectorDistributionBar key={sector} sector={sector} count={count} maxCount={maxSectorCount} />
                    ))}
                  </div>
                </section>

                <section className={CARD}>
                  <h2 className="micro mb-4 flex items-center gap-2 text-accent">
                    <Activity size={14} /> RECENT RUNTIME TELEMETRY
                  </h2>
                  <div className="flex max-h-[340px] flex-col gap-2.5 overflow-y-auto pr-1">
                    {overview.recentJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono font-semibold text-ink">{job.name}</p>
                          <p className="font-mono text-[11px] text-ink-dim">
                            {job.kind} · {job.createdAt.slice(0, 19).replace('T', ' ')}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${statusTone(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                    ))}
                    {overview.recentEvents.slice(0, 8).map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2 text-xs"
                      >
                        <span className="truncate font-mono text-ink">{ev.eventType}</span>
                        <span className="shrink-0 font-mono text-[11px] text-ink-dim">{ev.actor}</span>
                      </div>
                    ))}
                    {overview.recentJobs.length === 0 && overview.recentEvents.length === 0 && (
                      <div className="rounded-xl border border-dashed border-white/15 p-4 font-mono text-xs text-ink-dim">
                        No recent runtime jobs recorded yet. Dispatch an agent or workflow from the tabs above.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section aria-label="Core Modules and Studio Subsystems" className={CARD}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="micro flex items-center gap-2 text-accent">
                    <Layers size={14} /> CORE MODULES & SPECIALIZED BRAINS
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTab('core-vault')}
                      className="chip hover:border-accent/50"
                    >
                      OPEN VAULT BROWSER →
                    </button>
                    <Link href="/daw" className="chip border-s05_records/40 text-s05_records hover:border-s05_records">
                      DAW · PLUGIN · AUDIO BRAIN →
                    </Link>
                  </div>
                </div>
                {!modules ? (
                  <p className="rounded-xl border border-dashed border-white/15 p-3 font-mono text-xs text-ink-dim">
                    {isSeedMode
                      ? 'Core subsystem telemetry unavailable in offline seed mode.'
                      : 'Loading OS3 subsystem inventory…'}
                  </p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {modules.modules.map((mod) => (
                      <div key={mod.id} className="outlined flex flex-col justify-between gap-1.5 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-ink">{mod.name}</span>
                          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusTone(mod.status === 'healthy' ? 'live' : mod.status === 'degraded' ? 'pending' : 'error')}`}>
                            {mod.status}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-ink-dim">{mod.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 2: AGENTS */}
          {tab === 'agents' && (
            <div className="flex flex-col gap-5">
              <form onSubmit={(e) => void handleExecuteRegisteredAgent(e)} className={`${CARD} flex flex-col gap-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="micro flex items-center gap-2 text-accent">
                    <Bot size={14} /> AGENT REGISTRY EXECUTION CONSOLE
                  </h2>
                  <span className="font-mono text-[11px] text-ink-dim">
                    Dispatches POST /api/agents/run with class-based permission enforcement
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-12">
                  <select
                    aria-label="Agent to execute"
                    value={agentRunName || agents[0]?.name || ''}
                    onChange={(e) => setAgentRunName(e.target.value)}
                    className="rounded-xl border border-white/15 bg-[#0e1220] px-3 py-2 font-mono text-xs text-ink focus:border-accent/60 focus:outline-none md:col-span-3"
                  >
                    {agents.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name} ({a.class})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    aria-label="Agent execution goal"
                    value={agentRunGoal}
                    onChange={(e) => setAgentRunGoal(e.target.value)}
                    placeholder="Execution goal…"
                    className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-ink focus:border-accent/60 focus:outline-none md:col-span-5"
                  />
                  <select
                    aria-label="Agent execution mode"
                    value={agentRunMode}
                    onChange={(e) => setAgentRunMode(e.target.value as 'analyze' | 'execute')}
                    className="rounded-xl border border-white/15 bg-[#0e1220] px-3 py-2 font-mono text-xs text-ink focus:border-accent/60 focus:outline-none md:col-span-2"
                  >
                    <option value="analyze">analyze (read-only)</option>
                    <option value="execute">execute (Execution class)</option>
                  </select>
                  <button
                    type="submit"
                    disabled={actionBusyId === 'agent-console-exec' || agents.length === 0}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-accent/50 bg-accent/20 px-4 py-2 font-mono text-xs font-semibold text-accent transition hover:bg-accent/30 disabled:opacity-50 md:col-span-2"
                  >
                    <Play size={12} /> EXECUTE AGENT
                  </button>
                </div>
              </form>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredAgents.map((agent) => (
                  <article key={agent.name} className={`${CARD} flex flex-col gap-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-ink">{agent.name}</h2>
                        <p className="font-mono text-xs text-accent">
                          {agent.class} · {agent.domain}
                        </p>
                      </div>
                      {agent.lastRun && (
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${statusTone(agent.lastRun.status)}`}
                        >
                          {agent.lastRun.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-ink-dim">{agent.role}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.tools.slice(0, 6).map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                      <span className="truncate font-mono text-[11px] text-ink-dim">Model: {agent.model}</span>
                      <button
                        type="button"
                        disabled={actionBusyId === `agent:${agent.name}`}
                        onClick={() =>
                          void handleDispatchCommand(
                            `agent:${agent.name}`,
                            `Agent · ${agent.name}`,
                            `@${agent.name} status summary`,
                          )
                        }
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-accent transition hover:bg-accent/25 disabled:opacity-50"
                      >
                        <Play size={11} /> RUN
                      </button>
                    </div>
                  </article>
                ))}
                {filteredAgents.length === 0 && (
                  <p className="col-span-full font-mono text-sm text-ink-dim">No agents matched filter &ldquo;{filterText}&rdquo;.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WORKFLOWS & RUNS */}
          {tab === 'workflows' && (
            <div className="flex flex-col gap-6">
              <section className={`${CARD} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <h2 className="micro flex items-center gap-2 text-accent">
                    <GitBranch size={14} /> WORKFLOW INPUT PAYLOAD (JSON)
                  </h2>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-dim">
                    Passed to POST /api/workflows/run when triggering a workflow definition below
                  </p>
                </div>
                <input
                  type="text"
                  aria-label="Workflow JSON inputs"
                  value={workflowInputsRaw}
                  onChange={(e) => setWorkflowInputsRaw(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-ink focus:border-accent/60 focus:outline-none sm:w-96"
                />
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredWorkflows.map((wf) => (
                  <article key={wf.name} className={`${CARD} flex flex-col gap-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold text-ink">{wf.name}</h2>
                        <p className="font-mono text-xs text-ink-dim">{wf.stepCount} DAG steps</p>
                      </div>
                      {wf.lastJob && (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${statusTone(wf.lastJob.status)}`}
                        >
                          {wf.lastJob.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-ink-dim">{wf.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wf.steps.map((s) => (
                        <span key={s.id} className="chip">
                          {s.id} → {s.agent}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="truncate font-mono text-[11px] text-ink-dim">
                        Inputs: {wf.requiredInputs.join(', ') || 'none'}
                      </span>
                      <button
                        type="button"
                        disabled={actionBusyId === `wf-api:${wf.name}`}
                        onClick={() => void handleRunWorkflowApi(wf.name)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-accent transition hover:bg-accent/25 disabled:opacity-50"
                      >
                        <Play size={11} /> TRIGGER
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {overview && overview.recentJobs.length > 0 && (
                <section className={CARD}>
                  <h2 className="micro mb-3 text-accent">RECENT RUNTIME JOBS</h2>
                  <div className="flex flex-col gap-2">
                    {overview.recentJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 text-xs"
                      >
                        <span className="font-mono font-semibold text-ink">{job.name}</span>
                        <span className="font-mono text-ink-dim">
                          {job.kind} · {job.id} · {job.createdAt}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${statusTone(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {overview && overview.recentAgentRuns.length > 0 && (
                <section className={CARD}>
                  <h2 className="micro mb-3 text-accent">RECENT AGENT EXECUTION TRACE</h2>
                  <div className="flex flex-col gap-2">
                    {overview.recentAgentRuns.map((run) => (
                      <div
                        key={run.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 text-xs"
                      >
                        <span className="font-mono font-semibold text-ink">{run.agentName}</span>
                        <span className="font-mono text-ink-dim">
                          {run.durationMs != null ? `${run.durationMs}ms` : 'running'} · {run.startedAt}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${statusTone(run.status)}`}>
                          {run.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* TAB 4: APPROVALS & GOVERNANCE */}
          {tab === 'approvals' && (
            <div className="flex flex-col gap-4">
              {approvals.length === 0 ? (
                <div className={`${CARD} flex items-center gap-3 text-sm text-ink-dim`}>
                  <ShieldCheck size={18} className="text-emerald-300" />
                  No governance approval items recorded in SQLite runtime.
                </div>
              ) : (
                approvals.map((item) => (
                  <article
                    key={item.id}
                    className={`${CARD} flex flex-wrap items-center justify-between gap-4`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ShieldAlert size={15} className="text-amber-300" />
                        <span className="font-mono text-sm font-semibold text-ink">{item.itemId}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-ink-dim">
                        {item.itemType} · Proposer: {item.proposer} · {item.createdAt}
                      </p>
                      {item.reason && <p className="mt-2 text-sm text-ink">{item.reason}</p>}
                    </div>

                    {item.status === 'pending' && (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={actionBusyId === item.id}
                          onClick={() => void handleDecideApproval(item, 'approved')}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-400/45 bg-emerald-500/18 px-3.5 py-2 font-mono text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} /> APPROVE
                        </button>
                        <button
                          type="button"
                          disabled={actionBusyId === item.id}
                          onClick={() => void handleDecideApproval(item, 'rejected')}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-400/45 bg-rose-500/18 px-3.5 py-2 font-mono text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-50"
                        >
                          <XCircle size={14} /> REJECT
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          )}

          {/* TAB 5: RESEARCH INTELLIGENCE */}
          {tab === 'research' && research && (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className={CARD}>
                  <span className="micro text-ink-dim">PROJECTS</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{research.counts.projects}</p>
                </div>
                <div className={CARD}>
                  <span className="micro text-ink-dim">QUESTIONS</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{research.counts.questions}</p>
                </div>
                <div className={CARD}>
                  <span className="micro text-ink-dim">SOURCES</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{research.counts.sources}</p>
                </div>
                <div className={CARD}>
                  <span className="micro text-ink-dim">RESEARCH BRIEFS</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{research.counts.briefs}</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className="micro mb-3 flex items-center gap-2 text-accent">
                    <FlaskConical size={14} /> RESEARCH BRIEFS & FINDINGS
                  </h2>
                  <div className="flex flex-col gap-2">
                    {uniqueEntries([...research.briefs, ...research.findings])
                      .filter((e) => !needle || e.title.toLowerCase().includes(needle))
                      .slice(0, 12)
                      .map((entry) => renderEntryCard(entry, SECTOR_COLORS['03_RESEARCH_INTELLIGENCE']))}
                  </div>
                </section>

                <section className={CARD}>
                  <h2 className="micro mb-3 flex items-center gap-2 text-accent">
                    <FileText size={14} /> QUESTIONS, PROJECTS & SOURCES
                  </h2>
                  <div className="flex flex-col gap-2">
                    {uniqueEntries([...research.projects, ...research.questions, ...research.sources])
                      .filter((e) => !needle || e.title.toLowerCase().includes(needle))
                      .slice(0, 12)
                      .map((entry) => renderEntryCard(entry, SECTOR_COLORS['04_RESEARCH_MATERIAL']))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* TAB 6: RECORDS & X3LIUS */}
          {tab === 'records' && records && (
            <div className="flex flex-col gap-6">
              <div className="outlined flex flex-wrap items-center justify-between gap-3 border-s05_records/35 p-4">
                <div>
                  <span className="micro text-s05_records">XYP3RN DAW BRAIN STUDIO INTEGRATION</span>
                  <p className="mt-1 text-xs text-ink-dim">
                    Inspect FL Studio 2025 / REAPER live telemetry, routing graphs, Plugin Brain, Audio Brain DSP, and gated command approvals inside Constellation.
                  </p>
                </div>
                <Link
                  href="/daw"
                  className="chip border-s05_records/45 text-s05_records hover:border-s05_records"
                >
                  OPEN DAW BRAIN CONSOLE →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className={CARD}>
                  <span className="micro text-ink-dim">SONGS</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{records.counts.songs}</p>
                </div>
                <div className={CARD}>
                  <span className="micro text-ink-dim">EXTRACTED PROMPTS</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-accent">{records.counts.sunoPrompts}</p>
                </div>
                <div className={CARD}>
                  <span className="micro text-ink-dim">LYRICS</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{records.counts.lyrics}</p>
                </div>
                <div className={CARD}>
                  <span className="micro text-ink-dim">VOCAL DNA</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{records.counts.vocalDna}</p>
                </div>
                <div className={CARD}>
                  <span className="micro text-ink-dim">RELEASES</span>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{records.counts.releases}</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                  <h2 className="micro mb-3 flex items-center gap-2 text-accent">
                    <Music size={14} /> X3LIUS SONGS & RELEASES
                  </h2>
                  <div className="flex flex-col gap-2">
                    {uniqueEntries([...records.songs, ...records.releases, ...records.catalogAssignments])
                      .filter((e) => !needle || e.title.toLowerCase().includes(needle))
                      .slice(0, 14)
                      .map((entry) => renderEntryCard(entry, SECTOR_COLORS['05_XYP3RN_RECORDS']))}
                  </div>
                </section>

                <section className={CARD}>
                  <h2 className="micro mb-3 flex items-center gap-2 text-accent">
                    <Sparkles size={14} /> AUDIO EXTRACTED PROMPTS, LYRICS & VOCAL DNA
                  </h2>
                  <div className="flex flex-col gap-2">
                    {uniqueEntries([...records.sunoPrompts, ...records.lyrics, ...records.vocalDna, ...records.audioTakes])
                      .filter((e) => !needle || e.title.toLowerCase().includes(needle))
                      .slice(0, 14)
                      .map((entry) => renderEntryCard(entry, '#3ED6B9'))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* TAB 7: CORE MODULES, VAULT BROWSER & KNOWLEDGE SEARCH */}
          {tab === 'core-vault' && (
            <Os3CoreModulesAndVaultPanel
              modules={modules}
              vaultTree={vaultTree}
              loading={loading}
              permissionDeniedError={permissionDeniedError}
              offlineError={gatewayError}
              onInspectVaultPath={(p) => void openEntityInspector(p)}
            />
          )}

          {/* TAB 8: GOVERNANCE, INVARIANTS, LOCKS & RUNTIME EVENTS */}
          {tab === 'governance' && (
            <Os3GovernancePanel
              governance={governance}
              events={runtimeEvents}
              onInspectVaultPath={(p) => void openEntityInspector(p)}
            />
          )}

          {/* TAB 9: SYSTEM DIAGNOSTICS & HEALTH */}
          {tab === 'diagnostics' && (
            <Os3DiagnosticsPanel diagnostics={diagnostics} gatewayError={gatewayError} />
          )}
        </div>
      </div>

      {/* Entity Inspector Modal */}
      {inspectedPath && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Entity Inspector"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <div className="frost flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate font-mono text-sm font-semibold text-ink">{inspectedPath}</h2>
                {inspectedNote && (
                  <p className="mt-0.5 font-mono text-[11px] text-ink-dim">
                    {inspectedNote.sector} · sha256:{inspectedNote.sha256.slice(0, 12)} · {inspectedNote.outgoingLinks.length} links
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Close entity inspector"
                onClick={() => setInspectedPath(null)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-ink-dim hover:bg-white/10 hover:text-ink"
              >
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {inspectedLoading ? (
                <p className="font-mono text-xs text-ink-dim">Reading entity note from Vault…</p>
              ) : inspectedNote ? (
                <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/35 p-4 font-mono text-xs leading-relaxed text-ink">
                  {inspectedNote.rawContent}
                </pre>
              ) : (
                <p className="font-mono text-xs text-ink-dim">
                  Local seed preview: start OS3 Gateway (:8077) to read the full Vault Markdown note.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
