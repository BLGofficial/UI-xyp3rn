'use client';

import {
  ActivitySquare,
  ChevronDown,
  Eye,
  EyeOff,
  Mic,
  Minimize2,
  Send,
  ShieldCheck,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { departments, ui, x3liusTracks } from '@/data/map';
import {
  extractAudioTelemetryFromFile,
  fetchExtractedAudioPrompts,
  reverseEngineerAudio,
} from '@/lib/audio-reverse-engineer';
import { appendSessionLog, clearSessionLogs, dispatchJarvis, fetchGatewayHealth, readSessionLogs } from '@/lib/gateway';
import { fill } from '@/lib/labels';
import { LAYOUT } from '@/lib/tokens';
import type {
  AudioReverseEngineeredSpec,
  DepartmentId,
  EngineId,
  GatewayMode,
  JarvisExchange,
  JarvisVoiceState,
  SavedAudioPromptFile,
  SavedAudioPromptSummary,
  X3liusTrack,
} from '@/lib/types';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { speakJarvisReply, startVoiceCapture } from '@/lib/voice';
import { AudioExtractorPanel } from './AudioExtractorPanel';
import { JarvisVisualizer } from './JarvisVisualizer';
import { X3liusPlayer } from './X3liusPlayer';

const JOB_TITLES = new Map(
  departments.flatMap((dept) => dept.jobs.map((job) => [job.id, job.title] as const)),
);

const ORB_MODES: ReadonlyArray<{ voiceState: JarvisVoiceState; label: string }> = [
  { voiceState: 'idle', label: 'IDLE' },
  { voiceState: 'listening', label: 'LISTEN' },
  { voiceState: 'processing', label: 'THINK' },
  { voiceState: 'speaking', label: 'SPEAK' },
];

type GlassWindowProps = {
  title: string;
  badge?: string;
  open: boolean;
  pinned: boolean;
  onToggleOpen: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Collapsible cursor-reveal glassmorphic console block: rests at ghost transparency
 * over the cosmic void backdrop and reveals full contrast when hovered or focused.
 */
function GlassWindow({
  title,
  badge,
  open,
  pinned,
  onToggleOpen,
  headerRight,
  children,
  className = '',
}: GlassWindowProps) {
  return (
    <section
      data-pinned={pinned ? 'true' : 'false'}
      className={`jarvis-glass-panel pointer-events-auto flex flex-col rounded-xl ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            aria-hidden="true"
            className={`shrink-0 text-ink-dim transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          />
          <h3 className="micro truncate text-ink">{title}</h3>
          {badge && (
            <span className="shrink-0 rounded border border-hairline bg-black/40 px-1.5 py-0.5 font-mono text-[9px] text-ink-dim">
              {badge}
            </span>
          )}
        </button>
        {headerRight}
      </div>

      {open && (
        <div className="jarvis-panel-body border-t border-hairline/70 px-3.5 pb-3.5 pt-3">
          {children}
        </div>
      )}
    </section>
  );
}

type JarvisViewProps = {
  activeSector: DepartmentId;
  selectedJobId: string | null;
  onClose?: () => void;
  onSelectJob?: (jobId: string) => void;
  onFocusSector?: (sectorId: DepartmentId) => void;
};

/**
 * Full-screen Jarvis Operator Console: borderless Three.js audio-reactive Orb centered
 * inside its matching cosmic void backdrop with collapsible, cursor-reveal glassmorphic
 * Audio Player, Audio Reverse-Engineer Extractor, Quick Directives, and Session Console wings.
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
  const [micStatus, setMicStatus] = useState<'idle' | 'active' | 'denied'>('idle');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [mode, setMode] = useState<GatewayMode>('local-vault');
  const [connectorCount, setConnectorCount] = useState<number>(LAYOUT.mcpConnectorTotal);
  const [connectorHealthy, setConnectorHealthy] = useState<number>(LAYOUT.mcpConnectorTotal);
  const [logs, setLogs] = useState<JarvisExchange[]>([]);

  // Audio player & in-memory reverse-engineer states
  const [activeTrackId, setActiveTrackId] = useState<string>(x3liusTracks[0]!.id);
  const [playing, setPlaying] = useState(false);
  const [importedFiles, setImportedFiles] = useState<Record<string, string>>({});
  const [playbackAnalyser, setPlaybackAnalyser] = useState<AnalyserNode | null>(null);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);
  const [extractedSpec, setExtractedSpec] = useState<AudioReverseEngineeredSpec | null>(null);
  const [extractionMode, setExtractionMode] = useState<GatewayMode>('local-vault');
  const [savedPrompts, setSavedPrompts] = useState<SavedAudioPromptSummary[]>([]);

  // Collapsible glassmorphic windows & hover-reveal pinning
  const [pinGlass, setPinGlass] = useState(false);
  const [openPanels, setOpenPanels] = useState({
    player: true,
    extractor: true,
    directives: true,
    logs: true,
  });

  const stopCaptureRef = useRef<(() => void) | null>(null);
  const stopSpeakRef = useRef<(() => void) | null>(null);

  const refreshSavedPrompts = useCallback(async () => {
    const res = await fetchExtractedAudioPrompts();
    if (res.ok) {
      setSavedPrompts(res.prompts);
    }
  }, []);

  useEffect(() => {
    setLogs(readSessionLogs());
    let active = true;
    void fetchGatewayHealth().then((health) => {
      if (active) setMode(health.mode);
    });
    void fetchExtractedAudioPrompts().then((res) => {
      if (active && res.ok) setSavedPrompts(res.prompts);
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
    return playing ? 0.54 : 0.16;
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
    if (typeof window !== 'undefined') {
      void window.VoiceOrb?.initMicrophone();
    }
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
        toggleVoice();
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

  const handleAnalyzeAudioFile = useCallback(async (file: File) => {
    setAnalyzingAudio(true);
    setOpenPanels((prev) => ({ ...prev, extractor: true }));
    try {
      const telemetry = await extractAudioTelemetryFromFile(file);
      const res = await reverseEngineerAudio(telemetry, { useLlm: false });
      setExtractedSpec(res.spec);
      setExtractionMode(res.mode);
    } finally {
      setAnalyzingAudio(false);
    }
  }, []);

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

  const handleSavedPromptsSuccess = (savedFiles: SavedAudioPromptFile[]) => {
    void refreshSavedPrompts();
    if (savedFiles.length > 0) {
      const summary = savedFiles.map((f) => f.vaultPath).join(', ');
      const updated = appendSessionLog({
        id: `audio-save-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: `save extracted audio prompt -> ${savedFiles.length} .md file(s)`,
        reply: `Saved extracted prompt Markdown strictly into Obsidian: ${summary}`,
        commandKind: 'write',
        engine,
        mode: 'live-gateway',
        contextJobs: [],
      });
      setLogs(updated);
    }
  };

  const anyExpanded = Object.values(openPanels).some(Boolean);
  const toggleAllPanels = () => {
    const next = !anyExpanded;
    setOpenPanels({ player: next, extractor: next, directives: next, logs: next });
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={ui.jarvis.title}
      tabIndex={-1}
      className="jarvis-void-bg fade-in fixed inset-0 z-[70] flex flex-col overflow-y-auto outline-none lg:overflow-hidden"
    >
      {/* Borderless Centered Three.js Orb Background Stage (full-screen interactive backdrop on desktop) */}
      <div className="pointer-events-auto relative mx-auto h-72 w-full shrink-0 lg:fixed lg:inset-0 lg:z-0 lg:h-full">
        <JarvisVisualizer
          state={voiceState}
          activeEngine={engine}
          energy={energy}
          playbackAnalyser={playbackAnalyser}
          seamless
          hideOverlayHud
          onMicStatusChange={setMicStatus}
          onTriggerVoice={toggleVoice}
          onSelectState={handleSelectVoiceState}
        />
      </div>

      {/* Floating Frosted Glass Header */}
      <header className="jarvis-glass-bar relative z-20 mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 md:mx-6 md:px-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink md:text-lg">{ui.jarvis.title}</h2>
          <p className="micro mt-0.5 text-ink-dim">{ui.jarvis.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPinGlass((v) => !v)}
            aria-pressed={pinGlass}
            title={pinGlass ? 'Switch to cursor hover-reveal glass mode' : 'Pin all glass panels visible'}
            className={`chip flex items-center gap-1.5 transition-colors ${
              pinGlass ? 'border-[#3ECFB2]/60 bg-[#3ECFB2]/15 text-[#BFFFEF]' : 'hover:border-ink/40'
            }`}
          >
            {pinGlass ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
            {pinGlass ? 'GLASS PINNED' : 'HOVER REVEAL'}
          </button>

          <button
            type="button"
            onClick={toggleAllPanels}
            className="chip flex items-center gap-1.5 hover:border-ink/40"
          >
            <Minimize2 size={12} aria-hidden="true" />
            {anyExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
          </button>

          <span className="chip hidden items-center gap-1.5 sm:flex">
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
            className="chip hidden items-center gap-1.5 hover:border-ink/40 md:flex"
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
              className="grid h-8 w-8 place-items-center rounded-full border border-hairline text-ink-dim hover:border-accent/60 hover:text-ink"
            >
              <X size={15} strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* Orbital 3-Column Layout Surrounding the Centered Audio Assistant Orb */}
      <div className="pointer-events-none relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 px-3 py-4 md:px-6 lg:min-h-0 lg:grid-cols-12">
        {/* LEFT WING: Audio Player + Reverse-Engineer Extractor */}
        <div className="flex flex-col gap-3 lg:col-span-4 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-1">
          <GlassWindow
            title="X3LIUS AUDIO PLAYER"
            badge={playing ? 'LIVE' : 'RAM'}
            pinned={pinGlass}
            open={openPanels.player}
            onToggleOpen={() => setOpenPanels((p) => ({ ...p, player: !p.player }))}
          >
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
              onAnalyzeAudioFile={(file) => void handleAnalyzeAudioFile(file)}
              onPlaybackAnalyserChange={setPlaybackAnalyser}
              analyzingAudio={analyzingAudio}
              onOpenJob={onSelectJob ? handleOpenJob : undefined}
              className="p-0"
            />
          </GlassWindow>

          <GlassWindow
            title="AUDIO REVERSE ENGINEER"
            badge={extractedSpec ? `${extractedSpec.telemetry.bpm} BPM` : 'OBSIDIAN'}
            pinned={pinGlass || analyzingAudio}
            open={openPanels.extractor}
            onToggleOpen={() => setOpenPanels((p) => ({ ...p, extractor: !p.extractor }))}
          >
            <AudioExtractorPanel
              spec={extractedSpec}
              analyzing={analyzingAudio}
              analysisMode={extractionMode}
              savedPrompts={savedPrompts}
              onAnalyzeFile={(file) => void handleAnalyzeAudioFile(file)}
              onUpdateSpec={setExtractedSpec}
              onDiscard={() => setExtractedSpec(null)}
              onSavedSuccess={handleSavedPromptsSuccess}
              onRefreshLibrary={() => void refreshSavedPrompts()}
              onInspectSavedPrompt={(vaultPath) => void executePrompt(`xyp3rn> read ${vaultPath}`)}
            />
          </GlassWindow>
        </div>

        {/* CENTER STAGE: Clear Unobstructed Window for Orb + Bottom-Center Floating Assistant Core Pill */}
        <div className="pointer-events-none flex flex-col items-center justify-end lg:col-span-4 lg:pb-2">
          <div
            data-pinned={pinGlass ? 'true' : 'false'}
            className="jarvis-glass-panel pointer-events-auto flex flex-col items-center gap-2 rounded-2xl px-3.5 py-2.5"
          >
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={ui.jarvis.visualizer.trigger}
                aria-pressed={voiceState === 'listening'}
                className={`micro flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${
                  voiceState === 'listening'
                    ? 'border-[#1FEAD1]/80 bg-[#1FEAD1]/20 font-bold text-[#BFFFEF]'
                    : 'border-hairline bg-black/50 text-ink hover:border-accent'
                }`}
              >
                <Mic size={12} strokeWidth={1.75} aria-hidden="true" />
                <span>
                  {voiceState === 'listening'
                    ? micStatus === 'denied'
                      ? 'MIC DENIED'
                      : micStatus === 'active'
                        ? 'MIC LIVE'
                        : 'LISTENING'
                    : ui.jarvis.states[voiceState]}
                </span>
              </button>

              <div className="flex items-center gap-0.5 rounded-full border border-hairline bg-black/45 p-0.5">
                {ORB_MODES.map((modeItem) => {
                  const active = voiceState === modeItem.voiceState;
                  return (
                    <button
                      key={modeItem.voiceState}
                      type="button"
                      aria-label={`Orb state ${modeItem.label}`}
                      aria-pressed={active}
                      onClick={() => handleSelectVoiceState(modeItem.voiceState)}
                      className={`micro rounded-full px-2 py-1 text-[10px] transition-colors ${
                        active ? 'bg-ink font-bold text-bg' : 'text-ink-dim hover:text-ink'
                      }`}
                    >
                      {modeItem.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(['claude-code-cli', 'gemini-api'] as const).map((candidate) => {
                const current = engine === candidate;
                return (
                  <button
                    key={candidate}
                    type="button"
                    aria-pressed={current}
                    onClick={() => setEngine(candidate)}
                    className={`micro rounded-md border px-2.5 py-1 text-[10px] ${
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
                className="micro flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1 text-[10px] text-ink-dim hover:text-ink"
              >
                {ttsEnabled ? (
                  <Volume2 size={12} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <VolumeX size={12} strokeWidth={1.5} aria-hidden="true" />
                )}
                {ttsEnabled ? ui.jarvis.ttsOn : ui.jarvis.ttsOff}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT WING: Quick Directives + Collapsible Session Logs & Command Prompt */}
        <div className="flex flex-col gap-3 lg:col-span-4 lg:max-h-[calc(100vh-5.5rem)]">
          <GlassWindow
            title={ui.jarvis.quickLabel}
            badge={`${ui.jarvis.quickCommands.length}`}
            pinned={pinGlass}
            open={openPanels.directives}
            onToggleOpen={() => setOpenPanels((p) => ({ ...p, directives: !p.directives }))}
          >
            <div className="flex flex-wrap gap-1.5">
              {ui.jarvis.quickCommands.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void executePrompt(item.cmd)}
                  className="chip bg-black/35 hover:border-accent/60 hover:bg-black/60"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </GlassWindow>

          <GlassWindow
            title={ui.jarvis.sessionLogsLabel}
            badge={`${logs.length}`}
            pinned={pinGlass}
            open={openPanels.logs}
            onToggleOpen={() => setOpenPanels((p) => ({ ...p, logs: !p.logs }))}
            className="min-h-0 flex-1"
            headerRight={
              logs.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="micro flex items-center gap-1 text-[10px] text-ink-dim hover:text-ink"
                >
                  <Trash2 size={11} strokeWidth={1.5} aria-hidden="true" />
                  {ui.jarvis.clearLogs}
                </button>
              ) : undefined
            }
          >
            <div className="flex h-full flex-col gap-3">
              <div className="flex max-h-[260px] flex-1 flex-col gap-2.5 overflow-y-auto pr-1 lg:max-h-[340px]">
                {logs.length === 0 && (
                  <p className="my-auto py-8 text-center font-mono text-xs text-ink-dim">{ui.jarvis.emptyLogs}</p>
                )}
                {logs.map((entry) => {
                  const jobIds = Array.from(
                    new Set([
                      ...entry.contextJobs,
                      ...(entry.referencedJobId ? [entry.referencedJobId] : []),
                    ]),
                  );
                  return (
                    <article key={entry.id} className="rounded-lg border border-hairline/80 bg-black/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="font-mono text-xs text-accent">{entry.prompt}</code>
                        <span className="micro text-ink-dim">{ui.jarvis.engines[entry.engine]}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink">{entry.reply}</p>
                      {jobIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="micro text-ink-dim">{ui.jarvis.contextLabel}:</span>
                          {jobIds.map((id) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => handleOpenJob(id)}
                              className="chip border-dashed bg-black/40 hover:border-ink/50"
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

              <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-hairline/70 pt-3">
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-label={ui.jarvis.voiceToggle}
                  aria-pressed={voiceState === 'listening'}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${
                    voiceState === 'listening'
                      ? 'border-accent bg-accent text-bg'
                      : 'border-hairline bg-black/40 text-ink-dim hover:text-ink'
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
                  className="h-10 min-w-0 flex-1 rounded-lg border border-hairline bg-black/50 px-3 font-mono text-xs text-ink placeholder:text-ink-dim focus:outline-none"
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
            </div>
          </GlassWindow>
        </div>
      </div>
    </div>
  );
}
