'use client';

import { Bot, Maximize2, Mic, Music, Send } from 'lucide-react';
import { useCallback, useRef, useState, type FormEvent } from 'react';
import { ui, x3liusTracks } from '@/data/map';
import { appendSessionLog, dispatchJarvis } from '@/lib/gateway';
import type { DepartmentId, EngineId, JarvisExchange, JarvisVoiceState, X3liusTrack } from '@/lib/types';
import { speakJarvisReply, startVoiceCapture } from '@/lib/voice';
import { X3liusPlayer } from './X3liusPlayer';

type JarvisDockProps = {
  activeSector: DepartmentId;
  selectedJobId: string | null;
  onOpenConsole: () => void;
  onSelectJob?: (jobId: string) => void;
  onFocusSector?: (sectorId: DepartmentId) => void;
};

/**
 * Floating operator dock on the Constellation Map: quick voice/CLI input,
 * engine selector, expandable X3LIUS mini-player, and full-screen console launcher.
 */
export function JarvisDock({
  activeSector,
  selectedJobId,
  onOpenConsole,
  onSelectJob,
  onFocusSector,
}: JarvisDockProps) {
  const [input, setInput] = useState('');
  const [engine, setEngine] = useState<EngineId>('claude-code-cli');
  const [voiceState, setVoiceState] = useState<JarvisVoiceState>('idle');
  const [latest, setLatest] = useState<JarvisExchange | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<string>(x3liusTracks[0]!.id);
  const [playing, setPlaying] = useState(false);
  const [importedFiles, setImportedFiles] = useState<Record<string, string>>({});
  const stopCaptureRef = useRef<(() => void) | null>(null);

  const runPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;
      setVoiceState('processing');
      const response = await dispatchJarvis({
        prompt: trimmed,
        engine,
        activeSector,
        selectedJobId,
      });
      appendSessionLog(response.exchange);
      setLatest(response.exchange);
      setEngine(response.exchange.engine);

      if (response.action?.type === 'play-track') {
        setActiveTrackId(response.action.trackId);
        setPlaying(true);
        setShowPlayer(true);
      } else if (response.action?.type === 'compose-track') {
        setActiveTrackId(response.action.trackId);
        setShowPlayer(true);
      } else if (response.action?.type === 'focus-sector') {
        onFocusSector?.(response.action.sectorId);
      }

      speakJarvisReply(response.exchange.reply, {
        enabled: false,
        onEnd: () => setVoiceState('idle'),
      });
    },
    [engine, activeSector, selectedJobId, onFocusSector],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    const current = input;
    setInput('');
    void runPrompt(current);
  };

  const toggleVoice = () => {
    if (voiceState === 'listening') {
      stopCaptureRef.current?.();
      stopCaptureRef.current = null;
      setVoiceState('idle');
      if (input.trim()) {
        const text = input;
        setInput('');
        void runPrompt(text);
      }
      return;
    }
    setVoiceState('listening');
    stopCaptureRef.current = startVoiceCapture({
      onInterim: (transcript) => setInput(transcript),
      onFinal: (transcript) => {
        setInput('');
        void runPrompt(transcript);
      },
      onEnd: () => setVoiceState((current) => (current === 'listening' ? 'idle' : current)),
    });
  };

  const handleCompose = (track: X3liusTrack) => {
    void runPrompt(`xyp3rn> compose "${track.title}"`);
  };

  const handleImportRender = (trackId: string, fileName: string) => {
    setImportedFiles((prev) => ({ ...prev, [trackId]: fileName }));
  };

  return (
    <aside
      aria-label={ui.jarvis.dockLabel}
      className="fixed bottom-16 right-3 z-20 flex w-[min(420px,calc(100vw-1.5rem))] flex-col gap-2 md:bottom-5 md:right-4"
    >
      {showPlayer && (
        <div className="frost rounded-xl p-2 shadow-lg">
          <X3liusPlayer
            tracks={x3liusTracks}
            activeTrackId={activeTrackId}
            playing={playing}
            importedFiles={importedFiles}
            onSelectTrack={(id) => {
              setActiveTrackId(id);
              setPlaying(true);
            }}
            onTogglePlay={() => setPlaying((value) => !value)}
            onCompose={handleCompose}
            onImportRender={handleImportRender}
            onOpenJob={onSelectJob}
          />
        </div>
      )}

      {latest && (
        <div role="status" aria-live="polite" className="frost flex flex-col gap-1.5 rounded-xl px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="micro text-accent">
              {ui.jarvis.engines[latest.engine]} · {latest.mode === 'live-gateway' ? ui.jarvis.gatewayLive : ui.jarvis.gatewayLocal}
            </span>
            {latest.referencedJobId && onSelectJob && (
              <button
                type="button"
                onClick={() => onSelectJob(latest.referencedJobId!)}
                className="micro text-ink hover:text-accent"
              >
                {ui.jarvis.openJobCta}
              </button>
            )}
          </div>
          <p className="line-clamp-2 font-mono text-[11px] leading-relaxed text-ink">{latest.reply}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="frost flex items-center gap-1.5 rounded-full px-2 py-1.5">
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={ui.jarvis.voiceToggle}
          aria-pressed={voiceState === 'listening'}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
            voiceState === 'listening'
              ? 'border-accent bg-accent text-bg'
              : 'border-hairline text-ink-dim hover:text-ink'
          }`}
        >
          <Mic size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setEngine((current) => (current === 'claude-code-cli' ? 'gemini-api' : 'claude-code-cli'))}
          className="micro hidden shrink-0 rounded-full border border-hairline px-2.5 py-1 text-[9px] text-ink-dim hover:text-ink sm:inline-block"
        >
          {ui.jarvis.engines[engine]}
        </button>

        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label={ui.jarvis.inputLabel}
          placeholder={ui.jarvis.inputPlaceholder}
          className="min-w-0 flex-1 bg-transparent px-1.5 font-mono text-xs text-ink placeholder:text-ink-dim focus:outline-none"
        />

        <button
          type="submit"
          aria-label={ui.jarvis.send}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hairline text-ink-dim hover:text-ink"
        >
          <Send size={13} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setShowPlayer((value) => !value)}
          aria-label={ui.jarvis.playerToggle}
          aria-expanded={showPlayer}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
            showPlayer || playing ? 'border-s05_records text-s05_records' : 'border-hairline text-ink-dim hover:text-ink'
          }`}
        >
          <Music size={13} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onOpenConsole}
          aria-label={ui.jarvis.openConsole}
          className="micro flex h-8 shrink-0 items-center gap-1 rounded-full border border-hairline bg-ink/10 px-2.5 text-ink hover:border-ink/40"
        >
          <Bot size={13} strokeWidth={1.5} aria-hidden="true" />
          <span className="hidden sm:inline">{ui.jarvis.consoleCta}</span>
          <Maximize2 size={11} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}

