# TwistRouting — TypeScript Migration & WebAssembly / Modern-Web Report

> Companion to `docs/ARCHITECTURE-AUDIT.md`. Part A: a concrete, low-risk path to
> TypeScript. Part B: an honest, forward-looking assessment of where WebAssembly
> (and the rest of the modern web platform) genuinely move this app forward —
> versus where they'd be hype.

The codebase is now **native ES modules** (Phase 2 done): **52 files**, single
`main.js` entry, explicit `import`/`export`, a registry pattern (`editors/`),
centralized `core/state.js`, and a clean DnD `DataTransfer` contract. That ES-module
foundation is *exactly* what makes both TypeScript and a WASM core tractable.

**What changed since this report was first written:** the app grew a **fleet of 15
twist editors** (`js/editors/*.js`) — vision mixer, multi-viewer, ISO/replay, audio
mixer, audio monitor, intercom, IFB, camera control, encoder, signaling, stage-box,
lighting, WYSIWYG — all on the same `register(test,title,render)` contract; the most
complex (camera control) is itself split into a **6-module set** (`js/editors/camera/`)
threaded by a shared `ctx` object. It also gained a **role-based access layer**
(`js/auth.js` + `js/schedule.js`): a capability model, `window.can()`, and
`data-cap`-driven progressive disclosure applied on every editor open. These are
**new, wholly untyped cross-module contracts** — and the single biggest reason to
move on TypeScript now (details in A.0/A.3).

---

## PART A — TypeScript

### A.0 Why now
TS pays off most where there are **data contracts crossing module boundaries**, and
this app has several implicit ones that currently live only in comments. The list has
grown sharply with the editor fleet and the access layer:
- The **JSON data shapes** (`Routes/Sources/**` and `Routes/Destinations/**`): pools,
  stage boxes, playouts, productions, twist configs (now including camera-input twists:
  `cameraInput`, `row`, `maxVideo`).
- The **DnD `DataTransfer` protocol** (`text/plain` = ids, `source-type` = `'pool'`).
- The **editor registry** contract (`register(test,title,render)`, `render(body,twist,config)`)
  — now honoured by **15** editors, each with its own `test` regex against a free-text
  twist name. Two editors matching overlapping names (e.g. `signal` vs `signaling`,
  `light` vs `on-air`) is exactly the drift TS + a shared `EditorPlugin` type guards against.
- The **capability/role contract** (`js/auth.js`): the `Capability` keys
  (`admin|switch|route|signal|shade|gfx|comms|audio|book|view`), `window.can(cap)`,
  `window.Auth.applyScope()`, and the `data-cap="<capability>"` DOM attribute that every
  editor uses for progressive disclosure. A typo in a `data-cap` value silently shows a
  control to the wrong role today — a string-literal union would catch it.
- The **inter-editor bridges**: `window.openStageBox(name,color,channels,origin)`
  (audio-mixer → stage-box), `renderGridOfSiblings(body,twist,re,buildOne)` (`multi.js`,
  used by audio-monitor & IFB), and the camera module's shared `ctx`/`mkState()` object.
- The **`window` bridges** (`window.TopBar`, `window.Editors`, `window.Auth`,
  `window.Tutorial`, `window.RouterView`, `window.openStageBox`, `window.loadAllDestinations`).
Each is a real bug surface (the stale-manifest folder-rename and the lazy-load
`dragWired` regression were both "shape/expectation drifted" bugs that types would
have flagged).

### A.1 Two migration paths

**Path 1 — JSDoc + `checkJs` (NO build step).** Keep shipping plain `.js` ES modules;
add types in JSDoc comments and a `tsconfig.json` with `allowJs/checkJs`. `tsc --noEmit`
type-checks in CI/editor; the browser runs the untouched `.js`. **This preserves the
project's defining "no build, drop a file in and it works" ethos** and the Service
Worker / static-host deploy model. Recommended **first** step.

```jsonc
// tsconfig.json  (type-check only, emit nothing)
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "allowJs": true, "checkJs": true, "noEmit": true,
    "strict": false, "strictNullChecks": true, "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]
  },
  "include": ["js/**/*.js", "types/**/*.d.ts"]
}
```
```js
/** @typedef {import('./types/model').StageBox} StageBox */
/** @param {StageBox} data @param {HTMLElement} container */
export function renderVideoPool(data, container) { /* … */ }
```

**Path 2 — full `.ts` with a build step.** Convert files to `.ts`, compile with
**esbuild** (or Vite) to `dist/`. Gives the strongest guarantees and best DX, at the
cost of a build/watch and a deploy change (serve `dist/`, update `uploadftp.py` +
the Service-Worker shell). Recommended **second**, once the domain types exist.

> Recommendation: **start Path 1** (types with zero build risk), graduate the hottest
> files to Path 2 once `types/model.d.ts` is stable. They coexist (`allowJs`).

### A.2 The domain model (write this first — it's 80% of the value)
A single `types/model.d.ts` capturing the JSON the app reads:

```ts
export type RGB = `${number},${number},${number}`;
export type Hex = `#${string}`;

