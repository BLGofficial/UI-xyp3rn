'use client';

import { Mic } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { brain, ui } from '@/data/map';
import { buildVisualizerBars, buildVisualizerRings } from '@/lib/jarvis';
import { LAYOUT, SECTOR_COLORS, TOKENS } from '@/lib/tokens';
import type { EngineId, JarvisVoiceState } from '@/lib/types';
import { mapJarvisStateToOrbState, VoiceAssistantOrb } from '@/lib/voice-orb';

const VIEW_HALF = 130;
const ENGINE_NODES = [
  { index: 0, x: -78, y: -88, anchor: 'start' as const },
  { index: 1, x: 78, y: -88, anchor: 'end' as const },
] as const;

const STATE_COLOR: Record<JarvisVoiceState, string> = {
  idle: SECTOR_COLORS['01_CORE'],
  listening: TOKENS.accent,
  processing: SECTOR_COLORS['02_KNOWLEDGE_LAYER'],
  speaking: SECTOR_COLORS['05_XYP3RN_RECORDS'],
};

const ORB_MODES: ReadonlyArray<{ voiceState: JarvisVoiceState; label: string }> = [
  { voiceState: 'idle', label: 'IDLE' },
  { voiceState: 'listening', label: 'LISTEN' },
  { voiceState: 'processing', label: 'THINK' },
  { voiceState: 'speaking', label: 'SPEAK' },
];

type JarvisVisualizerProps = {
  state: JarvisVoiceState;
  activeEngine: EngineId;
  /** Normalized audio/voice energy in [0, 1]. */
  energy: number;
  /** Optional phase in radians for live frequency modulation. */
  phase?: number;
  /** Optional live music/imported-audio AnalyserNode synced to the 3D Orb. */
  playbackAnalyser?: AnalyserNode | null;
  /** Seamless borderless stage variant vs compact embedded card. */
  seamless?: boolean;
  /** Hide overlay chrome inside the WebGL canvas when rendered as a backdrop behind centered controls. */
  hideOverlayHud?: boolean;
  onMicStatusChange?: (status: 'idle' | 'active' | 'denied') => void;
  onTriggerVoice?: () => void;
  onSelectState?: (next: JarvisVoiceState) => void;
};

/**
 * Interactive 3D Voice Assistant Reactive Sphere (Three.js + WebGL Bloom + Microphone & Playback FFT)
 * rendered seamlessly inside the orb void with graceful SVG harmonic fallback when WebGL is absent.
 */
