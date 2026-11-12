# ModelFit frontend

React + TypeScript + Vite + Tailwind CSS. The public website plus the signed-in lab (dashboard) at `/app`. It talks only to the ModelFit backend; it never calls an AI provider directly, and API keys never reach the browser.

## Run it

The backend must be running on port 8000 first. Full setup for both is in the [root README](../README.md#running-locally).

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` to `http://localhost:8000` (override with `MODELFIT_API_TARGET`). `npm run build` type-checks and builds, `npm run lint` runs oxlint.

## Routes

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/signup`, `/login` | Sign up and log in against `/api/v1/auth`. Signed-in visitors skip straight to `/app`. |
| `/privacy`, `/terms` | Placeholders that say the documents are not written yet. |
| `/app/*` | Every lab page shares a sidebar (a drawer below 64rem): New benchmark, Overview, and each project with its latest benchmarks. It refreshes itself after any create, run or delete. On wide screens it can be hidden and shown again; the choice is remembered in `localStorage` (`modelfit:sidebar`). |
| `/app` | Lab overview: the latest best-fit verdict, projects with their next step, recent benchmarks, provider status. Guarded by `RequireAuth`. |
| `/app/new` | Guided setup: choose a project, add test cases, choose models, review and run. `?project=<id>` starts at step 2. |
| `/app/projects/:id` | A project: its system prompt, test cases and benchmarks. |
| `/app/benchmarks/:id` | Ready to run, live progress, then results: verdict with the fitting tape, quality-against-cost map, per-metric charts, every number, every answer. |

## Talking to the backend

- `src/services/auth.ts` signs up and logs in, keeps the JWT in `localStorage`, treats an expired token as signed out, and exposes `authFetch()`, which attaches the token to a request.
- `src/services/api.ts` is the typed client for everything else (projects, test cases, benchmarks, reports, providers). Its types mirror the backend's Pydantic schemas in `backend/app/schemas`.
- `src/hooks/useResource.ts` loads data for a page and sends the visitor to `/login` if the session has ended.

## Layout

```
src/
  pages/Landing/          landing page, one file per section, plus landing.css
  pages/Auth/             sign up and log in
  pages/Lab/              the signed-in lab's pages and lab.css
  components/lab/         lab building blocks: sidebar, verdict, run options, progress, tables, answers, forms
  components/lab/charts/  fitting tape, quality-against-cost map, metric bars, outcome bar
  pages/Legal/            privacy and terms placeholders
  components/landing/     nav, footer, tape, tape slider, price tag, pattern pieces, number field
  components/trap/        the cost calculator: inputs, validation, results
  components/RequireAuth  guard for /app
  services/auth.ts        sign up, log in, session token, authFetch
  services/api.ts         typed client for the backend API
  hooks/                  data loading (useResource), type fitting, scroll reveal, active nav section, reduced motion
  utils/                  benchmark (report → verdict and evidence), trapMath, exampleScore, fitText, format, providers
  styles/site.css         shared public-site styles (type, buttons, form controls, nav, footer)
  index.css               Tailwind import and design tokens
```

## Things worth knowing

- **Lab charts encode roles, not models.** Blue is the recommended model, navy the one used today, grey the rest, red only failures; every chart names models directly and has a takeaway sentence. Results text is computed in `src/utils/benchmark.ts` from report fields, never written by hand.
- **Lab and site CSS share one bundle.** Lab classes avoid names the public site already styles (`.num`, `.tape`, `.step`, `.results`, …); check `site.css` and `landing.css` before adding a generic class name.
- **Money is in Indian rupees** with Indian digit grouping (₹5,15,450). All formatting goes through `src/utils/format.ts`. The backend reports costs in US dollars; the lab converts them with `usdToInr()` at `VITE_USD_TO_INR` (default 88) and says so on the page.
- **The calculator is an estimate, not a benchmark.** `src/utils/trapMath.ts` holds the arithmetic and states its assumptions: a constant chance of success per attempt, a fixed limit on attempts, and the same cost for every attempt. The page repeats those assumptions to the visitor.
- **The "How to read a benchmark" table is illustrative demo data.** The numbers are made up, no real model is named, and the section is labelled as such. Its winner is computed from those numbers by `src/utils/exampleScore.ts`, not typed in.
- **Design tokens** (chalk, tape, ink, paper, tick, and the two font families) live in `src/index.css` under `@theme`.
- **Fonts are bundled** through Fontsource, so the site works offline.
