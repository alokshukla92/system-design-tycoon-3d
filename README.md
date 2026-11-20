# System Design Tycoon — classroom replica

Exact behavioural/visual replica of the reverse-engineered classroom (spec: `../reverse-engineering/`),
with lesson content converted from `system-design-tycoon/src/lib/learn/lessons.ts`.

```sh
npm install
npm run dev          # app at http://localhost:5173/#/day-one/1
npm test             # vitest: engine, content, search
npm run build        # tsc -b + vite build
```

Engine harness (dev only): `http://localhost:5173/engine-harness.html`.

## Layout
| Path | What |
|---|---|
| `src/engine/` | Isometric SVG diagram engine (docs 05, 05b) |
| `src/app/`, `src/components/`, `src/styles/` | Chrome, controller, store, router, CSS (docs 02–04, 06, 07) |
| `src/search/` | Search index + ⌘K modal (doc 07 §6) |
| `src/content/` | Course, registries, `lessons/*.json` (docs 11, 12) |
| `src/i18n/` | Strings + locale/RTL plumbing (en only) |
| `src/icons.ts` | Icon registry; markup in generated `icons.data.ts` |

## Scripts
- `node scripts/convert-lessons.mjs` — one-time lesson conversion (overwrites `src/content/lessons/*.json`, including hand enrichment encoded in the script).
- `node scripts/gen-incident-lessons.mjs` — regenerates the modules 02–03 lessons (Incident Commander, Campaign Extras) drafted from the source game's incidents/levels.
- `node scripts/gen-icons.mjs` — regenerate `src/icons.data.ts` after editing `ICON_NAMES`/`ALIAS`.

## Adding a lesson
Write `src/content/lessons/<id>.json` following doc 11, register it in `lessons/index.ts` and `course.ts`,
then `npm test` (schema validation).

## Practice & Design Lab (simulator)

The system-design simulator game is ported under `src/lab/` and rendered with the isometric engine.

- Routes:
  - `#/lab` is the free sandbox.
  - `#/practice[/campaign|incident|interview]` is the practice menu.
  - `#/play/<campaign|incident|interview>/<id>` is a game.
  - "Learn" returns to the last lesson.
- `src/lab/sim/` contains pure simulation, scoring, levels, incidents, interviews and mentor logic, copied unchanged, with their tests.
- `src/lab/store.ts` is the zustand game store. It persists the sandbox graph in `sdt:lab` and progress in `sdt:practice`.
- `src/lab/toScene.ts` turns graph + runtime into a `Scene`.
- **Open in Design Lab**: each lesson step carries `lab` (the source diagram's kinds, labels, edges, users and rps, which `convert-lessons.mjs` emits). The stage's *Tinker* tool loads it into the sandbox through `loadLessonGraph`. `src/lab/fromLesson.ts` rewires stores the way the sim routes traffic and sizes healthy blocks with headroom, while warn/crit blocks stay small. Traffic above `SIM_RPS_CAP` is scaled down along with users.
  - Layout is layered by BFS depth from `users`.
  - Node kinds map to entities, and live metrics map to pills, tags and flows.
  - Entity ids come from `entityId(nodeId)`, because link point syntax treats a `-<n>` suffix as an offset.
- `src/lab/ui/` holds the views (LabView, PracticeView, sidebar/sheet/rail, dialogs). `src/styles/lab.css` holds their styles.
- The engine has an additive API:
  - `update(scene)` applies property changes in place without re-running the transition.
  - `select(id)` highlights an entity.
  - `onPick(cb)` reports clicks on entities.

## Static pages & course overview

Like the original (Astro pages at real paths), the info pages use **real paths**, not hash routes:
`/pricing/`, `/about/`, `/contact/`, `/privacy/`, `/terms/`. Any other path renders a 404 page (the original
falls back to the home page). The classroom stays at `/` with its hash routes (`#/<lesson>/<step>`, `#/lab`, `#/practice`, `#/play/…`).

- `src/pages/routes.ts` maps `location.pathname` → page (`App.tsx` renders `StaticPage` or the classroom).
- `src/pages/pricing.config.ts` holds the plans. There is no checkout: a plan CTA either links (`href`) or shows a toast (`toast`).
- `src/pages/InfoPages.tsx` holds About / Contact / Privacy / Terms / 404 copy. **Privacy and Terms are placeholders marked TODO; review them before publishing.**
- `src/pages/CourseOverview.tsx` renders the overview below the classroom, with its copy built from `src/content/**`.
  It contains how-it-works, the FAQ, the module outline, further reading (`REFERENCES`) and footer links.
- `src/brand.ts` holds `supportEmail` / `siteUrl`. Both are placeholders.
- Styles live in `src/styles/pages.css`. Page tokens come from the original page CSS, and dark mode follows `sdt:theme`.

**Hosting:** static hosts must serve `index.html` for these paths.
- Netlify: `public/_redirects` (`/* /index.html 200`) is copied into `dist/`.
- Vercel: add `vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
- Other hosts: configure an SPA fallback to `index.html`.

`vite dev` / `vite preview` already do this.
