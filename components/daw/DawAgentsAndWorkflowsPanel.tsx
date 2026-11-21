'use client';

import { Bot, Play, Workflow } from 'lucide-react';
import { useState } from 'react';
import type { DawAgentRunResultView, DawOverviewPayload, DawSessionView } from '@/lib/daw-types';
import { DAW_CARD, DawStatusPill, SafetyTierBadge } from './daw-ui-helpers';

type Props = {
  data: DawOverviewPayload;
  activeSession: DawSessionView | null;
  areaFilter: 'agents' | 'workflows';
  onRunAgent: (input: { agentName: string; goal: string; mode: 'analyze' | 'recommend' | 'prepare'; sessionId?: string }) => Promise<DawAgentRunResultView | null>;
  onRunWorkflow: (input: { workflowId: string; sessionId?: string }) => Promise<void>;
  busyAction: string | null;
};

export function DawAgentsAndWorkflowsPanel({
  data,
  activeSession,
  areaFilter,
  onRunAgent,
  onRunWorkflow,
  busyAction,
}: Props) {
  const [selectedAgent, setSelectedAgent] = useState(data.agents[0]?.name ?? 'daw-session-analyst');
  const [agentMode, setAgentMode] = useState<'analyze' | 'recommend' | 'prepare'>('analyze');
  const [goal, setGoal] = useState('Audit session routing, freshness, and Producer Edition compatibility.');
  const [lastAgentOut, setLastAgentOut] = useState<DawAgentRunResultView | null>(null);
  const isDemo = data.isDemoFixture;

  const submitAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onRunAgent({
      agentName: selectedAgent,
      goal,
      mode: agentMode,
      sessionId: activeSession?.sessionId,
    });
    if (res) setLastAgentOut(res);
  };

  return (
    <div className="grid gap-4">
      {areaFilter === 'agents' && (
        <section aria-label="DAW Agent Console" className="grid gap-4 lg:grid-cols-2">
          <div className={DAW_CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-sky-300" aria-hidden="true" />
                <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
                  8. DAW Agent Console ({data.agents.length} agents)
                </h2>
              </div>
              <SafetyTierBadge tier={agentMode === 'prepare' ? 'proposed_action' : agentMode === 'recommend' ? 'recommendation' : 'observation'} />
            </div>

            <form onSubmit={submitAgent} className="mt-4 space-y-3 text-xs">
              <label className="block">
                <span className="micro text-ink-dim">Select DAW Specialist Agent</span>
                <select
                  aria-label="DAW Specialist Agent"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-bg px-3 py-2 font-mono text-ink"
                >
                  {data.agents.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.class})
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="micro text-ink-dim">Execution Mode (Direct Execution Blocked)</span>
                <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Agent Console mode">
                  {(['analyze', 'recommend', 'prepare'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={agentMode === m}
                      onClick={() => setAgentMode(m)}
                      className={`chip ${agentMode === m ? 'border-accent bg-accent/15 text-ink' : 'text-ink-dim'}`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="micro text-ink-dim">Task Goal</span>
                <textarea
                  aria-label="Agent Goal"
                  rows={3}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-bg p-2.5 font-mono text-xs text-ink"
                />
              </label>

              <button
                type="submit"
                disabled={isDemo || busyAction === 'agent:run'}
                className="chip border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sky-100 hover:border-sky-300 disabled:opacity-50"
              >
                <Play size={11} className="mr-1.5 inline" aria-hidden="true" />
                {isDemo ? 'DISABLED IN DEMO FIXTURE MODE' : 'DISPATCH DAW AGENT'}
              </button>
            </form>

            {lastAgentOut && (
              <div className="mt-4 outlined p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-ink">
                    {lastAgentOut.selectedAgent} ({lastAgentOut.mode})
                  </span>
                  <DawStatusPill tone={lastAgentOut.ok ? 'ok' : 'danger'}>
                    {lastAgentOut.ok ? 'COMPLETED' : 'REFUSED / ERROR'}
                  </DawStatusPill>
                </div>
                {lastAgentOut.findings.map((f, i) => (
                  <p key={i} className="mt-1.5 text-ink">• {f}</p>
                ))}
                {lastAgentOut.error && (
                  <p className="mt-1.5 font-mono text-rose-200">{lastAgentOut.error.code}: {lastAgentOut.error.message}</p>
                )}
              </div>
            )}
          </div>

          <div className={DAW_CARD}>
            <div className="micro mb-3 text-ink-dim">DAW Agent Contracts & Refusal Boundaries</div>
            <div className="max-h-96 space-y-2.5 overflow-y-auto text-xs">
              {data.agents.map((ag) => (
                <div key={ag.name} className="outlined p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-ink">{ag.name}</span>
                    <DawStatusPill tone={ag.class === 'Execution' ? 'warn' : 'neutral'}>{ag.class}</DawStatusPill>
                  </div>
                  <p className="mt-1 text-ink-dim">{ag.role}</p>
                  <p className="mt-1 font-mono text-[11px] text-rose-200/80">Refuses: {ag.refuses}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {areaFilter === 'workflows' && (
        <section aria-label="Production Workflows" className={DAW_CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Workflow size={16} className="text-emerald-300" aria-hidden="true" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
                9. Canonical DAW Production Workflows ({data.workflows.length})
              </h2>
            </div>
            <SafetyTierBadge tier="observation" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.workflows.map((wf) => (
              <div key={wf.id} className="outlined flex flex-col justify-between gap-3 p-3.5 text-xs">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-ink">{wf.title}</span>
                    <DawStatusPill tone="neutral">{wf.domain}</DawStatusPill>
                  </div>
                  <p className="mt-1 text-ink-dim">{wf.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {wf.steps.map((s) => (
                      <span key={s.id} className="chip">{s.id}: {s.agent}</span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isDemo || !activeSession || busyAction === `wf:${wf.id}`}
                  onClick={() => onRunWorkflow({ workflowId: wf.id, sessionId: activeSession?.sessionId })}
                  className="chip w-fit border-emerald-400/35 hover:border-emerald-300 disabled:opacity-45"
                >
                  <Play size={11} className="mr-1 inline" aria-hidden="true" />
                  RUN READ-ONLY WORKFLOW
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
