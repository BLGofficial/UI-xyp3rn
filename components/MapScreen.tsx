'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { departments, ui } from '@/data/map';
import { readStatusOverrides, resolveStatus, writeStatusOverrides } from '@/lib/storage';
import { parseOpenParam, serializeOpenParam } from '@/lib/url';
import type { DepartmentId, Status } from '@/lib/types';
import { useChrome } from './ChromeShell';
import { ConstellationCanvas, type FlyRequest } from './ConstellationCanvas';
import { JobPanel } from './JobPanel';
import { SearchBar } from './SearchBar';
import { SectorCycler } from './SectorCycler';
import { SkillViewer } from './SkillViewer';

const ALL: DepartmentId[] = departments.map((dept) => dept.id);
const JOBS = new Map(departments.flatMap((dept, index) => dept.jobs.map((job) => [job.id, { job, dept, index }] as const)));
const TITLES = new Map([...JOBS].map(([id, entry]) => [id, entry.job.title] as const));

/** Views 1-5: owns map state and wires the canvas, search, cycler, job panel and skill sheet together. */
export function MapScreen() {
  const { active, setActive } = useChrome();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL seeds the state once; after that state leads and the URL is rewritten to match.
  const [open, setOpen] = useState<DepartmentId[]>(() => parseOpenParam(searchParams?.get('open') ?? null, ALL));
  const [focusId, setFocusId] = useState<DepartmentId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewer, setViewer] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [strip, setStrip] = useState(0);
  const [fly, setFly] = useState<FlyRequest | null>(null);

  // Read after mount: localStorage does not exist during prerender.
  useEffect(() => setStatuses(readStatusOverrides()), []);

  const commitOpen = useCallback(
    (next: DepartmentId[]) => {
      setOpen(next);
      const value = serializeOpenParam(next, ALL);
      const params = new URLSearchParams(window.location.search);
      params.delete('open');
      // Built by hand so the commas stay readable instead of becoming %2C.
      const query = [params.toString(), value === null ? '' : `open=${value}`].filter(Boolean).join('&');
      window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
    },
    [pathname],
  );

  const toggle = useCallback(
    (id: DepartmentId) => commitOpen(open.includes(id) ? open.filter((item) => item !== id) : [...open, id]),
    [open, commitOpen],
  );

  const focusSector = useCallback(
    (id: DepartmentId) => {
      setActive(ALL.indexOf(id));
      setFocusId(id);
    },
    [setActive],
  );

  const selectJob = useCallback(
    (jobId: string, options: { fly?: boolean } = {}) => {
      const entry = JOBS.get(jobId);
      if (!entry) return;
      setActive(entry.index);
      // A job inside a collapsed sector would open a panel for a node nobody can see.
      if (!open.includes(entry.dept.id)) commitOpen([...open, entry.dept.id]);
      if (options.fly || focusId) setFocusId(entry.dept.id);
      if (options.fly) setFly((previous) => ({ jobId, nonce: (previous?.nonce ?? 0) + 1 }));
      setViewer(false);
      setSelectedId(jobId);
    },
    [open, focusId, commitOpen, setActive],
  );

  const cycle = useCallback(
    (delta: number) => {
      const next = (active + delta + ALL.length) % ALL.length;
      setActive(next);
      if (!focusId) setStrip((value) => value + 1);
    },
    [active, focusId, setActive],
  );

  // The rail and the cycler change the active sector; a focused view follows it.
  useEffect(() => {
    const id = ALL[active];
    if (id) setFocusId((current) => (current && current !== id ? id : current));
  }, [active]);

  const goHome = useCallback(() => {
    setViewer(false);
    setSelectedId(null);
    setFocusId(null);
  }, []);

  const changeStatus = useCallback(
    (status: Status) => {
      if (!selectedId) return;
      const next = { ...statuses, [selectedId]: status };
      // State first: the node restyles even when the write fails (quota, private mode).
      setStatuses(next);
      writeStatusOverrides(next);
    },
    [selectedId, statuses],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // One layer per press: skill sheet, then panel, then focus.
        if (viewer) setViewer(false);
        else if (selectedId) setSelectedId(null);
        else if (focusId) setFocusId(null);
        return;
      }
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (typing || selectedId) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        cycle(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewer, selectedId, focusId, cycle]);

  const selected = selectedId ? JOBS.get(selectedId) : undefined;
  const activeDept = departments[active] ?? departments[0]!;
  const allOpen = open.length === ALL.length;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <ConstellationCanvas
        departments={departments}
        active={active}
        open={open}
        focusId={focusId}
        selectedId={selectedId}
        statuses={statuses}
        fly={fly}
        strip={strip}
        onToggle={toggle}
        onFocus={focusSector}
        onSelect={selectJob}
      />

      <div className="absolute left-3 top-[60px] z-20 flex flex-col items-start gap-1 md:left-4 md:top-4">
        <SearchBar departments={departments} onHome={goHome} onFly={(jobId) => selectJob(jobId, { fly: true })} />
        {focusId && (
          <button type="button" onClick={() => setFocusId(null)} className="micro rounded px-1 py-2 text-ink-dim hover:text-ink">
            {ui.focus.back}
          </button>
        )}
      </div>

      {!focusId && (
        <div className="absolute left-1/2 top-[112px] z-20 -translate-x-1/2 md:top-[62px]">
          <button
            type="button"
            onClick={() => commitOpen(allOpen ? [] : ALL)}
            className="micro rounded-full px-3 py-2 text-ink-dim hover:text-ink"
          >
            {allOpen ? ui.overview.collapseAll : ui.overview.expandAll}
          </button>
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 md:bottom-5">
        <SectorCycler department={activeDept} onPrevious={() => cycle(-1)} onNext={() => cycle(1)} />
      </div>

      {selected && (
        <JobPanel
          key={selected.job.id}
          job={selected.job}
          department={selected.dept}
          status={resolveStatus(selected.job, statuses)}
          titles={TITLES}
          trapFocus={!viewer}
          onClose={() => setSelectedId(null)}
          onNavigate={selectJob}
          onStatus={changeStatus}
          onOpenSkill={() => setViewer(true)}
        />
      )}
      {selected && viewer && <SkillViewer job={selected.job} onClose={() => setViewer(false)} />}
    </div>
  );
}
