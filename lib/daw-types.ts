export type UiActionTier =
  | 'observation'
  | 'recommendation'
  | 'proposed_action'
  | 'approved_execution';

export type DawDataSourceKind = 'os3-gateway-live' | 'gateway-offline' | 'demonstration-fixture';

export type DawConnectionState = 'connected' | 'disconnected' | 'degraded';

export type DawCapabilityItem = {
  capabilityId: string;
  category: string;
  requiredTier: string;
  supportLevel: 'SUPPORTED' | 'TEMPLATE_SCOPED' | 'READ_ONLY' | 'UNSUPPORTED';
  rollbackSupported: boolean;
  limitations?: string[];
  notes?: string;
};

export type DawHostProbeSummary = {
  hostKind: 'fl_studio' | 'reaper';
  hostName: string;
  probedAt: string;
  installed: boolean;
  running: boolean;
  detectedVersions: string[];
  discoveredProjectCount: number;
  installedPluginCount: number;
  missingPrerequisites: string[];
  warnings: string[];
};

export type DawAdapterSummary = {
  adapterId: string;
  hostKind: string;
  hostName: string;
  supportedVersions: string[];
  transportProtocol: string;
  readOnlyDefault: boolean;
  capabilities: DawCapabilityItem[];
};

export type DawInstanceSummary = {
  id: string;
  adapterId: string;
  hostKind: string;
  hostName: string;
  edition: string;
  version: string;
  apiVersion: string;
  processId: number | null;
  transportKind: string;
  reachable: boolean;
  isSimulated: boolean;
  discoveredAt: string;
};

export type DawAvailability<T> =
  | { status: 'available'; value: T }
  | { status: 'unavailable' | 'unsupported' | 'unknown'; reason: string };

export type DawTrackView = {
  id: string;
  index: number;
  name: string;
  kind: string;
  color: string | null;
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  mixerChannelId: string | null;
};

export type DawMixerChannelView = {
  id: string;
  index: number;
  name: string;
  isMaster: boolean;
  volumeNormalized: number;
  volumeDb: number | null;
  panNormalized: number;
  muted: boolean;
  soloed: boolean;
  stereoSeparation: number | null;
  peakDb: number | null;
  pluginSlots: Array<{
    id: string;
    slotIndex: number;
    name: string;
    format: string;
    bypassed: boolean;
    editionCompatible: string;
    parameterCount: number;
  }>;
};

export type DawRoutingEdgeView = {
  id: string;
  sourceId: string;
  targetId: string;
  sendNormalized: number;
  sendDb: number | null;
  enabled: boolean;
  preFader: boolean;
  sidechain: boolean;
};

export type DawSnapshotView = {
  snapshotId: string;
  sessionId: string;
  freshness: string;
  provenance: {
    observedAt: string;
    dawId: string;
    adapterId: string;
    hostVersion: string;
    sourceEvidence: string;
    freshness: string;
  };
  transport: {
    playing: boolean;
    paused: boolean;
    recording: boolean;
    loopEnabled: boolean;
    songPositionBeats: number;
    songPositionSeconds: number;
    tempo: { bpm: number; freshness: string };
    timeSignature: { numerator: number; denominator: number; ppq?: number };
  };
  tracks: DawAvailability<DawTrackView[]>;
  mixerChannels: DawAvailability<DawMixerChannelView[]>;
  routing: DawAvailability<DawRoutingEdgeView[]>;
  plugins: DawAvailability<Array<{
    id: string;
    name: string;
    vendor: string | null;
    format: string;
    bypassed: boolean;
    editionCompatible: string;
    parameterCount: number;
  }>>;
  markers: DawAvailability<Array<{ id: string; name: string; positionBeats: number; kind: string }>>;
  regions: DawAvailability<Array<{ id: string; name: string; startBeats: number; endBeats: number }>>;
  stateDigest: string;
};

export type DawSessionView = {
  sessionId: string;
  adapterId: string;
  dawId: string;
  hostVersion: string;
  project: {
    projectId: string;
    name: string;
    format: string;
    projectPath: string | null;
    savedSha256: string | null;
    lastSavedAt: string | null;
    editionRequirement: string | null;
  };
  connection: {
    connectionId: string;
    status: string;
    activePermissionTier: string;
    versionCompatibility: string;
    connectedAt: string;
    lastHeartbeatAt: string | null;
    lastRttMs: number | null;
    consecutiveFailures: number;
  };
  stateFreshness: string;
  observed: DawSnapshotView | null;
  cached: DawSnapshotView | null;
  stale: boolean;
  hasUnsavedLiveChanges: boolean;
  unknownFields: string[];
  updatedAt: string;
};

