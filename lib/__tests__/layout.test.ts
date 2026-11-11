import { describe, expect, it } from 'vitest';
import { departments } from '@/data/map';
import { collapseTree, layoutFocusArc, layoutSector, layoutTree, ringPosition } from '@/lib/layout';
import { LAYOUT } from '@/lib/tokens';
import type { BranchSegment, Department, Point, SectorLayout } from '@/lib/types';

const DEG = Math.PI / 180;
const UP = -Math.PI / 2;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const len = (s: BranchSegment) => dist(s.from, s.to);
const sector = (id: string): Department => {
  const found = departments.find((d) => d.id === id);
  if (!found) throw new Error(`missing sector ${id}`);
  return found;
};
/** Smallest signed difference between two angles. */
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const minPairDistance = (layout: SectorLayout) => {
  let min = Infinity;
  layout.nodes.forEach((a, i) => {
    layout.nodes.slice(i + 1).forEach((b) => {
      min = Math.min(min, dist(a, b));
    });
  });
  return min;
};

// The four tests shipped in the source PDF, unchanged.
describe('XYP3RN Agentic OS Constellation Layout & Vault Data', () => {
  it('asserts total job count across all 6 vault sectors equals exactly 137', () => {
    const totalJobs = departments.reduce((acc, dept) => acc + dept.jobs.length, 0);
    expect(totalJobs).toBe(137);
  });

  it('verifies all 6 native vault sectors are present with correct IDs', () => {
    const expectedIds = [
      '01_CORE',
      '02_KNOWLEDGE_LAYER',
      '03_RESEARCH_INTELLIGENCE',
      '04_RESEARCH_MATERIAL',
      '05_XYP3RN_RECORDS',
      '06_GOVERNANCE',
    ];
    const actualIds = departments.map((d) => d.id);
    expect(actualIds).toEqual(expectedIds);
  });

  it('computes deterministic ring positions for 6 sector hubs', () => {
    const pos0 = ringPosition(0, 6, 200);
    const pos1 = ringPosition(0, 6, 200);
    expect(pos0).toEqual(pos1);
    expect(pos0.x).toBeCloseTo(200);
    expect(pos0.y).toBeCloseTo(0);
  });

  it('layoutTree produces deterministic node coordinates and supports collapse', () => {
    const dept = departments[0]!;
    const hub = { x: 0, y: 0 };
    const expandedNodes = layoutTree(dept, hub, false);
    const collapsedNodes = layoutTree(dept, hub, true);

    expect(expandedNodes.length).toBe(dept.jobs.length);
    expect(collapsedNodes.length).toBeLessThan(expandedNodes.length);

    const expandedNodes2 = layoutTree(dept, hub, false);
    expect(expandedNodes[0]!.x).toEqual(expandedNodes2[0]!.x);
    expect(expandedNodes[0]!.y).toEqual(expandedNodes2[0]!.y);
  });
});

describe('ringPosition', () => {
  it('spaces 6 hubs at 60 degree intervals on the ring', () => {
    const hubs = departments.map((_, i) => ringPosition(i, 6, 200));
    hubs.forEach((hub, i) => {
      expect(Math.hypot(hub.x, hub.y)).toBeCloseTo(200);
      const next = hubs[(i + 1) % 6]!;
      const step = angleDelta(Math.atan2(next.y, next.x), Math.atan2(hub.y, hub.x));
      expect(step).toBeCloseTo(60 * DEG);
    });
  });

  it('applies the angle offset used to bring the active hub to 6 o clock', () => {
    const hub = ringPosition(0, 6, 100, Math.PI / 2);
    expect(hub.x).toBeCloseTo(0);
    expect(hub.y).toBeCloseTo(100);
  });
});