export const JarvisVisualizer = memo(function JarvisVisualizer({
  state,
  activeEngine,
  energy,
  phase = 0,
  playbackAnalyser = null,
  seamless = true,
  hideOverlayHud = false,
  onMicStatusChange,
  onTriggerVoice,
  onSelectState,
}: JarvisVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<VoiceAssistantOrb | null>(null);
  const [webglReady, setWebglReady] = useState(true);
  const [micStatus, setMicStatus] = useState<'idle' | 'active' | 'denied'>('idle');

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') {
      setWebglReady(false);
      return;
    }
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
      if (!gl) {
        setWebglReady(false);
        return;
      }
      const instance = new VoiceAssistantOrb(el, (status) => {
        setMicStatus(status);
        onMicStatusChange?.(status);
      });
      orbRef.current = instance;
      setWebglReady(true);
      return () => {
        orbRef.current = null;
        instance.destroy();
      };
    } catch {
      setWebglReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    orb.setState(mapJarvisStateToOrbState(state));
  }, [state]);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    orb.setPlaybackAnalyser(playbackAnalyser ?? null);
  }, [playbackAnalyser]);

  const handleVoiceTrigger = () => {
    if (state !== 'listening') {
      void orbRef.current?.initMicrophone();
    }
    onTriggerVoice?.();
  };

  const handleSelectMode = (next: JarvisVoiceState) => {
    if (next === 'listening') {
      void orbRef.current?.initMicrophone();
    }
    if (onSelectState) {
      onSelectState(next);
    } else if (next === 'listening' || state === 'listening') {
      onTriggerVoice?.();
    }
  };

  const rings = useMemo(() => buildVisualizerRings(state, energy), [state, energy]);
  const bars = useMemo(() => buildVisualizerBars(state, energy, phase), [state, energy, phase]);
  const color = STATE_COLOR[state];
  const orbRadius = LAYOUT.jarvisOrbRadius;

  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleVoiceTrigger();
  };

  return (
    <div className={seamless ? 'relative flex h-full w-full items-center justify-center' : 'relative flex w-full flex-col items-center'}>
      {webglReady ? (
        <div
          role="group"
          aria-label={ui.jarvis.visualizer.label}
          className={
            seamless
              ? 'relative h-full w-full select-none overflow-hidden bg-transparent'
              : 'jarvis-void-bg relative h-72 w-full select-none overflow-hidden rounded-[12px] border border-hairline md:h-80'
          }
        >
          <div
            id="orb-container"
            ref={containerRef}
            data-testid="jarvis-orb-webgl"
            className={`h-full w-full touch-none ${seamless ? 'jarvis-orb-stage' : ''}`}
          />

          {!hideOverlayHud && (
            <>
              <div className="pointer-events-none absolute inset-x-3 top-2.5 flex items-center justify-between gap-2">
                {brain.cores.map((core) => {
                  const active = core.id === activeEngine;
                  return (
                    <span
                      key={core.id}
                      className={`micro rounded-full border px-2.5 py-0.5 backdrop-blur ${
                        active ? 'border-hairline bg-black/55 text-ink' : 'border-transparent bg-black/30 text-ink-dim opacity-60'
                      }`}
                    >
                      {core.label}
                    </span>
                  );
                })}
              </div>

              <div className="pointer-events-none absolute inset-x-3 bottom-2.5 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleVoiceTrigger}
                  aria-label={ui.jarvis.visualizer.trigger}
                  aria-pressed={state === 'listening'}
                  className={`pointer-events-auto micro flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur transition-colors ${
                    state === 'listening'
                      ? 'border-[#1FEAD1]/70 bg-[#1FEAD1]/15 font-bold text-[#BFFFEF]'
                      : 'border-hairline bg-black/60 text-ink hover:border-accent'
                  }`}
                >
                  <Mic size={12} strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    {state === 'listening'
                      ? micStatus === 'denied'
                        ? 'MIC DENIED'
                        : micStatus === 'active'
                          ? 'MIC LIVE'
                          : 'LISTENING'
                      : ui.jarvis.states[state]}
                  </span>
                </button>

                <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-hairline bg-black/60 p-0.5 backdrop-blur">
                  {ORB_MODES.map((modeItem) => {
                    const active = state === modeItem.voiceState;
                    return (
                      <button
                        key={modeItem.voiceState}
                        type="button"
                        aria-label={`Orb state ${modeItem.label}`}
                        aria-pressed={active}
                        onClick={() => handleSelectMode(modeItem.voiceState)}
                        className={`micro rounded-full px-2 py-1 text-[10px] ${
                          active ? 'bg-ink font-bold text-bg' : 'text-ink-dim hover:text-ink'
                        }`}
                      >
                        {modeItem.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <svg
          viewBox={`${-VIEW_HALF} ${-VIEW_HALF} ${VIEW_HALF * 2} ${VIEW_HALF * 2}`}
          role="group"
          aria-label={ui.jarvis.visualizer.label}
          className="h-56 w-56 select-none md:h-64 md:w-64"
        >
          <defs>
            <radialGradient id="jarvis-core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} stopOpacity="0.45" />
              <stop offset="65%" stopColor={color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={TOKENS.bg} stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle r={orbRadius * 2.2} fill="url(#jarvis-core-glow)" pointerEvents="none" />

          {rings.map((ring) => (
            <circle
              key={ring.index}
              data-visualizer-ring={ring.index}
              r={ring.radius}
              fill="none"
              stroke={color}
              strokeWidth={ring.strokeWidth}
              opacity={ring.opacity}
              strokeDasharray={ring.index % 2 === 1 ? '4 6' : undefined}
              strokeDashoffset={ring.dashOffset}
              pointerEvents="none"
            />
          ))}

          <g pointerEvents="none">
            {bars.map((bar) => (
              <line
                key={bar.index}
                data-visualizer-bar={bar.index}
                x1={bar.x1}
                y1={bar.y1}
                x2={bar.x2}
                y2={bar.y2}
                stroke={bar.index % 3 === 0 ? TOKENS.ink : color}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.35 + bar.amplitude * 0.65}
              />
            ))}
          </g>

          {ENGINE_NODES.map((node) => {
            const core = brain.cores[node.index];
            if (!core) return null;
            const active = core.id === activeEngine;
            const engineColor = active ? color : TOKENS.inkDim;
            return (
              <g key={core.id} pointerEvents="none">
                <line
                  x1={0}
                  y1={0}
                  x2={node.x}
                  y2={node.y}
                  stroke={engineColor}
                  strokeWidth={active ? 1.1 : 0.6}
                  strokeDasharray={active ? undefined : '3 3'}
                  opacity={active ? 0.65 : 0.25}
                />
                <g transform={`translate(${node.x} ${node.y})`}>
                  <circle r={active ? 5 : 3.5} fill={engineColor} />
                  <text
                    className="svg-micro"
                    x={node.index === 0 ? -8 : 8}
                    y={-8}
                    textAnchor={node.anchor}
                    fontSize={7.5}
                    fill={active ? TOKENS.ink : TOKENS.inkDim}
                    stroke={TOKENS.bg}
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {core.label}
                  </text>
                </g>
              </g>
            );
          })}

          <g
            role="button"
            tabIndex={0}
            aria-label={ui.jarvis.visualizer.trigger}
            aria-pressed={state === 'listening'}
            onClick={handleVoiceTrigger}
            onKeyDown={onKeyDown}
            className="node"
          >
            <circle className="focus-ring" r={orbRadius + 5} stroke={color} />
            <circle r={orbRadius} fill={TOKENS.bg} stroke={color} strokeWidth={1.75} />
            <Mic x={-11} y={-18} size={22} strokeWidth={1.5} color={color} aria-hidden="true" />
            <text className="svg-micro" y={14} textAnchor="middle" fontSize={7.5} fill={TOKENS.ink}>
              {ui.jarvis.visualizer.coreLabel}
            </text>
            <text className="font-mono" y={26} textAnchor="middle" fontSize={8} fill={color}>
              {ui.jarvis.states[state]}
            </text>
          </g>
        </svg>
      )}
    </div>
  );
});
