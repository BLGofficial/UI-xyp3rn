import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import './globals.css';
import { ChromeShell } from '@/components/ChromeShell';
import { ui } from '@/data/map';
import { mulberry32, stringToSeed } from '@/lib/prng';
import { TOKENS } from '@/lib/tokens';

export const metadata: Metadata = {
  title: ui.meta.title,
  description: ui.meta.description,
};

export const viewport: Viewport = {
  themeColor: TOKENS.bg,
  width: 'device-width',
  initialScale: 1,
};

const STAR_COUNT = 60;

/** ~60 sparse static stars. Seeded, so server and client render the same sky. */
function StarField() {
  const rng = mulberry32(stringToSeed(`${ui.product.name}-stars`));
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: (rng() * 100).toFixed(2),
    y: (rng() * 100).toFixed(2),
    r: (0.5 + rng() * 0.5).toFixed(2),
    opacity: (0.1 + rng() * 0.2).toFixed(2),
  }));
  return (
    <svg aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full">
      {stars.map((star, i) => (
        <circle key={i} cx={`${star.x}%`} cy={`${star.y}%`} r={star.r} fill="#fff" opacity={star.opacity} />
      ))}
    </svg>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StarField />
        <ChromeShell>{children}</ChromeShell>
      </body>
    </html>
  );
}
