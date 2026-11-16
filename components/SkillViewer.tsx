'use client';

import { X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { ui } from '@/data/map';
import { fetchVaultNote } from '@/lib/gateway';
import { parseInline, parseMarkdown, type MdBlock } from '@/lib/markdown';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { downloadName } from '@/lib/vault';
import type { Job, VaultNotePayload } from '@/lib/types';

type CopyTarget = 'install' | 'body';
type Feedback = { target: CopyTarget; ok: boolean };

const CALLOUT = 'overflow-x-auto rounded-md border-4 border-double border-hairline bg-bg/40 p-3 font-mono text-xs leading-relaxed text-ink';
const ACTION = 'micro rounded-md border border-hairline px-3 py-2 text-ink hover:border-ink/50';

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.type === 'code' ? (
          <code key={i} className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
            {part.value}
          </code>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: MdBlock }) {
  switch (block.type) {
    case 'frontmatter':
      return <pre className={CALLOUT}>{block.lines.join('\n')}</pre>;
    case 'code':
      return <pre className={CALLOUT}>{block.text}</pre>;
    case 'heading':
      return block.level === 1 ? (
        <h3 className="text-xl font-semibold tracking-tight">
          <Inline text={block.text} />
        </h3>
      ) : (
        <h4 className="micro pt-2 text-ink-dim">
          <Inline text={block.text} />
        </h4>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List className={`space-y-1 pl-5 text-sm leading-relaxed ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'paragraph':
      return (
        <p className="whitespace-pre-line text-sm leading-relaxed">
          <Inline text={block.text} />
        </p>
      );
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard access is refused in insecure contexts and unfocused documents.
    return false;
  }
}

function downloadMarkdown(job: Job, markdownText: string): void {
  const url = URL.createObjectURL(new Blob([markdownText], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName(job.file);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type SkillViewerProps = {
  job: Job;
  onClose: () => void;
};

/** View 5: the SKILL.MD sheet. Renders the live Vault note Markdown when gateway is online, falling back to local seed. */
export function SkillViewer({ job, onClose }: SkillViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [liveNote, setLiveNote] = useState<VaultNotePayload | null>(null);
  const [loading, setLoading] = useState(false);
  useDialogFocus(ref, true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchVaultNote(job.file)
      .then((note) => {
        if (!active) return;
        if (note && note.mode === 'live-gateway' && note.rawContent.trim()) {
          setLiveNote(note);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [job.file]);

  const activeMarkdown = liveNote?.rawContent ?? job.skill.markdown;

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1600);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const copy = async (target: CopyTarget) => {
    const ok = await copyText(target === 'install' ? job.skill.installCmd : activeMarkdown);
    setFeedback({ target, ok });
  };
  const label = (target: CopyTarget, idle: string) =>
    feedback?.target === target ? (feedback.ok ? ui.viewer.copied : ui.viewer.failed) : idle;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-viewer-title"
      tabIndex={-1}
      // Near-opaque: the sheet lies over the job panel, which would otherwise show through the frost.
      style={{ background: 'rgba(32, 35, 46, 0.97)' }}
      className="frost sheet-in fixed inset-x-0 bottom-0 top-0 z-[60] flex flex-col outline-none md:left-auto md:w-[min(720px,100vw)]"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-4 md:px-8">
        <div className="min-w-0 flex-1">
          <h2 id="skill-viewer-title" className="truncate text-lg font-semibold tracking-tight">
            {job.title}
          </h2>
          <p className="truncate font-mono text-xs text-ink-dim">
            {downloadName(job.file)}
            {liveNote ? ` · VAULT LIVE · sha256:${liveNote.sha256.slice(0, 10)}` : loading ? ' · SYNCING VAULT…' : ''}
          </p>
        </div>
        <span className="micro rounded-t-md border border-b-0 border-hairline bg-ink/5 px-3 py-2 text-ink">
          {ui.viewer.badge}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={ui.viewer.close}
          className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-ink-dim hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div className="flex w-full flex-wrap gap-2">
          <button type="button" className={ACTION} onClick={() => void copy('install')}>
            {label('install', ui.viewer.copyInstall)}
          </button>
          <button type="button" className={ACTION} onClick={() => void copy('body')}>
            {label('body', ui.viewer.copy)}
          </button>
          <button type="button" className={ACTION} onClick={() => downloadMarkdown(job, activeMarkdown)}>
            {ui.viewer.download}
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {feedback ? (feedback.ok ? ui.viewer.copied : ui.viewer.failed) : ''}
        </p>
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto px-5 py-6 md:px-8" data-testid="skill-body">
        {parseMarkdown(activeMarkdown).map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </div>
  );
}
