'use client';

import { AlertOctagon, CheckCircle2, ClipboardCheck, History, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { DawOverviewPayload, DawPreparedProposalView, DawSessionView } from '@/lib/daw-types';
import { DAW_CARD, DawStatusPill, EmptyHonestState, SafetyTierBadge } from './daw-ui-helpers';

type Props = {
  data: DawOverviewPayload;
  activeSession: DawSessionView | null;
  areaFilter: 'approvals' | 'history' | 'evaluation';
  onProposeCommand: (input: {
    sessionId: string;
    kind: string;
    capabilityId: string;
    targetRef: string;
    params: Record<string, unknown>;
  }) => Promise<void>;
  onDecideApproval: (input: {
    approvalId: string;
    decision: 'approved' | 'rejected';
    approver: string;
    reason: string;
    confirmDangerous: boolean;
  }) => Promise<void>;
  onRollbackReceipt: (input: { receiptId: string; actor: string; reason: string }) => Promise<void>;
  onRunEvaluation: () => Promise<void>;
  busyAction: string | null;
};

export function DawCommandSafetyPanel({
  data,
  activeSession,
  areaFilter,
  onProposeCommand,
  onDecideApproval,
  onRollbackReceipt,
  onRunEvaluation,
  busyAction,
}: Props) {
  const [approverName, setApproverName] = useState('blago-operator');
  const [decisionReason, setDecisionReason] = useState('Verified dry-run diff and headroom limits');
  const [dangerConfirmed, setDangerConfirmed] = useState<Record<string, boolean>>({});
  const isDemo = data.isDemoFixture;

  const isDangerous = (item: DawPreparedProposalView) =>
    item.riskLevel === 'high' ||
    item.riskLevel === 'critical' ||
    item.commandClass === 'potentially_destructive' ||
    item.commandClass === 'irreversible';

  return (
    <div className="grid gap-4">
      {areaFilter === 'approvals' && (
        <section aria-label="Command Approval Queue" className={DAW_CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-300" aria-hidden="true" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
                10. Command Approval Queue ({data.pendingApprovals.length})
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <SafetyTierBadge tier="proposed_action" />
              <SafetyTierBadge tier="approved_execution" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <label className="font-mono text-ink-dim">
                Human Approver:
                <input
                  aria-label="Human Approver"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="ml-2 rounded border border-white/15 bg-bg px-2 py-1 font-mono text-ink"
                />
              </label>
              <label className="font-mono text-ink-dim">
                Reason:
                <input
                  aria-label="Decision Reason"
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  className="ml-2 w-60 rounded border border-white/15 bg-bg px-2 py-1 font-mono text-ink"
                />
              </label>
            </div>
            {activeSession && !isDemo && (
              <button
                type="button"
                disabled={busyAction === 'propose'}
                onClick={() =>
                  onProposeCommand({
                    sessionId: activeSession.sessionId,
                    kind: 'mixer.volume_pan_mute',
                    capabilityId: 'daw.mixer.fader_pan_mute',
                    targetRef: 'mixer:insert:1',
                    params: { deltaDb: -1.0 },
                  })
                }
                className="chip border-amber-400/45 text-amber-100 hover:border-amber-300 disabled:opacity-50"
              >
                STAGE DRY-RUN MIXER TRIM (-1.0 dB)
              </button>
            )}
          </div>

          {data.pendingApprovals.length === 0 ? (
            <div className="mt-3">
              <EmptyHonestState
                title="No Queued DAW Commands"
                detail="All staged DAW commands appear here as Proposed Actions with dry-run diffs before any live host execution."
                isDemoMode={isDemo}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-xs">
              {data.pendingApprovals.map((item) => {
                const dangerous = isDangerous(item);
                const checked = Boolean(dangerConfirmed[item.approvalId]);
                return (
                  <div
                    key={item.approvalId}
                    data-risk-level={item.riskLevel}
                    data-command-class={item.commandClass}
                    className={`rounded-xl border p-4 ${
                      dangerous
                        ? 'border-rose-500/60 bg-rose-950/25 shadow-[0_0_24px_rgba(229,72,77,0.14)]'
                        : 'outlined border-amber-400/35'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {dangerous && <AlertOctagon size={15} className="text-rose-400" aria-hidden="true" />}
                        <span className="font-mono text-sm font-semibold text-ink">{item.capabilityId}</span>
                        <DawStatusPill tone={dangerous ? 'danger' : 'warn'}>
                          {item.commandClass.toUpperCase()} · RISK {item.riskLevel.toUpperCase()}
                        </DawStatusPill>
                        <DawStatusPill tone={item.status === 'approved' ? 'ok' : item.status === 'rejected' ? 'neutral' : 'warn'}>
                          {item.status.toUpperCase()}
                        </DawStatusPill>
                      </div>
                      <SafetyTierBadge tier={item.status === 'approved' ? 'approved_execution' : 'proposed_action'} />
                    </div>

                    <div className="mt-2 font-mono text-[11px] text-ink-dim">
                      Target: {item.targetRef} · Proposer: {item.proposer} · Rollback Supported: {String(item.rollbackSupported)} · Fresh: {String(item.fresh)}
                    </div>

                    {item.diff.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {item.diff.map((d, i) => (
                          <span key={i} className="chip">
                            {d.field}: {String(d.before)} → {String(d.after)} {d.unit ?? ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.warnings.map((w, i) => (
                      <p key={i} className={`mt-2 font-mono text-[11px] ${dangerous ? 'text-rose-200' : 'text-amber-200'}`}>
                        ⚠ {w}
                      </p>
                    ))}

                    {item.status === 'pending' && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                        {dangerous ? (
                          <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-[11px] text-rose-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => setDangerConfirmed((prev) => ({ ...prev, [item.approvalId]: e.target.checked }))}
                            />
                            CONFIRM DANGEROUS ACTION (NO AUTO-ROLLBACK / HIGH IMPACT)
                          </label>
                        ) : (
                          <span className="font-mono text-[11px] text-ink-dim">Human decision required (F35 D2)</span>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isDemo || busyAction === `decide:${item.approvalId}`}
                            onClick={() =>
                              onDecideApproval({
                                approvalId: item.approvalId,
                                decision: 'rejected',
                                approver: approverName,
                                reason: decisionReason,
                                confirmDangerous: false,
                              })
                            }
                            className="chip hover:border-white/30 disabled:opacity-45"
                          >
                            <XCircle size={12} className="mr-1 inline" aria-hidden="true" />
                            REJECT
                          </button>
                          <button
                            type="button"
                            disabled={isDemo || (dangerous && !checked) || busyAction === `decide:${item.approvalId}`}
                            onClick={() =>
                              onDecideApproval({
                                approvalId: item.approvalId,
                                decision: 'approved',
                                approver: approverName,
                                reason: decisionReason,
                                confirmDangerous: dangerous ? checked : true,
                              })
                            }
                            className={`rounded-md border px-3 py-1 font-mono text-[11px] font-semibold transition disabled:opacity-45 ${
                              dangerous
                                ? 'border-rose-400 bg-rose-600/30 text-rose-100 hover:bg-rose-600/45'
                                : 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                            }`}
                          >
                            <CheckCircle2 size={12} className="mr-1 inline" aria-hidden="true" />
                            {dangerous ? 'APPROVE & EXECUTE DANGEROUS ACTION' : 'APPROVE & EXECUTE'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {areaFilter === 'history' && (
        <section aria-label="Execution History" className={DAW_CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History size={16} className="text-rose-300" aria-hidden="true" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
                11. Execution History & Receipts ({data.executionHistory.length})
              </h2>
            </div>
            <SafetyTierBadge tier="approved_execution" />
          </div>

          {data.executionHistory.length === 0 ? (
            <div className="mt-3">
              <EmptyHonestState
                title="No Executed Command Receipts"
                detail="Only approved and executed DAW commands appear here with full lifecycle stage trace, readback postconditions, and genuine rollback support status."
                isDemoMode={isDemo}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-xs">
              {data.executionHistory.map((rc) => (
                <div key={rc.receiptId} className="outlined p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-semibold text-ink">{rc.capabilityId}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-dim">
                        {rc.receiptId} · by {rc.executedBy}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DawStatusPill tone={rc.status === 'succeeded' ? 'ok' : rc.status === 'rolled_back' ? 'warn' : 'danger'}>
                        {rc.status.toUpperCase()}
                      </DawStatusPill>
                      <button
                        type="button"
                        disabled={isDemo || !rc.rollbackSupported || rc.rollbackStatus === 'rolled_back' || busyAction === `rollback:${rc.receiptId}`}
                        onClick={() =>
                          onRollbackReceipt({
                            receiptId: rc.receiptId,
                            actor: approverName,
                            reason: 'Operator requested UI rollback',
                          })
                        }
                        className="chip border-amber-400/40 text-amber-100 disabled:opacity-40"
                      >
                        <RotateCcw size={11} className="mr-1 inline" aria-hidden="true" />
                        {rc.rollbackStatus === 'rolled_back'
                          ? 'ROLLED BACK'
                          : rc.rollbackSupported
                            ? 'ROLLBACK'
                            : 'ROLLBACK UNSUPPORTED'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-ink-dim">
                    Readback Verified: {String(rc.verifiedByReadback)} · Postcondition: {String(rc.postconditionVerified)} · Stages: {rc.lifecycleStages.join(' -> ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {areaFilter === 'evaluation' && (
        <section aria-label="Evaluation and Diagnostics" className={DAW_CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} className="text-emerald-300" aria-hidden="true" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink">12. Evaluation & Diagnostics</h2>
            </div>
            <button
              type="button"
              disabled={isDemo || busyAction === 'eval'}
              onClick={onRunEvaluation}
              className="chip border-emerald-400/40 text-emerald-100 hover:border-emerald-300 disabled:opacity-45"
            >
              RUN MEASURABLE BENCHMARK SUITE
            </button>
          </div>

          {!data.evaluation ? (
            <div className="mt-3">
              <EmptyHonestState
                title="No Evaluation Benchmark Executed in Current Runtime"
                detail="Run the benchmark suite via OS3 API to verify detection, state observation, session completeness, plugin/audio accuracy, command safety, and recovery."
                isDemoMode={isDemo}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 outlined p-3">
                <div>
                  <span className="font-mono font-semibold text-ink">
                    Benchmark {data.evaluation.evaluationId}
                  </span>
                  <div className="font-mono text-[11px] text-ink-dim">
                    {data.evaluation.passedCases}/{data.evaluation.totalCases} passed · Scope: verified-fixtures-and-adapters
                  </div>
                </div>
                <DawStatusPill tone={data.evaluation.overallPassed ? 'ok' : 'danger'}>
                  {data.evaluation.overallPassed ? 'BASELINE PASS' : `${data.evaluation.failedCases} FAILED`}
                </DawStatusPill>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {data.evaluation.categories.map((cat) => (
                  <div key={cat.category} className="outlined p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[11px] text-ink">{cat.category}</span>
                      <DawStatusPill tone={cat.passedThreshold ? 'ok' : 'danger'}>
                        {Math.round(cat.accuracy * 100)}%
                      </DawStatusPill>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-ink-dim">
                      {cat.passedCases}/{cat.totalCases} cases passed
                    </div>
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