export interface StageBox {                 // Routes/Sources/<cat>/<floor>/NNN.json
  id: string; name: string; prefix: string; count: number;
  extraClass: string; color?: Hex; floor?: string; level?: number;
  items?: string[];                         // audio: explicit channel labels
  status?: string;                          // e.g. "NO CONNECTION" → isFaultStatus()
}
export interface Playout {                  // Routes/Sources/Play/Playout N.json
  id: string; name: string; color: Hex;
  players: { id: string; name: string;
    videos: { id: string; name: string;
      stack: { video: string; audio: string[] } }[] }[];
}
export interface Production {               // Routes/Destinations/**, Sources/Prod/*
  id: string; name: string; color?: Hex; parentName?: string; status?: string;
  outputs?: { video?: string[]; audio?: string[]; intercom?: string[] };
  twists?: (string | TwistConfig)[];
}
export interface TwistConfig {
  name: string; accepts?: 'video' | 'audio' | 'both' | 'camera';
  inputs?: string[]; monitor?: boolean; row?: string;
  maxVideo?: number; maxAudio?: number;
  cameraInput?: boolean;                     // "CAM N" twists fed into a destination
}
export type Manifest = string[];            // index.json (entries end "/" = folder)
export type PoolKind = 'video' | 'audio' | 'playout' | 'productions';
```
This turns `inferPoolKind`, `channelsFor`, `renderPrograms`, the pool renderers and
`sources.js` into type-checked functions and makes the manifest/folder contract
explicit (would have caught the `Audio/`→`Sound/` rename mismatch).

**The editor-side runtime model is now equally worth typing.** The access layer and the
camera console both carry real shape contracts:

```ts
// js/auth.js — the capability vocabulary, used as data-cap values and window.can() args
export type Capability =
  | 'admin' | 'switch' | 'route' | 'signal' | 'shade'
  | 'gfx' | 'comms' | 'audio' | 'book' | 'view';
export interface Role {
  id: string; name: string; sub?: string; tier: string;
  color: Hex; task: string; caps: Partial<Record<Capability, 1>>;
}

