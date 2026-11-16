'use client';

import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { departments as seedDepartments } from '@/data/map';
import { fetchVaultNote } from '@/lib/gateway';
import { fetchKnowledgeGraph } from '@/lib/os3-adapter';
import { SECTOR_COLORS, TOKENS } from '@/lib/tokens';
import type {
  DepartmentId,
  Os3KnowledgeGraphEdge,
  Os3KnowledgeGraphNode,
  VaultNotePayload,
} from '@/lib/types';

type PositionedNode = Os3KnowledgeGraphNode & {
  x: number;
  y: number;
  color: string;
};

const ALL_SECTORS: readonly DepartmentId[] = seedDepartments.map((d) => d.id);

function buildSeedFallbackGraph(sectorFilter: DepartmentId | 'ALL'): {
  nodes: Os3KnowledgeGraphNode[];
  edges: Os3KnowledgeGraphEdge[];
} {
  const filteredDepts =
    sectorFilter === 'ALL' ? seedDepartments : seedDepartments.filter((d) => d.id === sectorFilter);
  const jobById = new Map(seedDepartments.flatMap((d) => d.jobs.map((j) => [j.id, { job: j, sector: d.id }] as const)));
  const edges: Os3KnowledgeGraphEdge[] = [];
  const deg = new Map<string, number>();

  for (const dept of filteredDepts) {
    for (const job of dept.jobs) {
      for (const depId of job.buildsOn) {
        const target = jobById.get(depId);
        if (!target) continue;
        edges.push({ source: job.file, target: target.job.file, rawTarget: target.job.title });
        deg.set(job.file, (deg.get(job.file) ?? 0) + 1);
        deg.set(target.job.file, (deg.get(target.job.file) ?? 0) + 1);
      }
    }
  }

  const nodes: Os3KnowledgeGraphNode[] = filteredDepts.flatMap((dept) =>
    dept.jobs.slice(0, 14).map((job) => ({
      id: job.file,
      title: job.title,
      sector: dept.id,
      domain: dept.id,
      docType: job.cluster,
      status: job.status,
      degree: deg.get(job.file) ?? 0,
    })),
  );
  const idSet = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: edges.filter((e) => idSet.has(e.source) && idSet.has(e.target)),
  };
}

