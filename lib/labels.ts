const ELLIPSIS = '…';

const clip = (text: string, maxChars: number) =>
  text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1))}${ELLIPSIS}` : text;

/**
 * Wraps a node title into short lines for SVG text, which cannot wrap on its own.
 * @param text title to wrap
 * @param maxChars characters per line
 * @param maxLines lines before the rest is ellipsised
 */
export function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? '';
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) {
      if (lines.length === maxLines - 1) return [...lines, clip(`${current}${ELLIPSIS}`, maxChars)];
      lines.push(current);
    }
    // A single word wider than the line cannot wrap; clip it and stop.
    if (word.length > maxChars) return [...lines, clip(word, maxChars)];
    current = word;
  }
  return current ? [...lines, current] : lines;
}

/**
 * Fills `{name}` placeholders in a copy template from data/map.ts.
 * @param template e.g. "{title}, {department}, {status}"
 * @param values replacement values by placeholder name
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
