'use client';

import { Home, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { ui } from '@/data/map';
import { fill } from '@/lib/labels';
import { searchJobs } from '@/lib/search';
import type { Department } from '@/lib/types';

type SearchBarProps = {
  departments: readonly Department[];
  onHome: () => void;
  /** Called with the best match when the operator presses Enter. */
  onFly: (jobId: string) => void;
};

/** Square home button plus the "Search jobs" field; Enter flies the camera to the top hit. */
export function SearchBar({ departments, onHome, onFly }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const hit = useMemo(() => searchJobs(departments, query, 1)[0], [departments, query]);
  const hint = query.trim() ? (hit ? fill(ui.search.hit, { title: hit.job.title }) : ui.search.miss) : '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (hit) onFly(hit.job.id);
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
      <form role="search" onSubmit={submit} className="w-48 md:w-60">
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
      </form>
    </div>
  );
}
