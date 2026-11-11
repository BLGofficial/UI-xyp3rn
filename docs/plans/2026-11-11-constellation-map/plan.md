---
title: "Constellation Job Map UI for MAIN-XYP3RN-OS-Vault"
status: in-progress
created: 2026-11-11
size: large
---

## 요구사항

Sources: the Constellation Job Map prompt (views, motion, a11y, acceptance) and the 6-sector transformation PDF
(sector mapping, tokens, seed distribution, file tree). Where they disagree the PDF wins; where the PDF's code
disagrees with the PDF's prose the prose wins.

- Next 14 App Router, React 18, TS strict, Tailwind 3, Framer Motion; one full-viewport SVG with one camera group `[confirmed: spec]`
- `data/map.ts` is the only content source, including UI copy; no hardcoded labels in components `[confirmed: spec]`
- 6 sectors, 44 top-level subfolders, 46 leaf clusters, 137 jobs; per-cluster counts fixed by the PDF table `[confirmed: PDF section 3]`
- `06_X3LIUS_MUSIC_SYSTEM` forks into `00_Songs`, `06_Audio`, `07_Suno_Prompts` `[confirmed: PDF section 1]`
- Layout is deterministic: PRNG seeded by sector id `[confirmed: spec]`
- Views: overview ring, collapsible sectors with `?open=`, sector focus, 14-section job panel, SKILL.MD sheet, `/dashboards` and `/chart` as empty states `[confirmed: spec]`
- Reduced motion, <768px layout, focusable node buttons with `aria-label="{title}, {department}, {status}"` `[confirmed: spec]`
- Fonts self-hosted through fontsource so the build needs no network `[researched: build must be hermetic, 1]`
- Lighthouse a11y >= 95 `[unresolved: no Lighthouse run in this environment]`

Policy values (radii, angles, durations, thresholds) live in `lib/tokens.ts` (`LAYOUT`, `MOTION`), not in prose or components.

Ambiguity sweep, four places checked:

- State transitions: hub click vs double-click, focus on a collapsed sector, opening a job inside a collapsed sector, Esc order. Resolved below.
- Rules that apply at once: `?open` absent vs empty; status override vs seed status; `startHere` given twice in sector 05. Resolved below.
- Boundaries: a chain of exactly 7 stays one chain, 8 forks. Search with an empty query does nothing.
- Failure and rollback: a failed localStorage write keeps the in-memory status; a failed clipboard write reports failure and changes nothing.

## 결정

- P0 seed content for the 27 notes the PDF names but never writes: user answer "Named, marked STUB (Recommended)". Real title, path, cluster; `stub: true`; body fields carry a STUB marker; status `not-started`.
- P0 build scope: user answer "Full build, one PR (Recommended)". Branch `feat/constellation-map`, one commit per step.
- P1 the 60 entries the PDF wrote are kept verbatim, with two corrections: `spec- market` -> `spec-market`; `startHere` removed from the daily note because the prose names the Uk Drill song as sector 05's start.
- P1 the PDF's 73 generated "Stub Note N" entries are dropped: 14 of their ids collide and their statuses are invented.
- P1 `?open` absent = all expanded; `?open=` = all collapsed; unknown ids are ignored.
- P1 hub click toggles collapse, Enter or double-click focuses, Space toggles. Focus always shows the full tree. Opening a job in a collapsed sector expands it.
- P1 Esc closes one layer per press: skill sheet, then panel, then focus.
- P2 `NEED HELP BUILDING THIS?` and the settings button have no behaviour in the source; both are marked `// STUB`.
- P3 geometry is computed in world units and the overview tree scale shrinks to fit the viewport; dots stay 7px on screen.

## 구현 계획

1. Scaffold, tokens, fonts, test harness.
2. Tests first: data contract and layout math, confirmed red.
3. `data/map.ts`: 60 written + 27 named STUB + 50 unnamed STUB, UI copy.
4. `lib/`: prng, layout (`ringPosition`, `layoutTree`, `layoutSector`, `collapseTree`, `layoutFocusArc`), storage, url, search, markdown, camera, vault paths.
5. Views 1-3: `ConstellationCanvas`, `BrainCore`, `SectorTree`, collapse, strip unroll, focus arc.
6. Views 4-5: `JobPanel`, `SkillViewer`.
7. Chrome: `ChromeShell`, `SearchBar`, `SectorCycler`, routes.
8. Verify, push, PR.

## 완료 조건

- `npm run typecheck` (exit 0)
- `npm run lint` (exit 0)
- `npm test` (exit 0)
- `npm run build` (exit 0)
- Manual attest: headless screenshots of the overview, collapsed, focus, panel and skill sheet states.
