import { departments as seedDepartments, x3liusTracks } from '@/data/map';
import type {
  Os3AgentSummary,
  Os3DomainEntrySummary,
  Os3RecordsOverview,
  Os3ResearchOverview,
  Os3SystemOverview,
  Os3WorkflowSummary,
} from './types';

function toDomainEntry(file: string, title: string, docType: string, status: string, tags: string[]): Os3DomainEntrySummary {
  return {
    vaultPath: file,
    title,
    docType,
    status,
    tags,
    sha256: 'local-seed-snapshot',
    wikilinksCount: tags.length,
  };
}

export function buildSeedDashboardBundle(): {
  overview: Os3SystemOverview;
  agents: Os3AgentSummary[];
  workflows: Os3WorkflowSummary[];
  research: Os3ResearchOverview;
  records: Os3RecordsOverview;
} {
  const bySector: Record<string, number> = {};
  let totalFiles = 0;
  for (const dept of seedDepartments) {
    bySector[dept.id] = dept.jobs.length;
    totalFiles += dept.jobs.length;
  }

  const allJobs = seedDepartments.flatMap((d) => d.jobs.map((job) => ({ ...job, sector: d.id })));

  const agentJobs = allJobs.filter(
    (j) => /agent/i.test(j.cluster) || /agent|jarvis|scribe|librarian|coordinator/i.test(j.id),
  );
  const agents: Os3AgentSummary[] = agentJobs.map((j) => ({
    name: j.id,
    class: j.sector === '01_CORE' ? 'core-orchestrator' : j.sector === '06_GOVERNANCE' ? 'governance-guard' : 'specialist',
    domain: j.sector,
    model: 'os3-local-router',
    tools: ['vault.read', 'vault.search', 'context.bundle'],
    role: j.summary,
    contract: j.replaces,
    refuses: j.human,
    path: j.file,
    lastRun: null,
  }));

  const workflowJobs = allJobs.filter(
    (j) => /flow|workflow|pipeline|engine/i.test(j.id) || /workflow|protocol/i.test(j.cluster),
  );
  const workflows: Os3WorkflowSummary[] = workflowJobs.map((j) => ({
    name: j.id,
    description: j.summary,
    sourcePath: j.file,
    requiredInputs: ['topic_or_target'],
    stepCount: Math.max(2, j.breaksInto.length),
    steps: j.breaksInto.slice(0, 4).map((step, idx) => ({
      id: `step-${idx + 1}`,
      agent: step,
      dependsOn: idx > 0 ? [`step-${idx}`] : [],
    })),
    lastJob: null,
  }));

  const researchJobs = allJobs.filter((j) => j.sector === '03_RESEARCH_INTELLIGENCE');
  const materialJobs = allJobs.filter((j) => j.sector === '04_RESEARCH_MATERIAL');
  const briefEntries = researchJobs
    .slice(0, 8)
    .map((j) => toDomainEntry(j.file, j.title, 'research-brief', j.status, j.breaksInto));
  const questionEntries = materialJobs
    .slice(0, 8)
    .map((j) => toDomainEntry(j.file, j.title, 'source-material', j.status, j.breaksInto));

  const recordJobs = allJobs.filter((j) => j.sector === '05_XYP3RN_RECORDS');
  const songs = x3liusTracks.map((t) =>
    toDomainEntry(`09_X3LIUS_MUSIC/SONGS/${t.title}.md`, t.title, 'song', t.status, [t.format.toUpperCase(), `${t.bpm} BPM`]),
  );
  const sunoPrompts = x3liusTracks.map((t) =>
    toDomainEntry(
      `09_X3LIUS_MUSIC/AUDIO_EXTRACTED_PROMPTS/${t.id}-prompt.md`,
      `${t.title} — Extracted Style Prompt`,
      'audio-extracted-prompt',
      'live',
      ['X3LIUS', t.release],
    ),
  );

  const byClass: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  for (const agent of agents) {
    byClass[agent.class] = (byClass[agent.class] ?? 0) + 1;
    byDomain[agent.domain] = (byDomain[agent.domain] ?? 0) + 1;
  }

  return {
    overview: {
      ok: true,
      service: 'XYP3RN OS 3.0 · Local Seed Snapshot',
      vaultRoot: 'LOCAL_SEED_MAP',
      sqliteOpen: false,
      integrityOk: true,
      schemaVersion: 3,
      indexStats: {
        totalFiles,
        bySector,
      },
      agents: {
        total: agents.length,
        failuresCount: 0,
        byClass,
        byDomain,
      },
      workflows: {
        total: workflows.length,
        names: workflows.map((w) => w.name),
      },
      runtime: {
        activeLocks: 0,
        pendingApprovals: 0,
        totalApprovals: 0,
        recentRunsCount: 0,
        recentJobsCount: 0,
        recentEventsCount: 0,
      },
      pendingApprovalsList: [],
      recentJobs: [],
      recentAgentRuns: [],
      recentEvents: [],
    },
    agents,
    workflows,
    research: {
      ok: true,
      counts: {
        totalIntelligenceFiles: researchJobs.length,
        totalMaterialFiles: materialJobs.length,
        projects: Math.min(4, researchJobs.length),
        questions: Math.min(4, materialJobs.length),
        sources: materialJobs.length,
        evidence: researchJobs.length,
        findings: researchJobs.length,
        contradictions: 0,
        experiments: Math.min(3, researchJobs.length),
        briefs: briefEntries.length,
        specialists: Math.min(6, researchJobs.length),
      },
      projects: briefEntries.slice(0, 4),
      questions: questionEntries.slice(0, 4),
      sources: questionEntries,
      evidence: [],
      findings: briefEntries,
      contradictions: [],
      experiments: [],
      briefs: briefEntries,
      recentRuns: [],
    },
    records: {
      ok: true,
      counts: {
        totalRecordsFiles: recordJobs.length + songs.length + sunoPrompts.length,
        songs: songs.length,
        lyrics: recordJobs.filter((j) => /lyric/i.test(j.id)).length,
        vocalDna: recordJobs.filter((j) => /vocal/i.test(j.id)).length,
        sunoPrompts: sunoPrompts.length,
        audioTakes: x3liusTracks.length,
        releases: x3liusTracks.filter((t) => t.status === 'released').length,
        rightsSplits: recordJobs.filter((j) => /rights|split/i.test(j.id)).length,
        catalogAssignments: recordJobs.length,
        sessionsDaily: 0,
        recordAgents: recordJobs.filter((j) => /agent/i.test(j.id)).length,
      },
      songs,
      lyrics: [],
      vocalDna: [],
      sunoPrompts,
      audioTakes: [],
      releases: x3liusTracks
        .filter((t) => t.status === 'released')
        .map((t) =>
          toDomainEntry(`05_XYP3RN_RECORDS/08_Releases/${t.id}.md`, `${t.release} — Release Package`, 'release', t.status, [
            t.format.toUpperCase(),
          ]),
        ),
      rightsSplits: [],
      catalogAssignments: recordJobs
        .slice(0, 8)
        .map((j) => toDomainEntry(j.file, j.title, 'record-entity', j.status, j.breaksInto)),
      sessionsDaily: [],
      recentRuns: [],
    },
  };
}
