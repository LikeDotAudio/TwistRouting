# `src/` — the A.8 side build (TypeScript, ultra-modular)

This is the clean-room rebuild described in [`docs/TYPESCRIPT-WASM-REPORT.md` §A.8](../docs/TYPESCRIPT-WASM-REPORT.md).
It runs **alongside** the live `js/` app (entry: `index.next.htm`) until it reaches
1:1 parity, then a single reversible cutover swaps the entry + service worker + deploy.

## Layering (M7 — dependency direction is a rule)

```
domain/        pure logic, ZERO DOM/globals  (routing-core: graph, faults, tally…)
  └─ model/    the typed data shapes (Production, TwistConfig, Capability, Role…)
       └─ platform/   discovery (manifest/autoindex), service worker, hash router
            └─ ui/    widget Web Components (knob, fader, meter, scope…)   [P2]
                 └─ editors/   one plugin package per editor (auto-registered)
                      └─ app/   boot + composition root
```

A layer may import only from layers above it. **Editors never import editors** —
cross-editor needs arrive as typed services on `EditorContext`. No `window.*`
globals anywhere.

## Editors are plugins (M2 + M3)

Each editor is a folder `editors/<name>/` whose `index.ts` default-exports one
`EditorPlugin` (`{ id, match, title, requiredCaps, render }`). `registry.ts` globs
them — **adding an editor is "drop a folder", zero edits elsewhere.** `render(host, ctx)`
reads only the typed `EditorContext` (resolved data), never the DOM.

## Run

```bash
npm install          # vite + typescript + vitest (dev only)
npm run dev          # side build at /index.next.htm (serves shared Routes/ data)
npm run typecheck    # tsc --noEmit, strict
npm test             # vitest (routing-core unit tests, dispatch tests)
npm run build        # → dist/  (content-hashed; retires the ?v= ritual)
```

## Deploy (cutover — TypeScript only)

The build has a relative base, so `dist/` drops at the site root next to the
shared `Routes/`. `deploy.py` (repo root) builds the app, publishes the entry as
`/index.htm` (the site default document — this is the cutover), uploads the
hashed bundle to `/assets/`, keeps the `Routes/` data + manifests on the server,
and removes the retired legacy `js/` shell + `sw.js`.

```bash
npm run deploy            # build → upload dist/ + Routes/ → remove legacy js/
npm run deploy:all        # same, but upload the ENTIRE Routes tree
```

`Routes/**` is the only JSON that ships — routing DATA, discovered via per-folder
`index.json` manifests (`src/platform/discovery.ts`), never app code.

## Status

- **P0 ✅** scaffold: tooling, layering, model, discovery, routing-core seed + tests,
  editor plugin contract + auto-registry, walking-skeleton boot.
- P1–P7: see the tasks / §A.8 phases.
