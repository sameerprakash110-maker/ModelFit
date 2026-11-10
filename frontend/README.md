# ModelFit public website

React + TypeScript + Vite + Tailwind CSS. This project is the public marketing site only. The authenticated benchmarking application and the backend are built separately, and nothing here calls an AI provider.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. `npm run build` type-checks and builds, `npm run lint` runs oxlint.

## Routes

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/signup`, `/login` | Account entry points. The forms validate, then call `src/services/auth.ts`. |
| `/privacy`, `/terms` | Placeholders that say the documents are not written yet. |
| `/app/*` | Where the authenticated application will mount. Guarded by `RequireAuth`, which sends every visitor to `/signup` for now. |

## Connecting authentication

`src/services/auth.ts` is the single integration point. Its three functions (`signUp`, `logIn`, `isAuthenticated`) currently report "not connected" and never pretend to succeed. Replace their bodies with calls to the real auth endpoints once the backend contract is agreed. The sign-up and log-in pages already handle success, error and not-connected results.

## Layout

```
src/
  pages/Landing/          landing page, one file per section, plus landing.css
  pages/Auth/             sign up and log in
  pages/Legal/            privacy and terms placeholders
  components/landing/     nav, footer, tape, tape slider, price tag, pattern pieces, number field
  components/trap/        the cost calculator: inputs, validation, results
  components/RequireAuth  guard for /app
  services/auth.ts        authentication integration point
  hooks/                  type fitting, scroll reveal, active nav section, reduced motion
  utils/                  trapMath (calculator arithmetic), exampleScore, fitText, format
  styles/site.css         shared public-site styles (type, buttons, form controls, nav, footer)
  index.css               Tailwind import and design tokens
```

## Things worth knowing

- **Money is in Indian rupees** with Indian digit grouping (₹5,15,450). All formatting goes through `src/utils/format.ts`.
- **The calculator is an estimate, not a benchmark.** `src/utils/trapMath.ts` holds the arithmetic and states its assumptions: a constant chance of success per attempt, a fixed limit on attempts, and the same cost for every attempt. The page repeats those assumptions to the visitor.
- **The "How to read a benchmark" table is illustrative demo data.** The numbers are made up, no real model is named, and the section is labelled as such. Its winner is computed from those numbers by `src/utils/exampleScore.ts`, not typed in.
- **Design tokens** (chalk, tape, ink, paper, tick, and the two font families) live in `src/index.css` under `@theme`.
- **Fonts are bundled** through Fontsource, so the site works offline.
