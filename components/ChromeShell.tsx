'use client';

import { ChevronRight, Disc, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { departments, ui } from '@/data/map';
import { resolveIcon } from '@/lib/icons';
import { readUiPreferences, writeUiPreferences } from '@/lib/os3-adapter';
import { TOKENS } from '@/lib/tokens';

type ChromeContextValue = {
  /** Index of the active sector; shared by the rail, the cycler and the map. */
  active: number;
  setActive: (index: number) => void;
  /** True when the full-screen Jarvis Operator Console is open on /map. */
  jarvisOpen: boolean;
  setJarvisOpen: (open: boolean) => void;
};

const ChromeContext = createContext<ChromeContextValue | null>(null);

/**
 * Active-sector state owned by the shell.
 * @throws when used outside ChromeShell
 */
export function useChrome(): ChromeContextValue {
  const value = useContext(ChromeContext);
  if (!value) throw new Error('useChrome must be used inside ChromeShell');
  return value;
}

/** XYP3RN's own mark: six sectors around one core. */
function LogoMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5 20.2 7.25v9.5L12 21.5l-8.2-4.75v-9.5L12 2.5Z" stroke={TOKENS.ink} strokeWidth="1.25" />
      <path d="M12 2.5v19M3.8 7.25l16.4 9.5M20.2 7.25 3.8 16.75" stroke={TOKENS.ink} strokeWidth="0.6" opacity="0.4" />
      <circle cx="12" cy="12" r="2.4" fill={TOKENS.accent} />
    </svg>
  );
}

function SectorButtons({ active, onPick, expanded }: { active: number; onPick: (index: number) => void; expanded: boolean }) {
  return (
    <>
      {departments.map((dept, i) => {
        const Icon = resolveIcon(ui.sectorIcons[dept.id]);
        const current = i === active;
        return (
          <button
            key={dept.id}
            type="button"
            onClick={() => onPick(i)}
            aria-label={dept.name}
            aria-current={current ? 'true' : undefined}
            title={dept.id}
            className="relative flex h-11 min-w-11 items-center gap-3 rounded-lg px-3 text-ink-dim hover:text-ink md:w-full"
            style={current ? { color: dept.color } : undefined}
          >
            <Icon size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
            {expanded && <span className="micro truncate">{dept.id}</span>}
            {current && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full md:bottom-auto md:left-0 md:top-1/2 md:h-4 md:w-0.5 md:-translate-y-1/2 md:translate-x-0"
                style={{ background: dept.color }}
              />
            )}
          </button>
        );
      })}
    </>
  );
}

/** Top MAP/DASHBOARDS/CHART pill, the collapsible sector rail, and its mobile bottom-bar form. */
export function ChromeShell({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [jarvisOpen, setJarvisOpen] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const prefs = readUiPreferences();
    setExpanded(prefs.expandedSidebar);
    if (prefs.activeSectorIndex < departments.length) {
      setActive(prefs.activeSectorIndex);
    }
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    writeUiPreferences({ expandedSidebar: expanded, activeSectorIndex: active });
  }, [expanded, active, prefsLoaded]);

  const context = useMemo(() => ({ active, setActive, jarvisOpen, setJarvisOpen }), [active, jarvisOpen]);

  const pick = useCallback(
    (index: number) => {
      setActive(index);
      if (pathname !== '/map') router.push('/map');
    },
    [pathname, router],
  );

  const toggleJarvis = useCallback(() => {
    setJarvisOpen((current) => !current);
    if (pathname !== '/map') router.push('/map');
  }, [pathname, router]);

  return (
    <ChromeContext.Provider value={context}>
      <div className="relative flex h-dvh w-full flex-col md:flex-row">
        <aside
          aria-label={ui.rail.label}
          className="relative z-30 hidden shrink-0 flex-col items-stretch gap-1 border-r border-hairline bg-bg/70 px-1.5 py-3 backdrop-blur transition-[width] duration-200 md:flex"
          style={{ width: expanded ? 208 : 56 }}
        >
          <Link href="/map" aria-label={ui.rail.home} className="mb-3 flex h-11 items-center gap-3 rounded-lg px-2.5">
            <LogoMark />
            {expanded && <span className="micro text-ink">{ui.product.name}</span>}
          </Link>
          <SectorButtons active={active} onPick={pick} expanded={expanded} />
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleJarvis}
            aria-label={ui.rail.operator}
            aria-expanded={jarvisOpen}
            className="micro mx-auto grid h-8 w-8 place-items-center rounded-full border border-hairline text-[9px] tracking-normal text-ink hover:border-accent hover:text-accent"
          >
            {ui.product.operatorInitials}
          </button>
          {/* STUB: the source shows a settings icon but defines no behaviour for it. */}
          <button
            type="button"
            disabled
            aria-label={ui.rail.settings}
            title={ui.rail.settingsStub}
            className="mx-auto grid h-11 w-11 place-items-center text-ink-dim"
          >
            <Settings size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? ui.rail.collapse : ui.rail.expand}
            aria-expanded={expanded}
            className="absolute -right-3 top-1/2 grid h-12 w-3 -translate-y-1/2 place-items-center rounded-r-md border border-l-0 border-hairline bg-bg text-ink-dim hover:text-ink"
          >
            <ChevronRight
              size={10}
              strokeWidth={2}
              aria-hidden="true"
              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </button>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
          <nav
            aria-label={ui.nav.label}
            className="frost absolute left-1/2 top-4 z-30 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full p-1 shadow-[0_14px_38px_rgba(0,0,0,0.55)]"
          >
            {ui.nav.items.map((item) => {
              const current = pathname === item.href || (item.href === '/daw' && pathname?.startsWith('/daw'));
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={`micro shrink-0 rounded-full px-3.5 py-2 sm:px-4 ${current ? 'bg-ink font-bold text-bg' : 'text-ink-dim hover:text-ink'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </main>

        <nav
          aria-label={ui.rail.label}
          className="z-30 flex h-14 shrink-0 items-center justify-between border-t border-hairline bg-bg/80 px-2 backdrop-blur md:hidden"
        >
          <Link href="/map" aria-label={ui.rail.home} className="grid h-11 w-11 place-items-center">
            <LogoMark />
          </Link>
          <SectorButtons active={active} onPick={pick} expanded={false} />
          <Link
            href="/daw"
            aria-label="DAW Brain Studio Console"
            className="grid h-11 w-11 place-items-center text-s05_records"
          >
            <Disc size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </ChromeContext.Provider>
  );
}
