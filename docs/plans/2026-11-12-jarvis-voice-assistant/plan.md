---
title: "Jarvis Voice Assistant, Typed Server Gateway & X3LIUS Music Player"
status: done
created: 2026-11-12
size: large
---

## 요구사항

Sources: the vault job contracts in `data/map.ts` (`01_CORE`, `05_XYP3RN_RECORDS/06_X3LIUS_MUSIC_SYSTEM`, `06_GOVERNANCE`) and the 5-step Jarvis build plan.

- `data/map.ts` remains the single source of truth for all UI copy (`ui.jarvis`, `ui.player`), brain config, X3LIUS track definitions (`x3liusTracks`), and the 137 vault jobs `[confirmed: CLAUDE.md]`
- No hardcoded labels in components; no magic numbers outside `lib/tokens.ts` (`LAYOUT`, `MOTION`) `[confirmed: CLAUDE.md]`
- Functional components, pure functions in `lib/`, no classes, JSDoc on exports `[confirmed: CLAUDE.md]`
- Typed server gateway (`lib/gateway.ts`) targeting `http://127.0.0.1:8077` (`00_COMMAND_CENTER/server.mjs` and `01_AGENTIC_EXECUTION/gateway.mjs`) with localhost/same-origin enforcement (`06_GOVERNANCE`) and automatic deterministic local-vault fallback when `127.0.0.1:8077` is offline `[confirmed: user answer]`
- Path safety guard (`06_GOVERNANCE/01_Standards/Path Safety & Extension Standard.md`) and no-overwrite numbered copy resolution (`01_CORE/07_Tools/vault.write.md`) `[confirmed: data/map.ts]`
- Prompt routing across `CLAUDE CODE CLI` and `GEMINI API` cores, `@path` / `@agent` context injection, and session logging to `localStorage` (`05_XYP3RN_RECORDS/01_Session_Logs/`) `[confirmed: data/map.ts]`
- Jarvis Visualizer (`components/JarvisVisualizer.tsx`), Operator Dock (`components/JarvisDock.tsx`), Full-Screen Jarvis View (`components/JarvisView.tsx` and `/jarvis`), and X3LIUS Music Player (`components/X3liusPlayer.tsx`) with `/api/music/pulse` spectrum, `COMPOSE`, `IMPORT RENDER`, and song hub navigation `[confirmed: task list]`
- Follow-ups: optimize and measure focus fly-in frame rate, update `CLAUDE.md` and `README.md`, and run cross-browser verification `[confirmed: task list]`

## 결정

- P0 Gateway fallback: when `http://127.0.0.1:8077` is unreachable, `dispatchJarvis` and `fetchTrackPulse` fall back deterministically to the in-memory vault engine (`mode: 'local-vault'`) without throwing.
- P1 All 137 jobs and 77 stub markers in `data/map.ts` remain untouched so existing data and layout snapshot tests stay valid.
- P1 Esc key order on `/map`: closes the full-screen Jarvis console first when open, then `SkillViewer`, `JobPanel`, and `focusId`.
- P2 Web Speech API (`SpeechRecognition` / `speechSynthesis`) and Web Audio API degrade gracefully to deterministic state transitions and timer ticks when browser speech/audio APIs are unavailable.
- P3 `ConstellationCanvas` skips redundant per-sector DOM attribute writes during the focus fly-in when `rot` and `unroll` are stationary.

## 구현 계획

1. Write Jarvis unit and component tests first (`lib/__tests__/jarvis.test.ts`, `components/__tests__/jarvis.test.tsx`), confirm red.
2. Implement `lib/jarvis.ts`, `lib/gateway.ts`, `lib/voice.ts`, and expand `lib/types.ts`, `lib/tokens.ts`, `data/map.ts`.
3. Implement `components/JarvisVisualizer.tsx`, `components/X3liusPlayer.tsx`, `components/JarvisDock.tsx`, `components/JarvisView.tsx`, `/jarvis` route, and wire into `ChromeShell.tsx`, `BrainCore.tsx`, and `MapScreen.tsx`.
4. Complete follow-ups: focus fly-in frame-rate optimization, `CLAUDE.md` and `README.md` updates, browser verification.
5. Run all four verification gates (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`), capture screenshots, commit, and prepare PR.

## 완료 조건

- `npm run typecheck` (exit 0)
- `npm run lint` (exit 0)
- `npm test` (exit 0)
- `npm run build` (exit 0)
- Headless browser verification and screenshots of Jarvis Operator Dock, Full-Screen Jarvis Console, and X3LIUS Player.

## 검증 결과

Run on 2026-11-12, each command on its own:

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, no warnings |
| `npm test` | exit 0, 6 files, 84 tests |
| `npm run build` | exit 0, `/map` 75.2 kB, `/jarvis` 3.57 kB, all routes static |


