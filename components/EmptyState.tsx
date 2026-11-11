import { ui } from '@/data/map';

type EmptyStateProps = {
  view: keyof typeof ui.empty;
};

/**
 * Views 6-7. STUB: the source material never shows the Dashboards or Chart screens,
 * so each route renders the shell and this empty state only.
 */
export function EmptyState({ view }: EmptyStateProps) {
  const copy = ui.empty[view];
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="outlined max-w-md border-dashed px-8 py-10 text-center">
        <h1 className="font-serif text-2xl font-light uppercase tracking-label text-ink">{copy.title}</h1>
        <p className="mt-4 font-mono text-xs text-ink-dim">{copy.body}</p>
      </div>
    </div>
  );
}