describe('layoutSector (overview)', () => {
  it('places every job exactly once', () => {
    departments.forEach((dept) => {
      const layout = layoutSector(dept);
      expect(layout.nodes.map((n) => n.id).sort()).toEqual(dept.jobs.map((j) => j.id).sort());
    });
  });

  it('is deterministic and snapshot-stable', () => {
    const snapshot = departments.map((dept) => {
      const a = layoutSector(dept);
      const b = layoutSector(dept);
      expect(a).toEqual(b);
      return { id: dept.id, nodes: a.nodes.map((n) => `${n.id}:${n.x.toFixed(2)},${n.y.toFixed(2)}`) };
    });
    expect(snapshot).toMatchSnapshot();
  });

  it('maps 44 top-level subfolders and 46 leaf clusters to branches', () => {
    const layouts = departments.map((dept) => layoutSector(dept));
    expect(layouts.map((l) => l.branches.length)).toEqual([8, 6, 7, 8, 8, 7]);
    const leafClusters = layouts.flatMap((l, i) => [...new Set(l.chains.map((c) => `${departments[i]!.id}/${c.cluster}`))]);
    expect(leafClusters).toHaveLength(46);
  });

  it('keeps every chain inside the 70 degree wedge and on the outward side of the hub', () => {
    departments.forEach((dept) => {
      const layout = layoutSector(dept, { outward: UP });
      layout.chains.forEach((chain) => {
        expect(Math.abs(angleDelta(chain.angle, UP))).toBeLessThanOrEqual((LAYOUT.wedgeDeg / 2) * DEG + 1e-9);
      });
      layout.nodes.forEach((node) => {
        expect(node.y).toBeLessThan(layout.hub.y);
      });
    });
  });

  it('uses 28-44 unit segments and chains of at most 7 nodes', () => {
    departments.forEach((dept) => {
      const layout = layoutSector(dept);
      layout.segments
        .filter((s) => s.kind === 'chain' || s.kind === 'root')
        .forEach((s) => {
          expect(len(s)).toBeGreaterThanOrEqual(LAYOUT.segMin - 1e-6);
          expect(len(s)).toBeLessThanOrEqual(LAYOUT.segMax + 1e-6);
        });
      layout.chains.forEach((chain) => {
        expect(chain.nodeIds.length).toBeGreaterThan(0);
        expect(chain.nodeIds.length).toBeLessThanOrEqual(LAYOUT.maxChain);
      });
    });
  });

  it('never stacks two dots on top of each other', () => {
    departments.forEach((dept) => {
      expect(minPairDistance(layoutSector(dept))).toBeGreaterThanOrEqual(LAYOUT.minDotGap);
    });
  });

  it('forks 06_X3LIUS_MUSIC_SYSTEM three ways from a shared trunk', () => {
    const layout = layoutSector(sector('05_XYP3RN_RECORDS'));
    const fork = layout.branches.find((b) => b.folder === '06_X3LIUS_MUSIC_SYSTEM');
    expect(fork).toBeDefined();
    expect(fork!.nested).toBe(true);
    expect(fork!.forkPoint).not.toBeNull();
    expect(fork!.count).toBe(13);
    const chains = fork!.chains.map((i) => layout.chains[i]!);
    expect(chains.map((c) => c.label)).toEqual(['00_Songs', '06_Audio', '07_Suno_Prompts']);
    expect(chains.map((c) => c.nodeIds.length)).toEqual([7, 3, 3]);

    const trunks = layout.segments.filter((s) => s.kind === 'trunk' && s.branchIndex === fork!.index);
    expect(trunks).toHaveLength(1);
    expect(trunks[0]!.to).toEqual(fork!.forkPoint);
    const prongs = layout.segments.filter((s) => s.kind === 'prong' && s.branchIndex === fork!.index);
    expect(prongs).toHaveLength(3);
    prongs.forEach((p) => expect(p.from).toEqual(fork!.forkPoint));
  });

  it('forks over-long clusters into balanced chains', () => {
    const research = layoutSector(sector('03_RESEARCH_INTELLIGENCE'));
    const specialists = research.branches.find((b) => b.folder === '06_Specialists')!;
    expect(specialists.nested).toBe(false);
    expect(specialists.chains.map((i) => research.chains[i]!.nodeIds.length)).toEqual([7, 7, 6]);
    expect(specialists.chains.filter((i) => research.chains[i]!.showLabel)).toHaveLength(1);

    const core = layoutSector(sector('01_CORE'));
    const agents = core.branches.find((b) => b.folder === '02_Agents')!;
    expect(agents.chains.map((i) => core.chains[i]!.nodeIds.length)).toEqual([4, 4]);
  });

  it('starts every branch beyond a larger hub when asked to', () => {
    departments.forEach((dept) => {
      const layout = layoutSector(dept, { hubRadius: 50 });
      layout.nodes.forEach((node) => {
        expect(Math.hypot(node.x, node.y)).toBeGreaterThanOrEqual(50 + LAYOUT.segMin);
      });
      expect(layout.nodes).toHaveLength(dept.jobs.length);
    });
  });

  it('grows away from the ring centre when the hub sits on the ring', () => {
    const hub = ringPosition(2, 6, 200);
    const nodes = layoutTree(sector('02_KNOWLEDGE_LAYER'), hub, false);
    nodes.forEach((node) => {
      expect((node.x - hub.x) * hub.x + (node.y - hub.y) * hub.y).toBeGreaterThan(0);
    });
  });
});

