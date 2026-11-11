export type MdBlock =
  | { type: 'frontmatter'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'paragraph'; text: string };

export type MdInline = { type: 'text' | 'code'; value: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+\.\s+(.*)$/;
const FENCE = /^\s*```/;
const RULE = /^-{3,}\s*$/;

/**
 * Parses the subset of Markdown the vault notes use: frontmatter, headings, lists,
 * fenced code and paragraphs. Small on purpose; the spec forbids pulling in a UI kit.
 * @param markdown note source
 */
export function parseMarkdown(markdown: string): MdBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let paragraph: string[] = [];
  let i = 0;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };

  if (RULE.test(lines[0] ?? '')) {
    const end = lines.findIndex((line, index) => index > 0 && RULE.test(line));
    if (end > 0) {
      blocks.push({ type: 'frontmatter', lines: lines.slice(1, end).filter((line) => line.trim() !== '') });
      i = end + 1;
    }
  }

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const heading = HEADING.exec(line);
    const ordered = NUMBERED.test(line);

    if (FENCE.test(line)) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i] ?? '')) body.push(lines[i++] ?? '');
      blocks.push({ type: 'code', text: body.join('\n') });
      i++;
    } else if (heading) {
      flush();
      blocks.push({ type: 'heading', level: (heading[1] ?? '').length, text: (heading[2] ?? '').trim() });
      i++;
    } else if (ordered || BULLET.test(line)) {
      flush();
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i] ?? '')) {
        items.push((pattern.exec(lines[i] ?? '')?.[1] ?? '').trim());
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
    } else {
      // A stray rule or a blank line both end the current paragraph.
      if (line.trim() === '' || RULE.test(line)) flush();
      else paragraph.push(line.trim());
      i++;
    }
  }
  flush();
  return blocks;
}

/**
 * Splits a line into plain text and inline `code` runs.
 * @param text one line or paragraph
 */
export function parseInline(text: string): MdInline[] {
  return text
    .split(/(`[^`]+`)/g)
    .filter((part) => part !== '')
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 2
        ? { type: 'code' as const, value: part.slice(1, -1) }
        : { type: 'text' as const, value: part },
    );
}
