'use client';

import { RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { decideGatewayApproval, fetchVaultNote } from '@/lib/gateway';
import {
  fetchAgentRegistry,
  fetchApprovalsByStatus,
  fetchRecordsOverview,
  fetchResearchOverview,
  fetchRuntimeEvents,
  fetchRuntimeRuns,
  fetchSystemOverview,
  fetchWorkflowRegistry,
} from '@/lib/os3-adapter';
import { parseMarkdown } from '@/lib/markdown';
import { SECTOR_COLORS } from '@/lib/tokens';
import type {
  DepartmentId,
  GatewayApprovalItem,
  Os3AgentRunRecord,
  Os3AgentSummary,
  Os3DomainEntrySummary,
  Os3JobRecord,
  Os3RecordsOverview,
  Os3ResearchOverview,
  Os3RuntimeEventRecord,
  Os3SystemOverview,
  Os3WorkflowSummary,
  VaultNotePayload,
} from '@/lib/types';

type DashboardTab = 'overview' | 'agents' | 'workflows' | 'approvals' | 'research' | 'records';

const TABS: ReadonlyArray<{ id: DashboardTab; label: string }> = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'agents', label: 'AGENTS' },
  { id: 'workflows', label: 'WORKFLOWS & RUNS' },
  { id: 'approvals', label: 'APPROVALS' },
  { id: 'research', label: 'RESEARCH' },
  { id: 'records', label: 'RECORDS' },
];

function StatusPill({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'idle').toLowerCase();
  const colorClass =
    s === 'success' || s === 'approved' || s === 'live'
      ? 'border-[#3ECFB2]/50 text-[#3ECFB2]'
      : s === 'running' || s === 'queued' || s === 'pending' || s === 'in-development'
        ? 'border-accent/60 text-accent'
        : s === 'error' || s === 'rejected'
          ? 'border-[#E5484D]/60 text-[#E5484D]'
          : 'border-hairline text-ink-dim';
  return <span className={`chip inline-block uppercase ${colorClass}`}>{s}</span>;
}

