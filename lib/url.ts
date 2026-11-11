import type { DepartmentId } from './types';

/**
 * Decodes the `?open=` query value into the list of expanded sectors.
 * @param value raw param: null (absent) means every sector is expanded, '' means none
 * @param all every sector id in vault order
 * @returns expanded sector ids in vault order; unknown ids are dropped
 */
export function parseOpenParam(value: string | null, all: readonly DepartmentId[]): DepartmentId[] {
  if (value === null) return [...all];
  const wanted = new Set(value.split(',').map((part) => part.trim()));
  return all.filter((id) => wanted.has(id));
}

/**
 * Encodes the expanded sectors for the `?open=` param.
 * @param open expanded sector ids
 * @param all every sector id in vault order
 * @returns null when everything is expanded (the param is omitted), otherwise a comma list
 */
export function serializeOpenParam(open: readonly DepartmentId[], all: readonly DepartmentId[]): string | null {
  const set = new Set(open);
  const ordered = all.filter((id) => set.has(id));
  return ordered.length === all.length ? null : ordered.join(',');
}
