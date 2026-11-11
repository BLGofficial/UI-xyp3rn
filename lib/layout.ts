import { mulberry32, stringToSeed } from './prng';
import { LAYOUT } from './tokens';
import type {
  Bounds,
  BranchLayout,
  BranchSegment,
  ChainLayout,
  Department,
  Job,
  LayoutNode,
  Point,
  SectorLayout,
} from './types';

const DEG = Math.PI / 180;
const UP = -Math.PI / 2;

type PlannedChain = { cluster: string; label: string; jobs: Job[]; count: number; showLabel: boolean };
type PlannedBranch = { folder: string; nested: boolean; chains: PlannedChain[] };

type TreeSpec = {
  wedge: number;
  jitter: number;
  segMin: number;
  segMax: number;
  /** Distance from the hub centre to the first node of a chain. */
  firstRadius: (chainIndex: number, forked: boolean) => number;
  forkRadius: number;
  minGap: number;
};

const OVERVIEW: TreeSpec = {
  wedge: LAYOUT.wedgeDeg * DEG,
  jitter: LAYOUT.jitterDeg * DEG,
  segMin: LAYOUT.segMin,
  segMax: LAYOUT.segMax,
  // Neighbouring chains start at two different radii so their first dots do not collide near the hub.
  firstRadius: (chainIndex, forked) =>
    // Forked chains start one segment further out so they also clear their unforked neighbours.
    LAYOUT.hubRadius + (forked ? LAYOUT.segMin : 0) + (chainIndex % 2 === 0 ? LAYOUT.segMin + 2 : LAYOUT.segMax),
  forkRadius: LAYOUT.hubRadius + LAYOUT.forkTrunk,
  minGap: LAYOUT.minDotGap,
};

const FOCUS: TreeSpec = {
  wedge: LAYOUT.focusArcDeg * DEG,
  jitter: LAYOUT.focusJitterDeg * DEG,
  segMin: LAYOUT.focusStep,
  segMax: LAYOUT.focusStep,
  // Even and odd chains sit half a step apart so 34px discs and their labels interleave.
  firstRadius: (chainIndex) => LAYOUT.focusFirstRadius[chainIndex % 2 === 0 ? 0 : 1],
  forkRadius: LAYOUT.focusForkRadius,
  minGap: LAYOUT.nodeSize + 8,
};

const polar = (origin: Point, angle: number, radius: number): Point => ({
  x: origin.x + Math.cos(angle) * radius,
  y: origin.y + Math.sin(angle) * radius,
});

/**
 * Position of hub `index` on the sector ring.
 * @param index hub index, 0-based
 * @param total number of hubs on the ring
 * @param radius ring radius
 * @param angleOffset rotation applied to the whole ring, radians
 */
export function ringPosition(index: number, total: number, radius: number, angleOffset = 0): Point {
  const angle = (index / total) * Math.PI * 2 + angleOffset;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function splitChain<T>(items: T[], max: number): T[][] {
  const parts = Math.ceil(items.length / max);
  const size = Math.ceil(items.length / parts);
  return Array.from({ length: parts }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/**
 * Groups a sector's jobs into branches: one per top-level vault subfolder, in vault order.
 * A branch forks when the folder nests sub-folders (06_X3LIUS_MUSIC_SYSTEM) or when a
 * cluster is longer than `LAYOUT.maxChain`.
 * @param department sector to plan
 */
export function planBranches(department: Department): PlannedBranch[] {
  const folders = new Map<string, Map<string, Job[]>>();
  department.jobs.forEach((job) => {
    const folder = job.cluster.split('/')[0] ?? job.cluster;
    const clusters = folders.get(folder) ?? new Map<string, Job[]>();
    clusters.set(job.cluster, [...(clusters.get(job.cluster) ?? []), job]);
    folders.set(folder, clusters);
  });

  return [...folders.entries()].map(([folder, clusters]) => ({
    folder,
    nested: [...clusters.keys()].some((cluster) => cluster !== folder),
    chains: [...clusters.entries()].flatMap(([cluster, jobs]) => {
      const parts = splitChain(jobs, LAYOUT.maxChain);
      const labelled = Math.floor((parts.length - 1) / 2);
      return parts.map((part, i) => ({
        cluster,
        label: cluster.split('/').at(-1) ?? cluster,
        jobs: part,
        count: jobs.length,
        showLabel: i === labelled,
      }));
    }),
  }));
}

function minPairDistance(nodes: LayoutNode[]): number {
  let min = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      min = Math.min(min, Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y));
    }
  }
  return min;
}

