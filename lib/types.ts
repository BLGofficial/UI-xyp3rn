export type Autonomy = 'human-led' | 'human-assisted' | 'fully-autonomous';
export type Status = 'not-started' | 'in-development' | 'live';

export type Job = {
  id: string;
  /** Vault-relative path, e.g. "01_CORE/02_Agents/Jarvis.md". */
  file: string;
  title: string;
  /** Subfolder branch, e.g. "02_Agents" or "06_X3LIUS_MUSIC_SYSTEM/00_Songs". */
  cluster: string;
  summary: string;
  /** Lucide icon name; must resolve in lib/icons. */
  icon: string;
  autonomy: Autonomy;
  status: Status;
  /** Sub-skills or linked notes, drawn as satellite dots. */
  breaksInto: string[];
  /** Upstream job ids, drawn as dashed dependency chips. */
  buildsOn: string[];
  replaces: string;
  ladder: Record<Autonomy, string>;
  human: string;
  buildNotes: string;
  skill: {
    name: string;
    blurb: string;
    /** Frontmatter + Markdown body of the vault note. */
    markdown: string;
    /** Terminal command, e.g. "xyp3rn> flow research-brief <topic>". */
    installCmd: string;
  };
  startHere?: boolean;
  /** True when the source spec names or counts this note but defines no content for it. */
  stub?: boolean;
};

export type DepartmentId =
  | '01_CORE'
  | '02_KNOWLEDGE_LAYER'
  | '03_RESEARCH_INTELLIGENCE'
  | '04_RESEARCH_MATERIAL'
  | '05_XYP3RN_RECORDS'
  | '06_GOVERNANCE';

export type Department = {
  id: DepartmentId;
  name: string;
  tagline: string;
  color: string;
  /** e.g. "MAIN-XYP3RN-OS-Vault/01_CORE/". */
  folder: string;
  jobs: Job[];
};

export type Point = {
  x: number;
  y: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type LayoutNode = Job & {
  x: number;
  y: number;
  /** 1-based distance from the hub in segments; a fork adds one level. */
  depth: number;
  /** Index of the top-level vault subfolder this node hangs off. */
  branchIndex: number;
  /** Index of the chain within the sector; a forked branch owns several chains. */
  chainIndex: number;
  /** Direction of the segment arriving at this node, in radians. */
  angle: number;
  collapsed: boolean;
};

export type SegmentKind = 'root' | 'trunk' | 'prong' | 'chain' | 'stub';

export type BranchSegment = {
  id: string;
  kind: SegmentKind;
  from: Point;
  to: Point;
  depth: number;
  branchIndex: number;
  chainIndex: number;
};

export type ChainLayout = {
  index: number;
  branchIndex: number;
  cluster: string;
  /** Last path segment of the cluster. */
  label: string;
  angle: number;
  nodeIds: string[];
  tip: Point;
  /** Jobs in the whole cluster, not just this chain. */
  count: number;
  /** False on overflow chains that repeat a label already shown on a sibling. */
  showLabel: boolean;
};

export type BranchLayout = {
  index: number;
  /** Top-level subfolder name, e.g. "06_X3LIUS_MUSIC_SYSTEM". */
  folder: string;
  angle: number;
  /** Where the trunk splits, or null when the branch is a single chain. */
  forkPoint: Point | null;
  /** True when the fork comes from nested vault folders rather than chain overflow. */
  nested: boolean;
  chains: number[];
  count: number;
};

export type SectorLayout = {
  hub: Point;
  /** Direction the tree grows in, radians. */
  outward: number;
  nodes: LayoutNode[];
  segments: BranchSegment[];
  branches: BranchLayout[];
  chains: ChainLayout[];
  bounds: Bounds;
  /** Distance from the hub to the farthest node. */
  reach: number;
};
