'use client';

import {
  Disc,
  ExternalLink,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ui } from '@/data/map';
import { sampleSpectrumFromAnalyser } from '@/lib/audio-reverse-engineer';
import { fetchTrackPulse } from '@/lib/gateway';
import { buildTrackSpectrum } from '@/lib/jarvis';
import { fill } from '@/lib/labels';
import type { X3liusTrack } from '@/lib/types';
import { startTrackClock } from '@/lib/voice';

type LocalImportedAudio = {
  file: File;
  fileName: string;
  objectUrl: string;
  durationSec: number;
};

type X3liusPlayerProps = {
  tracks: readonly X3liusTrack[];
  activeTrackId: string;
  playing: boolean;
  /** Map of trackId -> imported local audio filename. */
  importedFiles?: Record<string, string>;
  onSelectTrack: (trackId: string) => void;
  onTogglePlay: () => void;
  onCompose: (track: X3liusTrack) => void;
  onImportRender: (trackId: string, fileName: string) => void;
  onAnalyzeAudioFile?: (file: File, track: X3liusTrack) => void;
  onClearImportedAudio?: (trackId: string) => void;
  onPlaybackAnalyserChange?: (analyser: AnalyserNode | null) => void;
  analyzingAudio?: boolean;
  onOpenJob?: (jobId: string) => void;
  className?: string;
};