// js/editors/camera/state.js — mkState(): one per camera (8 instances)
export interface CamState {
  pan: number; tilt: number; zoom: number; dolly: number; ped: number;
  iris: number; gamma: number; mgain: number; shutter: number; mblack: number;
  rGain: number; gGain: number; bGain: number; rBlk: number; gBlk: number; bBlk: number;
  presets: (Partial<CamState> | null)[];
}
```
Typing `Capability` makes `window.can(cap)` and every `data-cap` literal checkable;
typing `CamState` makes the per-frame `scopes`/`maps`/`controls` builders that read it
type-safe instead of passing an untyped `ctx` blob between six modules.

### A.3 Typing the seams
- **DnD contract** → a const + type so `dragDrop`, `matrix`, `touchDrag`, `router-view`
  share one definition:
  ```ts
  export const DND = { IDS: 'text/plain', KIND: 'source-type' } as const;
  export type SourceKind = 'pool';
  ```
- **Registry** → a generic, replacing the loose-regex `KINDS` now shared by 15 editors:
  ```ts
  type EditorTest = (name: string) => boolean;
  type EditorRender = (body: HTMLElement, twist: HTMLElement, cfg: TwistConfig|null) => void;
  interface EditorPlugin { match: EditorTest; title: string; render: EditorRender; }
  // window.Editors.register(test, title, render) → typed; openForTwist returns boolean
  ```
- **Access layer** (`js/auth.js`) → the highest-leverage new seam. Type the global so
  every editor's gating is checked:
  ```ts
  // types/globals.d.ts
  interface Window {
    can(cap: Capability): boolean;
    Auth: { role: Role; roles: Role[];
      setRole(r: Role): void; showLogin(): void; applyScope(root?: ParentNode): void };
    openStageBox(name: string, color: Hex, channels: string[], origin?: HTMLElement): void;
  }
  ```
  Pair it with a typed `data-cap` — a tiny helper `cap(el, c: Capability)` instead of raw
  `el.dataset.cap = '…'` strings makes the disclosure contract impossible to mistype.
- **Camera module `ctx`** → the object `camera-control.js` threads through
  `state/scopes/bars/maps/controls` is pure `any` today; give it an interface
  (`{ cams: CamState[]; S(): CamState; ui: {...}; … }`) so the six files share one contract.
- **`multi.js`** → `renderGridOfSiblings(body, twist, re: RegExp, buildOne: EditorRender)`.
- **`AppState`** (`core/state.js`) → an interface; kills `any` on the shared mutable state.
- **`window` bridges** → `types/globals.d.ts` with `declare global { interface Window { … } }`
  for `TopBar`, `Editors`, `Tutorial`, `RouterView`, `loadAllDestinations`, and the
  inline-`onclick` names (`togglePool`, `toggleHelix`, `toggleRecord`, `removeSwimmer`).
- **DOM data-attributes** are an untyped contract today (`data-prod-name`, `data-config`,
  `data-origin`, `dataset.dragWired`). Document them in a `Dataset` interface; long-term,
  the architecture audit's move from DOM-scraping to passing models removes most of them.

### A.4 Tooling
- **Type-check:** `tsc --noEmit` (Path 1) in a `pre-commit`/CI step.
- **Build (Path 2):** `esbuild js/main.ts --bundle --format=esm --splitting --outdir=dist`
  — millisecond builds, ES-module output, tree-shaking. Vite if you want HMR dev server.
- **Lint:** `typescript-eslint` with `@typescript-eslint/strict-type-checked` on the typed files.
- Keep the Service Worker: if you adopt Path 2, point the SW `SHELL` at `dist/` and have
  `uploadftp.py` deploy `dist/` instead of `js/` (one-line change to the rank function).

### A.5 Phased TS plan (each step shippable, no big-bang)
1. **Add `tsconfig.json` (checkJs) + `types/model.d.ts` + `types/globals.d.ts`.** Include the
   new `Capability`, `Role`, `CamState`, and the `window.can/Auth/openStageBox` declarations.
   Zero runtime change; light up errors in the editor.
2. **JSDoc the leaf utils** (`util/*`, `core/state`, `globals` net helpers) — pure, easy, high signal.
3. **JSDoc the data layer** (`sources`, pools, `productions`, `app`) against `model.d.ts`.
4. **JSDoc the seams** (DnD, registry, **access layer**, inter-editor bridges). Type
   `editors/core.js`'s `register`/`openForTwist` and `auth.js`'s `can`/`applyScope` first —
   they're imported or relied on by every editor, so they pay back across all 15 at once.
5. **JSDoc the editor fleet, cheapest-first.** Start with the self-contained simulators
   (`vision-mixer`, `multi-viewer`, `signaling`, `lighting`, `wysiwyg`), then the
   cross-wired ones (`audio-mixer`↔`stagebox-input`, `intercom`↔`ifb`,
   `audio-monitor`/`ifb`↔`multi.js`), then the **camera module set** as a unit (type `ctx`
   + `CamState` once, all six files fall into line).
6. **Optional Path 2:** rename `.js`→`.ts`, add esbuild, ship `dist/`. Do hottest/most-coupled
   files first (`matrix`, `sources`, `editors/core`, `auth`).
7. Turn on `strict` once the above is clean.

### A.6 The conversion playbook & gotchas (this codebase, specifically)
A.5 is the *order*; this is the *mechanics* and the traps that will actually bite, grounded
in what's in the tree today (52 files, 280 `querySelector` sites, 10 `getContext('2d')`,
17 `window.*` bridges, inline `onclick` in generated HTML).

#### Step 0 — bootstrap (one commit, zero runtime change)
`package.json` exists but is bare (only `puppeteer`). Add dev tooling and scripts:
```jsonc
// package.json
{
  "type": "module",                       // matches the <script type=module> runtime
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch"
  },
  "devDependencies": { "typescript": "^5.6.0" }
}
```
Add the `tsconfig.json` from A.1 **with one change: ship `strictNullChecks: false` on day one**
(see G1). Wire `npm run typecheck` into a pre-commit hook / CI. Nothing the browser loads
changes — this whole step is reversible by deleting two files.

#### The gotchas, in rough order of how much they'll hurt

**G1 — the 280-`querySelector` null storm (the #1 friction).** With `strictNullChecks`
on, every `document.querySelector('.x').innerText` becomes an error (`Object is possibly
null`), and there are ~280 of them plus the 10 `getContext('2d')` (also `| null`). Turning
strict-null on across the whole repo on day one would bury you in hundreds of errors.
- **Do:** keep `strictNullChecks: false` initially; add a tiny typed helper and migrate to it
  file-by-file, flipping strict-null on per-file via `// @ts-check` discipline, only globally
  at the very end (A.5 step 7).
  ```ts
  // util/dom — throws instead of returning null, so callers get a non-null type
  export const qs  = <T extends Element = HTMLElement>(root: ParentNode, sel: string): T => {
    const el = root.querySelector<T>(sel); if (!el) throw new Error(`missing ${sel}`); return el;
  };
  export const qsa = <T extends Element = HTMLElement>(root: ParentNode, sel: string) =>
    [...root.querySelectorAll<T>(sel)];
  ```
- **Don't** sprinkle `!` non-null assertions everywhere — they silence the checker without the
  runtime guard the DOM-scraping code actually needs (these queries *do* sometimes miss, e.g.
  the lazy-load `dragWired` regression).

**G2 — inline `onclick` in runtime-generated HTML (silent breakage).** `togglePool`,
`toggleHelix`, `toggleRecord`, `removeSwimmer` are emitted as `onclick="togglePool(…)"`
strings (11 sites) and resolved off `window` at click time. TypeScript sees them as
**unused exports / dead globals** and any rename, `noUnusedLocals`, or tree-shake will
*silently* break the buttons — no type error, because the HTML string is opaque to TS.
- **Do:** declare them on `Window` (G3), and **never** enable `noUnusedLocals` for these.
- **Better long-term:** replace string-`onclick` with `addEventListener` + `data-*` attributes
  (kills the global *and* the opaque contract). Schedule this as a cleanup, not a blocker.

**G3 — the dual IIFE-`window` + ES-`export` pattern.** 25 files export ES symbols, and many
*also* publish a `window.*` bridge (`Editors`, `Auth`, `can`, `TopBar`, `RouterView`,
`Portals`, `Schedule`, `CaptainsLog`, `DestSelector`, `openStageBox`, `loadAllDestinations`,
plus the four `onclick` globals). `core.js` literally does both (IIFE builds `window.Editors`,
then re-exports each member). Type the bridges in one place:
```ts
// types/globals.d.ts
export {};
declare global {
  interface Window {
    Editors: { register(t:(n:string)=>boolean, title:string, render:EditorRender): void;
               openForTwist(t: HTMLElement): boolean; /* … */ };
    Auth: { role: Role; roles: Role[]; setRole(r: Role): void; applyScope(root?: ParentNode): void };
    can(cap: Capability): boolean;
    openStageBox(name: string, color: Hex, channels: string[], origin?: HTMLElement): void;
    togglePool(id: string): void; toggleHelix(id: string): void;
    toggleRecord(id: string): void; removeSwimmer(id: string): void;
    loadAllDestinations(): void;
    TopBar:any; RouterView:any; Portals:any; Schedule:any; CaptainsLog:any; DestSelector:any;
  }
}
```
- **Gotcha:** keep BOTH the `window.X =` assignment and the `export` during migration — don't
  delete a bridge until every consumer imports the symbol, or you break the non-migrated files.

**G4 — stringly-typed DOM data contracts.** `JSON.parse(twist.dataset.config)` is `any`
(launder it through `TwistConfig` at the boundary), and `data-cap="…"` is an unchecked string
(a typo shows a control to the wrong role — type it as `Capability`, ideally via a
`cap(el, c: Capability)` setter instead of raw `dataset.cap`). The DnD `DataTransfer` keys
(`text/plain`, `source-type`) are the same kind of contract — see A.3.

**G5 — canvas `getContext('2d')` returns `| null` (10 sites).** The camera scopes/maps and
WYSIWYG previz all call it. Guard once per editor (`const ctx = c.getContext('2d'); if (!ctx) return;`)
rather than asserting at every draw call.

**G6 — the Service-Worker SHELL + `?v=` cache-bust (the deploy-breaking trap).** This is why
**Path 1 (JSDoc, no build) is strongly recommended first**: it ships the same `.js`, so `sw.js`'s
`SHELL` list, the `?v=NN` query ritual, and `uploadftp.py` are all untouched. If/when you go
**Path 2 (.ts → `dist/`)**, three things must move together or the offline app breaks:
  1. every path in `sw.js`'s `SHELL` array repoints to the built output,
  2. `uploadftp.py` deploys `dist/` instead of `js/` (the audit notes this is ~a one-line rank change),
  3. the build is wired into the `CACHE_VERSION` + `?v=` bump so a deploy still invalidates caches.
- **Testing gotcha (now):** a stale service worker will keep serving the *old* JS while you test
  a change — bump the version or unregister the SW (DevTools ▸ Application) when verifying, or
  you'll think your edit didn't land. (This already bit the dest-selector centering edit.)

**G7 — import specifiers.** Imports today are clean: relative, explicit `.js`, **no `?v=`
query strings** (the `?v=` lives only in `sw.js`/`index.htm`). That's TS-friendly as-is.
- **Don't** start adding `?v=` to `import` statements — `tsc` can't resolve `./x.js?v=95`.
- For Path 2: keep writing `.js` in import specifiers (esbuild rewrites them); or set
  `allowImportingTsExtensions` — don't hand-edit 52 files' import paths.

**G8 — registry dispatch is order- and regex-dependent, and TS won't catch it.** 15 editors
register a `test(name)` regex; overlaps are resolved by *registration order* and negative
lookaheads (`lighting` excludes `on-air`; `signal` vs `signaling`). Types make the registry
shape safe but **cannot** catch a mis-ordered or too-greedy regex — add a couple of dispatch
unit tests (twist name → expected editor) so a future regex tweak can't silently reroute a twist.

**G9 — tooling/runtime mismatch.** Adding `"type": "module"` aligns Node tooling with the
browser's ES modules; without it, lint/test runners may assume CJS. `puppeteer` ships its own
types, so no `@types/*` are needed yet — add `lib: ["WebWorker"]` now (for `sw.js`) and
`WebCodecs`/AudioWorklet libs only when Part B's real-media work lands.

#### Definition of done (per phase, so each is shippable)
- **Phase 1–2:** `npm run typecheck` is green with `strictNullChecks:false`; CI runs it; no `.js` shipped differently.
- **Phase 3–5:** `model.d.ts` + `globals.d.ts` complete; each converted file passes with its own
  strict-null via the `qs`/`qsa` helpers; dispatch unit tests pass.
- **Phase 6 (optional Path 2):** `dist/` builds, `sw.js`/`uploadftp.py` repointed, offline reload
  verified after a `CACHE_VERSION` bump.
- **Phase 7:** `strict: true` repo-wide, green.

#### Rollback / risk
Path 1 is fully reversible (delete `tsconfig.json` + the `devDependencies`; JSDoc comments are
inert). Path 2 is the only step with deploy risk — gate it behind G6's checklist and keep the
`js/`-served Path-1 setup working until `dist/` is proven in production.

### A.7 Modularity wins to bank during the conversion — *modularity is king*
None of these are *required* for TypeScript, but the conversion is the cheapest possible moment
to make them, because you're already opening every file and TS will *enforce* the new seams once
drawn. The codebase is already in good shape to push on (editors don't import each other; `core/`
and `util/` are already DOM-free) — so the goal is to take it from "modular-ish with hidden global
wires" to **ultra-modular: every unit is a self-contained, independently-testable package with one
explicit, typed contract at its edge.** Ranked by modularity payoff:

**M1 — Kill the 17 `window.*` globals; that's the modularity ceiling.** Every
`window.Editors / Auth / can / TopBar / RouterView / Portals / Schedule / openStageBox / …` is an
**invisible, untyped dependency edge** — the single biggest thing stopping this from being truly
modular, because any file can reach any other with no declared contract. Replace them with explicit
`import`s; for the few genuinely cross-cutting services (`Editors`, `Auth`), expose **one typed
registry object** injected where needed rather than a global grab-bag. `core.js`'s dual
IIFE-`window`-+-`export` shape then collapses into a clean module. *Do this incrementally behind
the G3 `globals.d.ts` so nothing breaks mid-flight* — but the end state has **zero** app-owned
globals (only the unavoidable `onclick` ones, until M8 removes those too).

**M2 — Make each editor a self-contained plugin *package*, auto-registered.** `editors/camera/`
already proves the pattern; promote all 15 to it: `editors/<name>/{index,view,state,styles}.ts`,
each exporting **one** manifest:
```ts
export interface EditorPlugin {
  id: string;
  match(name: string): boolean;        // the dispatch regex, owned by the editor
  title: string;
  requiredCaps?: Capability[];         // M6 — gating declared, not scattered
  accepts?: TwistConfig['accepts'];
  render(host: HTMLElement, ctx: EditorContext): void;   // M3
}
export default { id:'vision-mixer', match:n=>/…/.test(n), title:'VISION MIXER', render } satisfies EditorPlugin;
```
Then **delete the 14 hand-maintained `import './editors/x.js'` lines in `main.js`** and build the
registry from a glob (`import.meta.glob('./editors/*/index.ts')` under Vite, or a generated
`editors/index.ts` barrel). **Adding an editor becomes: drop a folder. Zero edits anywhere else.**
That's the ultra-modular bar for the editor layer.

