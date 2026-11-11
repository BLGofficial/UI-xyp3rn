import { describe, expect, it, vi } from 'vitest';
import { departments } from '@/data/map';
import { clampPan, fitScale, zoomAt } from '@/lib/camera';
import { wrapLabel } from '@/lib/labels';
import { parseInline, parseMarkdown } from '@/lib/markdown';
import { searchJobs } from '@/lib/search';
import {
  STATUS_STORAGE_KEY,
  parseStatusOverrides,
  readStatusOverrides,
  resolveStatus,
  writeStatusOverrides,
} from '@/lib/storage';
import { parseOpenParam, serializeOpenParam } from '@/lib/url';
import { downloadName, folderTree, pathTree } from '@/lib/vault';
import type { DepartmentId } from '@/lib/types';

const ALL = departments.map((d) => d.id);

describe('url open param', () => {
  it('treats a missing param as all expanded and an empty one as all collapsed', () => {
    expect(parseOpenParam(null, ALL)).toEqual(ALL);
    expect(parseOpenParam('', ALL)).toEqual([]);
  });

  it('ignores unknown ids and keeps vault order', () => {
    expect(parseOpenParam('05_XYP3RN_RECORDS,nope,01_CORE', ALL)).toEqual(['01_CORE', '05_XYP3RN_RECORDS']);
  });

  it('round-trips, omitting the param when everything is open', () => {
    expect(serializeOpenParam(ALL, ALL)).toBeNull();
    expect(serializeOpenParam([], ALL)).toBe('');
    const some: DepartmentId[] = ['01_CORE', '05_XYP3RN_RECORDS'];
    expect(serializeOpenParam(some, ALL)).toBe('01_CORE,05_XYP3RN_RECORDS');
    expect(parseOpenParam(serializeOpenParam(some, ALL), ALL)).toEqual(some);
  });
});

describe('status storage', () => {
  it('drops malformed payloads and unknown statuses', () => {
    expect(parseStatusOverrides(null)).toEqual({});
    expect(parseStatusOverrides('{not json')).toEqual({});
    expect(parseStatusOverrides('[1,2]')).toEqual({});
    expect(parseStatusOverrides(JSON.stringify({ a: 'live', b: 'done', c: 3 }))).toEqual({ a: 'live' });
  });

  it('reads and writes through the given storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    expect(writeStatusOverrides({ 'jarvis-agent': 'in-development' }, storage)).toBe(true);
    expect(store.has(STATUS_STORAGE_KEY)).toBe(true);
    expect(readStatusOverrides(storage)).toEqual({ 'jarvis-agent': 'in-development' });
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: vi.fn(() => {
        throw new Error('denied');
      }),
      setItem: vi.fn(() => {
        throw new Error('quota');
      }),
    };
    expect(readStatusOverrides(broken)).toEqual({});
    expect(writeStatusOverrides({ a: 'live' }, broken)).toBe(false);
  });

  it('prefers the override over the seed status', () => {
    const job = departments[0]!.jobs[0]!;
    expect(resolveStatus(job, {})).toBe(job.status);
    expect(resolveStatus(job, { [job.id]: 'not-started' })).toBe('not-started');
  });
});

describe('searchJobs', () => {
  it('returns nothing for a blank query', () => {
    expect(searchJobs(departments, '   ')).toEqual([]);
  });

  it('ranks title matches above file and cluster matches', () => {
    const hits = searchJobs(departments, 'jarvis');
    expect(hits[0]!.job.title.toLowerCase()).toContain('jarvis');
    expect(hits.map((h) => h.job.id)).toContain('jarvis-agent');
  });

  it('matches on file path and cluster, case-insensitively', () => {
    expect(searchJobs(departments, 'ATTENTION.MD')[0]!.job.id).toBe('attention-paper-notes');
    const cluster = searchJobs(departments, '07_suno_prompts', 10);
    expect(cluster).toHaveLength(3);
    cluster.forEach((hit) => expect(hit.department.id).toBe('05_XYP3RN_RECORDS'));
  });
});

describe('markdown', () => {
  it('splits frontmatter, headings, lists, code and paragraphs', () => {
    const blocks = parseMarkdown(
      '---\ntype: workflow\nid: daily-digest\n---\n## Steps\n1. vault.search\n2. agent scribe\n\nPlain `code` text.\n- a\n- b\n```\nxyp3rn> status\n```\n',
    );
    expect(blocks).toEqual([
      { type: 'frontmatter', lines: ['type: workflow', 'id: daily-digest'] },
      { type: 'heading', level: 2, text: 'Steps' },
      { type: 'list', ordered: true, items: ['vault.search', 'agent scribe'] },
      { type: 'paragraph', text: 'Plain `code` text.' },
      { type: 'list', ordered: false, items: ['a', 'b'] },
      { type: 'code', text: 'xyp3rn> status' },
    ]);
  });

  it('handles frontmatter-only notes and an unterminated fence', () => {
    expect(parseMarkdown('---\nmodel: sonnet\n---\n')).toEqual([{ type: 'frontmatter', lines: ['model: sonnet'] }]);
    expect(parseMarkdown('```\nopen')).toEqual([{ type: 'code', text: 'open' }]);
  });

  it('tokenises inline code', () => {
    expect(parseInline('run `promote all` now')).toEqual([
      { type: 'text', value: 'run ' },
      { type: 'code', value: 'promote all' },
      { type: 'text', value: ' now' },
    ]);
  });
});

