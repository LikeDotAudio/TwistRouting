# TwistRouting — Architecture Audit & Modularization Plan

> Full audit of `js/` (18 files, ~3,236 lines) plus a concrete, phased plan to turn it
> into real modules: folders, one-function-per-file, module managers, per-folder
> handlers, builder & registry patterns, and importable/standalone units.

---

## 0. TL;DR

- **The codebase is a script-tag app**: every file is loaded by `<script>` and talks to its
  siblings through **window globals** and **bare global functions**. There is no `import`/`export`,
  no build step.
- **Encapsulation is wildly uneven.** `clock.js` and `topbar.js` are clean IIFEs; `editors/` is a
  proper registry; `globals.js` leaks **13 symbols** (incl. 5 mutable state vars) to `window`;
  `app.js`, `matrix.js`, the pool renderers all leak too.
- **The single best pattern already in the tree is `editors/core.js`** — a registry + plugin
  model + DI helpers. **That is the template for the whole refactor.**
- **The highest-leverage wins** are: (1) move to **native ES modules**, (2) a shared **`ui/` builder
  library** to kill ~6 duplicated widget implementations, (3) a centralized **`AppState`** store to
  kill 5 shared global vars, (4) a unified **DnD manager** that owns the `DataTransfer` contract,
  (5) split the 501-line `matrix.js` into 5 single-purpose modules.

---

## 1. Current module graph (the de-facto API)

"Exports" = globals a file defines. "Imports" = globals it reads. This is the hidden dependency
graph that real modules will make explicit.

| File | LOC | Defines (de-facto exports) | Consumes (de-facto imports) |
|---|---:|---|---|
| `globals.js` | 213 | `selectedPoolNodes`, `lastClickedNode`, `currentTwist`, `matrixDragSrcEl`, `inputDragSrcEl`, `isFaultStatus`, `fetchJSON`, `listDirectory`, `toggleSuperPool`, `togglePool`, `switchTab`, `toggleRecord`, `initSidebarResizer` | DOM ids/classes, `fetch`, `localStorage`, `DOMParser` |
| `app.js` | 116 | `makeMediaGroup`, `DEST_TAB_COLORS`, `addDestinationTree`, `initApp`, `window.loadAllDestinations` | `TopBar.*`, `fetchJSON`, `listDirectory`, `renderPrograms`, `initializeTwists`, `initializeDraggables`, `renderSourcesPanel`, `initSidebarResizer`, `Editors.*` |
| `topbar.js` | 271 | `window.TopBar` (`init/addGroup/addTab`) | `switchTab` |
| `clock.js` | 58 | *(none — pure side-effect widget)* | CSS var `--cyan` |
| `globals` state | — | (the 5 mutable vars above) | written by `matrix.js`, `dragDrop.js` |
| `poolVideo.js` | 79 | `shadeColor`, `styleVideoNode`, `populateVideoPool`, `renderVideoPool` | `isFaultStatus`, `togglePool` |
| `poolAudio.js` | 81 | `AUDIO_POOL_COLORS`, `styleAudioNode`, `populateAudioPool`, `renderAudioPool` | `isFaultStatus`, `togglePool` |
| `poolPlayout.js` | 77 | `buildPlayoutVideoNode`, `renderPlayoutPool` | `shadeColor`, `makeMediaGroup`, `togglePool` |
| `sources.js` | 95 | `SOURCE_POOL_COLORS`, `inferPoolKind`, `renderSourceLeaf`, `renderSourceTree`, `renderSourcesPanel` | `listDirectory`, `fetchJSON`, `AUDIO_POOL_COLORS`, `makeMediaGroup`, `toggleSuperPool`, `initializeDraggables`, all 4 pool renderers |
| `productions.js` | 135 | `renderProductionInputs`, `renderPrograms` | `isFaultStatus`, `initializeTwists`, `initRoomDrops`, inline `togglePool/toggleRecord/toggleHelix` |
| `visuals.js` | 148 | `getDNAHtml`, `updateTwistVisuals`, `toggleHelix` | `isFaultStatus`, `getComputedStyle` |
| `dragDrop.js` | 155 | `toggleProdOutput`, `makeNodeDraggable`, `initializeDraggables` | `selectedPoolNodes`, `lastClickedNode` |
| `touchDrag.js` | 119 | *(none — self-installing IIFE)* | `draggable=true` attr + the DataTransfer contract |
| `matrix.js` | 501 | `enforceTwistLimits`, `buildDroppedGroup`, `initializeTwists`, `openTwistModal`, `handleMatrix*`×4, `handleInput*`×4, `removeSwimmer`, `syncTwistOrder`, `closeTwistModal`, `placeSourceInTwist`, `autoPopulateRoom`, `initRoomDrops` | `currentTwist`, `matrixDragSrcEl`, `inputDragSrcEl`, `updateTwistVisuals`, `Editors.openForTwist`, DataTransfer contract |
| `editors/core.js` | 257 | `window.Editors` (registry + helpers + deep-link) | DOM conventions only |
| `editors/*.js` ×5 | ~180 ea | each `register()`s one `render(body,twist,config)` | `Editors` helpers |

