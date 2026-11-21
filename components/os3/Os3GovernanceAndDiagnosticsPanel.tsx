'use client';

import { Activity, Disc3, Lock, ShieldCheck, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type {
  Os3DiagnosticsOverview,
  Os3GovernanceOverview,
  Os3RuntimeEventRecord,
} from '@/lib/types';

export function Os3GovernancePanel({
  governance,
  events,
  onInspectVaultPath,
}: {
  governance: Os3GovernanceOverview | null;
  events: Os3RuntimeEventRecord[];
  onInspectVaultPath: (vaultPath: string) => void;
}) {
  const [domainFilter, setDomainFilter] = useState<string>('ALL');

  const filteredEvents = events.filter((e) => domainFilter === 'ALL' || e.domain === domainFilter);
  const domains = ['ALL', ...Array.from(new Set(events.map((e) => e.domain)))];

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Governance and Policies" className="glass-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="micro flex items-center gap-2 text-accent">
            <ShieldCheck size={14} aria-hidden="true" /> GOVERNANCE INVARIANTS, POLICIES & LOCKS
          </h2>
          {governance && (
            <span className="chip">
              {governance.counts.policies} policies · {governance.counts.activeLocks} active locks · {governance.counts.pendingApprovals} pending
            </span>
          )}
        </div>

        {!governance ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 font-mono text-xs text-ink-dim">
            Governance telemetry unavailable while OS3 Gateway is offline.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2.5 text-xs">
              {governance.enforcedInvariants.map((inv) => (
                <div key={inv.id} className="outlined p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-ink">{inv.id}: {inv.name}</span>
                    <span className="rounded-full border border-emerald-400/35 bg-emerald-500/12 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
                      {inv.enforced ? 'ENFORCED' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="mt-1 text-ink-dim">{inv.detail}</p>
                </div>
              ))}

              <div className="outlined p-3">
                <div className="micro mb-2 flex items-center gap-1.5 text-ink-dim">
                  <Lock size={12} aria-hidden="true" /> Active SQLite Runtime Locks ({governance.activeLocks.length})
                </div>
                {governance.activeLocks.length === 0 ? (
                  <p className="font-mono text-[11px] text-ink-dim">Zero held resource locks.</p>
                ) : (
                  <ul className="space-y-1 font-mono text-[11px] text-ink">
                    {governance.activeLocks.map((lk) => (
                      <li key={lk.resourceKey} className="flex justify-between gap-2">
                        <span>{lk.resourceKey}</span>
                        <span className="text-ink-dim">owner: {lk.ownerId}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="outlined p-3 text-xs">
              <div className="micro mb-2 text-ink-dim">
                Canonical Governance Policies & Standards ({governance.policies.length + governance.standards.length})
              </div>
              {governance.policies.length === 0 && governance.standards.length === 0 ? (
                <p className="font-mono text-[11px] text-ink-dim">No indexed policy notes found in current Vault scan.</p>
              ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {[...governance.policies, ...governance.standards].map((doc) => (
                    <button
                      key={doc.vaultPath}
                      type="button"
                      onClick={() => onInspectVaultPath(doc.vaultPath)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 text-left hover:bg-white/[0.07]"
                    >
                      <span className="truncate font-semibold text-ink">{doc.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-ink-dim">{doc.vaultPath.split('/').slice(-2).join('/')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section aria-label="Runtime Events" className="glass-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="micro flex items-center gap-2 text-accent">
            <Activity size={14} aria-hidden="true" /> IMMUTABLE RUNTIME AUDIT EVENTS ({filteredEvents.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {domains.map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setDomainFilter(dom)}
                className={`chip ${domainFilter === dom ? 'border-accent bg-accent/18 text-ink' : 'text-ink-dim'}`}
              >
                {dom}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 font-mono text-xs text-ink-dim">
            No runtime events recorded matching filter &ldquo;{domainFilter}&rdquo;.
          </p>
        ) : (
          <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1 text-xs">
            {filteredEvents.map((ev) => (
              <div key={ev.id} className="outlined flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-ink">{ev.eventType}</span>
                  <span className="chip">{ev.domain}</span>
                </div>
                <span className="text-[11px] text-ink-dim">
                  actor={ev.actor} {ev.targetPath ? `· ${ev.targetPath}` : ''} · {ev.timestamp}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function Os3DiagnosticsPanel({
  diagnostics,
  gatewayError,
}: {
  diagnostics: Os3DiagnosticsOverview | null;
  gatewayError: string | null;
}) {
  return (
    <section aria-label="System Diagnostics" className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="micro flex items-center gap-2 text-accent">
          <Stethoscope size={14} aria-hidden="true" /> OS3 SYSTEM DIAGNOSTICS & INTEGRITY
        </h2>
        <Link href="/daw" className="chip inline-flex items-center gap-1.5 border-s05_records/40 text-s05_records">
          <Disc3 size={12} aria-hidden="true" /> INSPECT DAW BRAIN HEALTH →
        </Link>
      </div>

      {!diagnostics ? (
        <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 font-mono text-xs text-ink-dim">
          {gatewayError ? `Diagnostics unavailable: ${gatewayError}` : 'Diagnostics awaiting live OS3 Gateway response.'}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="outlined p-3.5">
            <div className="micro text-ink-dim">SQLite Runtime Integrity</div>
            <p className={`mt-1.5 font-mono text-base font-semibold ${diagnostics.sqlite.integrityOk ? 'text-emerald-200' : 'text-rose-200'}`}>
              {diagnostics.sqlite.open && diagnostics.sqlite.integrityOk ? 'VERIFIED OK' : 'CHECK FAILED'}
            </p>
            <p className="mt-1 truncate font-mono text-[11px] text-ink-dim">
              Schema v{diagnostics.sqlite.schemaVersion ?? 0}
            </p>
          </div>

          <div className="outlined p-3.5">
            <div className="micro text-ink-dim">Vault Structural Index</div>
            <p className="mt-1.5 font-mono text-base font-semibold text-ink">
              {diagnostics.vault.totalIndexedFiles} NOTES
            </p>
            <p className="mt-1 truncate font-mono text-[11px] text-ink-dim">
              {diagnostics.vault.sectorsCount} indexed sectors
            </p>
          </div>

          <div className="outlined p-3.5">
            <div className="micro text-ink-dim">Agent Registry Health</div>
            <p className="mt-1.5 font-mono text-base font-semibold text-ink">
              {diagnostics.agents.loadedCount} LOADED
            </p>
            <p className={`mt-1 font-mono text-[11px] ${diagnostics.agents.failuresCount > 0 ? 'text-rose-200' : 'text-emerald-200'}`}>
              {diagnostics.agents.failuresCount} load failures · {diagnostics.runtimeHealth.failedJobsCount} failed jobs
            </p>
          </div>

          <div className="outlined p-3.5">
            <div className="micro text-ink-dim">DAW Brain Runtime State</div>
            <p className="mt-1.5 font-mono text-base font-semibold text-ink">
              {(diagnostics.dawHealth?.state ?? 'unknown').toUpperCase()}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-dim">
              {diagnostics.dawHealth?.adaptersRegistered ?? 0} adapters · {diagnostics.dawHealth?.reachableInstances ?? 0} reachable
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
