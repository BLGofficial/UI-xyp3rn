'use client';

import { AudioWaveform, Puzzle } from 'lucide-react';
import type { DawOverviewPayload } from '@/lib/daw-types';
import { DAW_CARD, DawStatusPill, EmptyHonestState, SafetyTierBadge } from './daw-ui-helpers';

type Props = {
  data: DawOverviewPayload;
  areaFilter: 'plugins' | 'audio';
};

export function DawPluginAndAudioBrainPanel({ data, areaFilter }: Props) {
  const { pluginBrain, audioBrain, isDemoFixture } = data;

  return (
    <div className="grid gap-4">
      {areaFilter === 'plugins' && (
        <section aria-label="Plugin Brain" className="grid gap-4 lg:grid-cols-2">
          <div className={DAW_CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Puzzle size={16} className="text-purple-300" aria-hidden="true" />
                <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
                  6. Plugin Brain Inventory ({pluginBrain.profiles.length})
                </h2>
              </div>
              <SafetyTierBadge tier="observation" />
            </div>

            {pluginBrain.profiles.length === 0 ? (
              <div className="mt-3">
                <EmptyHonestState
                  title="No Verified Host Plugins Loaded"
                  detail="Connect a session or probe installed VST3/Native directories so Plugin Brain can verify host installation independently of knowledge articles."
                  isDemoMode={isDemoFixture}
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2.5 text-xs">
                {pluginBrain.profiles.map((plg) => (
                  <div key={plg.id} className="outlined p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-semibold text-ink">{plg.identity.productName}</span>
                        <span className="ml-2 font-mono text-[11px] text-ink-dim">
                          {plg.format} · {plg.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DawStatusPill tone={plg.installation.installedOnHost === 'verified_installed' ? 'ok' : 'warn'}>
                          {plg.installation.installedOnHost === 'verified_installed' ? 'VERIFIED INSTALLED' : 'DOC ONLY / UNVERIFIED'}
                        </DawStatusPill>
                        <DawStatusPill tone={plg.compatibility.supportVerdict === 'verified_compatible' ? 'ok' : 'danger'}>
                          {plg.compatibility.supportVerdict}
                        </DawStatusPill>
                      </div>
                    </div>
                    {plg.compatibility.reasons.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-ink-dim">{plg.compatibility.reasons.join(' · ')}</p>
                    )}
                    {plg.parameters.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {plg.parameters.slice(0, 4).map((pm) => (
                          <span key={pm.id} className="chip">
                            {pm.name}: {pm.lastObservedDisplay ?? `${pm.min}-${pm.max}${pm.unit ?? ''}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={DAW_CARD}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-mono text-xs uppercase tracking-wider text-ink">Signal-Chain Analysis</h3>
              <SafetyTierBadge tier="recommendation" />
            </div>
            {pluginBrain.chainReports.length === 0 ? (
              <p className="mt-3 text-xs text-ink-dim">No active mixer/insert plugin chain graphs extracted.</p>
            ) : (
              <div className="mt-3 space-y-3 text-xs">
                {pluginBrain.chainReports.map((rep) => (
                  <div key={rep.chainId} className="outlined p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-ink">
                        {rep.chainId} ({rep.workflowKind})
                      </span>
                      <DawStatusPill tone={rep.compatibleForHost ? 'ok' : 'danger'}>
                        {rep.compatibleForHost ? 'EDITION COMPATIBLE' : 'COMPATIBILITY ISSUE'}
                      </DawStatusPill>
                    </div>
                    <p className="mt-1 text-ink-dim">{rep.summary}</p>
                    {rep.signalFlowIssues.map((iss, idx) => (
                      <div key={idx} className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-100">
                        [{iss.severity.toUpperCase()}] {iss.code}: {iss.summary}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {areaFilter === 'audio' && (
        <section aria-label="Audio Brain" className={DAW_CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AudioWaveform size={16} className="text-amber-300" aria-hidden="true" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
                7. Audio Brain DSP, Probabilistic MIR & Diagnostics ({audioBrain.recentAnalyses.length})
              </h2>
            </div>
            <SafetyTierBadge tier="recommendation" />
          </div>

          {audioBrain.recentAnalyses.length === 0 ? (
            <div className="mt-3">
              <EmptyHonestState
                title="No Audio Brain Analyses Computed"
                detail="Submit an approved render WAV or TRACE analysis JSON through Audio Brain or load the demonstration fixture to inspect LUFS, true peak, stereo correlation, and probabilistic MIR."
                isDemoMode={isDemoFixture}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {audioBrain.recentAnalyses.map((aud) => (
                <div key={aud.reportId} className="outlined p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-sm font-semibold text-ink">{aud.acquisition.label}</span>
                      <div className="font-mono text-[11px] text-ink-dim">
                        SHA-256: {aud.acquisition.sha256AfterRead.slice(0, 16)} · readOnlyVerified={String(aud.acquisition.readOnlyVerified)}
                      </div>
                    </div>
                    <DawStatusPill
                      tone={
                        aud.diagnostics.overallVerdict === 'PASS'
                          ? 'ok'
                          : aud.diagnostics.overallVerdict === 'WARN'
                            ? 'warn'
                            : 'danger'
                      }
                    >
                      VERDICT: {aud.diagnostics.overallVerdict} ({aud.diagnostics.stage.toUpperCase()})
                    </DawStatusPill>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="rounded-lg bg-white/[0.03] p-2.5">
                      <div className="micro text-ink-dim">Integrated LUFS</div>
                      <div className="mt-1 font-mono text-sm text-ink">{aud.features.loudness.integratedLufs} LUFS</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5">
                      <div className="micro text-ink-dim">True Peak</div>
                      <div className="mt-1 font-mono text-sm text-ink">
                        {aud.features.truePeakDbtp.status === 'available'
                          ? `${aud.features.truePeakDbtp.value} dBTP`
                          : aud.features.truePeakDbtp.reason}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5">
                      <div className="micro text-ink-dim">Crest / RMS</div>
                      <div className="mt-1 font-mono text-sm text-ink">
                        {aud.features.crestFactorDb} dB / {aud.features.rmsDbfs} dBFS
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5">
                      <div className="micro text-ink-dim">Stereo Correlation</div>
                      <div className="mt-1 font-mono text-sm text-ink">
                        {aud.features.stereo.correlation} ({aud.features.stereo.widthPct}% width)
                      </div>
                    </div>
                  </div>

                  {aud.mir.status === 'available' && (
                    <div className="mt-3 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-violet-200">
                          PROBABILISTIC MIR ESTIMATES (NOT GROUND TRUTH)
                        </span>
                        <span className="chip">{aud.mir.value.sourceClassification.primaryClass}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink">
                        <span className="chip">Tempo ~{aud.mir.value.tempoEstimate.bpm ?? 'n/a'} BPM ({Math.round(aud.mir.value.tempoEstimate.confidence * 100)}%)</span>
                        <span className="chip">Key ~{aud.mir.value.keyEstimate.key} {aud.mir.value.keyEstimate.scale} ({Math.round(aud.mir.value.keyEstimate.confidence * 100)}%)</span>
                      </div>
                    </div>
                  )}

                  {aud.recommendations.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="micro text-ink-dim">Advisory Recommendations (Requires Approval / Manual Action)</div>
                      {aud.recommendations.map((rec, i) => (
                        <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-400/25 bg-violet-500/5 px-3 py-2">
                          <div>
                            <span className="font-mono font-semibold text-ink">{rec.title}</span>
                            <span className="ml-2 text-ink-dim">{rec.rationale}</span>
                          </div>
                          <span className="chip">{rec.suggestedDelta}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
