# UI-xyp3rn

Constellation Job Map UI for MAIN-XYP3RN-OS-Vault. Next.js 14 App Router, React 18, TS strict, Tailwind 3, Framer Motion, Vitest.

## Commands

- `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
- Done means all four gates exit 0. Run them fresh; do not chain a gate with a push.

## Architecture

- `data/map.ts` is the only content source: `ui` (all copy), `brain`, `x3liusTracks`, `departments` (137 jobs).
- `lib/` is pure and tested. `lib/layout.ts` owns geometry; `lib/tokens.ts` owns colors and every constant; `lib/jarvis.ts`, `lib/gateway.ts`, and `lib/voice.ts` own Jarvis command routing, path guards, spectrum math, typed `127.0.0.1:8077` gateway dispatch (with local-vault fallback), and speech/audio I/O.
- `components/MapScreen.tsx` owns state. `ConstellationCanvas.tsx` owns the SVG, camera and motion values.
- `SectorTree.tsx` draws one sector in its own frame (hub at origin, growing up) for both variants.
- `ChromeShell.tsx` provides the active sector and Jarvis console state through context to the rail, cycler and map.
- `JarvisVisualizer.tsx`, `JarvisDock.tsx`, `JarvisView.tsx`, and `X3liusPlayer.tsx` implement the Jarvis operator dock, full-screen console, harmonic voice visualizer, and X3LIUS music player.

## Rules

- No hardcoded labels in components; add copy to `ui`. No magic numbers; add to `LAYOUT` / `MOTION`.
- Functional components, pure layout functions, no classes. JSDoc on exports. Comments say why.
- Never put a CSS transform on an element that carries an SVG `transform` attribute; nest a group.
- SVG transforms are written imperatively from motion values in `apply()`. Do not move them into React state.
- Decorative SVG must be `pointer-events: none`; invisible shapes swallow clicks.
- Layout must stay deterministic. If geometry changes on purpose, update the snapshot with `npx vitest run -u` and say so.
- Stubs: `stub: true`, marker text only, `not-started`, no satellites, no dependencies. Never invent vault content.
- Tests first for layout math and data changes.

## State

- Branch `feat/jarvis`. Plans: `docs/plans/2026-11-11-constellation-map/plan.md`, `docs/plans/2026-11-12-jarvis-voice-assistant/plan.md`.
- Views 1-5, Jarvis Operator Dock, Full-Screen Jarvis Console (`/jarvis`), Typed `127.0.0.1:8077` Gateway (with deterministic local-vault fallback), and X3LIUS Music Player built. `/dashboards` and `/chart` are STUB empty states.
- Open: real content for the 77 stub notes; behaviour for the help button and settings.
