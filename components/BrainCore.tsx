'use client';

import { memo, useMemo } from 'react';
import { brain } from '@/data/map';
import { mulberry32, stringToSeed } from '@/lib/prng';
import { TOKENS } from '@/lib/tokens';

type Particle = { x: number; y: number; size: number; color: number; layer: number; group: number; alpha: number };

/** Unit-space positions of the two engine cores. */
const CORES = [
  { x: -0.21, y: 0.07 },
  { x: 0.23, y: -0.09 },
] as const;

/**
 * Deterministic model of the brain: particles in a soft unit sphere plus hair-thin links to the nearest core.
 * @param count number of particles
 * @param colorCount number of sector colors; one extra slot is the cream ink
 */
export function buildBrain(count: number, colorCount: number) {
  const rng = mulberry32(stringToSeed(brain.label));
  const particles: Particle[] = Array.from({ length: count }, (_, i) => {
    const angle = rng() * Math.PI * 2;
    // An exponent of 0.5 is uniform over the disc; a larger one packs the centre like a sphere seen face-on.
    const radius = Math.pow(rng(), 0.72);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.94,
      size: 1 + rng() * 1.5,
      color: Math.floor(rng() * (colorCount + 1)),
      layer: i % 3,
      group: i % 2,
      alpha: 0.42 + rng() * 0.58 * (1 - radius * 0.4),
    };
  });
  // Only the static layer carries links, so a link never detaches from a drifting particle.
  const links = particles
    .filter((particle, i) => particle.layer === 0 && i % 2 === 0)
    .map((particle) => {
      const [a, b] = CORES;
      const toA = Math.hypot(particle.x - a.x, particle.y - a.y);
      const toB = Math.hypot(particle.x - b.x, particle.y - b.y);
      return { from: particle, to: toA <= toB ? a : b };
    });
  return { particles, links };
}

type BrainCoreProps = {
  /** Sphere radius in px. */
  radius: number;
  /** The six sector colors. */
  colors: readonly string[];
};

/** Central XYP3RN.CORE: drifting, twinkling particle sphere converging on two engine cores. */
export const BrainCore = memo(function BrainCore({ radius, colors }: BrainCoreProps) {
  const model = useMemo(() => buildBrain(brain.particleCount, colors.length), [colors.length]);
  const palette = [...colors, TOKENS.ink];
  const showLabels = radius >= 64;

  return (
    <g aria-hidden="true">
      {model.links.map((link, i) => (
        <line
          key={i}
          x1={link.from.x * radius}
          y1={link.from.y * radius}
          x2={link.to.x * radius}
          y2={link.to.y * radius}
          stroke={TOKENS.ink}
          strokeWidth={0.35}
          opacity={0.14}
        />
      ))}
      {[0, 1, 2].map((layer) => (
        <g
          key={layer}
          className={layer === 0 ? undefined : 'brain-drift'}
          data-reverse={layer === 2}
          style={{ '--drift': `${140 + layer * 50}s` } as React.CSSProperties}
        >
          {[0, 1].map((group) => (
            <g
              key={group}
              className="brain-twinkle"
              style={{ '--twinkle': `${4 + layer + group * 1.5}s`, '--phase': `${-(layer * 1.3 + group * 2.1)}s` } as React.CSSProperties}
            >
              {model.particles
                .filter((particle) => particle.layer === layer && particle.group === group)
                .map((particle, i) => (
                  <circle
                    key={i}
                    cx={particle.x * radius}
                    cy={particle.y * radius}
                    r={particle.size / 2}
                    fill={palette[particle.color] ?? TOKENS.ink}
                    opacity={particle.alpha}
                  />
                ))}
            </g>
          ))}
        </g>
      ))}
      {CORES.map((core, i) => {
        const label = brain.cores[i]?.label ?? '';
        return (
          <g key={i} transform={`translate(${core.x * radius} ${core.y * radius})`}>
            <circle r={9} fill={TOKENS.ink} opacity={0.22} filter="url(#glow)" />
            <circle r={2.8} fill={TOKENS.ink} />
            {showLabels && (
              <text
                className="svg-micro"
                x={i === 0 ? -9 : 9}
                y={i === 0 ? 16 : -10}
                textAnchor={i === 0 ? 'end' : 'start'}
                fontSize={7.5}
                fill={TOKENS.ink}
                stroke={TOKENS.bg}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
      {/* 3D Core planetary core lighting, orbital meridian rings, and specular crest */}
      <circle r={radius * 0.72} fill="url(#sphere-3d-core)" opacity={0.38} pointerEvents="none" />
      <ellipse
        rx={radius * 0.96}
        ry={radius * 0.34}
        fill="none"
        stroke="rgba(255, 224, 178, 0.24)"
        strokeWidth={1}
        strokeDasharray="3 5"
        transform="rotate(-18)"
        pointerEvents="none"
      />
      <ellipse
        rx={radius * 0.96}
        ry={radius * 0.34}
        fill="none"
        stroke="rgba(155, 140, 255, 0.28)"
        strokeWidth={1}
        transform="rotate(24)"
        pointerEvents="none"
      />
      <circle cx={-radius * 0.24} cy={-radius * 0.26} r={radius * 0.16} fill="rgba(255,255,255,0.16)" pointerEvents="none" />
      {showLabels && (
        <g textAnchor="middle" stroke={TOKENS.bg} strokeWidth={3.5} paintOrder="stroke">
          <text className="svg-micro" y={radius * 0.58} fontSize={9} fill={TOKENS.ink}>
            {brain.label}
          </text>
          <text className="font-mono" y={radius * 0.58 + 13} fontSize={9} fill={TOKENS.inkDim}>
            {brain.caption}
          </text>
        </g>
      )}
    </g>
  );
});