describe('vault paths', () => {
  it('always downloads a .md file named after the note', () => {
    expect(downloadName('01_CORE/02_Agents/Jarvis.md')).toBe('Jarvis.md');
    expect(downloadName('05_XYP3RN_RECORDS/06_X3LIUS_MUSIC_SYSTEM/06_Audio/uk-drill-type-render.wav')).toBe(
      'uk-drill-type-render.md',
    );
    expect(downloadName('04_RESEARCH_MATERIAL/01_Papers/attention.md')).toBe('attention.md');
  });

  it('renders a job path with tree glyphs under the vault root', () => {
    expect(pathTree('MAIN-XYP3RN-OS-Vault/01_CORE/', '01_CORE/02_Agents/Jarvis.md')).toEqual([
      'MAIN-XYP3RN-OS-Vault/01_CORE/',
      '└─ 02_Agents/',
      '   └─ Jarvis.md',
    ]);
  });

  it('lists 47 folders (44 top-level + 3 nested) with glyphs and counts', () => {
    const rows = departments.flatMap((dept) => folderTree(dept));
    expect(rows).toHaveLength(47);
    expect(rows.filter((row) => row.leaf)).toHaveLength(46);
    const records = folderTree(departments[4]!);
    const music = records.findIndex((row) => row.name === '06_X3LIUS_MUSIC_SYSTEM');
    expect(records[music]).toMatchObject({ glyph: '├─', depth: 0, count: 13, leaf: false });
    expect(records.slice(music + 1, music + 4).map((row) => `${row.glyph} ${row.name} ${row.count}`)).toEqual([
      '├─ 00_Songs 7',
      '├─ 06_Audio 3',
      '└─ 07_Suno_Prompts 3',
    ]);
    expect(records.at(-1)).toMatchObject({ glyph: '└─', name: '99_Archive', depth: 0 });
  });
});

describe('wrapLabel', () => {
  it('wraps on word boundaries and ellipsises overflow', () => {
    expect(wrapLabel('Jarvis Operator', 13, 2)).toEqual(['Jarvis', 'Operator']);
    expect(wrapLabel('Competitive Intelligence Specialist', 13, 2)).toEqual(['Competitive', 'Intelligence…']);
    expect(wrapLabel('Supercalifragilistic', 8, 2)).toEqual(['Superca…']);
    expect(wrapLabel('', 8, 2)).toEqual([]);
  });
});

describe('camera', () => {
  const viewport = { width: 1000, height: 800 };
  const bounds = { minX: -300, minY: -500, maxX: 300, maxY: 0 };

  it('fits bounds into the available box without exceeding the cap', () => {
    expect(fitScale(bounds, { width: 300, height: 250 }, 1.15)).toBeCloseTo(0.5);
    expect(fitScale(bounds, { width: 6000, height: 5000 }, 1.15)).toBe(1.15);
  });

  it('clamps pan so the tree cannot leave the viewport', () => {
    const origin = { x: 500, y: 700 };
    const free = clampPan({ x: 10, y: -20 }, 1, bounds, viewport, origin, 80);
    expect(free).toEqual({ x: 10, y: -20 });
    const far = clampPan({ x: 5000, y: 5000 }, 1, bounds, viewport, origin, 80);
    // The left/top edge of the tree stays at least 80px inside the right/bottom viewport edge.
    expect(origin.x + far.x + bounds.minX).toBeLessThanOrEqual(viewport.width - 80);
    expect(origin.y + far.y + bounds.minY).toBeLessThanOrEqual(viewport.height - 80);
    const back = clampPan({ x: -5000, y: -5000 }, 1, bounds, viewport, origin, 80);
    expect(origin.x + back.x + bounds.maxX).toBeGreaterThanOrEqual(80);
    expect(origin.y + back.y + bounds.maxY).toBeGreaterThanOrEqual(80);
  });

  it('zooms around the pointer and respects the zoom limits', () => {
    const origin = { x: 500, y: 700 };
    const next = zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 600, y: 300 }, 2, origin, 0.5, 2.5);
    expect(next.zoom).toBe(2);
    // The world point under the pointer stays under the pointer.
    expect(origin.x + next.x + ((600 - origin.x) / 1) * 2).toBeCloseTo(600);
    expect(origin.y + next.y + ((300 - origin.y) / 1) * 2).toBeCloseTo(300);
    expect(zoomAt({ x: 0, y: 0, zoom: 2 }, { x: 0, y: 0 }, 4, origin, 0.5, 2.5).zoom).toBe(2.5);
  });
});
