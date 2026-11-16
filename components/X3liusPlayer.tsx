'use client';

import { Disc, ExternalLink, Pause, Play, SkipBack, SkipForward, Sparkles, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ui } from '@/data/map';
import { fetchTrackPulse } from '@/lib/gateway';
import { buildTrackSpectrum } from '@/lib/jarvis';
import { fill } from '@/lib/labels';
import type { X3liusTrack } from '@/lib/types';
import { startTrackClock } from '@/lib/voice';

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
  onOpenJob?: (jobId: string) => void;
};

/**
 * X3LIUS Music System player (05_XYP3RN_RECORDS/06_X3LIUS_MUSIC_SYSTEM):
 * 24-band `/api/music/pulse` spectrum relay, cover art disc, track switcher,
 * Suno COMPOSE trigger, and IMPORT RENDER dropzone/file picker.
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
  onOpenJob,
}: X3liusPlayerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const trackIndex = Math.max(
    0,
    tracks.findIndex((candidate) => candidate.id === activeTrackId),
  );
  const track = tracks[trackIndex] ?? tracks[0]!;
  const initialSpectrum = useMemo(
    () => buildTrackSpectrum(track.id, track.bpm, progress, playing),
    [track.id, track.bpm, progress, playing],
  );
  const [spectrum, setSpectrum] = useState<number[]>(initialSpectrum);

  useEffect(() => {
    setSpectrum(buildTrackSpectrum(track.id, track.bpm, progress, playing));
  }, [track.id, track.bpm, progress, playing]);

  useEffect(() => {
    if (!playing) return;
    return startTrackClock(track.bpm, (delta) => {
      setProgress((current) => {
        const next = (current + delta) % track.durationSec;
        void fetchTrackPulse(track.id, track.bpm, next, true).then(setSpectrum);
        return next;
      });
    });
  }, [playing, track.id, track.bpm, track.durationSec]);

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
    if (file) onImportRender(track.id, file.name);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onImportRender(track.id, file.name);
  };

  const importedName = importedFiles[track.id];

  return (
    <section
      aria-label={ui.player.label}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="outlined flex flex-col gap-3 bg-bg/60 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="micro text-ink-dim">{ui.player.eyebrow}</span>
        <span className="chip uppercase" style={{ borderColor: track.color, color: track.color }}>
          {fill(ui.player.bpmUnit, { bpm: track.bpm })} · {track.format}
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
          <h3 className="truncate text-base font-semibold tracking-tight text-ink">{track.title}</h3>
          <p className="truncate font-mono text-xs text-ink-dim">
            {track.release} · {track.subtitle}
          </p>
          {importedName && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-accent">
              {ui.player.importedPrefix}
              {importedName}
            </p>
          )}
        </div>
      </div>

      <div
        role="img"
        aria-label={ui.player.spectrumLabel}
        className="flex h-12 items-end gap-1 rounded-md border border-hairline bg-bg/80 px-2.5 py-2"
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.flac,audio/*"
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
