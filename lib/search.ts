import type { Department, Job } from './types';

export type SearchHit = { job: Job; department: Department; score: number };

const SCORE = { titlePrefix: 100, title: 80, file: 60, cluster: 40 } as const;

function score(job: Job, query: string): number {
  const title = job.title.toLowerCase();
  if (title.startsWith(query)) return SCORE.titlePrefix;
  if (title.includes(query)) return SCORE.title;
  if (job.file.toLowerCase().includes(query)) return SCORE.file;
  if (job.cluster.toLowerCase().includes(query)) return SCORE.cluster;
  return 0;
}

/**
 * Finds jobs by title, vault path or cluster. Title matches rank first; ties keep vault order.
 * @param departments sectors to search
 * @param query free text; blank returns nothing
 * @param limit maximum hits
 */
export function searchJobs(departments: readonly Department[], query: string, limit = 8): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return departments
    .flatMap((department) => department.jobs.map((job) => ({ job, department, score: score(job, needle) })))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
