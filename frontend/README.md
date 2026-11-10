# ModelFit frontend

React + TypeScript + Vite + Tailwind CSS. Frontend only: the backend is built separately and nothing here calls an AI provider.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. `npm run build` type-checks and builds, `npm run lint` runs oxlint.

## What exists so far

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/app` | Stand-in that says the workspace is not built yet. The benchmarking app mounts here next. |

## Layout

```
src/
  pages/Landing/        landing page, one file per section, plus landing.css
  pages/Lab/            stand-in for the workspace
  components/landing/   tape, tape slider, hang tag, pattern pieces, wordmark
  hooks/                useFittedLines (fits type with the width axis), usePrefersReducedMotion
  utils/                fitText, trapMath (calculator arithmetic), format
  index.css             Tailwind import and design tokens
```

## Notes

- Design tokens (chalk, tape, ink, paper, tick, and the two font families) live in `src/index.css` under `@theme`, so they are available as Tailwind utilities and as CSS variables.
- The landing page calculator is arithmetic on numbers the visitor enters (`src/utils/trapMath.ts`). It shows no benchmark data, real or demo.
- Fonts are bundled through Fontsource, so the page works offline.