**Three load-bearing seams** hold the app together:
1. The **`DataTransfer` protocol** `{ 'text/plain': ids, 'source-type': 'pool' }` — produced in `dragDrop.js:96`, read in `matrix.js:88` and `touchDrag.js:61`. *This is the keystone of all drag/drop.*
2. **`updateTwistVisuals(twist)`** (`visuals.js`) — the shared re-render call, invoked from 5 sites.
3. **`window.Editors` registry** — the one clean plugin boundary.

---

## 2. Audit findings by dimension

### 2.1 Encapsulation gradient (worst → best)
```
globals.js  ──►  app.js  ──►  pool*/sources/productions  ──►  matrix.js  ──►  visuals/dragDrop  ──►  topbar.js ≈ clock.js ≈ editors/
  (13 globals)   (leaks all   (each leaks 2-6 globals,        (15 globals +    (IIFE-ish but      (IIFE, single
                  but 1)       cross-file palette reach)       3 shared state)  read globals)      namespaced export)
```
**Target:** make every file match the `topbar`/`editors` end of the spectrum.

### 2.2 Shared mutable global state — *highest-leverage decoupling*
Five raw `let`/`const` globals in `globals.js:1-11` are **written by other files**:
`selectedPoolNodes`, `lastClickedNode` (mutated in `dragDrop.js`), `currentTwist`,
`matrixDragSrcEl`, `inputDragSrcEl` (mutated in `matrix.js`). Whoever mutates them is invisible
from the declaration site. → **Replace with a single `core/state.js` `AppState` store.**

### 2.3 Duplication catalog (extract these)

**Pure utilities (trivial extraction):**
| Util | Locations | Target |
|---|---|---|
| `shadeColor` | `poolVideo.js:2` (def), `poolPlayout.js:37` (guarded consume) | `util/color.js` |
| `styleSignalNode` (border/color/shadow triplet) | `poolVideo.js:12`, `poolAudio.js:16` (byte-identical), `poolPlayout.js:38` (inlined) | `util/color.js` |
| `slugId` (`/[^a-zA-Z0-9]/g→'-'`) | `poolAudio.js:40`, `productions.js:16`, editors `slug()` | `util/dom.js` |
| `faultTag(status)` | `poolVideo.js:63`, `poolAudio.js:64`, `productions.js:66` | `util/dom.js` |
| `tagOrigin(grid, origin)` | `poolVideo.js:78`, `poolAudio.js:80` | `util/dom.js` |
| `getTwistConfig(twist)` (`JSON.parse(dataset.config)` try/catch) | `matrix.js` ×4 (96,202,426,463), `editors/core.js:38` | `twist/twistConfig.js` |
| `hexToRgb` | `topbar.js:19` | `util/color.js` |
| `formatTimecode(frames,fps)` | `iso-recorder.js:50` | `util/time.js` |
| fold-icon rotate | `globals.js:161/164/179/185`, `app.js:25` | `util/dom.js setFoldIcon()` |

