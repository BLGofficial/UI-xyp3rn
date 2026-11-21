'use client';

import { GitFork, Layers } from 'lucide-react';
import type { DawOverviewPayload, DawSessionView } from '@/lib/daw-types';
import { DAW_CARD, DawStatusPill, EmptyHonestState, FreshnessBadge, SafetyTierBadge } from './daw-ui-helpers';

type Props = {
  data: DawOverviewPayload;
  activeSession: DawSessionView | null;
  areaFilter: 'explorer' | 'routing';
};

export function DawSessionAndRoutingPanel({ data, activeSession, areaFilter }: Props) {
  const snap = activeSession?.observed ?? activeSession?.cached ?? null;
  const intel = data.sessionIntelligence;
  const isDemo = data.isDemoFixture;

  if (!activeSession || !snap) {
    return (
      <section aria-label={areaFilter === 'explorer' ? 'Session Explorer' : 'Track and Routing Inspector'} className={DAW_CARD}>
        <EmptyHonestState
          title={areaFilter === 'explorer' ? '4. Session Explorer Unavailable' : '5. Track & Routing Inspector Unavailable'}
          detail="Connect a live DAW session or explicitly load a demonstration fixture to inspect tempo, transport, tracks, mixer channels, and routing."
          isDemoMode={isDemo}
        />
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      {areaFilter === 'explorer' && (
        <section aria-label="Session Explorer" className="grid gap-4 lg:grid-cols-2">
          <div className={DAW_CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-sky-300" aria-hidden="true" />
                <h2 className="font-mono text-xs uppercase tracking-wider text-ink">4. Session Explorer</h2>
              </div>
              <SafetyTierBadge tier="observation" />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div className="outlined p-3">
                <dt className="micro text-ink-dim">Tempo</dt>
                <dd className="mt-1 font-mono text-base font-semibold text-ink">{snap.transport.tempo.bpm} BPM</dd>
              </div>
              <div className="outlined p-3">
                <dt className="micro text-ink-dim">Time Signature</dt>
                <dd className="mt-1 font-mono text-base font-semibold text-ink">
                  {snap.transport.timeSignature.numerator}/{snap.transport.timeSignature.denominator}
                </dd>
              </div>
              <div className="outlined p-3">
                <dt className="micro text-ink-dim">Transport</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <DawStatusPill tone={snap.transport.recording ? 'danger' : snap.transport.playing ? 'ok' : 'neutral'}>
                    {snap.transport.recording ? 'RECORDING' : snap.transport.playing ? 'PLAYING' : 'STOPPED / PAUSED'}
                  </DawStatusPill>
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <FreshnessBadge freshness={snap.freshness} stale={activeSession.stale} />
              <span className="chip">Digest: {snap.stateDigest.slice(0, 14)}</span>
              <span className="chip">Source: {snap.provenance.sourceEvidence}</span>
            </div>

            {snap.markers.status === 'available' ? (
              <div className="mt-4 outlined p-3">
                <div className="micro mb-2 text-ink-dim">Arrangement Markers ({snap.markers.value.length})</div>
                <div className="flex flex-wrap gap-2">
                  {snap.markers.value.map((mk) => (
                    <span key={mk.id} className="chip">
                      {mk.name} · beat {mk.positionBeats}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 font-mono text-[11px] text-ink-dim">Markers unavailable: {snap.markers.reason}</p>
            )}
          </div>

          <div className={DAW_CARD}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-mono text-xs uppercase tracking-wider text-ink">Session Intelligence & Drift Diff</h3>
              {intel && (
                <DawStatusPill tone={intel.confidence.level === 'high' ? 'ok' : 'warn'}>
                  CONFIDENCE {Math.round(intel.confidence.score * 100)}%
                </DawStatusPill>
              )}
            </div>

            {!intel ? (
              <p className="mt-3 text-xs text-ink-dim">No Session Intelligence report recorded yet for this session.</p>
            ) : (
              <div className="mt-3 space-y-3 text-xs">
                {intel.stateDiffFromPrevious && (
                  <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-amber-100">
                    <div className="font-mono font-semibold">{intel.stateDiffFromPrevious.freshnessTransition}</div>
                    <p className="mt-1">{intel.stateDiffFromPrevious.summary}</p>
                  </div>
                )}

                {intel.findings.map((f, idx) => (
                  <div key={idx} className="outlined p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-ink">{f.title}</span>
                      <DawStatusPill tone={f.severity === 'critical' ? 'danger' : f.severity === 'warning' ? 'warn' : 'neutral'}>
                        {f.severity.toUpperCase()}
                      </DawStatusPill>
                    </div>
                    <p className="mt-1 text-ink-dim">{f.detail}</p>
                  </div>
                ))}

                {intel.limitations.length > 0 && (
                  <div className="outlined border-rose-500/20 p-3">
                    <div className="micro text-ink-dim">Unobservable / Unsupported Boundaries</div>
                    <ul className="mt-1.5 list-disc pl-4 text-[11px] text-ink-dim">
                      {intel.limitations.map((l, idx) => (
                        <li key={idx}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {areaFilter === 'routing' && (
        <section aria-label="Track and Routing Inspector" className="grid gap-4 lg:grid-cols-2">
          <div className={DAW_CARD}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitFork size={16} className="text-emerald-300" aria-hidden="true" />
                <h2 className="font-mono text-xs uppercase tracking-wider text-ink">5. Track & Mixer Inspector</h2>
              </div>
              <SafetyTierBadge tier="observation" />
            </div>

            {snap.mixerChannels.status !== 'available' ? (
              <p className="mt-3 text-xs text-ink-dim">Mixer unavailable: {snap.mixerChannels.reason}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {snap.mixerChannels.value.map((ch) => (
                  <div key={ch.id} className="outlined flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs">
                    <div>
                      <div className="font-mono font-semibold text-ink">
                        #{ch.index} {ch.name} {ch.isMaster ? '(MASTER)' : ''}
                      </div>
                      <div className="font-mono text-[11px] text-ink-dim">
                        {ch.pluginSlots.length} insert slots · gain {ch.volumeDb ?? 'n/a'} dB
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ch.muted && <DawStatusPill tone="danger">MUTED</DawStatusPill>}
                      {ch.soloed && <DawStatusPill tone="warn">SOLO</DawStatusPill>}
                      <span className="chip">{ch.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={DAW_CARD}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-mono text-xs uppercase tracking-wider text-ink">Signal-Flow Routing Graph</h3>
              <SafetyTierBadge tier="observation" />
            </div>

            {snap.routing.status !== 'available' ? (
              <p className="mt-3 text-xs text-ink-dim">Routing graph unavailable: {snap.routing.reason}</p>
            ) : (
              <div className="mt-3 space-y-2.5 text-xs">
                {snap.routing.value.map((edge) => (
                  <div key={edge.id} className="outlined flex items-center justify-between gap-2 p-2.5">
                    <span className="font-mono text-ink">
                      {edge.sourceId} → {edge.targetId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {edge.sidechain && <DawStatusPill tone="warn">SIDECHAIN</DawStatusPill>}
                      <span className="chip">{edge.sendDb !== null ? `${edge.sendDb} dB` : `send ${edge.sendNormalized}`}</span>
                    </div>
                  </div>
                ))}

                {intel && intel.routingGraph.signalFlowChains.length > 0 && (
                  <div className="outlined p-3">
                    <div className="micro text-ink-dim">Verified Signal Flow Chains</div>
                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-sky-200">
                      {intel.routingGraph.signalFlowChains.map((chain, i) => (
                        <li key={i}>{chain.join(' -> ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