describe('collapseTree', () => {
  it('returns one 14 unit stub per top-level branch starting on the hub edge', () => {
    departments.forEach((dept) => {
      const layout = layoutSector(dept);
      const stubs = collapseTree(layout);
      expect(stubs).toHaveLength(layout.branches.length);
      stubs.forEach((stub) => {
        expect(stub.kind).toBe('stub');
        expect(len(stub)).toBeCloseTo(LAYOUT.stubLength);
        expect(dist(stub.from, layout.hub)).toBeCloseTo(LAYOUT.hubRadius);
      });
    });
  });

  it('exposes no job nodes beyond the stub tips when collapsed', () => {
    const dept = sector('05_XYP3RN_RECORDS');
    const collapsed = layoutTree(dept, { x: 0, y: 0 }, true);
    expect(collapsed).toHaveLength(8);
    collapsed.forEach((node) => {
      expect(node.collapsed).toBe(true);
      expect(Math.hypot(node.x, node.y)).toBeCloseTo(LAYOUT.hubRadius + LAYOUT.stubLength);
    });
  });
});

describe('layoutFocusArc', () => {
  it('fans every chain upward inside a 160 degree arc', () => {
    departments.forEach((dept) => {
      const layout = layoutFocusArc(dept);
      expect(layout.nodes).toHaveLength(dept.jobs.length);
      layout.chains.forEach((chain) => {
        expect(Math.abs(angleDelta(chain.angle, UP))).toBeLessThanOrEqual((LAYOUT.focusArcDeg / 2) * DEG + 1e-9);
      });
      layout.nodes.forEach((node) => expect(node.y).toBeLessThan(layout.hub.y));
    });
  });

  it('leaves room between 34px node discs', () => {
    departments.forEach((dept) => {
      expect(minPairDistance(layoutFocusArc(dept))).toBeGreaterThanOrEqual(LAYOUT.nodeSize + 8);
    });
  });

  it('is deterministic and reports bounds that contain every node', () => {
    departments.forEach((dept) => {
      const a = layoutFocusArc(dept);
      expect(a).toEqual(layoutFocusArc(dept));
      a.nodes.forEach((node) => {
        expect(node.x).toBeGreaterThanOrEqual(a.bounds.minX);
        expect(node.x).toBeLessThanOrEqual(a.bounds.maxX);
        expect(node.y).toBeGreaterThanOrEqual(a.bounds.minY);
        expect(node.y).toBeLessThanOrEqual(a.bounds.maxY);
      });
    });
  });
});