**Palettes (consolidate):** `AUDIO_POOL_COLORS` (`poolAudio.js:3`, **reached across files** by `sources.js:43`),
`SOURCE_POOL_COLORS` (`sources.js:8`), `DEST_TAB_COLORS`/`DEST_GROUP_COLORS` (`app.js:35,85`),
`LCARS_COLORS` (`topbar.js:7`), hardcoded hexes (`poolVideo.js:22`, `productions.js:87-89`). → **one `util/palette.js`.**

**Builders (DOM construction):**
| Builder | Duplicated at | Target |
|---|---|---|
| Foldable **pool header** | `poolVideo:66`, `poolAudio:67`, `poolPlayout:54`, `productions:38` | `pools/builders/poolHeader.js` |
| **Multiplex stack node** (1 video + 4 audio) | `poolVideo:30`, `poolPlayout:23` | `pools/builders/multiplexNode.js` |
| **Signal node** (HTML-string variants) | `poolVideo`, `poolAudio`, `poolPlayout`, `productions:28` | `pools/builders/SignalNodeBuilder.js` |
| **Dropped-group chip** | `matrix.js:27` | `drop/droppedGroup.js` |
| **clone-and-sanitize node** | `matrix.js:42,162,440` | `twist/cloneSourceNode.js` |
| **ensure drop-zone** | `matrix.js:99,432` | `twist/ensureDropZone.js` |

**UI widgets (CSS-in-JS, duplicated across editors):**
| Widget | Impls | Target |
|---|---:|---|
| Rotary **knob** | core `knob()` shared, `.am-knob` CSS redeclared | `ui/Knob.js` |
| Vertical **fader / T-bar** | `.vm-tbar` ≈ `.am-fader` | `ui/Fader.js` |
| **Meter / VU** (green→yellow→red) | core `meterBar()`, `.am-vu>i`, `.mv-meter>i`, `.iso-disk>i` | `ui/Meter.js` |
| **Selectable / toggle pill** | **6 impls**: `.vm-tbtn/.vm-btn`, `.mv-pbtn`, `.am-spill/.am-layerbtn`, `.ic-pill`, `.rp-btn` | `ui/Pill.js` |
| **Segmented single-select** (`toggle('sel', x===b)`) | vision transitions, mv presets, iso speed/angle | `ui/ButtonGroup.js` |
| **Section / card** | `.ed-h`, `.vm-sec`, `.ic-card`, `.iso-card`, `.am-submix` | `ui/Section.js`, `ui/Card.js` |
| **Chip/tag**, **M/S toggle** | `.ic-chip`, `.vm-dsk span`; `.am-ms button` | `ui/Chip.js`, `ui/ToggleButton.js` |

### 2.4 Inheritance / pattern audit
- **No class inheritance exists anywhere** — everything is free functions + closures. The pool
  renderers are the clearest case of *implicit* inheritance: all four share
  `build header → append group → populate grid → tag origin` but copy it instead of sharing a base.
  → introduce a real `PoolRenderer` base (template method: subclass implements only `buildContent`).
- **The registry pattern (`editors/core.js`) is the one true abstraction** and should be generalized
  (see §4.2).
- **The mega-builder anti-pattern**: `audio-mixer.js stripEl` (70 lines), `matrix.js openTwistModal`
  (116 lines), `productions.js renderPrograms` (large) each mix layout + state + event-wiring + DOM
  strings. Decompose into widget calls.

### 2.5 Coupling & load-order fragility
- **`typeof fn === 'function'` guards** appear in `sources.js:25-28,61`, `poolPlayout.js:37,67`,
  `productions.js:129,132`, `app.js:61` — symptoms of "I'm not sure this global has loaded yet."
  Real modules with `import` eliminate this entirely.
- **`<script>` order in `index.htm` is a hand-maintained topological sort.** Adding a file in the
  wrong place silently breaks things.
- **Two independent drag systems**: the pool→twist/room drops (covered by the touch bridge) **and**
  the in-modal matrix-row reorder + input-label swap (`matrix.js:302-384`, mouse-only — **a touch
  gap**). A unified DnD manager closes this.

