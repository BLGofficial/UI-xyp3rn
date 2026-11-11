import type { Department } from './types';

export type FolderRow = {
  glyph: '├─' | '└─';
  /** 0 for a sector's own subfolder, 1 for a folder nested inside one. */
  depth: number;
  name: string;
  count: number;
  /** True when jobs live directly in this folder (it is a cluster). */
  leaf: boolean;
};

/**
 * File name offered by the skill sheet's DOWNLOAD button: the note's own name, always `.md`.
 * @param file vault-relative path of the job
 */
export function downloadName(file: string): string {
  const base = file.split('/').at(-1) ?? file;
  return base.endsWith('.md') ? base : `${base.replace(/\.[^.]+$/, '')}.md`;
}

/**
 * Lines for a job's vault path, drawn with tree glyphs under the sector folder.
 * @param folder sector folder, e.g. "MAIN-XYP3RN-OS-Vault/01_CORE/"
 * @param file vault-relative job path, e.g. "01_CORE/02_Agents/Jarvis.md"
 */
export function pathTree(folder: string, file: string): string[] {
  const parts = file.split('/').slice(1);
  return [
    folder,
    ...parts.map((part, i) => `${'   '.repeat(i)}└─ ${part}${i < parts.length - 1 ? '/' : ''}`),
  ];
}

/**
 * Every folder of a sector in vault order, with tree glyphs and job counts.
 * @param department sector to list
 */
export function folderTree(department: Department): FolderRow[] {
  const top = new Map<string, Map<string, number>>();
  department.jobs.forEach((job) => {
    const [folder = job.cluster, child] = job.cluster.split('/');
    const children = top.get(folder) ?? new Map<string, number>();
    const key = child ?? '';
    children.set(key, (children.get(key) ?? 0) + 1);
    top.set(folder, children);
  });

  const folders = [...top.entries()];
  return folders.flatMap(([name, children], i) => {
    const nested = [...children.entries()].filter(([child]) => child !== '');
    const count = [...children.values()].reduce((sum, n) => sum + n, 0);
    const row: FolderRow = {
      glyph: i === folders.length - 1 ? '└─' : '├─',
      depth: 0,
      name,
      count,
      leaf: nested.length === 0,
    };
    return [
      row,
      ...nested.map(
        ([child, n], j): FolderRow => ({
          glyph: j === nested.length - 1 ? '└─' : '├─',
          depth: 1,
          name: child,
          count: n,
          leaf: true,
        }),
      ),
    ];
  });
}
