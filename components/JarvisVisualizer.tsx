'use client';

import { Mic } from 'lucide-react';
import { memo, useMemo, type KeyboardEvent } from 'react';
import { brain, ui } from '@/data/map';
import { buildVisualizerBars, buildVisualizerRings } from '@/lib/jarvis';
import { LAYOUT, SECTOR_COLORS, TOKENS } from '@/lib/tokens';
import type { EngineId, JarvisVoiceState } from '@/lib/types';

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

type JarvisVisualizerProps = {
  state: JarvisVoiceState;
  activeEngine: EngineId;
  /** Normalized audio/voice energy in [0, 1]. */
  energy: number;
  /** Optional phase in radians for live frequency modulation. */
  phase?: number;
  onTriggerVoice?: () => void;
};

/**
 * Harmonic orb visualizer for Jarvis: concentric rings, 24 radial frequency bars,
 * dual engine satellite nodes (CLAUDE CODE CLI / GEMINI API), and interactive voice trigger.
 */
export const JarvisVisualizer = memo(function JarvisVisualizer({
  state,
  activeEngine,
  energy,
  phase = 0,
  onTriggerVoice,
}: JarvisVisualizerProps) {
  const rings = useMemo(() => buildVisualizerRings(state, energy), [state, energy]);
  const bars = useMemo(() => buildVisualizerBars(state, energy, phase), [state, energy, phase]);
  const color = STATE_COLOR[state];
  const orbRadius = LAYOUT.jarvisOrbRadius;

  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onTriggerVoice?.();
  };

  return (
    <div className="relative flex flex-col items-center">
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
          onClick={onTriggerVoice}
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
    </div>
  );
});

