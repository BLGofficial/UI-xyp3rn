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

export type EngineId = 'claude-code-cli' | 'gemini-api';

export type JarvisVoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export type GatewayMode = 'live-gateway' | 'local-vault';

export type ConnectorStatus = 'healthy' | 'amber';

export type CommandKind =
  | 'status'
  | 'read'
  | 'write'
  | 'append'
  | 'search'
  | 'flow'
  | 'task-new'
  | 'task-run'
  | 'registry'
  | 'promote'
  | 'connections'
  | 'specialists'
  | 'research'
  | 'record'
  | 'records'
  | 'song-new'
  | 'compose'
  | 'play'
  | 'gemini'
  | 'run'
  | 'chat';

export type ParsedCommand = {
  kind: CommandKind;
  raw: string;
  command: string;
  args: string;
  targetPath?: string;
  engine: EngineId;
  contextRefs: string[];
};

export type JarvisExchange = {
  id: string;
  timestamp: string;
  prompt: string;
  reply: string;
  commandKind: CommandKind;
  engine: EngineId;
  mode: GatewayMode;
  /** Job ids resolved from @path or @agent tokens in the prompt. */
  contextJobs: string[];
  referencedJobId?: string;
  trackId?: string;
};

export type GatewayAction =
  | { type: 'select-job'; jobId: string }
  | { type: 'play-track'; trackId: string }
  | { type: 'compose-track'; trackId: string }
  | { type: 'focus-sector'; sectorId: DepartmentId };

export type GatewayRequest = {
  prompt: string;
  engine?: EngineId;
  activeSector?: DepartmentId;
  selectedJobId?: string | null;
};

export type GatewayResponse = {
  ok: boolean;
  exchange: JarvisExchange;
  connectorCount: number;
  connectorHealthy: number;
  status: ConnectorStatus;
  action?: GatewayAction;
};

export type X3liusTrack = {
  id: string;
  songJobId: string;
  audioJobId: string;
  promptJobId: string;
  title: string;
  subtitle: string;
  file: string;
  format: 'wav' | 'mp3' | 'flac';
  bpm: number;
  durationSec: number;
  status: 'rendered' | 'released';
  release: string;
  stylePrompt: string;
  color: string;
};

export type VisualizerRing = {
  index: number;
  radius: number;
  strokeWidth: number;
  opacity: number;
  dashOffset: number;
};

export type VisualizerBar = {
  index: number;
  angle: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  amplitude: number;
};

export type GatewayHealthSnapshot = {
  ok: boolean;
  mode: GatewayMode;
  service: string;
  vaultRoot: string;
  agentsCount: number;
  pendingApprovals: number;
  totalIndexedFiles: number;
  bySector: Record<string, number>;
};

export type VaultNotePayload = {
  vaultPath: string;
  sector: string;
  isCanonical: boolean;
  rawContent: string;
  body: string;
  sha256: string;
  byteSize: number;
  outgoingLinks: string[];
  backlinks: string[];
  mode: GatewayMode;
};

export type VaultSearchHit = {
  vaultPath: string;
  sector: string;
  title: string;
  sha256: string;
  tags: string[];
  mode: GatewayMode;
};

