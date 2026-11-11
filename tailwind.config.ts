import type { Config } from 'tailwindcss';
import { SECTOR_COLORS, SECTOR_TOKEN_NAMES, TOKENS } from './lib/tokens';
import type { DepartmentId } from './lib/types';

const sectorColors = Object.fromEntries(
  (Object.keys(SECTOR_COLORS) as DepartmentId[]).map((id) => [SECTOR_TOKEN_NAMES[id], SECTOR_COLORS[id]]),
);

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: TOKENS.bg,
        ink: TOKENS.ink,
        'ink-dim': TOKENS.inkDim,
        hairline: TOKENS.hairline,
        accent: TOKENS.accent,
        ...sectorColors,
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Marcellus', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        emphasis: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        label: '0.3em',
        micro: '0.25em',
      },
      fontSize: {
        micro: ['10px', { lineHeight: '14px' }],
        'micro-sm': ['9px', { lineHeight: '12px' }],
      },
    },
  },
  plugins: [],
};

export default config;
