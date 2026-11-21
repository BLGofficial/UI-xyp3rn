import { os3FetchJson, type Os3HttpOptions } from './api-http';
import type {
  DawAgentRunResultView,
  DawEvaluationReportView,
  DawOverviewPayload,
} from './daw-types';

export type DawClientOptions = Os3HttpOptions;

export type DawClientResult<T> = {
  ok: boolean;
  mode: 'live-gateway' | 'gateway-offline';
  statusKind: 'ok' | 'permission-denied' | 'offline' | 'error';
  data: T | null;
  error: string | null;
  statusCode?: number;
};

async function dawRequest<T>(
  path: string,
  init: RequestInit = {},
  options: DawClientOptions = {},
): Promise<DawClientResult<T>> {
  const res = await os3FetchJson<T>(path, init, options);
  return {
    ok: res.ok,
    mode: res.statusKind === 'offline' ? 'gateway-offline' : 'live-gateway',
    statusKind: res.statusKind,
    data: res.data,
    error: res.error,
    statusCode: res.statusCode,
  };
}

export function fetchDawOverview(options?: DawClientOptions): Promise<DawClientResult<DawOverviewPayload>> {
  return dawRequest<DawOverviewPayload>('/api/daw/overview', { method: 'GET' }, options);
}

export function probeDawConnections(options?: DawClientOptions) {
  return dawRequest<{ ok: boolean; hostProbes: unknown[]; discoveredInstances: unknown[] }>(
    '/api/daw/connections/probe',
    { method: 'POST' },
    options,
  );
}

export function connectDawSession(
  input: { adapterId: string; instanceId?: string; projectPath?: string; actor?: string },
  options?: DawClientOptions,
) {
  return dawRequest<{ ok: boolean; session: unknown }>(
    '/api/daw/connections/connect',
    { method: 'POST', body: JSON.stringify(input) },
    options,
  );
}

export function refreshDawSession(sessionId: string, options?: DawClientOptions) {
  return dawRequest<{ ok: boolean; session: unknown; analysis: unknown }>(
    '/api/daw/sessions/refresh',
    { method: 'POST', body: JSON.stringify({ sessionId }) },
    options,
  );
}

export function grantDawPrepareLease(
  input: { sessionId: string; grantedBy: string; allowedTargets?: string[]; ttlMs?: number },
  options?: DawClientOptions,
) {
  return dawRequest<{ ok: boolean; lease: { id: string; maxPermission: string; expiresAt: string } }>(
    '/api/daw/sessions/lease',
    { method: 'POST', body: JSON.stringify(input) },
    options,
  );
}

export function runDawAgent(
  input: {
    agentName: string;
    goal: string;
    mode: 'analyze' | 'recommend' | 'prepare';
    sessionId?: string;
    hostEdition?: string;
    pluginName?: string;
    compareWithPlugin?: string;
  },
  options?: DawClientOptions,
): Promise<DawClientResult<DawAgentRunResultView>> {
  return dawRequest<DawAgentRunResultView>(
    '/api/daw/agents/run',
    { method: 'POST', body: JSON.stringify(input) },
    options,
  );
}

export function runDawWorkflow(
  input: { workflowId: string; sessionId?: string; hostEdition?: string },
  options?: DawClientOptions,
) {
  return dawRequest<{ ok: boolean; result: { workflowId: string; workflowName: string; status: string; steps: Array<{ stepId: string; agent: string; tool: string; ok: boolean; findings: string[]; error?: string }> } }>(
    '/api/daw/workflows/run',
    { method: 'POST', body: JSON.stringify(input) },
    options,
  );
}

export function proposeDawCommand(
  input: {
    sessionId: string;
    kind: string;
    capabilityId: string;
    targetRef: string;
    params: Record<string, unknown>;
    proposer?: string;
  },
  options?: DawClientOptions,
) {
  return dawRequest<{ ok: boolean; approvalId: string; prepared: unknown }>(
    '/api/daw/commands/propose',
    { method: 'POST', body: JSON.stringify(input) },
    options,
  );
}

export function decideDawCommand(
  input: {
    approvalId: string;
    decision: 'approved' | 'rejected';
    approver: string;
    reason: string;
    confirmDangerous?: boolean;
  },
  options?: DawClientOptions,
) {
  return dawRequest<{ ok: boolean; approvalId: string; decision: 'approved' | 'rejected'; executionResult: unknown }>(
    '/api/daw/commands/decide',
    { method: 'POST', body: JSON.stringify(input) },
    options,
  );
}

export function rollbackDawCommand(
  input: { receiptId: string; actor: string; reason: string },
  options?: DawClientOptions,
) {
  return dawRequest<{ ok: boolean; result: unknown }>(
    '/api/daw/commands/rollback',
    { method: 'POST', body: JSON.stringify(input) },
    options,
  );
}

export function runDawEvaluation(
  options?: DawClientOptions,
): Promise<DawClientResult<{ ok: boolean; evaluationScope: string; report: DawEvaluationReportView }>> {
  return dawRequest<{ ok: boolean; evaluationScope: string; report: DawEvaluationReportView }>(
    '/api/daw/evaluate',
    { method: 'POST' },
    options,
  );
}