export type DawSessionIntelligenceView = {
  reportId: string;
  projectName: string;
  sessionId: string;
  observationTimestamp: string;
  dataFreshness: {
    stateFreshness: string;
    isLive: boolean;
    isStale: boolean;
    hasUnsavedLiveChanges: boolean;
  };
  confidence: { level: string; score: number; rationale: string };
  routingGraph: {
    observabilityStatus: string;
    observabilityReason: string;
    nodes: Array<{ id: string; label: string; kind: string }>;
    edges: Array<{ from: string; to: string; kind: string }>;
    signalFlowChains: string[][];
  };
  findings: Array<{ severity: string; title: string; detail: string }>;
  limitations: string[];
  recommendedNextActions: Array<{
    priority: string;
    title: string;
    actionType: string;
    requiresApproval: boolean;
    rationale: string;
  }>;
  stateDiffFromPrevious?: { summary: string; freshnessTransition: string } | null;
};

export type DawPluginProfileView = {
  id: string;
  identity: { manufacturer: string | null; productName: string; version: string | null };
  format: string;
  category: string;
  pluginType: string;
  processingRoles: string[];
  compatibility: {
    editionRequirement: string;
    supportVerdict: string;
    reasons: string[];
  };
  installation: {
    installedOnHost: 'verified_installed' | 'not_detected_on_host' | 'unknown';
    discoverySources: string[];
  };
  parameters: Array<{
    id: string;
    name: string;
    min: number;
    max: number;
    unit: string | null;
    lastObservedDisplay: string | null;
    interpretation: string;
  }>;
  knownLimitations: string[];
};

export type DawPluginChainReportView = {
  chainId: string;
  sourceKind: string;
  workflowKind: string;
  compatibleForHost: boolean;
  installedCoverageRatio: number;
  redundancies: Array<{ code: string; severity: string; summary: string }>;
  signalFlowIssues: Array<{ code: string; severity: string; summary: string }>;
  summary: string;
};

export type DawAudioAnalysisView = {
  reportId: string;
  analyzedAt: string;
  acquisition: { label: string; sourceKind: string; sha256AfterRead: string; readOnlyVerified: boolean };
  decodedInfo: { sampleRateHz: number | null; channels: number | null; durationSec: number | null };
  features: {
    samplePeakDbfs: number;
    truePeakDbtp: DawAvailability<number>;
    rmsDbfs: number;
    crestFactorDb: number;
    dynamicRangeDb: number;
    loudness: { integratedLufs: number; shortTermMaxLufs: number; rangeLu: number };
    clipping: { clippedSampleCount: number; exceedsZeroDbfs: boolean; exceedsMinusOneDbtp: boolean };
    silence: { isEffectiveSilence: boolean; silentFrameRatio: number };
    noiseFloorDbfs: number;
    stereo: { correlation: number; widthPct: number; monoCompatibilityRisk: string };
    spectrum: { spectralCentroidHz: number; tonalBalanceDb: Record<string, number> };
  };
  mir: DawAvailability<{
    modelDisclaimer: string;
    probabilistic: true;
    tempoEstimate: { bpm: number | null; confidence: number; probabilistic: true };
    keyEstimate: { key: string; scale: string; confidence: number; probabilistic: true };
    harmonicPercussive: { harmonicEnergyRatio: number; percussiveEnergyRatio: number; classification: string; probabilistic: true };
    sourceClassification: { primaryClass: string; confidence: number; probabilistic: true };
  }>;
  diagnostics: {
    overallVerdict: 'PASS' | 'WARN' | 'CRITICAL';
    stage: string;
    alerts: Array<{ code: string; severity: string; metric: string; measured: number | string; summary: string }>;
  };
  recommendations: Array<{
    priority: string;
    actionType: string;
    title: string;
    rationale: string;
    suggestedDelta: string;
    requiresApprovalOrManualAction: true;
  }>;
};

