import { describe, expect, it } from 'vitest';
import { brain, departments, ui } from '@/data/map';
import { ICONS } from '@/lib/icons';
import { SECTOR_COLORS } from '@/lib/tokens';
import type { DepartmentId } from '@/lib/types';

/** Per-cluster job counts copied from the seed distribution table in the source PDF. */
const EXPECTED: Record<DepartmentId, Record<string, number>> = {
  '01_CORE': {
    '00_Identity': 2,
    '01_System_Prompts': 2,
    '02_Agents': 8,
    '03_Workflows': 3,
    '04_Templates': 4,
    '05_Dashboards': 2,
    '06_Tasks': 1,
    '07_Tools': 4,
  },
  '02_KNOWLEDGE_LAYER': {
    '00_MOCs': 3,
    '01_Concepts': 3,
    '02_Frameworks': 3,
    '03_Playbooks': 3,
    '04_Atomic_Notes': 4,
    '05_Glossary': 2,
  },
  '03_RESEARCH_INTELLIGENCE': {
    '00_Briefs': 2,
    '01_Analyses': 2,
    '02_Competitive_Intel': 2,
    '03_Trend_Signals': 2,
    '04_Hypotheses': 2,
    '05_Syntheses': 2,
    '06_Specialists': 20,
  },
  '04_RESEARCH_MATERIAL': {
    '00_Inbox': 3,
    '01_Papers': 3,
    '02_Articles': 2,
    '03_Books': 2,
    '04_Transcripts': 2,
    '05_Datasets': 2,
    '06_Media': 2,
    '07_Web_Clippings': 2,
  },
  '05_XYP3RN_RECORDS': {
    '00_Daily_Notes': 2,
    '01_Session_Logs': 2,
    '02_Decisions_ADR': 2,
    '03_Projects': 2,
    '04_Meetings': 2,
    '05_Releases': 2,
    '06_X3LIUS_MUSIC_SYSTEM/00_Songs': 7,
    '06_X3LIUS_MUSIC_SYSTEM/06_Audio': 3,
    '06_X3LIUS_MUSIC_SYSTEM/07_Suno_Prompts': 3,
    '99_Archive': 2,
  },
  '06_GOVERNANCE': {
    '00_Policies': 3,
    '01_Standards': 2,
    '02_Access_Control': 2,
    '03_Risk_Register': 2,
    '04_Compliance': 2,
    '05_Audit_Logs': 2,
    '06_Changelog': 3,
  },
};

const allJobs = departments.flatMap((d) => d.jobs.map((job) => ({ job, dept: d })));

describe('vault seed data', () => {
  it('totals 137 jobs split 26 / 18 / 32 / 18 / 27 / 16', () => {
    expect(departments.map((d) => d.jobs.length)).toEqual([26, 18, 32, 18, 27, 16]);
    expect(allJobs).toHaveLength(137);
  });

  it('matches the per-cluster distribution, in vault folder order', () => {
    departments.forEach((dept) => {
      const counts: Record<string, number> = {};
      dept.jobs.forEach((job) => {
        counts[job.cluster] = (counts[job.cluster] ?? 0) + 1;
      });
      expect(counts).toEqual(EXPECTED[dept.id]);
      expect(Object.keys(counts)).toEqual(Object.keys(EXPECTED[dept.id]));
    });
  });

  it('has 46 leaf clusters', () => {
    expect(new Set(allJobs.map(({ job, dept }) => `${dept.id}/${job.cluster}`)).size).toBe(46);
  });

  it('gives every job a unique id and a unique vault path inside its own cluster', () => {
    expect(new Set(allJobs.map(({ job }) => job.id)).size).toBe(137);
    expect(new Set(allJobs.map(({ job }) => job.file)).size).toBe(137);
    allJobs.forEach(({ job, dept }) => {
      expect(job.file.startsWith(`${dept.id}/${job.cluster}/`)).toBe(true);
      expect(job.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    });
  });

  it('resolves every buildsOn reference to a real job other than itself', () => {
    const ids = new Set(allJobs.map(({ job }) => job.id));
    allJobs.forEach(({ job }) => {
      job.buildsOn.forEach((ref) => {
        expect(ids.has(ref), `${job.id} builds on unknown ${ref}`).toBe(true);
        expect(ref).not.toBe(job.id);
      });
    });
  });

  it('marks exactly one START HERE job per sector, never a stub', () => {
    departments.forEach((dept) => {
      const starts = dept.jobs.filter((job) => job.startHere);
      expect(starts.map((job) => job.id)).toHaveLength(1);
      expect(starts[0]!.stub).toBeFalsy();
    });
  });

  it('keeps 60 written entries and marks the other 77 as stubs with no invented state', () => {
    const stubs = allJobs.filter(({ job }) => job.stub);
    expect(stubs).toHaveLength(77);
    expect(allJobs.length - stubs.length).toBe(60);
    stubs.forEach(({ job }) => {
      expect(job.status).toBe('not-started');
      expect(job.breaksInto).toEqual([]);
      expect(job.buildsOn).toEqual([]);
      expect(job.summary.startsWith(ui.stub.marker)).toBe(true);
    });
  });

  it('names the 27 notes the source lists without content', () => {
    const named = allJobs.filter(({ job }) => job.stub && !job.title.startsWith(ui.stub.titlePrefix));
    expect(named).toHaveLength(27);
    const titles = named.map(({ job }) => job.title);
    ['Research Orchestrator', 'X3LIUS Songwriter', 'vault.read', 'Single Job Lock', 'No Overwrite Policy'].forEach((title) => {
      expect(titles).toContain(title);
    });
  });

  it('uses only icons that resolve', () => {
    allJobs.forEach(({ job }) => {
      expect(ICONS[job.icon], `${job.id} uses unknown icon ${job.icon}`).toBeDefined();
    });
    departments.forEach((dept) => expect(ICONS[ui.sectorIcons[dept.id]]).toBeDefined());
  });

  it('binds each sector to its token color and vault folder', () => {
    departments.forEach((dept) => {
      expect(dept.color).toBe(SECTOR_COLORS[dept.id]);
      expect(dept.folder).toBe(`${ui.vaultRoot}/${dept.id}/`);
    });
  });

  it('describes the two engine cores of the brain', () => {
    expect(brain.cores).toHaveLength(2);
    expect(brain.particleCount).toBeGreaterThanOrEqual(300);
  });
});
