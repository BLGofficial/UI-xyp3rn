'use client';

import { Download, Info, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { ui } from '@/data/map';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { pathTree } from '@/lib/vault';
import type { Autonomy, Department, Job, Status } from '@/lib/types';

const LADDER: readonly Autonomy[] = ['human-led', 'human-assisted', 'fully-autonomous'];
const STATUSES: readonly Status[] = ['not-started', 'in-development', 'live'];

type JobPanelProps = {
  job: Job;
  department: Department;
  /** Status after the operator's overrides. */
  status: Status;
  /** Job id to title, for the BUILDS ON chips. */
  titles: ReadonlyMap<string, string>;
  /** False while the skill sheet is on top of the panel. */
  trapFocus: boolean;
  onClose: () => void;
  onNavigate: (jobId: string) => void;
  onStatus: (status: Status) => void;
  onOpenSkill: () => void;
};

function Section({ n, label, children }: { n: number; label?: string; children: ReactNode }) {
  return (
    <section data-section={n}>
      {label && <h3 className="micro mb-2 text-ink-dim">{label}</h3>}
      {children}
    </section>
  );
}

/** View 4: the 14-section frosted job card. Every string comes from data/map.ts. */
export function JobPanel({
  job,
  department,
  status,
  titles,
  trapFocus,
  onClose,
  onNavigate,
  onStatus,
  onOpenSkill,
}: JobPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [help, setHelp] = useState(false);
  useDialogFocus(ref, trapFocus);
  const dim = job.stub ? 'text-ink-dim' : 'text-ink';

  return (
    <>
      <div className="fade-in fixed inset-0 z-40 bg-bg/55" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-panel-title"
        tabIndex={-1}
        className="frost sheet-in fixed inset-x-0 bottom-0 z-50 flex h-[92vh] flex-col rounded-t-[14px] outline-none md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:h-auto md:w-[min(720px,calc(100vw-2rem))] md:rounded-[14px]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={ui.panel.close}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-hairline text-ink-dim hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 pb-8 pt-6 md:px-8">
          <Section n={1}>
            <p className="micro pr-12 text-accent">{job.stub ? ui.stub.eyebrow : ui.autonomy[job.autonomy]}</p>
          </Section>

          <Section n={2}>
            <h2 id="job-panel-title" className="pr-10 text-[26px] font-semibold leading-tight tracking-tight">
              {job.title}
              {job.startHere && (
                <span className="micro ml-3 align-middle text-accent">{ui.focus.startHere}</span>
              )}
            </h2>
          </Section>

          <Section n={3}>
            <p className="text-sm text-ink-dim">
              {department.name} · {job.cluster}
            </p>
            <pre aria-label={ui.panel.path} className="mt-2 overflow-x-auto font-mono text-[11px] leading-5 text-ink-dim">
              {pathTree(department.folder, job.file).join('\n')}
            </pre>
          </Section>

          <Section n={4}>
            <p className={`text-[15px] leading-relaxed ${dim}`}>{job.summary}</p>
          </Section>

          <Section n={5}>
            {/* A stub has no skill file yet, so the bar says so instead of offering a download. */}
            <button
              type="button"
              onClick={onOpenSkill}
              disabled={job.stub}
              aria-label={job.stub ? undefined : ui.panel.download.aria}
              className="outlined flex w-full items-center gap-3 px-4 py-3 text-left text-sm enabled:hover:border-ink/40 disabled:border-dashed"
            >
              <Download size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ink-dim" />
              {job.stub ? (
                <span className="min-w-0 flex-1 text-ink-dim">{ui.stub.text}</span>
              ) : (
                <>
                  <span className="min-w-0 flex-1">
                    <strong className="font-semibold">{ui.panel.download.strong}</strong>{' '}
                    <span className="text-ink-dim">{ui.panel.download.rest}</span>
                  </span>
                  <span className="shrink-0 font-emphasis text-lg italic text-accent">{ui.panel.download.cta}</span>
                </>
              )}
            </button>
          </Section>

          <Section n={6} label={ui.panel.breaksInto}>
            <ul className="flex flex-wrap gap-2">
              {job.breaksInto.length === 0 && <li className="text-sm text-ink-dim">{ui.panel.none}</li>}
              {job.breaksInto.map((item) => (
                <li key={item} className="chip">
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section n={7} label={ui.panel.buildsOn}>
            <ul className="flex flex-wrap gap-2">
              {job.buildsOn.length === 0 && <li className="text-sm text-ink-dim">{ui.panel.none}</li>}
              {job.buildsOn.map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => onNavigate(id)} className="chip border-dashed hover:border-ink/50">
                    {titles.get(id) ?? id}
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section n={8} label={ui.panel.replaces}>
            <p className={`outlined px-4 py-3 text-sm leading-relaxed ${dim}`}>{job.replaces}</p>
          </Section>

          <Section n={9} label={ui.panel.ladder}>
            <dl className="divide-y divide-hairline border-y border-hairline">
              {LADDER.map((level) => {
                const current = !job.stub && level === job.autonomy;
                return (
                  <div key={level} className="flex gap-4 py-2.5" data-current={current}>
                    <dt className={`micro w-[110px] shrink-0 pt-0.5 ${current ? 'font-bold text-ink' : 'text-ink-dim'}`}>
                      {ui.autonomy[level]}
                    </dt>
                    <dd className={`text-sm leading-relaxed ${current ? 'font-semibold text-ink' : 'text-ink-dim'}`}>
                      {job.ladder[level]}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Section>

          <Section n={10} label={ui.panel.human}>
            <p className={`text-sm leading-relaxed ${dim}`}>{job.human}</p>
          </Section>

          <Section n={11} label={ui.panel.buildNotes}>
            <p className={`text-sm leading-relaxed ${dim}`}>{job.buildNotes}</p>
          </Section>

          <Section n={12} label={ui.panel.takeSkill}>
            <button
              type="button"
              onClick={onOpenSkill}
              disabled={job.stub}
              className="outlined block w-full px-4 py-3 text-left enabled:hover:border-ink/40 disabled:border-dashed"
            >
              <span className="block font-mono text-sm text-ink">{job.skill.name}</span>
              <span className={`mt-1 block text-sm ${dim}`}>{job.skill.blurb}</span>
              <span className="micro mt-3 block text-ink-dim">{ui.panel.terminal}</span>
              <span className="mt-1 block overflow-x-auto whitespace-nowrap font-mono text-xs text-ink-dim">
                {job.skill.installCmd}
              </span>
            </button>
          </Section>

          <Section n={13} label={ui.status.label}>
            <div role="group" aria-label={ui.status.label} className="grid grid-cols-3 overflow-hidden rounded-lg border border-hairline">
              {STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === status}
                  onClick={() => onStatus(option)}
                  className={`micro px-2 py-2.5 ${option === status ? 'bg-accent font-bold text-bg' : 'text-ink-dim hover:text-ink'}`}
                >
                  {ui.status.options[option]}
                </button>
              ))}
            </div>
          </Section>

          <Section n={14}>
            {/* STUB: the source shows this button but defines nothing behind it. */}
            <button
              type="button"
              aria-expanded={help}
              onClick={() => setHelp((value) => !value)}
              className="outlined micro flex w-full items-center justify-center gap-2 px-4 py-3 text-ink hover:border-ink/40"
            >
              {ui.panel.help}
              <Info size={13} strokeWidth={1.5} aria-hidden="true" />
            </button>
            {help && <p className="mt-2 font-mono text-xs text-ink-dim">{ui.panel.helpStub}</p>}
          </Section>
        </div>
      </div>
    </>
  );
}