### 2.6 Standalone-import / testability blockers
1. Renderers read collaborators off `window` → need **dependency injection**.
2. Palettes physically live in sibling feature files and are reached across boundaries.
3. Inline `onclick="togglePool(...)"`/`onclick="removeSwimmer(...)"` strings hardwire global names
   into markup (and embed ids into strings — injection-fragile) → use `addEventListener` in builders.
4. Load-time side effects (`app.js:116` bootstrap, `clock.js:56` auto-mount, every editor IIFE,
   `touchDrag.js` self-install) mean *importing a file runs it* → move all bootstrapping into one
   composition root.
5. `Math.random()` animation delays (`poolAudio:41,53`) and `document.getElementById` re-lookups
   make rendering non-pure → pass the target element in.

---

## 3. The model to copy: the editors registry (extracted mechanics)

`editors/core.js` already implements the exact plugin architecture the rest of the app needs:

```
KINDS = []                              // the registry store
register(test, title, render)           // editors self-register at file end (IIFE)
openForTwist(twist):
    name   = twist .twist-title text
    kind   = KINDS.find(k => k.test(name))   // first match wins
    if !kind: return false                    // → caller falls back to generic modal
    open(title, color, body => kind.render(body, twist, config))   // render(body, twist, config) contract
```
Plus a **deep-link router** (`setHash`/`openFromHash`/`pending`/`resolvePending`/`notifyRendered`)
that arms a request and retries it on every lazy render. **Keep the `render(body, model, config)`
contract**; generalize the rest (see §4.2). The one weakness: `test` is a loose regex on a display
name — replace with `{id, priority, match}` for deterministic resolution.

---

## 4. Target architecture

### 4.1 Decision: move to **native ES modules** (no build step)
Switch `<script src>` → `<script type="module">` with real `import`/`export`. Works in every
modern browser with zero tooling. This is what makes files **importable and standalone**, kills the
`typeof` guards and the hand-sorted script order, and enables unit tests. The Service Worker
(`sw.js`) and lazy-loading already in place are unaffected (module scripts are still cacheable).

### 4.2 Conventions: **module manager + handler per folder**
Every feature folder follows the same shape (the editors pattern, formalized):

```
feature/
  index.js        ← public entry: exports the manager; the ONLY thing outsiders import
  manager.js      ← module manager: owns lifecycle, registry instance, wiring, DI
  handler.js      ← per-folder handler: turns raw input (DOM/events/data) into the feature's model
  <Thing>.js      ← one unit per file (a builder, a renderer, a pure util)
  builders/…      ← DOM builders for this feature
  feature.css     ← styles extracted from CSS-in-JS (still no build needed)
```
- **Manager** = the façade + state owner (e.g. `TopBar`, `Editors`, `DragManager`). Instantiable, DI'd.
- **Handler** = the input adapter (e.g. `gatherSources`+`parseConfig`+`channelsFor` → a model;
  the drop event → a `routeDrop(model)` call). Pure, testable.
- **Registry** = a shared `createRegistry({key})` factory used by every plugin family.