export type GatewayApprovalItem = {
  id: string;
  itemType: string;
  itemId: string;
  status: 'pending' | 'approved' | 'rejected';
  proposer: string;
  approver: string | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type Os3JobRecord = {
  id: string;
  kind: string;
  name: string;
  status: 'queued' | 'running' | 'success' | 'error' | 'cancelled';
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorDetail: string | null;
};

export type Os3AgentRunRecord = {
  id: string;
  agentName: string;
  status: 'running' | 'success' | 'error' | 'cancelled';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorDetail: string | null;
};

export type Os3RuntimeEventRecord = {
  id: number;
  timestamp: string;
  eventType: string;
  domain: string;
  actor: string;
  targetPath: string | null;
};

export type Os3AgentSummary = {
  name: string;
  class: string;
  domain: string;
  model: string;
  tools: string[];
  role: string;
  contract: string;
  refuses: string;
  path: string;
  lastRun: Os3AgentRunRecord | null;
};

export type Os3WorkflowSummary = {
  name: string;
  description: string;
  sourcePath: string;
  requiredInputs: string[];
  stepCount: number;
  steps: Array<{ id: string; agent: string; dependsOn: string[] }>;
  lastJob: Os3JobRecord | null;
};

export type Os3SystemOverview = {
  ok: boolean;
  service: string;
  vaultRoot: string;
  sqliteOpen: boolean;
  integrityOk: boolean;
  schemaVersion: number | null;
  indexStats: { totalFiles: number; bySector: Record<string, number> };
  agents: {
    total: number;
    failuresCount: number;
    byClass: Record<string, number>;
    byDomain: Record<string, number>;
  };
  workflows: { total: number; names: string[] };
  runtime: {
    activeLocks: number;
    pendingApprovals: number;
    totalApprovals: number;
    recentRunsCount: number;
    recentJobsCount: number;
    recentEventsCount: number;
  };
  pendingApprovalsList: GatewayApprovalItem[];
  recentJobs: Os3JobRecord[];
  recentAgentRuns: Os3AgentRunRecord[];
  recentEvents: Os3RuntimeEventRecord[];
};

export type Os3VaultTreeNote = {
  vaultPath: string;
  title: string;
  domain: string | null;
  docType: string | null;
  status: string | null;
  tags: string[];
  sha256: string;
  wikilinksCount: number;
};

export type Os3VaultTreeSector = {
  sector: string;
  totalIndexed: number;
  returnedCount: number;
  folders: Array<{ folder: string; count: number; notes: Os3VaultTreeNote[] }>;
};

export type Os3VaultTreeResponse = {
  ok: boolean;
  totalFiles: number;
  bySector: Record<string, number>;
  sectors: Os3VaultTreeSector[];
};

export type Os3KnowledgeGraphNode = {
  id: string;
  title: string;
  sector: string;
  domain: string | null;
  docType: string | null;
  status: string | null;
  degree: number;
};

export type Os3KnowledgeGraphEdge = {
  source: string;
  target: string;
  rawTarget: string;
};

export type Os3KnowledgeGraphResponse = {
  ok: boolean;
  sector: string | null;
  totalIndexed: number;
  nodeCount: number;
  edgeCount: number;
  nodes: Os3KnowledgeGraphNode[];
  edges: Os3KnowledgeGraphEdge[];
};

export type Os3DomainEntrySummary = {
  vaultPath: string;
  title: string;
  docType: string | null;
  status: string | null;
  tags: string[];
  sha256: string;
  wikilinksCount: number;
};

export type Os3ResearchOverview = {
  ok: boolean;
  counts: {
    totalIntelligenceFiles: number;
    totalMaterialFiles: number;
    projects: number;
    questions: number;
    sources: number;
    evidence: number;
    findings: number;
    contradictions: number;
    experiments: number;
    briefs: number;
    specialists: number;
  };
  projects: Os3DomainEntrySummary[];
  questions: Os3DomainEntrySummary[];
  sources: Os3DomainEntrySummary[];
  evidence: Os3DomainEntrySummary[];
  findings: Os3DomainEntrySummary[];
  contradictions: Os3DomainEntrySummary[];
  experiments: Os3DomainEntrySummary[];
  briefs: Os3DomainEntrySummary[];
  recentRuns: Os3AgentRunRecord[];
};

export type Os3RecordsOverview = {
  ok: boolean;
  counts: {
    totalRecordsFiles: number;
    songs: number;
    lyrics: number;
    vocalDna: number;
    sunoPrompts: number;
    audioTakes: number;
    releases: number;
    rightsSplits: number;
    catalogAssignments: number;
    sessionsDaily: number;
    recordAgents: number;
  };
  songs: Os3DomainEntrySummary[];
  lyrics: Os3DomainEntrySummary[];
  vocalDna: Os3DomainEntrySummary[];
  sunoPrompts: Os3DomainEntrySummary[];
  audioTakes: Os3DomainEntrySummary[];
  releases: Os3DomainEntrySummary[];
  rightsSplits: Os3DomainEntrySummary[];
  catalogAssignments: Os3DomainEntrySummary[];
  sessionsDaily: Os3DomainEntrySummary[];
  recentRuns: Os3AgentRunRecord[];
};

export type AudioPromptFacet = 'style' | 'genres' | 'vocal' | 'flow' | 'instruments';
export type AudioPromptSaveMode = 'unified' | 'per-facet';

export type AudioStructureSection = {
  label: string;
  startSec: number;
  endSec: number;
  energy: number;
};

export type AudioAcousticTelemetry = {
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
  durationSec: number;
  sampleRate: number;
  channels: number;
  bpm: number;
  bpmConfidence: number;
  musicalKey: string;
  scale: string;
  keyConfidence: number;
  rmsDb: number;
  peakDb: number;
  crestDb: number;
  estimatedLufs: number;
  spectralCentroidHz: number;
  subBassRatio: number;
  lowMidRatio: number;
  vocalMidRatio: number;
  airHighRatio: number;
  stereoWidth: number;
  transientDensity: number;
  swingFactor: number;
  vocalActivityScore: number;
  sections?: AudioStructureSection[];
};

export type AudioReverseEngineeredSpec = {
  id: string;
  sourceFileName: string;
  analyzedAt: string;
  title: string;
  analysisMode: 'dsp-telemetry' | 'dsp+llm-enriched';
  summary: string;
  stylePrompt: string;
  expandedPrompt: string;
  negativePrompt: string;
  genres: string[];
  subgenresAndMoods: string[];
  vocalSpec: {
    hasVocals: boolean;
    delivery: string;
    register: string;
    singingStyle: string;
    vocalEffects: string[];
    lyricCadenceHint: string;
  };
  flowSpec: {
    pocket: string;
    cadence: string;
    energyCurve: string;
    rhythmTags: string[];
  };
  instrumentsSpec: {
    drumsAndPercussion: string[];
    bassAndSub: string[];
    melodicAndHarmonic: string[];
    texturesAndFx: string[];
    mixAndMastering: string;
  };
  sunoMetaTags: string[];
  telemetry: AudioAcousticTelemetry;
  relatedVaultNotes: Array<{ vaultPath: string; title: string; sector: string }>;
};

export type SavedAudioPromptFile = {
  facet: AudioPromptFacet | 'unified';
  vaultPath: string;
  sha256: string;
  byteSize: number;
  createdCopy: boolean;
};

export type SavedAudioPromptSummary = {
  vaultPath: string;
  title: string;
  sha256: string;
  tags: string[];
  status: string | null;
  bpm: number | null;
  musicalKey: string | null;
  sourceAudio: string | null;
  updatedAt: string;
};

export type ImportedAudioEntry = {
  file: File;
  fileName: string;
  objectUrl: string;
  sizeBytes: number;
  mimeType: string;
  durationSec: number;
};