**M3 — Decouple editors from the DOM: pass a typed model, stop scraping.** Today
`render(body, twist, config)` hands each editor a live DOM node it must *scrape*
(`gatherSources` walks `.drop-zone`, reads `dataset.*`). That's the deepest coupling in the app —
every editor secretly depends on `matrix.js`'s DOM shape. Invert it: the host gathers the routed
feeds into data and passes a context:
```ts
interface EditorContext {
  sources: Feed[];            // already-resolved routed feeds (no DOM walk)
  config: TwistConfig | null;
  production: { name: string; color: Hex };
  can(cap: Capability): boolean;
}
```
Now editors are **pure functions of data → UI**: unit-testable with a fake context, no `matrix`
coupling, and `gatherSources`/`channelsFor` shrink to one host-side resolver. This is the change
that makes the editor fleet genuinely independent modules, and it pairs perfectly with TS.

**M4 — Extract a real `ui/` widget library (the duplicated chrome).** `knob`/`meterBar` live in
`core.js` and **14 editors each inject their own CSS block** via `addStyles` — that's the CSS
duplication the architecture audit flagged. Move the shared vocabulary (knob, fader, meter, scope,
pill, crosspoint, the LCARS rail) into `ui/` as **custom elements with Shadow DOM**: encapsulated
styles (kills the 14 `addStyles` blobs), reusable, framework-free. Editors then *compose*
`<tr-fader>`/`<tr-meter>` instead of hand-rolling divs + CSS strings. `ui/makeMediaGroup.js` is
the lone resident today — this is where the rest belong.