### 4.3 Proposed folder layout
```
js/
  core/
    state.js              AppState store (selectedPoolNodes, currentTwist, drag-src…) — replaces 5 globals
    registry.js           createRegistry({key}) — generalized from editors/KINDS
    bootstrap.js          the ONE composition root (DOMContentLoaded → App.init); only side-effect site
    net/ fetchJSON.js, listDirectory.js
  util/
    color.js              shadeColor, styleSignalNode, hexToRgb
    dom.js                slugId, faultTag, tagOrigin, setFoldIcon, ensureStyle(id,css)
    palette.js            LCARS named colors + AUDIO/SOURCE/DEST/TAB arrays
    time.js               formatTimecode, formatUnix
  ui/                     ← shared widget/builder library (importable, CSS ships with each widget)
    Knob.js Fader.js Meter.js Pill.js ButtonGroup.js Section.js Card.js Chip.js ToggleButton.js
    SignalNodeBuilder.js
  pools/
    index.js  manager.js (PoolRegistry: inferPoolKind + dispatch)
    PoolRenderer.js       base (template method)
    VideoPool.js AudioPool.js PlayoutPool.js ProductionInputsPool.js
    builders/ poolHeader.js multiplexNode.js
  sources/
    index.js  SourcesManager.js (owns IO ports + palette)  SourceTree.js (per-folder handler, lazy)
  destinations/
    index.js  DestinationsManager.js (addDestinationTree + loadAll)  activateTab.js
  programs/
    ProgramTabRenderer.js (renderPrograms, split from productions.js)
  twist/
    twistConfig.js twistLimits.js cloneSourceNode.js ensureDropZone.js
    TwistController.js (initializeTwists, placeSourceInTwist)
  visuals/
    dnaSvg.js (pure getDNAHtml)  twistVisuals.js (updateTwistVisuals split: layout vs render)
  drop/
    dropRouter.js (the matrix.js:83-180 closure → routeDrop({twist,ids,sourceType}))
    droppedGroup.js  autoPopulate.js (autoPopulateRoom + initRoomDrops)
  modal/
    SwitcherMatrixModal.js (open/close/removeSwimmer/syncTwistOrder)
    matrixRowDnd.js  inputAssignDnd.js  matrixRowBuilder.js
  dnd/                    ← unified drag-and-drop module manager
    DragManager.js        owns DND_TYPES contract; registerDropTarget(el,{onDrop,accepts})
    poolSelection.js      PoolSelection (encapsulates selectedPoolNodes/lastClickedNode)
    draggableSource.js    makeNodeDraggable/initializeDraggables/toggleProdOutput
    touchDragBridge.js    touchDrag.js → init(options)
  topbar/
    index.js TopBar.js (instantiable: createTopBar({tabsEl,contentEl,onTabSwitch}))
    Group.js Tab.js IdleCollapse.js styles.js
  editors/                ← already close; split core.js into:
    manager.js (registry+overlay+deep-link)  handler.js (model adapter: gatherSources/grouped/channelsFor)
    deepLinkRouter.js  core widgets move to ui/
    vision-mixer.js multi-viewer.js audio-mixer.js intercom.js iso-recorder.js
  clock/
    PtpClock.js (class: mount/start/stop)  format.js
```

### 4.4 Keystone abstractions
1. **`createRegistry({key})`** — one factory, many registries: `Editors`, `Pools`, `DropTargets`,
   `Destinations`. Resolution by `{id, priority, match}` (deterministic) not loose regex.
2. **`DragManager`** — single owner of the `DataTransfer` contract; `registerDropTarget(el, {onDrop,
   accepts})`. Twist drops, room drops, **and the modal row/input reorders** all register through it,
   which automatically gives the modal DnD touch support it lacks today.
3. **`PoolRenderer` base + `SignalNodeBuilder`** — kills the 4-way pool duplication and all the
   HTML-string node construction + manual attribute escaping.
4. **`ui/` widget library** — one implementation each of knob/fader/meter/pill/button-group/section,
   CSS shipped with the widget. Editors shrink to `register(...)` + a pure `render(body, model)`.
5. **`AppState`** — the only mutable shared state, with getters/setters.

---

## 5. Step-by-step migration plan (incremental, low-risk, always shippable)

Each phase is independently shippable and keeps the app working. Do them in order; commit per phase.

**Phase 0 — Safety net (½ day).** Add a smoke test harness (the Puppeteer probes already used in
this project: load page, expand a floor, open each editor, drag a stage box → assert drop). Run it
after every phase. *No code moves yet.*

**Phase 1 — Extract pure utils (low risk).** Create `util/color.js`, `util/dom.js`, `util/palette.js`,
`util/time.js`, `core/net/*`. Move `shadeColor`, `styleSignalNode`, `slugId`, `faultTag`, `hexToRgb`,
`formatTimecode`, palettes, `fetchJSON`, `listDirectory`. Have the old globals *re-export* from the new
modules so nothing else changes yet. Delete duplicate copies.

**Phase 2 — Adopt ES modules + `AppState`.** Flip `index.htm` to `<script type="module">` and add
`import` statements; introduce `core/state.js` and replace the 5 shared globals. Remove all `typeof`
guards (no longer needed — imports are resolved). This is the structural turning point.

