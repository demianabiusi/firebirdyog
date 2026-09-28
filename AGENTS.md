# AGENTS.md

Firebird SQL client: Electron 44 + React 19 + TypeScript + Vite 8 + Tailwind v4 + Monaco Editor. Talks to Firebird over the network via `node-firebird` (no local Firebird client libs required).

## Commands

- `npm run dev` — full dev loop (Vite on :5173 + `tsc` electron watch + Electron). Use this to run the app.
- `npm run build` — builds UI (`build:ui` → `dist/`) then electron main (`build:electron` → `dist-electron/`).
- `npm run package:win` / `package:linux` — produce release binaries (slow; see note below).
- Typecheck: renderer `npx tsc --noEmit`, electron `npx tsc -p tsconfig.electron.json --noEmit`.

There is **no test framework and no lint/format config** (no eslint/prettier/jest). Typecheck + `npm run build` is the only verification.

## Architecture

Two independent TypeScript projects with separate configs (no shared types):

- `src/` — React renderer, ESM/bundler, `noEmit`, jsx `react-jsx`. Entry `src/main.tsx`.
- `electron/` — Node main process, CommonJS, emitted to `dist-electron/` via `tsconfig.electron.json`.

Renderer never talks to Firebird directly. All backend access goes through `window.electronAPI` (exposed by `electron/preload.ts` via contextBridge). Every IPC handler is registered in `electron/main.ts`; domain logic lives in `electron/firebird-service.ts`, `dump-service.ts`, `compare-service.ts`, `storage-service.ts`, `ssh-tunnel-service.ts`. Types for the API contract are in `src/types/index.ts` (also declares the global `window.electronAPI`). `preload.ts` uses loose `any` args — keep `src/types/index.ts` in sync manually when adding IPC.

`electron/main.ts` is a single large file: window-state persistence, app icon resolution, and all ~40 IPC handlers live there.

## Gotchas

- `npm start` (= `electron .`) runs unpackaged, so `isDev` is true and it loads `http://localhost:5173` — it will fail unless the Vite dev server is running. Use `npm run dev` instead.
- Adding a new IPC channel requires three edits: handler in `electron/main.ts`, bridge in `electron/preload.ts`, and type in `src/types/index.ts`.
- `.fdb`/`.gdb`/`.fbk` and `data/` are gitignored — never commit database files.
- CI (`.github/workflows/ci.yml`) runs `npm ci --ignore-scripts` on Linux. Do not add `--omit=optional`: TypeScript 7 (native compiler) needs its platform binary `@typescript/typescript-linux-x64`, which is an optional dependency.

## Conventions

- Conventional Commits (`feat:`, `fix:`, etc.). Target branch `main`; PRs rebased/squashed (see `CONTRIBUTING.md`).
- i18n: string files in `src/i18n/locales/{en,es}.json`; no hardcoded UI strings in components.
- Tailwind v4 (config-less, via `@tailwindcss/vite` plugin) — no `tailwind.config.js`.
- Developer preference (from `PROJECT_STATUS.md`): do **not** run `package:win` on every minor local change; verify with `npm run build` and let GitHub Actions produce releases. Spanish is the preferred language for docs/commit bodies.