**M5 — Carve out a pure `routing-core` (domain logic, zero DOM).** No domain module exists yet;
crosspoint/tally/mix-minus/salvo logic is smeared through `matrix.js` and `router-view.js` as
DOM-scraping. Extract it as pure functions over a typed graph (`take`, `salvo`, `computeTally`,
`mixMinus`, `diff`). `core/` and `util/` are *already* DOM-free, so there's a clean home. Payoff:
trivially unit-testable, and it's the exact module Part B wants for the server/WASM-portable future.

**M6 — Capabilities declared, not scattered.** Fold editor-level gating into the M2 manifest
(`requiredCaps`); the host checks once before render. Keep `data-cap` for *sub-control* disclosure,
but typed as `Capability` (G4). Access policy lives in one place instead of sprinkled DOM attributes.

**M7 — Make the dependency direction a rule, not a habit.** Layer it
`routing-core → model → ui (widgets) → editors → app`, with **editors never importing editors**
(already true — *preserve it*). The one real cross-editor need, `openStageBox`, becomes a typed
service passed via `EditorContext`, not a window global. Add an ESLint `import/no-restricted-paths`
rule so the layering can't quietly erode.

**M8 — Delete the inline-`onclick` globals via event delegation.** Replace
`onclick="togglePool(…)"` (and the 3 others) with `addEventListener` + `data-action` delegation.
Removes the last 4 app-owned globals and the opaque-HTML contract from G2 — finishing what M1 starts.

