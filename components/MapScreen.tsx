'use client';

import { Box, Minus, Plus, RotateCcw } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { departments as seedDepartments, ui } from '@/data/map';
import { dispatchJarvis } from '@/lib/gateway';
import {
  fetchRuntimeRuns,
  fetchSystemOverview,
  fetchVaultTree,
  mergeVaultTreeIntoDepartments,
} from '@/lib/os3-adapter';
import { resolveStatus } from '@/lib/storage';
import { parseOpenParam, serializeOpenParam } from '@/lib/url';
import type { Department, DepartmentId, GatewayMode, Job, Status } from '@/lib/types';
import { useChrome } from './ChromeShell';
import { ConstellationCanvas, type FlyRequest, type ZoomCommand } from './ConstellationCanvas';
import { JarvisDock } from './JarvisDock';
import { JarvisView } from './JarvisView';
import { JobPanel } from './JobPanel';
import { SearchBar } from './SearchBar';
import { SectorCycler } from './SectorCycler';
import { SkillViewer } from './SkillViewer';

const ALL: DepartmentId[] = seedDepartments.map((dept) => dept.id);

/** Views 1-5 + Jarvis operator dock & console: owns map state and wires the canvas, search, cycler, job panel, skill sheet and Jarvis together. */
export function MapScreen() {
  const { active, setActive, jarvisOpen, setJarvisOpen } = useChrome();
  const pathname = usePathname();
  const [zoomPct, setZoomPct] = useState(100);
  const [threeDMode, setThreeDMode] = useState(true);
  const [zoomCmd, setZoomCmd] = useState<ZoomCommand | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ job: Job; department: Department } | null>(null);

  const sendZoomCmd = useCallback((action: ZoomCommand['action']) => {
    setZoomCmd((prev) => ({ id: (prev?.id ?? 0) + 1, action }));
  }, []);
  const searchParams = useSearchParams();

  // The URL seeds the state once; after that state leads and the URL is rewritten to match.
  const [open, setOpen] = useState<DepartmentId[]>(() => parseOpenParam(searchParams?.get('open') ?? null, ALL));
  const [focusId, setFocusId] = useState<DepartmentId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewer, setViewer] = useState(false);
  const [departments, setDepartments] = useState(seedDepartments);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [gatewayMode, setGatewayMode] = useState<GatewayMode>('local-vault');
  const [vaultTotalFiles, setVaultTotalFiles] = useState<number>(0);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [loadingSync, setLoadingSync] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [strip, setStrip] = useState(0);
  const [fly, setFly] = useState<FlyRequest | null>(null);

  const syncWithOs3Backend = useCallback(async () => {
    setLoadingSync(true);
    setSyncError(null);
    const [overviewRes, treeRes, runsRes] = await Promise.all([
      fetchSystemOverview(),
      fetchVaultTree(),
      fetchRuntimeRuns(50),
    ]);

    if (treeRes.ok && treeRes.data) {
      const merged = mergeVaultTreeIntoDepartments(seedDepartments, treeRes.data, runsRes.data);
      setDepartments(merged.departments);
      setStatuses(merged.liveStatuses);
      setGatewayMode('live-gateway');
      setVaultTotalFiles(overviewRes.data?.indexStats.totalFiles ?? treeRes.data.totalFiles);
      setPendingApprovals(overviewRes.data?.runtime.pendingApprovals ?? 0);
    } else if (overviewRes.ok && overviewRes.data) {
      setGatewayMode('live-gateway');
      setVaultTotalFiles(overviewRes.data.indexStats.totalFiles);
      setPendingApprovals(overviewRes.data.runtime.pendingApprovals);
    } else {
      setGatewayMode('local-vault');
      setSyncError(treeRes.error ?? overviewRes.error ?? null);
    }
    setLoadingSync(false);
  }, []);

  useEffect(() => {
    void syncWithOs3Backend();
  }, [syncWithOs3Backend]);

  const jobMap = useMemo(
    () => new Map(departments.flatMap((dept, index) => dept.jobs.map((job) => [job.id, { job, dept, index }] as const))),
    [departments],
  );
  const titles = useMemo(() => new Map([...jobMap].map(([id, entry]) => [id, entry.job.title] as const)), [jobMap]);

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
      const entry = jobMap.get(jobId);
      if (!entry) return;
      setActive(entry.index);
      // A job inside a collapsed sector would open a panel for a node nobody can see.
      if (!open.includes(entry.dept.id)) commitOpen([...open, entry.dept.id]);
      if (options.fly || focusId) setFocusId(entry.dept.id);
      if (options.fly) setFly((previous) => ({ jobId, nonce: (previous?.nonce ?? 0) + 1 }));
      setViewer(false);
      setSelectedId(jobId);
    },
    [jobMap, open, focusId, commitOpen, setActive],
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
      const entry = jobMap.get(selectedId);
      setStatuses((prev) => ({ ...prev, [selectedId]: status }));
      if (gatewayMode === 'live-gateway' && entry) {
        void dispatchJarvis({
          prompt: `xyp3rn> record status update ${entry.job.title} (${selectedId}) -> ${status}`,
          activeSector: entry.dept.id,
          selectedJobId: selectedId,
        });
      }
    },
    [selectedId, jobMap, gatewayMode],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // One layer per press: Jarvis console, skill sheet, then panel, then focus.
        if (jarvisOpen) setJarvisOpen(false);
        else if (viewer) setViewer(false);
        else if (selectedId) setSelectedId(null);
        else if (focusId) setFocusId(null);
        return;
      }
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (typing || selectedId || jarvisOpen) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        cycle(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jarvisOpen, setJarvisOpen, viewer, selectedId, focusId, cycle]);

  const selected = selectedId ? jobMap.get(selectedId) : undefined;
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
        threeDMode={threeDMode}
        zoomCommand={zoomCmd}
        onZoomChange={setZoomPct}
        onHoverJob={setHoveredNode}
        onToggle={toggle}
        onFocus={focusSector}
        onSelect={selectJob}
      />

      <div className="absolute left-3 top-[60px] z-20 flex flex-col items-start gap-1.5 md:left-4 md:top-4">
        <SearchBar departments={departments} onHome={goHome} onFly={(jobId) => selectJob(jobId, { fly: true })} />
        {focusId && (
          <button type="button" onClick={() => setFocusId(null)} className="micro rounded px-1 py-2 text-ink-dim hover:text-ink">
            {ui.focus.back}
          </button>
        )}
        {hoveredNode && !selected && (
          <div className="frost pointer-events-none max-w-[270px] rounded-xl px-3 py-2 text-xs shadow-lg">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: hoveredNode.department.color }}
              />
              <span className="truncate font-semibold text-ink">{hoveredNode.job.title}</span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] text-ink-dim">
              {hoveredNode.department.name} · {ui.status.spoken[resolveStatus(hoveredNode.job, statuses)]}
            </p>
          </div>
        )}
      </div>

      <div className="frost absolute right-3 top-[60px] z-20 hidden items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] text-ink-dim md:right-4 md:top-4 md:flex">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${gatewayMode === 'live-gateway' ? 'bg-[#3ECFB2]' : 'bg-accent'}`}
        />
        <span>
          {loadingSync
            ? 'SYNCING OS3…'
            : gatewayMode === 'live-gateway'
              ? `OS3 LIVE · ${vaultTotalFiles} FILES · ${pendingApprovals} PENDING`
              : 'SEED FALLBACK'}
        </span>
        {syncError && !loadingSync && (
          <button
            type="button"
            onClick={() => void syncWithOs3Backend()}
            className="underline hover:text-ink"
            title={syncError}
          >
            RETRY
          </button>
        )}
      </div>

      {/* 3D Camera Zoom & Perspective HUD */}
      <div
        role="toolbar"
        aria-label="Constellation camera and 3D controls"
        className="frost absolute right-3 top-[106px] z-20 flex items-center gap-1 rounded-full px-1.5 py-1 md:right-4 md:top-[58px]"
      >
        <button
          type="button"
          aria-label="Zoom out constellation"
          onClick={() => sendZoomCmd('out')}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-dim transition hover:bg-white/10 hover:text-ink"
        >
          <Minus size={13} />
        </button>
        <span className="min-w-[44px] text-center font-mono text-[10px] tabular-nums text-ink">{zoomPct}%</span>
        <button
          type="button"
          aria-label="Zoom in constellation"
          onClick={() => sendZoomCmd('in')}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-dim transition hover:bg-white/10 hover:text-ink"
        >
          <Plus size={13} />
        </button>
        <button
          type="button"
          aria-label="Reset constellation camera"
          onClick={() => sendZoomCmd('reset')}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-dim transition hover:bg-white/10 hover:text-ink"
          title="Reset camera zoom & pan"
        >
          <RotateCcw size={12} />
        </button>
        <span className="mx-0.5 h-3.5 w-px bg-white/15" aria-hidden="true" />
        <button
          type="button"
          aria-label="Toggle 3D tilt"
          aria-pressed={threeDMode}
          onClick={() => setThreeDMode((v) => !v)}
          className={`flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] transition ${
            threeDMode ? 'bg-accent/20 text-accent' : 'text-ink-dim hover:bg-white/10 hover:text-ink'
          }`}
        >
          <Box size={11} /> 3D
        </button>
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

      <JarvisDock
        activeSector={activeDept.id}
        selectedJobId={selectedId}
        onOpenConsole={() => setJarvisOpen(true)}
        onSelectJob={(jobId) => selectJob(jobId, { fly: true })}
        onFocusSector={focusSector}
      />

      {selected && (
        <JobPanel
          key={selected.job.id}
          job={selected.job}
          department={selected.dept}
          status={resolveStatus(selected.job, statuses)}
          titles={titles}
          trapFocus={!viewer && !jarvisOpen}
          onClose={() => setSelectedId(null)}
          onNavigate={selectJob}
          onStatus={changeStatus}
          onOpenSkill={() => setViewer(true)}
        />
      )}
      {selected && viewer && <SkillViewer job={selected.job} onClose={() => setViewer(false)} />}
      {jarvisOpen && (
        <JarvisView
          activeSector={activeDept.id}
          selectedJobId={selectedId}
          onClose={() => setJarvisOpen(false)}
          onSelectJob={(jobId) => {
            setJarvisOpen(false);
            selectJob(jobId, { fly: true });
          }}
          onFocusSector={(sectorId) => {
            setJarvisOpen(false);
            focusSector(sectorId);
          }}
        />
      )}
    </div>
  );
}
