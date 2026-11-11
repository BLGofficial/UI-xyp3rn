'use client';

import { memo, type CSSProperties, type KeyboardEvent, type Ref } from 'react';
import { ui } from '@/data/map';
import { resolveIcon } from '@/lib/icons';
import { fill, wrapLabel } from '@/lib/labels';
import { collapseTree } from '@/lib/layout';
import { resolveStatus } from '@/lib/storage';
import { LAYOUT, MOTION, TOKENS } from '@/lib/tokens';
import type { BranchSegment, Department, DepartmentId, LayoutNode, SectorLayout, Status } from '@/lib/types';

const DISC = LAYOUT.nodeSize / 2;
const HUB = LAYOUT.hubRadius;

type SectorTreeProps = {
  department: Department;
  /** Layout in the tree's own frame: hub at the origin, growing up. */
  layout: SectorLayout;
  variant: 'overview' | 'focus';
  open: boolean;
  /** On-screen scale of the overview tree; the hub and dots are counter-scaled to keep their pixel size. */
  scale: number;
  statuses: Record<string, Status>;
  selectedId: string | null;
  /** False while the tree is hidden behind another view, so it leaves the tab order. */
  interactive: boolean;
  glyphRef?: Ref<SVGGElement>;
  onSelect: (jobId: string) => void;
  onToggle?: (id: DepartmentId) => void;
  onFocus?: (id: DepartmentId) => void;
};

const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

/** Path between two points, pulled back from each end so it never runs under a node. */
function trimmed(segment: BranchSegment, fromGap: number, toGap: number): string | null {
  const dx = segment.to.x - segment.from.x;
  const dy = segment.to.y - segment.from.y;
  const length = Math.hypot(dx, dy);
  if (length <= fromGap + toGap) return null;
  const ux = dx / length;
  const uy = dy / length;
  const p = (n: number) => n.toFixed(2);
  return `M${p(segment.from.x + ux * fromGap)} ${p(segment.from.y + uy * fromGap)}L${p(segment.to.x - ux * toGap)} ${p(segment.to.y - uy * toGap)}`;
}

/** Side of a node to hang satellites on: across the chain, preferring up and away from the tree's axis. */
function satelliteSide(node: LayoutNode): number {
  const score = (angle: number) => -Math.sin(angle) + 0.35 * Math.sign(node.x || 1) * Math.cos(angle);
  const a = node.angle - Math.PI / 2;
  const b = node.angle + Math.PI / 2;
  return score(a) >= score(b) ? a : b;
}

function OverviewDot({ status, r }: { status: Status; r: number }) {
  if (status === 'live') return <circle r={r} fill={TOKENS.ink} />;
  if (status === 'in-development') {
    return (
      <>
        <circle r={r - 0.5} fill="none" stroke={TOKENS.ink} strokeWidth={1} />
        <path d={`M0 ${-r}A${r} ${r} 0 0 0 0 ${r}Z`} fill={TOKENS.ink} />
      </>
    );
  }
  return <circle r={r - 0.5} fill="none" stroke={TOKENS.ink} strokeWidth={1} opacity={0.45} />;
}

function FocusDisc({ status, icon, stub }: { status: Status; icon: string; stub: boolean }) {
  const Icon = resolveIcon(icon);
  const glyph = (color: string, opacity = 1) => (
    <Icon x={-10} y={-10} size={20} strokeWidth={1.25} absoluteStrokeWidth color={color} opacity={opacity} />
  );
  if (status === 'live') {
    return (
      <>
        <circle r={DISC} fill={TOKENS.ink} />
        {glyph(TOKENS.bg)}
      </>
    );
  }
  if (status === 'in-development') {
    return (
      <>
        <circle r={DISC - 0.6} fill={TOKENS.bg} stroke={TOKENS.ink} strokeWidth={1.25} />
        <path d={`M0 ${-DISC}A${DISC} ${DISC} 0 0 0 0 ${DISC}Z`} fill={TOKENS.ink} />
        {/* The icon is drawn twice so each half contrasts with what is behind it. */}
        <g clipPath="url(#half-left)">{glyph(TOKENS.bg)}</g>
        <g clipPath="url(#half-right)">{glyph(TOKENS.ink)}</g>
      </>
    );
  }
  return (
    <>
      <circle
        r={DISC - 0.6}
        fill={TOKENS.bg}
        stroke={TOKENS.ink}
        strokeWidth={1.25}
        strokeOpacity={0.45}
        strokeDasharray={stub ? '3 3' : undefined}
      />
      {glyph(TOKENS.ink, 0.6)}
    </>
  );
}

