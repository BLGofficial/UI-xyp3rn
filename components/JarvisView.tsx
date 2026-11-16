'use client';

import { ActivitySquare, Mic, Send, ShieldCheck, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { departments, ui, x3liusTracks } from '@/data/map';
import { appendSessionLog, clearSessionLogs, dispatchJarvis, fetchGatewayHealth, readSessionLogs } from '@/lib/gateway';
import { fill } from '@/lib/labels';
import { LAYOUT } from '@/lib/tokens';
import type {
  DepartmentId,
  EngineId,
  GatewayMode,
  JarvisExchange,
  JarvisVoiceState,
  X3liusTrack,
} from '@/lib/types';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { speakJarvisReply, startVoiceCapture } from '@/lib/voice';
import { JarvisVisualizer } from './JarvisVisualizer';
import { X3liusPlayer } from './X3liusPlayer';

const JOB_TITLES = new Map(
  departments.flatMap((dept) => dept.jobs.map((job) => [job.id, job.title] as const)),
);

type JarvisViewProps = {
  activeSector: DepartmentId;
  selectedJobId: string | null;
  onClose?: () => void;
  onSelectJob?: (jobId: string) => void;
  onFocusSector?: (sectorId: DepartmentId) => void;
};

/**
 * Full-screen Jarvis Operator Console: interactive harmonic visualizer, dual-engine
 * routing gateway (127.0.0.1:8077 + local vault engine), MCP connector monitor,
 * X3LIUS Music System player, and real-time session log transcript.
 */
export function JarvisView({
  activeSector,
  selectedJobId,
  onClose,
  onSelectJob,
  onFocusSector,
}: JarvisViewProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, true);

  const [input, setInput] = useState('');
  const [engine, setEngine] = useState<EngineId>('claude-code-cli');
  const [voiceState, setVoiceState] = useState<JarvisVoiceState>('idle');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [mode, setMode] = useState<GatewayMode>('local-vault');
  const [connectorCount, setConnectorCount] = useState<number>(LAYOUT.mcpConnectorTotal);
  const [connectorHealthy, setConnectorHealthy] = useState<number>(LAYOUT.mcpConnectorTotal);
  const [logs, setLogs] = useState<JarvisExchange[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string>(x3liusTracks[0]!.id);
  const [playing, setPlaying] = useState(false);
  const [importedFiles, setImportedFiles] = useState<Record<string, string>>({});

  const stopCaptureRef = useRef<(() => void) | null>(null);
  const stopSpeakRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLogs(readSessionLogs());
    let active = true;
    void fetchGatewayHealth().then((health) => {
      if (active) setMode(health.mode);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopCaptureRef.current?.();
      stopSpeakRef.current?.();
    };
  }, []);

  const energy = useMemo(() => {
    if (voiceState === 'speaking') return 0.9;
    if (voiceState === 'listening') return 0.8;
    if (voiceState === 'processing') return 0.65;
    return playing ? 0.48 : 0.16;
  }, [voiceState, playing]);

  const executePrompt = useCallback(
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

      const updated = appendSessionLog(response.exchange);
      setLogs(updated);
      setMode(response.exchange.mode);
      setEngine(response.exchange.engine);
      setConnectorCount(response.connectorCount);
      setConnectorHealthy(response.connectorHealthy);

      if (response.action?.type === 'play-track') {
        setActiveTrackId(response.action.trackId);
        setPlaying(true);
      } else if (response.action?.type === 'compose-track') {
        setActiveTrackId(response.action.trackId);
      } else if (response.action?.type === 'focus-sector') {
        onFocusSector?.(response.action.sectorId);
      }

      stopSpeakRef.current?.();
      stopSpeakRef.current = speakJarvisReply(response.exchange.reply, {
        enabled: ttsEnabled,
        onStart: () => setVoiceState('speaking'),
        onEnd: () => setVoiceState('idle'),
      });
    },
    [engine, activeSector, selectedJobId, ttsEnabled, onFocusSector],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput('');
    void executePrompt(text);
  };

  const toggleVoice = useCallback(() => {
    if (voiceState === 'listening') {
      stopCaptureRef.current?.();
      stopCaptureRef.current = null;
      setVoiceState('idle');
      if (input.trim()) {
        const text = input;
        setInput('');
        void executePrompt(text);
      }
      return;
    }
    setVoiceState('listening');
    stopCaptureRef.current = startVoiceCapture({
      onInterim: (transcript) => setInput(transcript),
      onFinal: (transcript) => {
        setInput('');
        void executePrompt(transcript);
      },
      onEnd: () => setVoiceState((current) => (current === 'listening' ? 'idle' : current)),
    });
  }, [voiceState, input, executePrompt]);

  const handleSelectVoiceState = useCallback(
    (next: JarvisVoiceState) => {
      if (next === voiceState) return;
      if (next === 'listening') {
        if (voiceState !== 'listening') {
          toggleVoice();
        }
        return;
      }
      if (voiceState === 'listening') {
        stopCaptureRef.current?.();
        stopCaptureRef.current = null;
      }
      if (voiceState === 'speaking') {
        stopSpeakRef.current?.();
        stopSpeakRef.current = null;
      }
      setVoiceState(next);
    },
    [voiceState, toggleVoice],
  );

  const handleCompose = (track: X3liusTrack) => {
    void executePrompt(`xyp3rn> compose "${track.title}"`);
  };

  const handleImportRender = (trackId: string, fileName: string) => {
    setImportedFiles((prev) => ({ ...prev, [trackId]: fileName }));
  };

  const handleClearLogs = () => {
    clearSessionLogs();
    setLogs([]);
  };

  const handleOpenJob = (jobId: string) => {
    onSelectJob?.(jobId);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={ui.jarvis.title}
      tabIndex={-1}
      style={{ background: 'rgba(32, 35, 46, 0.96)' }}
      className="frost fade-in fixed inset-0 z-[70] flex flex-col overflow-y-auto outline-none"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 md:px-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">{ui.jarvis.title}</h2>
          <p className="micro mt-0.5 text-ink-dim">{ui.jarvis.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="chip flex items-center gap-1.5">
            <ShieldCheck size={13} strokeWidth={1.5} className="text-s01_core" aria-hidden="true" />
            {ui.jarvis.hostPolicy}
          </span>

          <span className="chip text-accent">
            {mode === 'live-gateway' ? ui.jarvis.gatewayLive : ui.jarvis.gatewayLocal}
          </span>

          <button
            type="button"
            onClick={() => void executePrompt('xyp3rn> connections refresh')}
            aria-label={ui.jarvis.connectorsLabel}
            className="chip flex items-center gap-1.5 hover:border-ink/40"
          >
            <ActivitySquare
              size={13}
              strokeWidth={1.5}
              className={connectorHealthy === connectorCount ? 'text-s05_records' : 'text-accent'}
              aria-hidden="true"
            />
            {fill(ui.jarvis.connectorsHealthy, { healthy: connectorHealthy, total: connectorCount })}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={ui.jarvis.closeConsole}
              className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-ink-dim hover:text-ink"
            >
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-5 py-6 md:px-8 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-5">
          <div className="outlined flex flex-col items-center gap-4 bg-bg/50 p-4">
            <JarvisVisualizer
              state={voiceState}
              activeEngine={engine}
              energy={energy}
              onTriggerVoice={toggleVoice}
              onSelectState={handleSelectVoiceState}
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              {(['claude-code-cli', 'gemini-api'] as const).map((candidate) => {
                const current = engine === candidate;
                return (
                  <button
                    key={candidate}
                    type="button"
                    aria-pressed={current}
                    onClick={() => setEngine(candidate)}
                    className={`micro rounded-md border px-3 py-1.5 ${
                      current ? 'border-accent bg-accent font-bold text-bg' : 'border-hairline text-ink-dim hover:text-ink'
                    }`}
                  >
                    {ui.jarvis.engines[candidate]}
                  </button>
                );
              })}

              <button
                type="button"
                aria-label={ui.jarvis.ttsToggle}
                aria-pressed={ttsEnabled}
                onClick={() => setTtsEnabled((value) => !value)}
                className="micro flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-ink-dim hover:text-ink"
              >
                {ttsEnabled ? (
                  <Volume2 size={13} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <VolumeX size={13} strokeWidth={1.5} aria-hidden="true" />
                )}
                {ttsEnabled ? ui.jarvis.ttsOn : ui.jarvis.ttsOff}
              </button>
            </div>
          </div>

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
            onOpenJob={onSelectJob ? handleOpenJob : undefined}
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7">
          <section className="outlined flex flex-col gap-2.5 bg-bg/50 p-4">
            <h3 className="micro text-ink-dim">{ui.jarvis.quickLabel}</h3>
            <div className="flex flex-wrap gap-2">
              {ui.jarvis.quickCommands.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void executePrompt(item.cmd)}
                  className="chip hover:border-ink/50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="outlined flex min-h-[280px] flex-1 flex-col bg-bg/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2.5">
              <h3 className="micro text-ink-dim">{ui.jarvis.sessionLogsLabel}</h3>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="micro flex items-center gap-1 text-ink-dim hover:text-ink"
                >
                  <Trash2 size={12} strokeWidth={1.5} aria-hidden="true" />
                  {ui.jarvis.clearLogs}
                </button>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {logs.length === 0 && (
                <p className="my-auto text-center font-mono text-xs text-ink-dim">{ui.jarvis.emptyLogs}</p>
              )}
              {logs.map((entry) => {
                const jobIds = Array.from(
                  new Set([
                    ...entry.contextJobs,
                    ...(entry.referencedJobId ? [entry.referencedJobId] : []),
                  ]),
                );
                return (
                  <article key={entry.id} className="rounded-lg border border-hairline bg-bg/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="font-mono text-xs text-accent">{entry.prompt}</code>
                      <span className="micro text-ink-dim">{ui.jarvis.engines[entry.engine]}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink">{entry.reply}</p>
                    {jobIds.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="micro text-ink-dim">{ui.jarvis.contextLabel}:</span>
                        {jobIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleOpenJob(id)}
                            className="chip border-dashed hover:border-ink/50"
                          >
                            {JOB_TITLES.get(id) ?? id}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <form onSubmit={onSubmit} className="mt-4 flex items-center gap-2 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={ui.jarvis.voiceToggle}
                aria-pressed={voiceState === 'listening'}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${
                  voiceState === 'listening'
                    ? 'border-accent bg-accent text-bg'
                    : 'border-hairline text-ink-dim hover:text-ink'
                }`}
              >
                <Mic size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                aria-label={ui.jarvis.inputLabel}
                placeholder={ui.jarvis.inputPlaceholder}
                className="h-10 min-w-0 flex-1 rounded-lg border border-hairline bg-bg/80 px-3 font-mono text-xs text-ink placeholder:text-ink-dim focus:outline-none"
              />
              <button
                type="submit"
                aria-label={ui.jarvis.send}
                className="micro flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-ink px-4 font-bold text-bg"
              >
                <Send size={13} strokeWidth={1.75} aria-hidden="true" />
                {ui.jarvis.sendCta}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

