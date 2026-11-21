'use client';

import { ArrowUpRight, Minus, Network, Plus, RefreshCw, RotateCcw, Search, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { fetchVaultNote } from '@/lib/gateway';
import { fetchKnowledgeGraph } from '@/lib/os3-adapter';
import { SECTOR_COLORS } from '@/lib/tokens';
import type {
  DepartmentId,
  Os3KnowledgeGraphEdge,
  Os3KnowledgeGraphNode,
  Os3KnowledgeGraphResponse,
  VaultNotePayload,
} from '@/lib/types';

const SECTORS: Array<{ id: DepartmentId | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'ALL SECTORS' },
  { id: '01_CORE', label: '01_CORE' },
  { id: '02_KNOWLEDGE_LAYER', label: '02_KNOWLEDGE_LAYER' },
  { id: '03_RESEARCH_INTELLIGENCE', label: '03_RESEARCH_INTELLIGENCE' },
  { id: '04_RESEARCH_MATERIAL', label: '04_RESEARCH_MATERIAL' },
  { id: '05_XYP3RN_RECORDS', label: '05_XYP3RN_RECORDS' },
  { id: '06_GOVERNANCE', label: '06_GOVERNANCE' },
];

type PositionedNode = Os3KnowledgeGraphNode & {
  x: number;
  y: number;
  r: number;
  color: string;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function computeGraphPositions(
  nodes: Os3KnowledgeGraphNode[],
  width = 960,
  height = 640,
): Map<string, PositionedNode> {
  const cx = width / 2;
  const cy = height / 2;
  const sectorGroups = new Map<string, Os3KnowledgeGraphNode[]>();
  for (const node of nodes) {
    const group = sectorGroups.get(node.sector) ?? [];
    group.push(node);
    sectorGroups.set(node.sector, group);
  }

  const sectorNames = [...sectorGroups.keys()].sort();
  const result = new Map<string, PositionedNode>();

  sectorNames.forEach((sectorName, sectorIdx) => {
    const group = sectorGroups.get(sectorName) ?? [];
    const baseAngle = (sectorIdx / Math.max(1, sectorNames.length)) * Math.PI * 2 - Math.PI / 2;
    const color = SECTOR_COLORS[sectorName as DepartmentId] ?? '#9B8CFF';

    group.forEach((node, idx) => {
      const ring = idx % 3;
      const spread = (idx / Math.max(1, group.length) - 0.5) * 0.92;
      const angle = baseAngle + spread;
      const dist = 108 + ring * 80 + Math.min(48, node.degree * 5);
      const r = Math.min(18, 6.5 + node.degree * 1.15);
      result.set(node.id, {
        ...node,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        r,
        color,
      });
    });
  });

  return result;
}

export function KnowledgeGraphView() {
  const [sectorFilter, setSectorFilter] = useState<DepartmentId | 'ALL'>('ALL');
  const [queryFilter, setQueryFilter] = useState('');
  const [graph, setGraph] = useState<Os3KnowledgeGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<'permission-denied' | 'offline' | 'error' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [note, setNote] = useState<VaultNotePayload | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);

  // Interactive Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; moved: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });
  const svgWrapRef = useRef<HTMLDivElement>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorKind(null);
    const res = await fetchKnowledgeGraph({
      sector: sectorFilter === 'ALL' ? undefined : sectorFilter,
      limit: 180,
    });
    if (!res.ok || !res.data) {
      setErrorKind(
        res.statusKind === 'permission-denied'
          ? 'permission-denied'
          : res.statusKind === 'offline'
            ? 'offline'
            : 'error',
      );
      setError(res.error ?? 'Failed to fetch Vault Knowledge Graph.');
      setGraph(null);
    } else {
      setGraph(res.data);
    }
    setLoading(false);
  }, [sectorFilter]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const selectNode = useCallback(async (nodeId: string) => {
    setSelectedId(nodeId);
    setNote(null);
    setNoteLoading(true);
    try {
      const payload = await fetchVaultNote(nodeId);
      setNote(payload);
    } finally {
      setNoteLoading(false);
    }
  }, []);

  useEffect(() => {
    const el = svgWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0014);
      setZoom((prev) => clamp(prev * factor, 0.45, 3.6));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const nodes = useMemo(() => graph?.nodes ?? [], [graph]);
  const edges = useMemo(() => graph?.edges ?? [], [graph]);

  const needle = queryFilter.trim().toLowerCase();
  const matchedIds = useMemo(() => {
    if (!needle) return null;
    const set = new Set<string>();
    for (const n of nodes) {
      if (
        n.title.toLowerCase().includes(needle) ||
        n.id.toLowerCase().includes(needle) ||
        n.sector.toLowerCase().includes(needle) ||
        (n.domain ?? '').toLowerCase().includes(needle)
      ) {
        set.add(n.id);
      }
    }
    return set;
  }, [nodes, needle]);

  const positioned = useMemo(() => computeGraphPositions(nodes), [nodes]);
  const activeNodeId = hoveredId ?? selectedId;

  const connectedToActive = useMemo(() => {
    const connected = new Set<string>();
    if (!activeNodeId) return connected;
    connected.add(activeNodeId);
    for (const e of edges) {
      if (e.source === activeNodeId) connected.add(e.target);
      if (e.target === activeNodeId) connected.add(e.source);
    }
    return connected;
  }, [activeNodeId, edges]);

  const activeNodeEdges = useMemo(() => {
    if (!selectedId) return { outgoing: [] as PositionedNode[], incoming: [] as PositionedNode[] };
    const outgoing: PositionedNode[] = [];
    const incoming: PositionedNode[] = [];
    for (const edge of edges) {
      if (edge.source === selectedId) {
        const target = positioned.get(edge.target);
        if (target) outgoing.push(target);
      } else if (edge.target === selectedId) {
        const source = positioned.get(edge.source);
        if (source) incoming.push(source);
      }
    }
    return { outgoing, incoming };
  }, [selectedId, edges, positioned]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (!dragRef.current.moved && Math.hypot(dx, dy) > 4) {
      dragRef.current.moved = true;
    }
    if (dragRef.current.moved) {
      setPan({
        x: clamp(dragRef.current.origX + dx, -700, 700),
        y: clamp(dragRef.current.origY + dy, -500, 500),
      });
    }
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-ink">
      {/* Frosted Knowledge Graph Header */}
      <header className="frost z-10 shrink-0 border-x-0 border-t-0 px-4 pb-3.5 pt-16 sm:px-8 sm:pt-20">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-violet-400/40 bg-violet-500/15 text-violet-300 shadow-[0_0_24px_rgba(155,140,255,0.22)]">
              <Network size={19} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
                OS 3.0 VAULT KNOWLEDGE TOPOLOGY
              </h1>
              <p className="font-mono text-xs text-ink-dim">
                {graph
                  ? `${graph.nodeCount} nodes · ${graph.edgeCount} wikilinks · ${graph.totalIndexed} Vault indexed`
                  : 'Inspecting structural wikilinks across Vault…'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
              <input
                type="search"
                value={queryFilter}
                onChange={(e) => setQueryFilter(e.target.value)}
                placeholder="Highlight node or sector…"
                aria-label="Filter knowledge graph nodes"
                className="w-48 rounded-xl border border-white/15 bg-black/30 py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-dim/75 focus:border-accent/60 focus:outline-none sm:w-56"
              />
            </div>

            <select
              aria-label="Sector filter"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value as DepartmentId | 'ALL')}
              className="rounded-xl border border-white/15 bg-[#0e1220] px-3 py-1.5 font-mono text-xs text-ink focus:border-accent/60 focus:outline-none"
            >
              {SECTORS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void loadGraph()}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-1.5 font-mono text-xs text-ink transition hover:border-accent/50 hover:bg-white/[0.1]"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-accent' : 'text-accent'} />
              RELOAD
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-12">
        {/* Interactive 3D Topology Canvas */}
        <section
          ref={svgWrapRef}
          aria-label="Knowledge graph topology"
          className="glass-card relative min-h-[380px] overflow-hidden rounded-2xl lg:col-span-8"
        >
          {/* Floating Graph Zoom Controls */}
          <div
            role="toolbar"
            aria-label="Knowledge graph zoom controls"
            className="frost absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full px-1.5 py-1"
          >
            <button
              type="button"
              aria-label="Zoom out graph"
              onClick={() => setZoom((z) => clamp(z / 1.28, 0.45, 3.6))}
              className="grid h-7 w-7 place-items-center rounded-full text-ink-dim transition hover:bg-white/10 hover:text-ink"
            >
              <Minus size={13} />
            </button>
            <span className="min-w-[42px] text-center font-mono text-[10px] tabular-nums text-ink">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in graph"
              onClick={() => setZoom((z) => clamp(z * 1.28, 0.45, 3.6))}
              className="grid h-7 w-7 place-items-center rounded-full text-ink-dim transition hover:bg-white/10 hover:text-ink"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              aria-label="Reset graph zoom"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-ink-dim transition hover:bg-white/10 hover:text-ink"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="m-4 rounded-xl border border-rose-400/35 bg-rose-950/45 p-4 font-mono text-xs text-rose-100"
            >
              <p className="font-semibold text-rose-200">
                {errorKind === 'permission-denied'
                  ? 'PERMISSION DENIED (401/403)'
                  : errorKind === 'offline'
                    ? 'GATEWAY OFFLINE'
                    : 'KNOWLEDGE GRAPH ERROR'}
              </p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {!error && !loading && nodes.length === 0 && (
            <div className="m-4 rounded-xl border border-dashed border-white/15 p-4 font-mono text-xs text-ink-dim">
              No Vault nodes matched this sector filter in the live OS3 index.
            </div>
          )}

          {!error && nodes.length > 0 && (
            <svg
              viewBox="0 0 960 640"
              className="h-full w-full cursor-grab select-none active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <defs>
                <radialGradient id="kg-sphere-glaze" cx="32%" cy="28%" r="72%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                  <stop offset="45%" stopColor="rgba(255,255,255,0.08)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
                </radialGradient>
                <filter id="kg-node-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <g transform={`translate(${(480 + pan.x).toFixed(1)} ${(320 + pan.y).toFixed(1)}) scale(${zoom.toFixed(3)}) translate(-480 -320)`}>
                {/* Subtle Concentric Orbital Rings */}
                {[120, 210, 300].map((radius) => (
                  <circle
                    key={radius}
                    cx={480}
                    cy={320}
                    r={radius}
                    fill="none"
                    stroke="rgba(244,241,234,0.06)"
                    strokeDasharray="4 6"
                  />
                ))}

                {/* Curved Quadratic Bezier Wikilink Edges */}
                {edges.map((edge: Os3KnowledgeGraphEdge, i) => {
                  const s = positioned.get(edge.source);
                  const t = positioned.get(edge.target);
                  if (!s || !t) return null;
                  const mx = (s.x + t.x) / 2;
                  const my = (s.y + t.y) / 2;
                  const dx = t.x - s.x;
                  const dy = t.y - s.y;
                  const cxCtrl = mx - dy * 0.14;
                  const cyCtrl = my + dx * 0.14;
                  const isActiveEdge = activeNodeId === edge.source || activeNodeId === edge.target;
                  const dimmed = Boolean(activeNodeId && !isActiveEdge);
                  return (
                    <path
                      key={`${edge.source}-${edge.target}-${i}`}
                      d={`M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${cxCtrl.toFixed(1)} ${cyCtrl.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`}
                      fill="none"
                      stroke={isActiveEdge ? s.color : 'rgba(244,241,234,0.16)'}
                      strokeWidth={isActiveEdge ? 1.8 : 0.85}
                      strokeOpacity={dimmed ? 0.15 : isActiveEdge ? 0.85 : 0.42}
                      className={isActiveEdge ? 'graph-edge-flow' : undefined}
                    />
                  );
                })}

                {/* 3D Spherical Nodes */}
                {[...positioned.values()].map((node) => {
                  const isSelected = selectedId === node.id;
                  const isConnected = connectedToActive.has(node.id);
                  const matchesSearch = matchedIds ? matchedIds.has(node.id) : true;
                  const dimmed =
                    (activeNodeId && !isConnected) || (matchedIds !== null && !matchesSearch);

                  return (
                    <g
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${node.title}, ${node.sector}, ${node.degree} links`}
                      transform={`translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})`}
                      style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1, transition: 'opacity 180ms ease' }}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId((prev) => (prev === node.id ? null : prev))}
                      onClick={() => {
                        if (!dragRef.current.moved) {
                          void selectNode(node.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void selectNode(node.id);
                        }
                      }}
                    >
                      {(isSelected || hoveredId === node.id || (matchedIds?.has(node.id) ?? false)) && (
                        <circle r={node.r + 6} fill="none" stroke={node.color} strokeWidth={1.6} opacity={0.75} />
                      )}
                      <circle
                        r={node.r}
                        fill={node.color}
                        filter={isSelected || node.degree >= 3 ? 'url(#kg-node-glow)' : undefined}
                      />
                      <circle r={node.r} fill="url(#kg-sphere-glaze)" pointerEvents="none" />
                      {(isSelected || hoveredId === node.id || node.degree >= 2 || zoom >= 1.35 || (matchedIds?.has(node.id) ?? false)) && (
                        <text
                          y={node.r + 12}
                          textAnchor="middle"
                          fontSize={10}
                          fill="#F4F1EA"
                          stroke="#090C14"
                          strokeWidth={3}
                          paintOrder="stroke"
                          className="pointer-events-none font-mono"
                        >
                          {node.title.length > 26 ? `${node.title.slice(0, 24)}…` : node.title}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </section>

        {/* Entity Inspector Sidebar */}
        <aside className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl lg:col-span-4">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <span className="micro text-ink">ENTITY INSPECTOR</span>
            </div>
            {selectedId && (
              <span className="rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 font-mono text-[10px] text-accent">
                {positioned.get(selectedId)?.sector ?? 'VAULT'}
              </span>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {!selectedId ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-sm leading-relaxed text-ink-dim">
                Select any node sphere on the topology canvas or scroll/drag to explore the Vault graph in 3D space.
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-semibold text-ink">
                    {positioned.get(selectedId)?.title ?? selectedId}
                  </h2>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-ink-dim">{selectedId}</p>
                </div>

                {(activeNodeEdges.outgoing.length > 0 || activeNodeEdges.incoming.length > 0) && (
                  <div className="flex flex-col gap-2">
                    <span className="micro text-ink-dim">CONNECTED WIKILINKS</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[...activeNodeEdges.outgoing, ...activeNodeEdges.incoming].slice(0, 12).map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => void selectNode(target.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-ink transition hover:border-accent/55 hover:text-accent"
                        >
                          {target.title}
                          <ArrowUpRight size={11} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {noteLoading ? (
                  <p className="font-mono text-xs text-ink-dim">Loading note content from OS3 Gateway…</p>
                ) : note ? (
                  <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-3.5 font-mono text-xs leading-relaxed text-ink">
                    {note.rawContent}
                  </pre>
                ) : (
                  <p className="font-mono text-xs text-ink-dim">
                    Live Markdown content unavailable in current offline snapshot.
                  </p>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