> **The throughline:** M1 (no globals) + M2 (plugin packages) + M3 (data-in, not DOM-scrape) are
> the heart of "modularity is king." After them, every editor is a folder you can build, type,
> and test in isolation, wired to the rest by exactly one typed contract. Do M4/M5 opportunistically
> as you touch the relevant code; enforce M7 from day one so the gains don't regress.

### A.8 Alternative strategy — parallel 1:1 rebuild + cutover (clean-room)
A.5/A.6 migrate the existing `js/` **in place**. This is the other option: **build a complete,
TypeScript, ultra-modular replacement alongside the live app, verify it at 1:1 parity, then cut
over in a single reversible swap.** Pick this when the real goal is the M1–M8 end-state — because
the new tree is born strict-typed and modular from line one, with **no retrofit scar tissue** (no
280-`querySelector` null storm to chase, no dual-`window`/`export` limbo, no half-migrated files).
The cost is running two trees until cutover; the mitigations for that are the whole game (G-drift below).

```
Repo during the rebuild:
  js/            ← live app, keeps shipping (frozen for features near the end)
  src/           ← new TS app, built to dist/
  Routes/        ← SHARED data — used by BOTH, never forked
  *.css / styleguide ← SHARED LCARS styling — used by both
  index.htm      ← live entry      index.next.htm ← side-build entry (until cutover)
```

#### Build order (foundations up — each layer is shippable-to-the-side and tested before the next)
- **P0 · Scaffold.** New `src/` tree + Vite/esbuild + **`strict: true` tsconfig from day one** +
  `npm run dev/build/typecheck/test`. Lay down the M7 layering as empty folders:
  `src/domain/` (routing-core), `src/model/` (the `.d.ts` become real `.ts`), `src/ui/` (widgets),
  `src/editors/<name>/`, `src/platform/` (discovery, service-worker, hash-router), `src/app/`.
  Add a `index.next.htm` entry so the side build is reachable in a browser **without touching the
  live `index.htm`**. **Reuse `Routes/` and the LCARS CSS as-is** — they're already host-agnostic
  and modular; forking them just creates drift.
- **P1 · Domain core (M5), pure & DOM-free.** `routing-core`: typed graph + `take/salvo/computeTally/
  mixMinus/diff`, plus the typed `model` and the discovery layer (`listDirectory/fetchJSON/manifest`).
  Fully unit-tested. Everything above reads from this.
- **P2 · UI widget library (M4).** `ui/` as Web Components (knob, fader, meter, scope, pill,
  lcars-rail, crosspoint) with Shadow-DOM-encapsulated CSS. A widget gallery page to eyeball each
  against the original.
- **P3 · Shell + map.** Sources panel, destination tabs, the twist map, DNA-helix visuals,
  drag/touch DnD, fault propagation — wired to `routing-core`. Reproduces the main screen 1:1.
