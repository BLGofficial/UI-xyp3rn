'use client';

import { Home, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ui } from '@/data/map';
import { searchLiveVault } from '@/lib/gateway';
import { fill } from '@/lib/labels';
import { searchJobs } from '@/lib/search';
import type { Department, VaultSearchHit } from '@/lib/types';

type SearchBarProps = {
  departments: readonly Department[];
  onHome: () => void;
  /** Called with the best match when the operator presses Enter. */
  onFly: (jobId: string) => void;
};

/** Square home button plus the "Search jobs" field backed by Vault Engine; Enter flies the camera to the top hit. */
export function SearchBar({ departments, onHome, onFly }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [vaultHits, setVaultHits] = useState<VaultSearchHit[]>([]);
  const localHit = useMemo(() => searchJobs(departments, query, 1)[0], [departments, query]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setVaultHits([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchLiveVault(trimmed, { departments, limit: 5 }).then((hits) => {
        if (!active) return;
        setVaultHits(hits.filter((h) => h.mode === 'live-gateway'));
      });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, departments]);

  const resolvedTopLiveJob = useMemo(() => {
    if (localHit) return localHit.job;
    for (const hit of vaultHits) {
      for (const dept of departments) {
        const match = dept.jobs.find((j) => j.file.toLowerCase() === hit.vaultPath.toLowerCase());
        if (match) return match;
      }
    }
    return undefined;
  }, [localHit, vaultHits, departments]);

  const hint = query.trim()
    ? resolvedTopLiveJob
      ? fill(ui.search.hit, { title: resolvedTopLiveJob.title })
      : vaultHits[0]
        ? `Vault · ${vaultHits[0].title}`
        : ui.search.miss
    : '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (resolvedTopLiveJob) {
      onFly(resolvedTopLiveJob.id);
      setVaultHits([]);
    }
  };

  return (
    <div className="flex items-start gap-2">
      <button
        type="button"
        onClick={onHome}
        aria-label={ui.search.home}
        className="frost grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-dim hover:text-ink"
      >
        <Home size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <form role="search" onSubmit={submit} className="w-48 md:w-64">
        <label className="frost flex h-10 items-center gap-2 rounded-lg px-3">
          <Search size={14} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ink-dim" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ui.search.placeholder}
            aria-label={ui.search.label}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-dim focus:outline-none"
          />
        </label>
        <p aria-live="polite" className="mt-1 h-4 truncate pl-1 font-mono text-[11px] text-ink-dim">
          {hint}
        </p>
        {vaultHits.length > 0 && (
          <ul
            aria-label="Live Vault search results"
            className="frost mt-1 flex max-h-44 flex-col divide-y divide-hairline overflow-y-auto rounded-lg p-1"
          >
            {vaultHits.map((vHit) => {
              const matchedJob = departments
                .flatMap((d) => d.jobs)
                .find((j) => j.file.toLowerCase() === vHit.vaultPath.toLowerCase());
              return (
                <li key={vHit.vaultPath}>
                  <button
                    type="button"
                    disabled={!matchedJob}
                    onClick={() => {
                      if (matchedJob) {
                        onFly(matchedJob.id);
                        setVaultHits([]);
                      }
                    }}
                    className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-ink/5 disabled:opacity-60"
                  >
                    <span className="truncate text-xs font-medium text-ink">{vHit.title}</span>
                    <span className="truncate font-mono text-[10px] text-ink-dim">{vHit.vaultPath}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </form>
    </div>
  );
}