/** One sector: hub, subfolder branches, forks, and every job as a focusable node. */
export const SectorTree = memo(function SectorTree({
  department,
  layout,
  variant,
  open,
  scale,
  statuses,
  selectedId,
  interactive,
  glyphRef,
  onSelect,
  onToggle,
  onFocus,
}: SectorTreeProps) {
  const focus = variant === 'focus';
  const inverse = focus ? 1 : 1 / scale;
  // Dots shrink with the tree so neighbours never touch: never wider than the on-screen gap between two of them.
  const gap = LAYOUT.minDotGap * scale;
  const dot = Math.min((LAYOUT.dotSize / 2) * Math.min(1, Math.max(0.7, scale * 1.4)), gap / 2 - 0.3);
  // A hit area wider than the gap would cover the neighbouring dot and steal its clicks.
  const hit = Math.min(dot + 2.5, gap - 0.4);
  const nodeGap = focus ? DISC + 3 : (dot + 1.5) * inverse;
  const maxDepth = layout.nodes.reduce((max, node) => Math.max(max, node.depth), 1);
  // layout.nodes is already in cluster order, which is the tab order the spec asks for.
  const nodeById = new Map(layout.nodes.map((node, index) => [node.id, { node, index }]));
  const segmentByJob = new Map(layout.segments.map((segment) => [segment.id, segment]));
  const HubIcon = resolveIcon(ui.sectorIcons[department.id]);
  const tabIndex = interactive && (focus || open) ? 0 : -1;

  const onKey = (action: () => void) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  };

  const renderNode = (node: LayoutNode, index: number) => {
    const status = resolveStatus(node, statuses);
    const selected = node.id === selectedId;
    const segment = segmentByJob.get(`${department.id}:seg:${node.id}`);
    const path = segment ? trimmed(segment, segment.kind === 'chain' ? nodeGap : 0, nodeGap) : null;
    const breathe = MOTION.breatheMinSeconds + (index % 7) * ((MOTION.breatheMaxSeconds - MOTION.breatheMinSeconds) / 6);
    const side = focus ? satelliteSide(node) : 0;
    const labelLines = focus ? wrapLabel(node.title, LAYOUT.focusLabelMaxChars, LAYOUT.focusLabelMaxLines) : [];

    return (
      <g key={node.id} className="node-group">
        {path && <path className="tree-seg" d={path} pathLength={1} style={cssVars({ '--depth': node.depth })} />}
        <g transform={`translate(${node.x.toFixed(2)} ${node.y.toFixed(2)}) scale(${inverse.toFixed(4)})`}>
          <g className="tree-node" style={cssVars({ '--depth': node.depth })}>
            <g className="breathe" style={cssVars({ '--breathe': `${breathe}s`, '--phase': `${-((index * 0.83) % breathe)}s` })}>
              <g
                className="node"
                role="button"
                tabIndex={tabIndex}
                aria-label={fill(ui.node.label, {
                  title: node.title,
                  department: department.name,
                  status: ui.status.spoken[status],
                })}
                data-job-id={node.id}
                data-status={status}
                data-selected={selected}
                onClick={() => onSelect(node.id)}
                onKeyDown={onKey(() => onSelect(node.id))}
              >
                <circle r={focus ? DISC + 5 : hit} fill="transparent" />
                {focus &&
                  !node.stub &&
                  node.breaksInto.map((item, k) => {
                    const angle = side + (k - (node.breaksInto.length - 1) / 2) * ((30 * Math.PI) / 180);
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const tip = DISC + 2 + LAYOUT.satelliteStem;
                    const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
                    return (
                      <g key={item}>
                        <line
                          x1={cos * (DISC + 2)}
                          y1={sin * (DISC + 2)}
                          x2={cos * tip}
                          y2={sin * tip}
                          stroke={department.color}
                          strokeWidth={1}
                          opacity={0.55}
                        />
                        <circle
                          cx={cos * (tip + LAYOUT.satelliteSize / 2)}
                          cy={sin * (tip + LAYOUT.satelliteSize / 2)}
                          r={LAYOUT.satelliteSize / 2}
                          fill={department.color}
                        />
                        <text
                          className="sat-label"
                          x={cos * (tip + 11)}
                          y={sin * (tip + 11) + (anchor === 'middle' ? (sin < 0 ? -2 : 9) : 3)}
                          textAnchor={anchor}
                        >
                          {item}
                        </text>
                      </g>
                    );
                  })}
                <circle className="focus-ring" r={focus ? DISC + 4 : dot + 4} stroke={department.color} />
                {selected && (
                  <>
                    <circle className="pulse-ring" r={focus ? DISC : dot + 1} stroke={department.color} />
                    <circle className="pulse-ring" r={focus ? DISC : dot + 1} stroke={department.color} />
                  </>
                )}
                <g className="node-body">
                  {focus ? (
                    <FocusDisc status={status} icon={node.icon} stub={Boolean(node.stub)} />
                  ) : (
                    <OverviewDot status={status} r={dot} />
                  )}
                </g>
                {focus && node.startHere && (
                  <text
                    className="svg-micro"
                    y={DISC + 17 + labelLines.length * 13}
                    textAnchor="middle"
                    fontSize={7.5}
                    fill={TOKENS.accent}
                  >
                    {ui.focus.startHere}
                  </text>
                )}
                {focus &&
                  labelLines.map((line, i) => (
                    <text
                      key={i}
                      className="node-label"
                      y={DISC + 15 + i * 13}
                      textAnchor="middle"
                      fill={node.stub ? TOKENS.inkDim : TOKENS.ink}
                    >
                      {line}
                    </text>
                  ))}
              </g>
            </g>
          </g>
        </g>
      </g>
    );
  };

  return (
    <g
      className="tree"
      data-open={focus || open}
      data-sector={department.id}
      style={cssVars({ '--max-depth': maxDepth, '--inv': inverse.toFixed(4) })}
    >
      {layout.segments
        .filter((segment) => segment.kind === 'trunk')
        .map((segment) => {
          const path = trimmed(segment, 0, 0);
          return path ? <path key={segment.id} className="tree-seg" d={path} pathLength={1} style={cssVars({ '--depth': 1 })} /> : null;
        })}

      {layout.chains.map((chain) => (
        <g key={chain.index} className="chain">
          {chain.nodeIds.map((id) => {
            const entry = nodeById.get(id);
            return entry ? renderNode(entry.node, entry.index) : null;
          })}
        </g>
      ))}

      {focus &&
        layout.chains
          .filter((chain) => chain.showLabel)
          .map((chain) => {
            const x = chain.tip.x + Math.cos(chain.angle) * 62;
            const y = chain.tip.y + Math.sin(chain.angle) * 62;
            return (
              <g key={chain.index} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} textAnchor="middle">
                <text className="svg-micro" fontSize={9} fill={TOKENS.ink}>
                  {chain.label}
                </text>
                <text className="svg-micro" y={13} fontSize={8} fill={TOKENS.inkDim}>
                  {chain.count === 1 ? ui.focus.job : fill(ui.focus.jobs, { count: chain.count })}
                </text>
              </g>
            );
          })}

      {focus &&
        layout.branches
          .filter((branch) => branch.nested && branch.forkPoint)
          .map((branch) => (
            <text
              key={branch.index}
              className="svg-micro"
              x={(branch.forkPoint?.x ?? 0) - 10}
              y={(branch.forkPoint?.y ?? 0) + 14}
              textAnchor="end"
              fontSize={7.5}
              fill={department.color}
            >
              {branch.folder}
            </text>
          ))}

      <g transform={`scale(${inverse.toFixed(4)})`}>
        <g className="tree-stubs">
          {collapseTree(layout).map((stub) => (
            <g key={stub.id}>
              <line
                x1={stub.from.x}
                y1={stub.from.y}
                x2={stub.to.x}
                y2={stub.to.y}
                stroke={TOKENS.ink}
                strokeWidth={1}
                opacity={0.45}
              />
              <circle cx={stub.to.x} cy={stub.to.y} r={1.75} fill={TOKENS.ink} />
            </g>
          ))}
        </g>
        {layout.segments
          .filter((segment) => segment.kind === 'root' || segment.kind === 'trunk')
          .map((segment, i) => {
            const angle =
              segment.kind === 'trunk'
                ? (layout.branches[segment.branchIndex]?.angle ?? layout.outward)
                : (layout.chains[segment.chainIndex]?.angle ?? layout.outward);
            return (
              <circle
                key={segment.id}
                className="root-dot"
                // Two radii, alternating, so eight dots in a 70 degree wedge do not read as a dotted arc.
                cx={Math.cos(angle) * (HUB + (i % 2 === 0 ? 6 : 12))}
                cy={Math.sin(angle) * (HUB + (i % 2 === 0 ? 6 : 12))}
                r={LAYOUT.rootDotSize / 2}
                fill={department.color}
              />
            );
          })}
        <g
          className="hub"
          role={focus ? undefined : 'button'}
          tabIndex={focus || !interactive ? undefined : 0}
          aria-hidden={focus ? true : undefined}
          aria-expanded={focus ? undefined : open}
          aria-label={
            focus
              ? undefined
              : fill(ui.overview.hub, {
                  name: department.name,
                  count: department.jobs.length,
                  state: open ? ui.overview.expanded : ui.overview.collapsed,
                })
          }
          data-hub={department.id}
          onClick={focus ? undefined : () => onToggle?.(department.id)}
          onDoubleClick={focus ? undefined : () => onFocus?.(department.id)}
          onKeyDown={
            focus
              ? undefined
              : (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onFocus?.(department.id);
                  } else if (event.key === ' ') {
                    event.preventDefault();
                    onToggle?.(department.id);
                  }
                }
          }
        >
          <circle r={HUB + 8} fill={department.color} opacity={0.2} filter="url(#glow)" pointerEvents="none" />
          <circle className="focus-ring" r={HUB + 5} stroke={department.color} />
          <circle r={HUB} fill={TOKENS.bg} stroke={department.color} strokeWidth={1.5} />
          <g ref={glyphRef}>
            <HubIcon x={-10} y={-10} size={20} strokeWidth={1.25} absoluteStrokeWidth color={department.color} />
          </g>
        </g>
      </g>
    </g>
  );
});
