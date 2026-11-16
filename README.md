# UI-xyp3rn

Constellation Job Map for `MAIN-XYP3RN-OS-Vault`: 6 sectors around the XYP3RN.CORE brain, 46 vault folders as branches, 137 notes as nodes.

![Overview ring](docs/screenshots/overview.png)

## Run

```bash
npm install
npm run dev        # http://localhost:3000 -> /map
```

| Command | What it does |
|---|---|
| `npm test` | Vitest: data contract, layout math, helpers, components |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run lint` | `next lint`, zero warnings allowed |
| `npm run build` | Production build, all routes static |

## Stack

Next.js 14 (App Router), React 18, TypeScript strict, Tailwind 3, Framer Motion, lucide-react, Vitest. Fonts are self-hosted through fontsource, so the build needs no network.

## Views

| View | Where | Notes |
|---|---|---|
| 1 Overview ring | `/map` | 6 hubs at 60 degrees, active sector rotates to 6 o'clock |
| 2 Collapsible sectors | `/map?open=01_CORE,05_XYP3RN_RECORDS` | Click a hub to collapse. No param = all open, `?open=` = all collapsed |
| 3 Sector focus | Enter or double-click a hub | 160 degree arc, 34px icon nodes, satellites, wheel/pinch zoom, drag pan |
| 4 Job panel | Click a node | 14 sections, BUILDS ON navigation, status saved to localStorage |
| 5 SKILL.MD sheet | From the panel | Rendered note, copy install command, copy, download |
| Jarvis Dock & Console | `/map` dock, `X3` rail button, or `/jarvis` | Voice/CLI routing (`CLAUDE CLI` / `GEMINI API`), `@path` context injection, `127.0.0.1:8077` gateway + local vault fallback, 24-band X3LIUS player |
| 6-7 | `/dashboards`, `/chart` | Empty states. STUB: the source never shows these screens |

Keys: `←` `→` cycle sectors, `Enter` on a hub focuses it, `Space` collapses it, `Esc` closes one layer.

## Layout of the code

```
app/            routes (/map, /jarvis, /dashboards, /chart), fonts, dot grid, star field
components/     ConstellationCanvas, SectorTree, BrainCore, JobPanel, SkillViewer, JarvisVisualizer, JarvisDock, JarvisView, X3liusPlayer, chrome
data/map.ts     the only content source: UI copy, brain config, X3LIUS tracks, 137 jobs
lib/            pure functions: layout, prng, storage, url, search, markdown, camera, vault paths, jarvis, gateway, voice
lib/tokens.ts   palette plus every layout and motion constant
```

Rules the code follows:

- No label is hardcoded in a component. Copy lives in `ui` in `data/map.ts`.
- No magic numbers in components. They live in `LAYOUT` and `MOTION` in `lib/tokens.ts`.
- Layout is deterministic: a PRNG seeded by sector id. A snapshot test pins every node coordinate.
- Animation frames never re-render React. Motion values write SVG `transform` attributes directly.

## Seed data and STUB entries

`data/map.ts` holds 137 jobs, split 26 / 18 / 32 / 18 / 27 / 16.

- 60 entries carry the content written in the source spec, unchanged apart from two fixes: skill name `spec- market` became `spec-market`, and `startHere` was removed from the daily note because the spec names the Uk Drill song as sector 05's start.
- 27 are notes the spec names but never writes (Research Orchestrator, X3LIUS Songwriter, vault.read, ...). Title and path are real; every other field is the STUB marker.
- 50 are notes the spec only counts ("plus 1 // STUB"). They are titled `STUB · <kind>`.

A stub is `stub: true`, `status: 'not-started'`, with no satellites and no dependencies. To replace one, swap its `namedStub(...)` or `unnamedStub(...)` call for a full `Job` literal. The data test counts stubs, so update `77` there when you do.

## Known gaps

- Dashboards and Chart are empty states by design.
- `NEED HELP BUILDING THIS?` and the settings button have no behaviour in the source. Both are marked STUB.
- The overview trees are scaled to fit the viewport, so the 28-44 unit segments render smaller than 28-44px on most screens. Dots keep their size.
- Overview dots are small touch targets on a phone. The focus view is the comfortable way to open a job there.
