'use client';

import type { ReactNode } from 'react';
import type { UiActionTier } from '@/lib/daw-types';

export const DAW_CARD = 'glass-card rounded-2xl p-4 sm:p-5';

export function SafetyTierBadge({ tier }: { tier: UiActionTier }) {
  const styles: Record<UiActionTier, { label: string; cls: string }> = {
    observation: {
      label: 'OBSERVATION · READ-ONLY',
      cls: 'border-sky-400/35 bg-sky-500/12 text-sky-200',
    },
    recommendation: {
      label: 'RECOMMENDATION · ADVISORY ONLY',
      cls: 'border-violet-400/35 bg-violet-500/12 text-violet-200',
    },
    proposed_action: {
      label: 'PROPOSED ACTION · DRY-RUN',
      cls: 'border-amber-400/45 bg-amber-500/14 text-amber-200',
    },
    approved_execution: {
      label: 'APPROVED EXECUTION · MUTATING',
      cls: 'border-rose-500/55 bg-rose-500/18 text-rose-100',
    },
  };
  const cfg = styles[tier];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function DawStatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'neutral'; children: ReactNode }) {
  const map = {
    ok: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200',
    warn: 'border-amber-400/45 bg-amber-500/14 text-amber-200',
    danger: 'border-rose-500/50 bg-rose-500/16 text-rose-200',
    neutral: 'border-white/15 bg-white/5 text-ink-dim',
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${map[tone]}`}>
      {children}
    </span>
  );
}

export function FreshnessBadge({ freshness, stale }: { freshness: string; stale: boolean }) {
  const tone = stale || freshness === 'stale' ? 'warn' : freshness === 'observed' ? 'ok' : 'neutral';
  return (
    <DawStatusPill tone={tone}>
      {stale || freshness === 'stale' ? `STALE · ${freshness.toUpperCase()}` : freshness.toUpperCase()}
    </DawStatusPill>
  );
}

export function EmptyHonestState({
  title,
  detail,
  isDemoMode,
}: {
  title: string;
  detail: string;
  isDemoMode: boolean;
}) {
  return (
    <div className="outlined rounded-xl border-white/15 p-4 text-xs text-ink-dim">
      <div className="font-mono uppercase tracking-wider text-ink">{title}</div>
      <p className="mt-1 leading-relaxed">{detail}</p>
      {!isDemoMode && (
        <p className="mt-1.5 font-mono text-[11px] text-amber-200/80">
          Live telemetry is never fabricated when the DAW host is disconnected.
        </p>
      )}
    </div>
  );
}