function DomainEntityList({
  title,
  items,
  onInspect,
}: {
  title: string;
  items: readonly Os3DomainEntrySummary[];
  onInspect: (vaultPath: string) => void;
}) {
  return (
    <section className="frost rounded-[12px] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="micro text-ink-dim">{title}</h3>
        <span className="font-mono text-xs text-ink-dim">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="font-mono text-xs text-ink-dim">No indexed records yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {items.slice(0, 12).map((item) => (
            <li key={item.vaultPath} className="py-2">
              <button
                type="button"
                onClick={() => onInspect(item.vaultPath)}
                className="flex w-full items-start justify-between gap-3 text-left hover:text-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                  <p className="truncate font-mono text-[11px] text-ink-dim">{item.vaultPath}</p>
                </div>
                <StatusPill status={item.status ?? item.docType} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Operational Dashboard connecting System Overview, Agents, Workflows, Runs, Approvals, Research, and Records. */
export function DashboardsView() {
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<Os3SystemOverview | null>(null);
  const [agents, setAgents] = useState<Os3AgentSummary[]>([]);
  const [workflows, setWorkflows] = useState<Os3WorkflowSummary[]>([]);
  const [jobs, setJobs] = useState<Os3JobRecord[]>([]);
  const [agentRuns, setAgentRuns] = useState<Os3AgentRunRecord[]>([]);
  const [events, setEvents] = useState<Os3RuntimeEventRecord[]>([]);
  const [approvals, setApprovals] = useState<GatewayApprovalItem[]>([]);
  const [research, setResearch] = useState<Os3ResearchOverview | null>(null);
  const [records, setRecords] = useState<Os3RecordsOverview | null>(null);

  const [agentFilter, setAgentFilter] = useState('');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [approvalReason, setApprovalReason] = useState('Operator verified via OS3 Console');
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);

  const [inspectedPath, setInspectedPath] = useState<string | null>(null);
  const [inspectedNote, setInspectedNote] = useState<VaultNotePayload | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [ovRes, agRes, wfRes, runsRes, evRes, apRes, resRes, recRes] = await Promise.all([
      fetchSystemOverview(),
      fetchAgentRegistry(),
      fetchWorkflowRegistry(),
      fetchRuntimeRuns(40),
      fetchRuntimeEvents(40),
      fetchApprovalsByStatus(approvalStatusFilter),
      fetchResearchOverview(),
      fetchRecordsOverview(),
    ]);

    if (!ovRes.ok) {
      setError(ovRes.error ?? 'OS3 Gateway (127.0.0.1:8077) is offline or unreachable.');
    }

    if (ovRes.data) setOverview(ovRes.data);
    if (agRes.data) setAgents(agRes.data.agents);
    if (wfRes.data) setWorkflows(wfRes.data.workflows);
    if (runsRes.data) {
      setJobs(runsRes.data.jobs);
      setAgentRuns(runsRes.data.agentRuns);
    }
    if (evRes.data) setEvents(evRes.data.events);
    if (apRes.data) setApprovals(apRes.data.approvals);
    if (resRes.data) setResearch(resRes.data);
    if (recRes.data) setRecords(recRes.data);

    setLoading(false);
  }, [approvalStatusFilter]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const openEntityInspector = useCallback(async (vaultPath: string) => {
    setInspectedPath(vaultPath);
    setInspectLoading(true);
    const note = await fetchVaultNote(vaultPath);
    setInspectedNote(note);
    setInspectLoading(false);
  }, []);

  const handleApprovalDecision = useCallback(
    async (approvalId: string, decision: 'approved' | 'rejected') => {
      setApprovalBusyId(approvalId);
      setApprovalFeedback(null);
      const decided = await decideGatewayApproval({
        approvalId,
        decision,
        approver: 'operator-x3lius',
        reason: approvalReason.trim() || `Operator ${decision}`,
      });
      setApprovalBusyId(null);
      if (decided) {
        setApprovalFeedback(`Approval ${approvalId} marked ${decided.status.toUpperCase()}.`);
        void loadDashboardData();
      } else {
        setApprovalFeedback(`Failed to record decision for ${approvalId}. Check gateway connection.`);
      }
    },
    [approvalReason, loadDashboardData],
  );

  const filteredAgents = useMemo(() => {
    const q = agentFilter.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.class.toLowerCase().includes(q) ||
        a.domain.toLowerCase().includes(q),
    );
  }, [agents, agentFilter]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-10 pt-20 md:px-8 md:pt-20">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <p className="micro text-accent">XYP3RN OS 3.0 · OPERATIONAL DASHBOARD</p>
          <h1 className="mt-1 font-serif text-2xl font-light uppercase tracking-label text-ink md:text-3xl">
            System &amp; Execution Telemetry
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboardData()}
          className="frost micro flex items-center gap-2 rounded-full px-4 py-2 text-ink hover:border-accent"
        >
          <RefreshCw size={13} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? 'SYNCING…' : 'REFRESH'}
        </button>
      </header>

      {error && (
        <div role="alert" className="frost mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border-[#E5484D]/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-ink">
            <ShieldAlert size={16} className="text-[#E5484D]" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboardData()}
            className="micro rounded border border-hairline px-3 py-1.5 text-ink hover:border-ink/50"
          >
            RETRY CONNECTION
          </button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Operational dashboard sections"
        className="mb-6 flex flex-wrap gap-1.5 border-b border-hairline pb-3"
      >
        {TABS.map((item) => {
          const activeTab = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activeTab}
              onClick={() => setTab(item.id)}
              className={`micro rounded-full px-4 py-2 transition-colors ${
                activeTab ? 'bg-ink font-bold text-bg' : 'frost text-ink-dim hover:text-ink'
              }`}
            >
              {item.label}
              {item.id === 'approvals' && overview && overview.runtime.pendingApprovals > 0
                ? ` (${overview.runtime.pendingApprovals})`
                : ''}
            </button>
          );
        })}
      </div>

      {loading && !overview && (
        <div className="frost rounded-[12px] p-8 text-center font-mono text-xs text-ink-dim">
          Connecting to XYP3RN OS 3.0 Gateway (127.0.0.1:8077)…
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <div className="frost rounded-[12px] p-4">
              <p className="micro text-ink-dim">VAULT FILES</p>
              <p className="mt-2 font-serif text-3xl font-light text-ink">{overview.indexStats.totalFiles}</p>
            </div>
            <div className="frost rounded-[12px] p-4">
              <p className="micro text-ink-dim">AGENTS</p>
              <p className="mt-2 font-serif text-3xl font-light text-ink">{overview.agents.total}</p>
            </div>
            <div className="frost rounded-[12px] p-4">
              <p className="micro text-ink-dim">WORKFLOWS</p>
              <p className="mt-2 font-serif text-3xl font-light text-ink">{overview.workflows.total}</p>
            </div>
            <div className="frost rounded-[12px] p-4">
              <p className="micro text-ink-dim">PENDING APPROVALS</p>
              <p className="mt-2 font-serif text-3xl font-light text-accent">{overview.runtime.pendingApprovals}</p>
            </div>
            <div className="frost rounded-[12px] p-4">
              <p className="micro text-ink-dim">ACTIVE LOCKS</p>
              <p className="mt-2 font-serif text-3xl font-light text-ink">{overview.runtime.activeLocks}</p>
            </div>
            <div className="frost rounded-[12px] p-4">
              <p className="micro text-ink-dim">SQLITE INTEGRITY</p>
              <p className="mt-2 flex items-center gap-1.5 font-mono text-sm text-[#3ECFB2]">
                <ShieldCheck size={16} aria-hidden="true" />
                {overview.integrityOk ? 'VERIFIED' : 'CHECK'}
              </p>
            </div>
          </div>

          <section className="frost rounded-[12px] p-5">
            <h2 className="micro mb-4 text-ink-dim">VAULT SECTOR DISTRIBUTION</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(overview.indexStats.bySector).map(([sector, count]) => {
                const color = SECTOR_COLORS[sector as DepartmentId] ?? '#8B8F9C';
                return (
                  <div key={sector} className="outlined flex items-center justify-between px-4 py-3">
                    <span className="font-mono text-xs" style={{ color }}>
                      {sector}
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink">{count}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="frost rounded-[12px] p-5">
              <h2 className="micro mb-3 text-ink-dim">RECENT RUNTIME JOBS</h2>
              {overview.recentJobs.length === 0 ? (
                <p className="font-mono text-xs text-ink-dim">No workflow jobs recorded yet.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {overview.recentJobs.slice(0, 8).map((job) => (
                    <li key={job.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{job.name}</p>
                        <p className="font-mono text-[11px] text-ink-dim">
                          {job.kind} · {job.id}
                        </p>
                      </div>
                      <StatusPill status={job.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="frost rounded-[12px] p-5">
              <h2 className="micro mb-3 text-ink-dim">RECENT AUDIT &amp; RUNTIME EVENTS</h2>
              {overview.recentEvents.length === 0 ? (
                <p className="font-mono text-xs text-ink-dim">No runtime events recorded yet.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {overview.recentEvents.slice(0, 8).map((ev) => (
                    <li key={ev.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-ink">
                          {ev.eventType} · <span className="text-ink-dim">{ev.actor}</span>
                        </p>
                        {ev.targetPath && (
                          <button
                            type="button"
                            onClick={() => void openEntityInspector(ev.targetPath!)}
                            className="truncate font-mono text-[11px] text-accent hover:underline"
                          >
                            {ev.targetPath}
                          </button>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-ink-dim">
                        {ev.timestamp.slice(11, 19)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              placeholder="Filter agents by name, class, or domain…"
              aria-label="Filter agents"
              className="frost w-full max-w-sm rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:outline-none"
            />
            <span className="font-mono text-xs text-ink-dim">
              Showing {filteredAgents.length} / {agents.length} registered agents
            </span>
          </div>
          {filteredAgents.length === 0 ? (
            <div className="frost rounded-[12px] p-6 font-mono text-xs text-ink-dim">
              No agents match filter &ldquo;{agentFilter}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredAgents.map((agent) => (
                <article key={agent.name} className="frost flex flex-col justify-between rounded-[12px] p-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-mono text-sm font-semibold text-ink">{agent.name}</h3>
                      <StatusPill status={agent.lastRun?.status ?? 'ready'} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-accent">
                      {agent.class} · {agent.domain} · {agent.model}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-ink-dim">{agent.role}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-hairline pt-2.5">
                    {agent.tools.map((tool) => (
                      <span key={tool} className="chip">
                        {tool}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'workflows' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="frost rounded-[12px] p-5">
            <h2 className="micro mb-4 text-ink-dim">WORKFLOW REGISTRY ({workflows.length})</h2>
            {workflows.length === 0 ? (
              <p className="font-mono text-xs text-ink-dim">No workflow definitions discovered.</p>
            ) : (
              <ul className="space-y-3">
                {workflows.map((wf) => (
                  <li key={wf.name} className="outlined p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-mono text-sm font-semibold text-ink">{wf.name}</h3>
                      <StatusPill status={wf.lastJob?.status ?? 'ready'} />
                    </div>
                    <p className="mt-1 text-xs text-ink-dim">{wf.description || wf.sourcePath}</p>
                    <p className="mt-2 font-mono text-[11px] text-ink-dim">
                      {wf.stepCount} steps · agents: {wf.steps.map((s) => s.agent).join(' → ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="frost rounded-[12px] p-5">
            <h2 className="micro mb-4 text-ink-dim">EXECUTION HISTORY (AGENT RUNS &amp; EVENTS)</h2>
            {agentRuns.length === 0 && jobs.length === 0 && events.length === 0 ? (
              <p className="font-mono text-xs text-ink-dim">No execution history recorded yet.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {agentRuns.slice(0, 15).map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-ink">{run.agentName}</p>
                      <p className="font-mono text-[10px] text-ink-dim">
                        {run.id} · {run.durationMs != null ? `${run.durationMs}ms` : 'active'}
                      </p>
                    </div>
                    <StatusPill status={run.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {(['pending', 'approved', 'rejected'] as const).map((statusKey) => (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => setApprovalStatusFilter(statusKey)}
                  className={`micro rounded-full px-3 py-1.5 ${
                    approvalStatusFilter === statusKey ? 'bg-accent font-bold text-bg' : 'frost text-ink-dim'
                  }`}
                >
                  {statusKey}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              aria-label="Approval decision reason"
              placeholder="Operator decision reason…"
              className="frost w-full max-w-md rounded-lg px-3 py-1.5 font-mono text-xs text-ink focus:outline-none"
            />
          </div>

          {approvalFeedback && (
            <p role="status" className="frost rounded-lg px-4 py-2 font-mono text-xs text-accent">
              {approvalFeedback}
            </p>
          )}

          {approvals.length === 0 ? (
            <div className="frost rounded-[12px] p-6 font-mono text-xs text-ink-dim">
              No {approvalStatusFilter} approvals in governance queue.
            </div>
          ) : (
            <ul className="space-y-3">
              {approvals.map((item) => (
                <li key={item.id} className="frost flex flex-wrap items-center justify-between gap-4 rounded-[12px] p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusPill status={item.status} />
                      <span className="font-mono text-xs text-ink-dim">{item.itemType}</span>
                    </div>
                    <p className="mt-1 font-mono text-sm font-semibold text-ink">{item.itemId}</p>
                    <p className="mt-1 font-mono text-[11px] text-ink-dim">
                      Proposer: {item.proposer} · Created: {item.createdAt}
                      {item.approver ? ` · Decided by: ${item.approver}` : ''}
                    </p>
                  </div>
                  {item.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={approvalBusyId === item.id}
                        onClick={() => void handleApprovalDecision(item.id, 'approved')}
                        className="micro rounded-md border border-[#3ECFB2]/60 px-3 py-2 text-[#3ECFB2] hover:bg-[#3ECFB2]/10 disabled:opacity-50"
                      >
                        APPROVE
                      </button>
                      <button
                        type="button"
                        disabled={approvalBusyId === item.id}
                        onClick={() => void handleApprovalDecision(item.id, 'rejected')}
                        className="micro rounded-md border border-[#E5484D]/60 px-3 py-2 text-[#E5484D] hover:bg-[#E5484D]/10 disabled:opacity-50"
                      >
                        REJECT
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'research' && (
        <div className="space-y-6">
          {!research ? (
            <div className="frost rounded-[12px] p-6 font-mono text-xs text-ink-dim">
              Research Intelligence data unavailable while gateway is offline.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {Object.entries(research.counts).map(([k, val]) => (
                  <div key={k} className="frost rounded-[12px] p-3">
                    <p className="micro truncate text-ink-dim">{k}</p>
                    <p className="mt-1 font-serif text-2xl font-light text-[#EC6A9C]">{val}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DomainEntityList title="RESEARCH BRIEFS & SYNTHESES" items={research.briefs} onInspect={(p) => void openEntityInspector(p)} />
                <DomainEntityList title="PROJECTS & QUESTIONS" items={[...research.projects, ...research.questions]} onInspect={(p) => void openEntityInspector(p)} />
                <DomainEntityList title="EVIDENCE & FINDINGS" items={[...research.evidence, ...research.findings]} onInspect={(p) => void openEntityInspector(p)} />
                <DomainEntityList title="CONTRADICTIONS & EXPERIMENTS" items={[...research.contradictions, ...research.experiments]} onInspect={(p) => void openEntityInspector(p)} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'records' && (
        <div className="space-y-6">
          {!records ? (
            <div className="frost rounded-[12px] p-6 font-mono text-xs text-ink-dim">
              X3LIUS Records &amp; Music data unavailable while gateway is offline.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {Object.entries(records.counts).map(([k, val]) => (
                  <div key={k} className="frost rounded-[12px] p-3">
                    <p className="micro truncate text-ink-dim">{k}</p>
                    <p className="mt-1 font-serif text-2xl font-light text-[#3ECFB2]">{val}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DomainEntityList title="SONGS & LYRIC VERSIONS" items={[...records.songs, ...records.lyrics]} onInspect={(p) => void openEntityInspector(p)} />
                <DomainEntityList title="SUNO PROMPTS & AUDIO TAKES" items={[...records.sunoPrompts, ...records.audioTakes]} onInspect={(p) => void openEntityInspector(p)} />
                <DomainEntityList title="RELEASES & CATALOG ASSIGNMENTS" items={[...records.releases, ...records.catalogAssignments]} onInspect={(p) => void openEntityInspector(p)} />
                <DomainEntityList title="RIGHTS SPLITS & SESSION LOGS" items={[...records.rightsSplits, ...records.sessionsDaily]} onInspect={(p) => void openEntityInspector(p)} />
              </div>
            </>
          )}
        </div>
      )}

      {inspectedPath && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Entity Inspector"
          className="frost fixed inset-y-4 right-4 z-50 flex w-[min(640px,calc(100vw-2rem))] flex-col rounded-[14px]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <p className="micro text-accent">ENTITY INSPECTOR</p>
              <p className="truncate font-mono text-xs text-ink-dim">{inspectedPath}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInspectedPath(null);
                setInspectedNote(null);
              }}
              aria-label="Close entity inspector"
              className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-ink-dim hover:text-ink"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {inspectLoading ? (
              <p className="font-mono text-xs text-ink-dim">Reading canonical Vault note…</p>
            ) : !inspectedNote ? (
              <p className="font-mono text-xs text-[#E5484D]">Could not load note from Vault Engine.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 font-mono text-[11px] text-ink-dim">
                  <span className="chip">{inspectedNote.sector}</span>
                  <span className="chip">{inspectedNote.isCanonical ? 'CANONICAL' : 'WORKSPACE'}</span>
                  <span className="chip">sha256:{inspectedNote.sha256.slice(0, 12)}</span>
                </div>
                <div className="space-y-2 text-sm text-ink">
                  {parseMarkdown(inspectedNote.rawContent).map((block, i) =>
                    block.type === 'code' || block.type === 'frontmatter' ? (
                      <pre key={i} className="outlined overflow-x-auto bg-bg/40 p-3 font-mono text-xs">
                        {block.type === 'code' ? block.text : block.lines.join('\n')}
                      </pre>
                    ) : block.type === 'heading' ? (
                      <h4 key={i} className="pt-2 font-semibold text-ink">
                        {block.text}
                      </h4>
                    ) : block.type === 'list' ? (
                      <ul key={i} className="list-disc space-y-1 pl-5 text-ink-dim">
                        {block.items.map((it, idx) => (
                          <li key={idx}>{it}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={i} className="leading-relaxed text-ink">
                        {block.text}
                      </p>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
