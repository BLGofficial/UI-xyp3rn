'use client';

import { Activity, Cpu, Link2, Lock, PlugZap, Radio, RefreshCw, ShieldAlert } from 'lucide-react';
import type { DawOverviewPayload } from '@/lib/daw-types';
import { DAW_CARD, DawStatusPill, EmptyHonestState, FreshnessBadge, SafetyTierBadge } from './daw-ui-helpers';

type Props = {
  data: DawOverviewPayload;
  areaFilter: 'overview' | 'connections' | 'sessions';
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onProbeHosts: () => void;
  onConnectAdapter: (adapterId: string) => void;
  onRefreshSession: (sessionId: string) => void;
  onGrantPrepareLease: (sessionId: string) => void;
  busyAction: string | null;
};

export function DawOverviewAndConnectionsPanel({
  data,
  areaFilter,
  selectedSessionId,
  onSelectSession,
  onProbeHosts,
  onConnectAdapter,
  onRefreshSession,
  onGrantPrepareLease,
  busyAction,
}: Props) {
  const { connectionSummary: summary, capabilities, hostProbes, adapters, discoveredInstances, sessions, activeOperations } = data;
  const isDemo = data.isDemoFixture;

  return (
    <div className="grid gap-4">
      {(areaFilter === 'overview') && (
        <section aria-label="DAW Overview" className="grid gap-4 lg:grid-cols-2">
          <div className={DAW_CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-sky-300" aria-hidden="true" />
                <h2 className="font-mono text-xs uppercase tracking-wider text-ink">1. DAW Overview & Safety Separation</h2>
              </div>
              <SafetyTierBadge tier="observation" />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="outlined p-3">
                <dt className="micro text-ink-dim">Connection State</dt>
                <dd className="mt-1">
                  <DawStatusPill tone={summary.state === 'connected' ? 'ok' : summary.state === 'degraded' ? 'warn' : 'danger'}>
                    {summary.state.toUpperCase()}
                  </DawStatusPill>
                </dd>
              </div>
              <div className="outlined p-3">
                <dt className="micro text-ink-dim">DAW & Version</dt>
                <dd className="mt-1 font-mono text-ink">
                  {summary.currentDaw ? `${summary.currentDaw} · ${summary.currentVersion ?? 'unknown'}` : 'None connected'}
                </dd>
              </div>
              <div className="outlined p-3">
                <dt className="micro text-ink-dim">Current Project</dt>
                <dd className="mt-1 truncate font-mono text-ink" title={summary.currentProject ?? undefined}>
                  {summary.currentProject ?? 'No active project'}
                </dd>
              </div>
              <div className="outlined p-3">
                <dt className="micro text-ink-dim">Observation Freshness</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <FreshnessBadge freshness={summary.freshness} stale={summary.stale} />
                  <span className="font-mono text-[11px] text-ink-dim">
                    {summary.lastObservedAt ? summary.lastObservedAt : 'Never observed'}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="micro text-ink-dim">Active Operations & Pending Governance</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="chip">{activeOperations.length} active ops</span>
                <span className="chip">{data.pendingApprovals.filter((p) => p.status === 'pending').length} pending approvals</span>
                <span className="chip">{data.executionHistory.length} execution receipts</span>
                <span className="chip">{capabilities.readOnlyCount} read-only caps</span>
              </div>
            </div>
          </div>

          <div className={DAW_CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-300" aria-hidden="true" />
                <h2 className="font-mono text-xs uppercase tracking-wider text-ink">Capabilities: Available vs Unsupported</h2>
              </div>
              <span className="chip">
                {capabilities.available.length} available · {capabilities.unsupported.length} unsupported
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="outlined p-3">
                <div className="micro text-emerald-200">Available Capabilities ({capabilities.available.length})</div>
                {capabilities.available.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-dim">No adapter capabilities loaded.</p>
                ) : (
                  <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
                    {capabilities.available.slice(0, 10).map((cap) => (
                      <li key={cap.capabilityId} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
                        <span className="truncate font-mono text-[11px] text-ink">{cap.capabilityId}</span>
                        <DawStatusPill tone={cap.supportLevel === 'READ_ONLY' ? 'neutral' : 'ok'}>
                          {cap.supportLevel}
                        </DawStatusPill>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="outlined border-rose-500/25 p-3">
                <div className="micro text-rose-200">Unsupported Capabilities ({capabilities.unsupported.length})</div>
                {capabilities.unsupported.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-dim">None marked unsupported for current host.</p>
                ) : (
                  <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
                    {capabilities.unsupported.slice(0, 10).map((cap) => (
                      <li key={cap.capabilityId} className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[11px] text-rose-100">{cap.capabilityId}</span>
                          <DawStatusPill tone="danger">UNSUPPORTED</DawStatusPill>
                        </div>
                        {cap.limitations?.[0] && (
                          <p className="mt-1 text-[11px] text-ink-dim">{cap.limitations[0]}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {(areaFilter === 'overview' || areaFilter === 'connections') && (
        <section aria-label="DAW Connections" className={DAW_CARD}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PlugZap size={16} className="text-sky-300" aria-hidden="true" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink">2. DAW Connections & Host Discovery</h2>
            </div>
            <button
              type="button"
              onClick={onProbeHosts}
              disabled={busyAction === 'probe' || isDemo}
              className="chip inline-flex items-center gap-1.5 hover:border-white/30 disabled:opacity-50"
            >
              <RefreshCw size={12} className={busyAction === 'probe' ? 'animate-spin' : ''} aria-hidden="true" />
              PROBE LOCAL DAW HOSTS
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {hostProbes.map((probe) => (
              <div key={probe.hostKind} className="outlined p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-ink">{probe.hostName}</span>
                  <DawStatusPill tone={probe.running ? 'ok' : probe.installed ? 'warn' : 'danger'}>
                    {probe.running ? 'RUNNING' : probe.installed ? 'INSTALLED · OFFLINE' : 'NOT RUNNING / DISCONNECTED'}
                  </DawStatusPill>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-dim">
                  <span>Versions: {probe.detectedVersions.length > 0 ? probe.detectedVersions.join(', ') : 'none detected'}</span>
                  <span>· {probe.discoveredProjectCount} projects</span>
                  <span>· {probe.installedPluginCount} scanned plugins</span>
                </div>
                {probe.missingPrerequisites.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] text-amber-200/90">
                    Missing prerequisites: {probe.missingPrerequisites.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="micro mb-2 text-ink-dim">Registered Adapters & Reachable Instances</div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {adapters.map((ad) => {
                const inst = discoveredInstances.find((i) => i.adapterId === ad.adapterId);
                return (
                  <div key={ad.adapterId} className="outlined flex flex-col justify-between gap-2 p-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-ink">{ad.hostName}</span>
                        <DawStatusPill tone={inst?.reachable ? 'ok' : 'neutral'}>
                          {inst?.reachable ? 'REACHABLE' : 'OFFLINE'}
                        </DawStatusPill>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-ink-dim">
                        {ad.adapterId} · {ad.transportProtocol} · readOnlyDefault={String(ad.readOnlyDefault)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!inst?.reachable || isDemo || busyAction === `connect:${ad.adapterId}`}
                      onClick={() => onConnectAdapter(ad.adapterId)}
                      className="chip w-fit hover:border-sky-400/40 disabled:opacity-45"
                    >
                      <Link2 size={11} className="mr-1 inline" aria-hidden="true" />
                      {inst?.reachable ? 'CONNECT READ-ONLY SESSION' : 'HOST UNREACHABLE'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {(areaFilter === 'overview' || areaFilter === 'sessions') && (
        <section aria-label="Active Sessions" className={DAW_CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-emerald-300" aria-hidden="true" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink">3. Active Sessions ({sessions.length})</h2>
            </div>
            <SafetyTierBadge tier="observation" />
          </div>

          {sessions.length === 0 ? (
            <div className="mt-3">
              <EmptyHonestState
                title="No Active DAW Session Connected"
                detail="Start FL Studio 2025 or Cockos REAPER with the verified XYP3RN bridge, then click Probe/Connect."
                isDemoMode={isDemo}
              />
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {sessions.map((sess) => {
                const isSelected = sess.sessionId === selectedSessionId;
                return (
                  <div
                    key={sess.sessionId}
                    className={`outlined p-3.5 text-xs ${isSelected ? 'border-accent/55 bg-accent/5' : ''}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectSession(sess.sessionId)}
                        className="text-left font-mono font-semibold text-ink hover:text-accent"
                      >
                        {sess.project.name} ({sess.dawId} {sess.hostVersion})
                      </button>
                      <FreshnessBadge freshness={sess.stateFreshness} stale={sess.stale} />
                    </div>
                    <div className="mt-1.5 font-mono text-[11px] text-ink-dim">
                      Session: {sess.sessionId} · Tier: {sess.connection.activePermissionTier} · Last Observed: {sess.updatedAt}
                    </div>
                    {sess.stale && (
                      <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/12 px-2.5 py-1.5 font-mono text-[11px] text-amber-100">
                        STALE OBSERVATION WARNING: Snapshot age exceeds live threshold or live edits are unsaved.
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isDemo || busyAction === `refresh:${sess.sessionId}`}
                        onClick={() => onRefreshSession(sess.sessionId)}
                        className="chip hover:border-sky-400/45 disabled:opacity-50"
                      >
                        <RefreshCw size={11} className="mr-1 inline" aria-hidden="true" />
                        REFRESH OBSERVATION
                      </button>
                      <button
                        type="button"
                        disabled={isDemo || busyAction === `lease:${sess.sessionId}`}
                        onClick={() => onGrantPrepareLease(sess.sessionId)}
                        className="chip border-amber-400/40 text-amber-100 hover:border-amber-300 disabled:opacity-50"
                      >
                        <Lock size={11} className="mr-1 inline" aria-hidden="true" />
                        GRANT PREPARE LEASE (OPERATOR)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeOperations.length > 0 && (
            <div className="mt-4 outlined p-3">
              <div className="micro mb-2 flex items-center gap-1.5 text-ink-dim">
                <Cpu size={12} aria-hidden="true" />
                Active Operations & Leases ({activeOperations.length})
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeOperations.map((op) => (
                  <div key={op.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs">
                    <span className="truncate font-mono text-ink">{op.label}</span>
                    <DawStatusPill tone={op.kind === 'prepared_command' ? 'warn' : 'neutral'}>{op.tierOrRisk}</DawStatusPill>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
