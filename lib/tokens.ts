import type { DepartmentId } from './types';

/** Core palette. Tailwind and inline SVG both read from here so the two cannot drift. */
export const TOKENS = {
  bg: '#090C14',
  ink: '#F4F1EA',
  inkDim: '#A6ADBF',
  hairline: 'rgba(244,241,234,0.16)',
  accent: '#FFAC5E',
} as const;

/** The six vault sector colors, keyed by sector id. */
export const SECTOR_COLORS: Record<DepartmentId, string> = {
  '01_CORE': '#38BDF8',
  '02_KNOWLEDGE_LAYER': '#8B7CF6',
  '03_RESEARCH_INTELLIGENCE': '#EC6A9C',
  '04_RESEARCH_MATERIAL': '#E8C53A',
  '05_XYP3RN_RECORDS': '#3ECFB2',
  '06_GOVERNANCE': '#E5484D',
};

/** Token names as written in the spec's token table, used as Tailwind color keys. */
export const SECTOR_TOKEN_NAMES: Record<DepartmentId, string> = {
  '01_CORE': 's01_core',
  '02_KNOWLEDGE_LAYER': 's02_knowledge',
  '03_RESEARCH_INTELLIGENCE': 's03_research',
  '04_RESEARCH_MATERIAL': 's04_material',
  '05_XYP3RN_RECORDS': 's05_records',
  '06_GOVERNANCE': 's06_governance',
};

/**
 * Every tunable number from the spec in one place.
 * Lengths are world units: 1 unit = 1px at camera scale 1.
 */
export const LAYOUT = {
  ringRadiusRatio: 0.22,
  hubRadius: 22,
  wedgeDeg: 70,
  focusArcDeg: 160,
  segMin: 28,
  segMax: 44,
  jitterDeg: 25,
  stubLength: 14,
  /** Length of the shared trunk before a forked branch splits. */
  forkTrunk: 16,
  /** A chain longer than this forks into balanced sub-chains. */
  maxChain: 7,
  dotSize: 7,
  nodeSize: 34,
  satelliteSize: 6,
  satelliteStem: 22,
  rootDotSize: 3,
  /** Minimum centre distance between two overview dots before a layout attempt is rejected. */
  minDotGap: 12,
  layoutAttempts: 96,
  focusStep: 84,
  focusFirstRadius: [214, 256],
  focusJitterDeg: 8,
  focusForkRadius: 95,
  focusLabelMaxChars: 13,
  focusLabelMaxLines: 2,
  jarvisOrbRadius: 48,
  jarvisRingCount: 4,
  jarvisRingStep: 18,
  jarvisBarCount: 24,
  jarvisBarInner: 58,
  jarvisBarMaxLen: 32,
  playerSpectrumBars: 24,
  gatewayPort: 8077,
  mcpConnectorTotal: 21,
  sessionLogMax: 50,
} as const;

/** Durations in milliseconds unless noted. */
export const MOTION = {
  ringSpring: 700,
  fly: 800,
  stripIdle: 1200,
  reduced: 150,
  expand: 320,
  collapseRatio: 0.6,
  staggerPerDepth: 18,
  breatheMinSeconds: 6,
  breatheMaxSeconds: 9,
  breathePx: 1.5,
  jarvisPulseMs: 1400,
  jarvisSweepMs: 2400,
  spectrumTickMs: 80,
  gatewayTimeoutMs: 1200,
} as const;

export const BREAKPOINT_MOBILE = 768;