**Phase 3 — `ui/` widget library.** Build `Knob/Fader/Meter/Pill/ButtonGroup/Section/Card/Chip/
ToggleButton`, each with its own scoped CSS. Refactor the 5 editors to consume them; delete the
duplicated CSS-in-JS. Editors become pure `render(body, model)`.

**Phase 4 — Pool base + SignalNodeBuilder.** Introduce `PoolRenderer` + `pools/builders/*` +
`SignalNodeBuilder`; reimplement Video/Audio/Playout/ProductionInputs on top. Normalize the renderer
signatures behind `PoolRegistry.renderLeaf(data, container, {color})`.

**Phase 5 — Split `matrix.js`.** Carve into `twist/`, `drop/`, `modal/` modules (see §4.3). Extract
`getTwistConfig`, `cloneSourceNode`, `ensureDropZone`, `dropRouter`, `droppedGroup`, `autoPopulate`.
`matrix.js` disappears.

**Phase 6 — Unified `DragManager`.** Merge `dragDrop.js` + `touchDrag.js` + the modal DnD under one
manager that owns `DND_TYPES` and `registerDropTarget`. Encapsulate `PoolSelection`. Modal DnD now
works on touch.

**Phase 7 — Registry generalization + managers/handlers.** Promote `createRegistry`; give `pools/`,
`sources/`, `destinations/`, `editors/` each a `manager.js` + `handler.js` + `index.js`. Wire
everything through `core/bootstrap.js` with explicit DI (`App.init({ topBar, net, sources, ... })`).

**Phase 8 — Topbar & clock as instances.** `createTopBar(...)` instance (inject `onTabSwitch`,
removing the `switchTab` global). `PtpClock` class with `start/stop`. Move CSS to stylesheets.

**Phase 9 — Cleanup.** Delete dead code (`productions.js:52` `twists`, possibly `app.js makeMediaGroup`
if unused), remove inline `onclick` strings in favor of builder-attached listeners, finalize the
single bootstrap as the only load-time side effect.

---

## 6. Per-folder manager / handler responsibilities (quick reference)

| Folder | Manager owns | Handler owns |
|---|---|---|
| `dnd/` | `DragManager`: the `DataTransfer` contract, source wiring, touch bridge install order, `registerDropTarget` | `dropRouter.routeDrop(model)` — multiplex-chip vs group-by-origin vs append |
| `editors/` | registry + overlay lifecycle + deep-link router; the only outside-facing API | model adapter: `gatherSources`/`gatherGrouped`/`channelsFor`/`parseConfig` → model |
| `pools/` | `PoolRegistry` (kind → RendererClass) | per-leaf render via `PoolRenderer.buildContent` |
| `sources/` | `SourcesManager`: palette + IO ports (`fetchJSON`/`listDirectory` injected) | `SourceTree`: recursion + lazy-load lifecycle, emits `poolsRendered` (no direct `initializeDraggables`) |
| `destinations/` | `DestinationsManager`: `addDestinationTree`, `loadAll`, colors | `activateTab`: fetch + render one program lazily |
| `topbar/` | `TopBar` instance: groups/tabs/accordion | `IdleCollapse` handler |
| `twist/` | `TwistController`: init + place + limits | `twistConfig`/`ensureDropZone`/`cloneSourceNode` |

---

## 7. Risks & sequencing notes
- **Biggest risk is Phase 5** (matrix split) — it touches the most behavior. Land Phases 1-4 first so
  the utils/widgets it depends on already exist; lean on the Phase 0 smoke tests.
- **Behavioral parity to preserve:** idempotent init guards (`dataset.dragWired/initialized/roomDrop`),
  the `isTrusted` handshake between `topbar` auto-select and `loadAllDestinations`, the lazy
  `notifyRendered` deep-link retry, the Service-Worker cache versioning.
- **Don't regress the touch bridge** — it couples *only* through the DataTransfer contract; keep that
  seam intact when building `DragManager`.
- Keep each phase shippable; never let a refactor branch live longer than one phase.