function formatTime(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

/**
 * X3LIUS Music System player (05_XYP3RN_RECORDS/06_X3LIUS_MUSIC_SYSTEM):
 * Plays imported audio files cleanly from browser ObjectURL memory (never written to disk),
 * drives real-time Web Audio FFT spectrum bars & VoiceAssistantOrb reactivity, and triggers
 * non-destructive reverse engineering for prompt extraction.
 */
export function X3liusPlayer({
  tracks,
  activeTrackId,
  playing,
  importedFiles = {},
  onSelectTrack,
  onTogglePlay,
  onCompose,
  onImportRender,
  onAnalyzeAudioFile,
  onClearImportedAudio,
  onPlaybackAnalyserChange,
  analyzingAudio = false,
  onOpenJob,
  className = 'outlined bg-bg/60 p-4',
}: X3liusPlayerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaCtxRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaGainRef = useRef<GainNode | null>(null);
  const mediaAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaFreqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const synthAnalyserRef = useRef<AnalyserNode | null>(null);
  const synthFreqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const localImportsRef = useRef<Record<string, LocalImportedAudio>>({});

  const [localImports, setLocalImports] = useState<Record<string, LocalImportedAudio>>({});
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);

  const trackIndex = Math.max(
    0,
    tracks.findIndex((candidate) => candidate.id === activeTrackId),
  );
  const track = tracks[trackIndex] ?? tracks[0]!;
  const localAudio = localImports[track.id];
  const importedName = localAudio?.fileName ?? importedFiles[track.id];
  const effectiveDuration = localAudio?.durationSec && localAudio.durationSec > 0 ? localAudio.durationSec : track.durationSec;

  const initialSpectrum = useMemo(
    () => buildTrackSpectrum(track.id, track.bpm, progress, playing),
    [track.id, track.bpm, progress, playing],
  );
  const [spectrum, setSpectrum] = useState<number[]>(initialSpectrum);

  // Keep latest imports map ref & revoke all in-memory ObjectURLs on unmount
  useEffect(() => {
    localImportsRef.current = localImports;
  }, [localImports]);

  useEffect(() => {
    return () => {
      onPlaybackAnalyserChange?.(null);
      for (const entry of Object.values(localImportsRef.current)) {
        try {
          URL.revokeObjectURL(entry.objectUrl);
        } catch {
          // Ignore URL revocation errors
        }
      }
      if (mediaCtxRef.current) {
        void mediaCtxRef.current.close().catch(() => undefined);
        mediaCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure Web Audio MediaElement pipeline is wired once for the <audio> element
  const ensureMediaGraph = () => {
    const audioEl = audioElRef.current;
    if (!audioEl || typeof window === 'undefined') return null;
    if (mediaAnalyserRef.current && mediaCtxRef.current) {
      if (mediaCtxRef.current.state === 'suspended') {
        void mediaCtxRef.current.resume().catch(() => undefined);
      }
      return mediaAnalyserRef.current;
    }

    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (typeof Ctx !== 'function') return null;

    try {
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audioEl);
      const gain = ctx.createGain();
      gain.gain.value = muted ? 0 : volume;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.68;

      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);

      mediaCtxRef.current = ctx;
      mediaSourceRef.current = source;
      mediaGainRef.current = gain;
      mediaAnalyserRef.current = analyser;
      mediaFreqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      return analyser;
    } catch {
      return null;
    }
  };

  // Sync HTMLAudioElement volume / mute
  useEffect(() => {
    const effective = muted ? 0 : volume;
    if (audioElRef.current) {
      audioElRef.current.volume = effective;
    }
    if (mediaGainRef.current) {
      mediaGainRef.current.gain.value = effective;
    }
  }, [volume, muted]);

  // Synchronize source URL on imported file switch
  useEffect(() => {
    const audioEl = audioElRef.current;
    if (!audioEl) return;
    if (!localAudio?.objectUrl) {
      audioEl.pause();
      if (audioEl.getAttribute('src')) {
        audioEl.removeAttribute('src');
        audioEl.load();
      }
      return;
    }
    if (audioEl.src !== localAudio.objectUrl) {
      audioEl.src = localAudio.objectUrl;
      audioEl.currentTime = 0;
      setProgress(0);
    }
  }, [localAudio?.objectUrl]);

  // Real playback for imported files vs Web Audio clock for catalog tracks
  useEffect(() => {
    const audioEl = audioElRef.current;

    if (localAudio?.objectUrl && audioEl) {
      if (!playing) {
        audioEl.pause();
        onPlaybackAnalyserChange?.(null);
        setSpectrum(buildTrackSpectrum(track.id, track.bpm, progress, false));
        return;
      }

      const analyser = ensureMediaGraph();
      if (analyser) {
        onPlaybackAnalyserChange?.(analyser);
      }

      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => undefined);
      }

      let rafId: number | null = null;
      let lastTick = 0;
      const tickSpectrum = (now: number) => {
        if (now - lastTick >= 42) {
          lastTick = now;
          if (mediaAnalyserRef.current && mediaFreqDataRef.current) {
            setSpectrum(sampleSpectrumFromAnalyser(mediaAnalyserRef.current, mediaFreqDataRef.current, 24));
          }
        }
        rafId = requestAnimationFrame(tickSpectrum);
      };
      rafId = requestAnimationFrame(tickSpectrum);

      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        audioEl.pause();
      };
    }

    // Catalog built-in demo track playback (synthetic Web Audio pulse + gateway spectrum)
    if (!playing) {
      onPlaybackAnalyserChange?.(null);
      setSpectrum(buildTrackSpectrum(track.id, track.bpm, progress, false));
      return;
    }

    return startTrackClock(
      track.bpm,
      (delta) => {
        setProgress((current) => {
          const next = (current + delta) % track.durationSec;
          const a = synthAnalyserRef.current;
          const f = synthFreqDataRef.current;
          if (a && f) {
            setSpectrum(sampleSpectrumFromAnalyser(a, f, 24));
          } else {
            void fetchTrackPulse(track.id, track.bpm, next, true).then(setSpectrum);
          }
          return next;
        });
      },
      {
        volume: muted ? 0 : volume,
        onAnalyser: (analyser) => {
          synthAnalyserRef.current = analyser;
          synthFreqDataRef.current = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
          onPlaybackAnalyserChange?.(analyser);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, localAudio?.objectUrl, track.id, track.bpm, track.durationSec, muted, volume]);

  const handleImportFile = (file: File) => {
    let objectUrl = '';
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        objectUrl = URL.createObjectURL(file);
      }
    } catch {
      objectUrl = '';
    }

    setLocalImports((prev) => {
      const existing = prev[track.id];
      if (existing?.objectUrl) {
        try {
          URL.revokeObjectURL(existing.objectUrl);
        } catch {
          // Ignore URL revocation errors
        }
      }
      return {
        ...prev,
        [track.id]: {
          file,
          fileName: file.name,
          objectUrl,
          durationSec: track.durationSec,
        },
      };
    });

    onImportRender(track.id, file.name);
    onAnalyzeAudioFile?.(file, track);
  };

  const handleClearImport = () => {
    const existing = localImports[track.id];
    if (existing?.objectUrl) {
      try {
        URL.revokeObjectURL(existing.objectUrl);
      } catch {
        // Ignore URL revocation errors
      }
    }
    setLocalImports((prev) => {
      const copy = { ...prev };
      delete copy[track.id];
      return copy;
    });
    setProgress(0);
    onClearImportedAudio?.(track.id);
  };

  const stepTrack = (delta: number) => {
    const nextIndex = (trackIndex + delta + tracks.length) % tracks.length;
    const nextTrack = tracks[nextIndex];
    if (nextTrack) {
      setProgress(0);
      onSelectTrack(nextTrack.id);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleImportFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleImportFile(file);
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value) || 0;
    setProgress(nextTime);
    if (audioElRef.current && localAudio?.objectUrl) {
      audioElRef.current.currentTime = nextTime;
    }
  };

  return (
    <section
      aria-label={ui.player.label}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className={`flex flex-col gap-3 ${className}`}
    >
      {/* Hidden native audio stream for zero-storage local Blob ObjectURL playback */}
      <audio
        ref={audioElRef}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const dur = e.currentTarget.duration;
          if (Number.isFinite(dur) && dur > 0) {
            setLocalImports((prev) => {
              const cur = prev[track.id];
              if (!cur) return prev;
              return { ...prev, [track.id]: { ...cur, durationSec: dur } };
            });
          }
        }}
        onTimeUpdate={(e) => {
          setProgress(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          if (playing) onTogglePlay();
        }}
        className="hidden"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="micro text-ink-dim">{ui.player.eyebrow}</span>
        <span className="chip uppercase" style={{ borderColor: track.color, color: track.color }}>
          {fill(ui.player.bpmUnit, { bpm: track.bpm })} · {localAudio ? 'RAM STREAM' : track.format}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-hairline"
          style={{ background: `${track.color}18`, borderColor: `${track.color}55` }}
        >
          <Disc
            size={22}
            strokeWidth={1.5}
            style={{ color: track.color }}
            className={playing ? 'brain-drift' : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-tight text-ink">
            {localAudio ? localAudio.fileName.replace(/\.[a-z0-9]{1,8}$/i, '') : track.title}
          </h3>
          <p className="truncate font-mono text-xs text-ink-dim">
            {localAudio
              ? `${track.title} slot · in-memory playback (not stored)`
              : `${track.release} · ${track.subtitle}`}
          </p>
          {importedName && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="truncate font-mono text-[11px] text-accent">
                {ui.player.importedPrefix}
                {importedName}
              </p>
              {localAudio && (
                <button
                  type="button"
                  onClick={handleClearImport}
                  title="Unload imported audio from memory"
                  aria-label="Unload imported audio"
                  className="text-ink-dim transition-colors hover:text-ink"
                >
                  <Trash2 size={11} strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        role="img"
        aria-label={ui.player.spectrumLabel}
        className="flex h-12 items-end gap-1 rounded-md border border-hairline bg-black/35 px-2.5 py-2"
      >
        {spectrum.map((level, i) => (
          <span
            key={i}
            data-spectrum-bar={i}
            className="flex-1 rounded-sm transition-[height] duration-75"
            style={{
              height: `${Math.round(level * 100)}%`,
              background: i % 3 === 0 ? track.color : 'rgba(239,235,226,0.55)',
            }}
          />
        ))}
      </div>

      {/* Scrub bar + live time + volume */}
      <div className="flex items-center gap-2 font-mono text-[10px] text-ink-dim">
        <span className="w-9 tabular-nums">{formatTime(progress)}</span>
        <input
          type="range"
          aria-label="Audio playback seek"
          min={0}
          max={Math.max(1, Math.round(effectiveDuration))}
          step={0.5}
          value={Math.min(Math.round(effectiveDuration), progress)}
          onChange={handleSeek}
          className="h-1 flex-1 cursor-pointer accent-[#F59B5C]"
        />
        <span className="w-9 text-right tabular-nums">{formatTime(effectiveDuration)}</span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute audio player' : 'Mute audio player'}
          className="ml-1 grid h-6 w-6 place-items-center rounded border border-hairline text-ink-dim hover:text-ink"
        >
          {muted ? <VolumeX size={12} aria-hidden="true" /> : <Volume2 size={12} aria-hidden="true" />}
        </button>
        <input
          type="range"
          aria-label="Audio player volume"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => {
            setMuted(false);
            setVolume(Number(e.target.value));
          }}
          className="hidden h-1 w-14 cursor-pointer accent-[#3ECFB2] sm:block"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => stepTrack(-1)}
            aria-label={ui.player.previous}
            className="grid h-9 w-9 place-items-center rounded-md border border-hairline text-ink-dim hover:text-ink"
          >
            <SkipBack size={15} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? ui.player.pause : ui.player.play}
            className="grid h-9 w-9 place-items-center rounded-md border border-hairline bg-ink text-bg"
          >
            {playing ? (
              <Pause size={15} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Play size={15} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => stepTrack(1)}
            aria-label={ui.player.next}
            className="grid h-9 w-9 place-items-center rounded-md border border-hairline text-ink-dim hover:text-ink"
          >
            <SkipForward size={15} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {tracks.map((candidate) => {
            const active = candidate.id === track.id;
            return (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setProgress(0);
                  onSelectTrack(candidate.id);
                }}
                className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
                  active ? 'border-ink bg-ink/10 text-ink' : 'border-hairline text-ink-dim hover:text-ink'
                }`}
              >
                {candidate.title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-2.5">
        <button
          type="button"
          onClick={() => onCompose(track)}
          className="micro flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-ink hover:border-ink/40"
        >
          <Sparkles size={12} strokeWidth={1.5} aria-hidden="true" />
          {ui.player.compose}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="micro flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-ink hover:border-ink/40"
        >
          <Upload size={12} strokeWidth={1.5} aria-hidden="true" />
          {ui.player.importRender}
        </button>

        {onAnalyzeAudioFile && (
          <button
            type="button"
            disabled={analyzingAudio}
            onClick={() => {
              if (localAudio?.file) {
                onAnalyzeAudioFile(localAudio.file, track);
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="micro flex items-center gap-1.5 rounded-md border border-[#3ECFB2]/45 bg-[#3ECFB2]/10 px-2.5 py-1.5 text-[#BFFFEF] hover:border-[#3ECFB2] disabled:opacity-50"
          >
            <Wand2 size={12} strokeWidth={1.5} aria-hidden="true" />
            {analyzingAudio ? 'EXTRACTING...' : localAudio ? 'RE-EXTRACT' : 'EXTRACT FILE'}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.flac,.ogg,.m4a,audio/*"
          onChange={handleFileChange}
          className="sr-only"
          tabIndex={-1}
        />

        {onOpenJob && (
          <button
            type="button"
            onClick={() => onOpenJob(track.songJobId)}
            className="micro ml-auto flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-accent hover:border-accent/50"
          >
            {ui.player.openHub}
            <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