- **P4 · Editor fleet (M2 + M3), one folder at a time.** Each editor a plugin package consuming a
  typed `EditorContext` (data-in, no scraping), **auto-registered via glob** — no central import list.
  Port order: isolated first (vision-mixer, multi-viewer, signaling, lighting, wysiwyg) → cross-wired
  (audio-mixer↔stagebox, intercom↔ifb, audio-monitor/ifb via the grid helper) → **camera last but
  easy** (it's already a 6-module set — a near-direct typed port). Each editor carries a parity checklist.
- **P5 · Cross-cutting.** Access layer (M1/M6: typed registry + manifest `requiredCaps`, **zero
  `window.*`**), schedule, the `#/prod/twist` hash router, and the service worker — the new build uses
  **content-hashed filenames**, so the manual `?v=NN` ritual is retired entirely (a clean win).

#### The parity gate (this is the "tested" in "once tested it migrates")
Cutover is **blocked** until the side build provably matches. Define acceptance explicitly and
automate what you can — `puppeteer` is **already a dependency**, so a parity harness is cheap:
- **Automated parity harness:** drive `js/` and `src/dist/` through the *same* scripted actions
  against the *same* `Routes/` data; diff resulting DOM/state + screenshots (visual regression) on
  the key screens and every editor.
- **Unit tests:** `routing-core` (crosspoints/tally/mix-minus), and **dispatch tests** (twist name →
  expected editor) so the 15 regexes can't silently reroute (G8).
- **Manual QA checklist:** every editor opens for the same twist names and renders the same controls;
  **per-role gating matches** (Captain vs Chief vs Guest); faults propagate end-to-end; **deep links
  resolve** (bookmarks / Captain's-Log links); **offline/SW works**; touch-drag works on a tablet.
- Acceptance = the harness is green + the checklist is signed off. Only then do you schedule cutover.

#### Cutover (one small, reversible swap)
1. **Feature-freeze `js/`** for the final sync window (see G-drift — non-negotiable).
2. Re-run the parity harness against the frozen `js/`; fix any last deltas.
3. Flip **three things only:** `index.htm` loads the built bundle; `sw.js` `SHELL` → `dist/` with a
   bumped `CACHE_VERSION`; `uploadftp.py` deploys `dist/`.
4. Deploy; **verify in prod with a hard reload / SW update** (G6); smoke-test the checklist live.
5. **Keep `js/` in the repo, git-tagged, for one release** = instant rollback (reverting those three
   files restores the old app verbatim). Delete/relegate `js/` to `legacy/` only after a soak period.

#### Gotchas unique to build-on-the-side (beyond A.6's G1–G9)
- **G-drift — the moving target (the defining risk).** The live app is **actively changing** (you're
  editing `index.htm`/`sw.js`/`clock.js`/`router-view.js` right now). A parallel rebuild races against
  every such change. Mitigate by: (a) keeping the rebuild **behind, not ahead** of features — port to
  parity, then **freeze** `js/` features and let the side build catch the frozen target; or (b) logging
  every old-tree change during the build to replay into `src/`. Without a freeze window, parity is a
  treadmill that never converges.
- **Share data & styling, don't fork them.** `Routes/**` and the LCARS styleguide must be the *same*
  files for both trees, or they drift and the parity harness lies. The discovery/`index.json` manifest
  contract must be reproduced **exactly** (this is the `Audio/`→`Sound/` rename bug class).
- **Service-worker collision during parallel testing.** The live SW may cache/intercept the side
  build's entry. Serve `index.next.htm`/`dist/` on a path the SW doesn't claim (or unregister the SW in
  dev), or you'll test stale assets and not know it.
- **Two cache regimes.** Don't let the old `?v=NN` SHELL and the new content-hashed `dist/` fight in
  one origin during overlap — keep them on separate paths until cutover, then the old regime is gone.
- **Deep-link & hash parity is acceptance, not polish.** `#/prod/twist` bookmarks and Captain's-Log
  links must resolve identically post-cutover; bake it into the harness.
- **Honest cost.** This is **more total effort** than the in-place path (you build twice and keep them
  in sync), and the cutover is the one genuinely big-bang moment. You buy: a clean strict-TS, M1–M8
  modular codebase with no migration debt, retired `?v=` ritual, and a single-revert rollback. Choose
  it when the modular end-state is the point and you can afford a feature-freeze window; choose A.5/A.6
  when you must keep shipping features continuously and can tolerate a longer half-migrated middle.

---

## PART B — WebAssembly & the modern web

### B.0 Honest framing
WebAssembly accelerates **CPU-bound compute** (DSP, codecs, crypto, physics, big
numeric/graph work) and enables **sharing one engine across browser + server +
native**. It does **not** speed up DOM manipulation, event handling, layout, or
network IO — which is ~95% of what this app does today. So "rewrite it in WASM" would
be **net-negative** for the current app (more toolchain, no DOM speedup, larger payloads,
JS↔WASM marshalling overhead on every DOM touch).

The forward-thinking question isn't "where do we bolt on WASM," it's **"as this grows
from a routing *simulator* into a real broadcast control surface, where does heavy
compute appear — and what platform primitive fits each?"** Below: WASM where it earns
its place, and the *other* modern-web primitives that matter more for the rest.

### B.1 The one genuinely compelling WASM use — a portable **routing engine core**
The app's domain is a router (sources → crosspoints → destinations, with salvos,
tie-lines, tally, mix-minus, lock/protect). That logic is **pure, deterministic, and
identical on client and server**. Today it's implicit in the DOM (`router-view.js`
re-derives crosspoints by scraping `.drop-zone`s).

Extract it into a **`routing-core`** compiled from **Rust** (via `wasm-bindgen`) or
**AssemblyScript** to WASM:
- Inputs: a normalized graph (senders, receivers, current crosspoints, salvos, locks).
- Ops: `take(src,dst)`, `salvo(list)`, `solveTieLines()`, `computeTally()`,
  `mixMinus(bus)`, `diff(prev,next)`, crosspoint queries for the 1990s view at scale.
- Outputs: deterministic state + an event diff.

Why WASM specifically here: **one binary is the single source of truth** — the same
core runs in the browser (instant UI), in a Node/Deno **server** (authoritative state,
multi-operator sync), and could embed in native/edge later. It removes the "logic lives
in the DOM" smell the audit flagged, is trivially unit-testable, and stays fast if the
matrix grows to thousands of crosspoints (where JS `Set` scans in `router-view` would
start to drag). This is the *forward-thinking* move: **portable routing logic, not a
WASM-ified UI.**