/** View 7: Vault Knowledge Graph visualising wikilinks and cross-sector relations in Constellation aesthetics. */
export function KnowledgeGraphView() {
  const [sectorFilter, setSectorFilter] = useState<DepartmentId | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [nodes, setNodes] = useState<Os3KnowledgeGraphNode[]>([]);
  const [edges, setEdges] = useState<Os3KnowledgeGraphEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<VaultNotePayload | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchKnowledgeGraph({
      sector: sectorFilter === 'ALL' ? undefined : sectorFilter,
      limit: 120,
    });
    if (res.ok && res.data) {
      setIsLive(true);
      setNodes(res.data.nodes);
      setEdges(res.data.edges);
    } else {
      setIsLive(false);
      setError(res.error ?? 'OS3 Gateway offline; showing seed dependency graph.');
      const fallback = buildSeedFallbackGraph(sectorFilter);
      setNodes(fallback.nodes);
      setEdges(fallback.edges);
    }
    setLoading(false);
  }, [sectorFilter]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedNote(null);
      return;
    }
    let active = true;
    void fetchVaultNote(selectedId).then((note) => {
      if (active) setSelectedNote(note);
    });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const positioned = useMemo<PositionedNode[]>(() => {
    const grouped = new Map<string, Os3KnowledgeGraphNode[]>();
    for (const node of nodes) {
      const list = grouped.get(node.sector) ?? [];
      list.push(node);
      grouped.set(node.sector, list);
    }

    const sectors = [...grouped.keys()].sort();
    const out: PositionedNode[] = [];
    const cx = 420;
    const cy = 280;

    sectors.forEach((sec, sIdx) => {
      const list = grouped.get(sec) ?? [];
      const sectorAngle = (sIdx / Math.max(1, sectors.length)) * Math.PI * 2 - Math.PI / 2;
      const anchorX = sectors.length === 1 ? cx : cx + Math.cos(sectorAngle) * 140;
      const anchorY = sectors.length === 1 ? cy : cy + Math.sin(sectorAngle) * 110;
      const color = SECTOR_COLORS[sec as DepartmentId] ?? TOKENS.accent;

      list.forEach((node, nIdx) => {
        const ring = Math.floor(nIdx / 10);
        const angle = (nIdx % 10) * ((Math.PI * 2) / Math.min(10, list.length || 1)) + ring * 0.45;
        const radius = 38 + ring * 34 + (node.degree > 0 ? 0 : 12);
        out.push({
          ...node,
          x: anchorX + Math.cos(angle) * radius,
          y: anchorY + Math.sin(angle) * radius,
          color,
        });
      });
    });

    return out;
  }, [nodes]);

  const nodeMap = useMemo(() => new Map(positioned.map((n) => [n.id, n] as const)), [positioned]);
  const selectedNode = selectedId ? nodeMap.get(selectedId) ?? null : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-8 pt-20 md:px-8 md:pt-20">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <p className="micro text-accent">
            VAULT KNOWLEDGE GRAPH · {isLive ? 'OS3 LIVE INDEX' : 'SEED FALLBACK'}
          </p>
          <h1 className="mt-1 font-serif text-2xl font-light uppercase tracking-label text-ink md:text-3xl">
            Entity &amp; Wikilink Topology
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void loadGraph()}
          className="frost micro flex items-center gap-2 rounded-full px-4 py-2 text-ink hover:border-accent"
        >
          <RefreshCw size={13} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? 'LOADING…' : 'REFRESH GRAPH'}
        </button>
      </header>

      {error && (
        <div role="status" className="frost mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-xs text-ink-dim">
          <span className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-accent" aria-hidden="true" />
            {error}
          </span>
          <button type="button" onClick={() => void loadGraph()} className="micro underline hover:text-ink">
            RETRY
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Sector filter">
        <button
          type="button"
          onClick={() => setSectorFilter('ALL')}
          className={`micro rounded-full px-3 py-1.5 ${
            sectorFilter === 'ALL' ? 'bg-ink font-bold text-bg' : 'frost text-ink-dim hover:text-ink'
          }`}
        >
          ALL SECTORS ({nodes.length})
        </button>
        {ALL_SECTORS.map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => setSectorFilter(sec)}
            style={sectorFilter === sec ? { borderColor: SECTOR_COLORS[sec], color: SECTOR_COLORS[sec] } : undefined}
            className={`micro rounded-full px-3 py-1.5 ${
              sectorFilter === sec ? 'frost font-bold' : 'frost text-ink-dim hover:text-ink'
            }`}
          >
            {sec}
          </button>
        ))}
      </div>

      <div className="grid min-h-[420px] flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="frost relative flex flex-col overflow-hidden rounded-[14px] lg:col-span-2">
          {positioned.length === 0 && !loading ? (
            <div className="grid flex-1 place-items-center p-8 font-mono text-xs text-ink-dim">
              No Vault nodes found in this sector yet.
            </div>
          ) : (
            <svg
              viewBox="0 0 840 560"
              role="img"
              aria-label="Vault Knowledge Graph"
              className="h-full min-h-[380px] w-full"
            >
              {edges.map((edge, idx) => {
                const a = nodeMap.get(edge.source);
                const b = nodeMap.get(edge.target);
                if (!a || !b) return null;
                const highlighted = selectedId === a.id || selectedId === b.id;
                return (
                  <line
                    key={`${edge.source}-${edge.target}-${idx}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={highlighted ? TOKENS.accent : TOKENS.ink}
                    strokeOpacity={highlighted ? 0.85 : 0.16}
                    strokeWidth={highlighted ? 1.6 : 0.8}
                  />
                );
              })}
              {positioned.map((node) => {
                const selected = node.id === selectedId;
                const radius = selected ? 7 : Math.min(6, 3 + node.degree * 0.6);
                return (
                  <g
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.title}, ${node.sector}, ${node.degree} links`}
                    onClick={() => setSelectedId(node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(node.id);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill={selected ? TOKENS.accent : node.color}
                      fillOpacity={selected ? 1 : 0.85}
                      stroke={TOKENS.bg}
                      strokeWidth={1.2}
                    />
                    {(selected || node.degree >= 2) && (
                      <text
                        x={node.x + 8}
                        y={node.y + 3}
                        fill={TOKENS.ink}
                        fontSize="10"
                        fontFamily="monospace"
                        opacity={selected ? 1 : 0.72}
                      >
                        {node.title.slice(0, 22)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
          <div className="flex items-center justify-between border-t border-hairline px-4 py-2 font-mono text-[11px] text-ink-dim">
            <span>{positioned.length} nodes</span>
            <span>{edges.length} wikilink edges</span>
          </div>
        </div>

        <aside className="frost flex flex-col rounded-[14px] p-5">
          <h2 className="micro text-ink-dim">ENTITY INSPECTOR</h2>
          {!selectedNode ? (
            <p className="mt-4 font-mono text-xs text-ink-dim">
              Select any constellation node to inspect Vault path, wikilink relations, and document body.
            </p>
          ) : (
            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              <div>
                <p className="font-mono text-[11px]" style={{ color: selectedNode.color }}>
                  {selectedNode.sector}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-ink">{selectedNode.title}</h3>
                <p className="mt-1 break-all font-mono text-[11px] text-ink-dim">{selectedNode.id}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                <span className="chip">{selectedNode.docType ?? 'note'}</span>
                <span className="chip">{selectedNode.degree} links</span>
                {selectedNote && <span className="chip">sha256:{selectedNote.sha256.slice(0, 10)}</span>}
              </div>
              {selectedNote && (
                <pre className="outlined max-h-64 overflow-auto bg-bg/40 p-3 font-mono text-[11px] leading-relaxed text-ink">
                  {selectedNote.body || selectedNote.rawContent}
                </pre>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