function boundsOf(points: Point[]): Bounds {
  return points.reduce<Bounds>(
    (b, p) => ({
      minX: Math.min(b.minX, p.x),
      minY: Math.min(b.minY, p.y),
      maxX: Math.max(b.maxX, p.x),
      maxY: Math.max(b.maxY, p.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function buildTree(
  department: Department,
  plan: PlannedBranch[],
  hub: Point,
  outward: number,
  spec: TreeSpec,
  attempt: number,
): SectorLayout {
  // Keyed by sector id: the same sector always draws the same constellation.
  const rng = mulberry32(stringToSeed(department.id) + attempt * 7919);
  const chainTotal = plan.reduce((sum, branch) => sum + branch.chains.length, 0);
  const nodes: LayoutNode[] = [];
  const segments: BranchSegment[] = [];
  const branches: BranchLayout[] = [];
  const chains: ChainLayout[] = [];

  plan.forEach((planned, branchIndex) => {
    const firstChain = chains.length;
    const forked = planned.chains.length > 1;
    const slotAngle = (chainIndex: number) => outward - spec.wedge / 2 + (spec.wedge * (chainIndex + 0.5)) / chainTotal;
    const branchAngle = (slotAngle(firstChain) + slotAngle(firstChain + planned.chains.length - 1)) / 2;
    const forkPoint = forked ? polar(hub, branchAngle, spec.forkRadius) : null;

    if (forkPoint) {
      segments.push({
        id: `${department.id}:trunk:${branchIndex}`,
        kind: 'trunk',
        from: polar(hub, branchAngle, LAYOUT.hubRadius),
        to: forkPoint,
        depth: 1,
        branchIndex,
        chainIndex: firstChain,
      });
    }

    planned.chains.forEach((chain) => {
      const chainIndex = chains.length;
      const angle = slotAngle(chainIndex);
      const baseDepth = forkPoint ? 2 : 1;
      let position = polar(hub, angle, spec.firstRadius(chainIndex, forked));
      let from = forkPoint ?? polar(hub, angle, LAYOUT.hubRadius);
      let sign = rng() < 0.5 ? 1 : -1;

      chain.jobs.forEach((job, k) => {
        let arrival = Math.atan2(position.y - from.y, position.x - from.x);
        if (k > 0) {
          const length = spec.segMin + rng() * (spec.segMax - spec.segMin);
          // Alternating sign gives a zig-zag that stays near the chain's ray instead of wandering.
          arrival = angle + sign * spec.jitter * (0.3 + 0.7 * rng());
          sign = -sign;
          from = position;
          position = polar(position, arrival, length);
        }
        segments.push({
          id: `${department.id}:seg:${job.id}`,
          kind: k > 0 ? 'chain' : forkPoint ? 'prong' : 'root',
          from,
          to: position,
          depth: baseDepth + k,
          branchIndex,
          chainIndex,
        });
        nodes.push({
          ...job,
          x: position.x,
          y: position.y,
          depth: baseDepth + k,
          branchIndex,
          chainIndex,
          angle: arrival,
          collapsed: false,
        });
      });

      chains.push({
        index: chainIndex,
        branchIndex,
        cluster: chain.cluster,
        label: chain.label,
        angle,
        nodeIds: chain.jobs.map((job) => job.id),
        tip: position,
        count: chain.count,
        showLabel: chain.showLabel,
      });
    });

    branches.push({
      index: branchIndex,
      folder: planned.folder,
      angle: branchAngle,
      forkPoint,
      nested: planned.nested,
      chains: planned.chains.map((_, i) => firstChain + i),
      count: planned.chains.reduce((sum, chain) => sum + chain.jobs.length, 0),
    });
  });

  return {
    hub,
    outward,
    nodes,
    segments,
    branches,
    chains,
    bounds: boundsOf([hub, ...nodes]),
    reach: nodes.reduce((max, node) => Math.max(max, Math.hypot(node.x - hub.x, node.y - hub.y)), 0),
  };
}

function solve(department: Department, hub: Point, outward: number, spec: TreeSpec): SectorLayout {
  const plan = planBranches(department);
  let best: SectorLayout | null = null;
  let bestGap = -Infinity;
  // Deterministic rejection sampling: take the first attempt with no overlapping nodes,
  // otherwise the roomiest one. Attempts are seeded, so the choice never changes.
  for (let attempt = 0; attempt < LAYOUT.layoutAttempts; attempt++) {
    const candidate = buildTree(department, plan, hub, outward, spec, attempt);
    const gap = minPairDistance(candidate.nodes);
    if (gap >= spec.minGap) return candidate;
    if (gap > bestGap) {
      best = candidate;
      bestGap = gap;
    }
  }
  return best ?? buildTree(department, plan, hub, outward, spec, 0);
}

/**
 * Overview layout of one sector: branches radiate from the hub inside a ~70 degree wedge.
 * @param department sector to lay out
 * @param options.hub hub centre, default origin
 * @param options.outward growth direction in radians, default straight up
 */
export function layoutSector(department: Department, options: { hub?: Point; outward?: number } = {}): SectorLayout {
  return solve(department, options.hub ?? { x: 0, y: 0 }, options.outward ?? UP, OVERVIEW);
}

/**
 * Sector Focus layout: the same branches fanned upward across a ~160 degree arc,
 * spaced for 34px icon discs and their labels.
 * @param department sector to lay out
 * @param options.hub hub centre, default origin
 */
export function layoutFocusArc(department: Department, options: { hub?: Point } = {}): SectorLayout {
  return solve(department, options.hub ?? { x: 0, y: 0 }, UP, FOCUS);
}

/**
 * Collapsed form of a sector: one short stub per top-level branch, no job nodes.
 * @param layout expanded layout of the sector
 */
export function collapseTree(layout: SectorLayout): BranchSegment[] {
  return layout.branches.map((branch) => ({
    id: `stub:${branch.index}`,
    kind: 'stub',
    from: polar(layout.hub, branch.angle, LAYOUT.hubRadius),
    to: polar(layout.hub, branch.angle, LAYOUT.hubRadius + LAYOUT.stubLength),
    depth: 1,
    branchIndex: branch.index,
    chainIndex: branch.chains[0] ?? 0,
  }));
}

/**
 * Node positions for one sector.
 * @param department sector to lay out
 * @param hubCenter hub position; the tree grows away from the ring centre (origin)
 * @param collapsed when true, returns one stub-tip node per branch instead of every job
 * @param outward overrides the growth direction, radians
 */
export function layoutTree(
  department: Department,
  hubCenter: Point,
  collapsed: boolean,
  outward?: number,
): LayoutNode[] {
  const atOrigin = Math.hypot(hubCenter.x, hubCenter.y) < 1e-9;
  const direction = outward ?? (atOrigin ? UP : Math.atan2(hubCenter.y, hubCenter.x));
  const layout = layoutSector(department, { hub: hubCenter, outward: direction });
  if (!collapsed) return layout.nodes;

  return collapseTree(layout).flatMap((stub) => {
    const first = layout.nodes.find((node) => node.branchIndex === stub.branchIndex);
    if (!first) return [];
    return [
      {
        ...first,
        x: stub.to.x,
        y: stub.to.y,
        depth: 1,
        angle: layout.branches[stub.branchIndex]?.angle ?? direction,
        collapsed: true,
      },
    ];
  });
}