> Reality check: at today's scale (hundreds of crosspoints) plain TypeScript is plenty.
> The WASM core's value is **portability + a server-authoritative future**, not present-day speed.

### B.2 Real-time media — where WASM shows up *if the editors become real*
The editors still **simulate** signal flow (the data is synthetic), but they are no
longer static mockups: several now run **real per-frame canvas compute** — the camera
console's RGB parade + vectorscope + SMPTE bars + robotics maps (`editors/camera/`), and
WYSIWYG's 60fps top-down DMX pre-viz with ray-traced shadows (`editors/wysiwyg.js`).
That work is driven off `requestAnimationFrame`/intervals against synthetic state today,
so it's cheap — but it means the **render hot paths already exist**, and the GPU/Canvas
arguments below are now about optimizing code that's in the tree, not hypothetical future
code. The moment any editor touches real media, the right primitives are:
- **Audio Mixer → Web Audio + `AudioWorklet` + WASM DSP.** Real faders/EQ/aux-sends/
  mix-minus = sample-accurate DSP on the audio thread. AudioWorklet runs WASM in the
  realtime audio context — *this* is a textbook, high-value WASM use (EQ/dynamics/pan laws).
- **Camera scopes / WYSIWYG pre-viz → `OffscreenCanvas` in a Worker, then `WebGPU`.** These
  are the app's *current* compute-shaped surfaces: the parade/vectorscope and the previz beam-
  cone + shadow pass are per-pixel work that would move cleanly to a Worker (keep the UI thread
  free) and then to GPU shaders if the resolution/fixture count grows. No WASM needed — this is
  a GPU/Worker story.
- **Multiviewer / ISO / Vision Mixer → `WebCodecs` + `WebGPU`/`OffscreenCanvas`.** Real
  thumbnails, tally-bordered tiles, transitions: decode with WebCodecs (hardware), composite
  on the GPU. WASM only for exotic codecs/scalers WebCodecs lacks; otherwise GPU > WASM here.
- **Tally / metering at scale → `SharedArrayBuffer` + Worker.** Push meter/tally state
  through shared memory to keep the UI thread free.

### B.3 The upgrades that matter *more* than WASM right now
Ranked by value-for-this-app:
1. **TypeScript** (Part A) — biggest correctness ROI, no runtime cost.
2. **A real-time transport** — `WebSocket` (or `WebTransport`) to an actual router/control
   backend, so the UI reflects/*drives* real hardware. This is the difference between a
   simulator and a control surface, and it's what makes B.1's server core worthwhile.
3. **Web Components / custom elements** — the architecture audit's `ui/` widget library
   (knob, fader, meter, pill, crosspoint) as real custom elements with Shadow DOM:
   encapsulated, reusable, framework-free, and a natural home for the duplicated editor CSS.
4. **WebGPU / Canvas** for the visuals (`getDNAHtml` SVG helix, VU meters, the crosspoint
   grid at scale) — smoother than per-frame DOM/SVG churn; pairs with `OffscreenCanvas` in a Worker.
5. **View Transitions API** for the overlay/editor open-close and tab switches — native, cheap polish.
6. **IndexedDB** (alongside the Service Worker) for routing snapshots/salvos/user layouts —
   structured local persistence beyond the current `localStorage` flags.
7. **PWA manifest + installability** — you already have a Service Worker and offline cache;
   add a web-app manifest to make it an installable control-surface app on a tablet/touch panel.

### B.4 A pragmatic WASM roadmap (only if/when warranted)
- **Now:** none. Ship TypeScript; keep routing logic in TS but **structured as a pure
  `routing-core` module** with no DOM deps (so it's WASM-portable later).
- **When multi-operator / server-authoritative sync is needed:** compile that same core to
  WASM (Rust + `wasm-bindgen`, or AssemblyScript for a lighter toolchain) and run it both
  client- and server-side.
- **When real audio lands:** AudioWorklet + WASM DSP for the mixer.
- **When real video lands:** WebCodecs + WebGPU (WASM only for codec gaps).
- Always measure first — JS engines are very fast; reach for WASM on a profiled hot path or
  a portability requirement, not on spec.

---

## Bottom line
- **Do TypeScript now** — Path 1 (JSDoc + `checkJs`, no build) → domain types → seams →
  editor fleet → optional `.ts`+esbuild. The ES-module refactor already paid the hard cost;
  this is the payoff — and the case is **stronger than when this report was written**: 15
  editors share one stringly-typed `register` contract, and the new `data-cap`/`window.can`
  access layer is a typo-prone string contract that a `Capability` union eliminates outright.
- **Don't WASM-ify the UI.** The single forward-thinking WASM play is a **portable
  `routing-core`** (browser + server), and even that is a "when you add real-time sync"
  move, not a today move.
- **The bigger modern-web wins for this app are TypeScript, a real transport, Web
  Components for the widget library, and GPU/WebCodecs/AudioWorklet *when the editors
  stop simulating and start carrying real signal.***
