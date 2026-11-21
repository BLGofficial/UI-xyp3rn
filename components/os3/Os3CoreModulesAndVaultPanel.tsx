'use client';

import { Cpu, Database, FolderTree, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { searchKnowledgeVault } from '@/lib/os3-adapter';
import type {
  Os3CoreModulesOverview,
  Os3VaultTreeResponse,
  VaultSearchHit,
} from '@/lib/types';

type Props = {
  modules: Os3CoreModulesOverview | null;
  vaultTree: Os3VaultTreeResponse | null;
  loading: boolean;
  permissionDeniedError: string | null;
  offlineError: string | null;
  onInspectVaultPath: (vaultPath: string) => void;
};

function moduleTone(status: 'healthy' | 'degraded' | 'offline') {
  if (status === 'healthy') return 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200';
  if (status === 'degraded') return 'border-amber-400/40 bg-amber-500/12 text-amber-200';
  return 'border-rose-500/45 bg-rose-500/15 text-rose-200';
}

export function Os3CoreModulesAndVaultPanel({
  modules,
  vaultTree,
  loading,
  permissionDeniedError,
  offlineError,
  onInspectVaultPath,
}: Props) {
  const sectors = useMemo(() => vaultTree?.sectors ?? [], [vaultTree]);
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<VaultSearchHit[] | null>(null);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error' | 'permission-denied' | 'offline'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSector && sectors.length > 0) {
      setSelectedSector(sectors[0]!.sector);
    }
  }, [sectors, selectedSector]);

  const activeSectorObj = useMemo(
    () => sectors.find((s) => s.sector === selectedSector) ?? sectors[0] ?? null,
    [sectors, selectedSector],
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchHits(null);
      setSearchState('idle');
      return;
    }
    setSearchState('loading');
    setSearchError(null);
    const res = await searchKnowledgeVault(q, { limit: 25 });
    if (res.ok && res.data) {
      setSearchHits(res.data.hits);
      setSearchState('idle');
    } else if (res.statusKind === 'permission-denied') {
      setSearchHits(null);
      setSearchState('permission-denied');
      setSearchError(res.error ?? 'Permission denied querying Vault search');
    } else if (res.statusKind === 'offline') {
      setSearchHits(null);
      setSearchState('offline');
      setSearchError(res.error ?? 'OS3 Gateway offline');
    } else {
      setSearchHits(null);
      setSearchState('error');
      setSearchError(res.error ?? 'Vault search failed');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Core Modules" className="glass-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="micro flex items-center gap-2 text-accent">
            <Cpu size={14} aria-hidden="true" /> CORE OS3 MODULES & SUBSYSTEMS ({modules?.modules.length ?? 0})
          </h2>
          {loading && <span className="chip">SYNCING MODULES…</span>}
        </div>

        {permissionDeniedError ? (
          <p role="alert" className="mt-3 rounded-xl border border-rose-500/45 bg-rose-500/15 p-3 font-mono text-xs text-rose-100">
            PERMISSION DENIED: {permissionDeniedError}
          </p>
        ) : !modules || modules.modules.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 font-mono text-xs text-ink-dim">
            {offlineError
              ? `OS3 Core module telemetry unavailable while Gateway is offline (${offlineError}).`
              : 'No OS3 Core modules reported.'}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.modules.map((mod) => (
              <div key={mod.id} className="outlined flex flex-col justify-between gap-2 p-3.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-mono font-semibold text-ink">{mod.name}</h3>
                    <p className="font-mono text-[10px] text-ink-dim">{mod.sector}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${moduleTone(mod.status)}`}>
                    {mod.status}
                  </span>
                </div>
                <p className="text-ink-dim">{mod.summary}</p>
                <p className="truncate font-mono text-[10px] text-ink-dim/80">{mod.sourcePath}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Knowledge Search" className="glass-card rounded-2xl p-4 sm:p-5">
          <h2 className="micro mb-3 flex items-center gap-2 text-accent">
            <Search size={14} aria-hidden="true" /> KNOWLEDGE SEARCH (LIVE FTS5 INDEX)
          </h2>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="search"
              aria-label="Search OS3 Knowledge Vault"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes, protocols, claims, entities…"
              className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-ink placeholder:text-ink-dim/70 focus:border-accent/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={searchState === 'loading'}
              className="chip border-accent/45 bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-50"
            >
              {searchState === 'loading' ? 'SEARCHING…' : 'SEARCH VAULT'}
            </button>
          </form>

          {searchError && (
            <div role="alert" className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/12 p-3 font-mono text-xs text-rose-100">
              {searchState === 'permission-denied' ? 'PERMISSION DENIED: ' : ''}{searchError}
            </div>
          )}

          {searchHits && searchHits.length === 0 && (
            <p className="mt-3 rounded-xl border border-dashed border-white/15 p-3 font-mono text-xs text-ink-dim">
              No Vault notes matched &ldquo;{searchQuery}&rdquo;.
            </p>
          )}

          {searchHits && searchHits.length > 0 && (
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1 text-xs">
              {searchHits.map((hit) => (
                <button
                  key={hit.vaultPath}
                  type="button"
                  onClick={() => onInspectVaultPath(hit.vaultPath)}
                  className="outlined flex w-full flex-col gap-1 p-3 text-left hover:border-accent/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-ink">{hit.title}</span>
                    <span className="chip">{hit.sector}</span>
                  </div>
                  <span className="truncate font-mono text-[11px] text-ink-dim">{hit.vaultPath}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Vault Browser" className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="micro flex items-center gap-2 text-accent">
              <FolderTree size={14} aria-hidden="true" /> VAULT BROWSER ({vaultTree?.totalFiles ?? 0} INDEXED)
            </h2>
            <Database size={14} className="text-ink-dim" aria-hidden="true" />
          </div>

          {sectors.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 font-mono text-xs text-ink-dim">
              No live Vault tree loaded. Connect OS3 Gateway and scan Vault to browse indexed folders.
            </p>
          ) : (
            <>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {sectors.map((sec) => (
                  <button
                    key={sec.sector}
                    type="button"
                    onClick={() => setSelectedSector(sec.sector)}
                    className={`chip shrink-0 ${
                      activeSectorObj?.sector === sec.sector ? 'border-accent bg-accent/18 text-ink' : 'text-ink-dim'
                    }`}
                  >
                    {sec.sector} ({sec.totalIndexed})
                  </button>
                ))}
              </div>

              {activeSectorObj && (
                <div className="mt-3 max-h-80 space-y-2.5 overflow-y-auto pr-1 text-xs">
                  {activeSectorObj.folders.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/15 p-3 font-mono text-xs text-ink-dim">
                      Sector &ldquo;{activeSectorObj.sector}&rdquo; contains no indexed folders yet.
                    </p>
                  ) : (
                    activeSectorObj.folders.map((folder) => (
                      <div key={folder.folder} className="outlined p-3">
                        <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-ink">
                          <span>{folder.folder}</span>
                          <span className="text-ink-dim">{folder.count} notes</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {folder.notes.slice(0, 12).map((n) => (
                            <button
                              key={n.vaultPath}
                              type="button"
                              onClick={() => onInspectVaultPath(n.vaultPath)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/[0.025] px-2.5 py-1.5 text-left hover:bg-white/[0.07]"
                            >
                              <span className="truncate text-ink">{n.title}</span>
                              <span className="shrink-0 font-mono text-[10px] text-ink-dim">{n.docType ?? n.status ?? 'note'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