export type DawPreparedProposalView = {
  approvalId: string;
  prepareId: string;
  sessionId: string;
  capabilityId: string;
  commandKind: string;
  commandClass: 'read_only' | 'reversible' | 'potentially_destructive' | 'irreversible' | 'unsupported';
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  approvalRequirement: 'none' | 'human_standard' | 'human_strong';
  targetRef: string;
  proposer: string;
  status: 'pending' | 'approved' | 'rejected';
  rollbackSupported: boolean;
  wouldSucceed: boolean;
  projectVerified: boolean;
  fresh: boolean;
  warnings: string[];
  postconditionExpectations: string[];
  diff: Array<{ field: string; before: unknown; after: unknown; unit?: string }>;
  createdAt: string;
  decidedAt: string | null;
  approver: string | null;
  reason: string | null;
};

export type DawExecutionReceiptView = {
  receiptId: string;
  commandId: string;
  correlationId: string;
  sessionId: string;
  adapterId: string;
  capabilityId: string;
  commandKind: string;
  commandClass: string;
  riskLevel: string;
  requestedBy: string;
  executedBy: string;
  lifecycleStages: string[];
  verifiedByReadback: boolean;
  postconditionVerified: boolean;
  rollbackSupported: boolean;
  rollbackStatus: 'available' | 'unavailable' | 'rolled_back' | 'rollback_failed';
  status: string;
  warnings: string[];
  error?: { code: string; message: string };
  createdAt: string;
  completedAt: string;
};

export type DawAgentSpecView = {
  name: string;
  class: string;
  domain: string;
  role: string;
  permissions: string;
  tools: string[];
  refuses: string;
  escalatesTo: string;
};

export type DawAgentRunResultView = {
  ok: boolean;
  selectedAgent: string;
  agentClass: string;
  domain: string;
  mode: 'analyze' | 'recommend' | 'prepare' | 'execute_with_approval';
  toolsInvoked: string[];
  findings: string[];
  recommendations: string[];
  evidence: string[];
  limitations: string[];
  escalatedTo?: string;
  error?: { code: string; message: string };
};

export type DawWorkflowView = {
  id: string;
  name: string;
  title: string;
  domain: string;
  description: string;
  requiredInputs: string[];
  stepCount: number;
  steps: Array<{ id: string; agent: string; tool: string; dependsOn: string[] }>;
};

export type DawEvaluationReportView = {
  evaluationId: string;
  generatedAt: string;
  overallPassed: boolean;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  categories: Array<{
    category: string;
    totalCases: number;
    passedCases: number;
    accuracy: number;
    passedThreshold: boolean;
  }>;
  cases?: Array<{
    caseId: string;
    category: string;
    title: string;
    passed: boolean;
    provenance: { datasetId: string; sourceKind: string; notes: string };
    error: string | null;
  }>;
};

export type DawOverviewPayload = {
  ok: boolean;
  generatedAt: string;
  dataSource: DawDataSourceKind;
  isDemoFixture: boolean;
  fixtureNotice?: string;
  connectionSummary: {
    state: DawConnectionState;
    connectedSessions: number;
    totalSessions: number;
    activeSessionId: string | null;
    currentDaw: string | null;
    currentVersion: string | null;
    currentProject: string | null;
    lastObservedAt: string | null;
    freshness: string;
    stale: boolean;
    adaptersRegistered: number;
    reachableInstances: number;
  };
  hostProbes: DawHostProbeSummary[];
  adapters: DawAdapterSummary[];
  discoveredInstances: DawInstanceSummary[];
  sessions: DawSessionView[];
  capabilities: {
    available: DawCapabilityItem[];
    unsupported: DawCapabilityItem[];
    readOnlyCount: number;
    mutableCount: number;
  };
  activeOperations: Array<{
    id: string;
    kind: 'lease' | 'prepared_command';
    sessionId: string;
    actor: string;
    label: string;
    tierOrRisk: string;
    expiresOrCreatedAt: string;
  }>;
  pendingApprovals: DawPreparedProposalView[];
  executionHistory: DawExecutionReceiptView[];
  sessionIntelligence: DawSessionIntelligenceView | null;
  pluginBrain: {
    profiles: DawPluginProfileView[];
    chainGraphs: Array<{ chainId: string; label: string; sourceKind: string; nodes: unknown[]; missingRoles: string[] }>;
    chainReports: DawPluginChainReportView[];
  };
  audioBrain: {
    recentAnalyses: DawAudioAnalysisView[];
  };
  agents: DawAgentSpecView[];
  workflows: DawWorkflowView[];
  evaluation: DawEvaluationReportView | null;
  events: Array<{ id?: number; timestamp?: string; eventType?: string; actor?: string; payload?: Record<string, unknown> }>;
};
