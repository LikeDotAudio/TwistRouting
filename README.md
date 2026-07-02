# TwistRouting — Anthony's Media Workflow Matrix

A browser-based **broadcast signal routing visualizer**, dressed in full LCARS regalia.
It maps the living signal flow of a multi-floor production facility — every stage box,
every camera, every audio channel — onto destinations like control rooms, edit suites,
encoders, and floor rooms. You drag a source onto a destination's input, and the patch
comes alive as a twisting strand of DNA.

The "twist" is the metaphor and the mechanic: each routing point is a **twist**, and the
signals you braid into it are rendered as an animated double helix — two strands (cyan and
magenta) spiraling around each other, the way two feeds wind together into one production.
Route a healthy source and the helix flows clean; route a faulted one and the strand
**corrupts**, flickering red.

But a twist is more than a patch point. **Open a twist and you drop into a full role-specific
control surface** — a vision mixer with a T-bar, a CCU shading console with waveform scopes,
a DMX lighting board, an IFB mix-minus rack. The patch panel is the map; the editors are the
rooms. The rest of this document is mostly about those rooms.

---

## What it does

- **Sources** (left ingress panel) — draggable signal nodes, discovered dynamically from the
  `Sources/` tree: video stage boxes, audio stage boxes (channel banks), and **Productions**
  (finished program outputs re-exposed as routable sources). Shape encodes category: video
  reads as a trapezoid, audio as a rounded pill, group containers stay square.

- **Destinations** (footer tabs) — consumers of signal, discovered from the `Destinations/`
  tree. Each category (Control Rooms, Edit Suites, Encoders, Floors…) becomes a tab group;
  each room is a tab full of **twists**.

- **Patching** — drag a source onto a twist. The helix grows to show what's braided in; click
  the LCARS lip to fold/unfold the strand.

- **Editing** — click a twist to open its dedicated editor full-screen (see [The editors](#the-editors)).
  Twists with no matching editor fall through to a generic switcher-matrix modal where you
  drag rows to reorder priority and switcher-input assignments.

- **Fault propagation** — any source whose `status` isn't `OK` (e.g. `LOST CLOCK`) pulses red,
  and every destination it's routed into inherits the alarm, end-to-end.

- **Role-based access** — a "single pane of glass" gateway (see [Roles & access](#roles--access))
  scopes which controls each operator sees.

- **Zero-backend discovery** — the whole source/destination tree is just folders of JSON.
  Drop in a new stage box or control room and it appears in the UI; no code change. Discovery
  prefers an `index.json` manifest per folder (works on any static host) and falls back to
  parsing autoindex HTML.

---

## The editors

### The framework (`src/editors/registry.ts` + the `EditorPlugin` contract)

The app is **TypeScript**, built with Vite. Every editor is a self-contained package —
`src/editors/<name>/index.ts` — whose default export is one `EditorPlugin`. `registry.ts`
**globs them at build time**, so adding an editor is "drop a folder", with zero edits anywhere
else:

```ts
// src/editors/<name>/index.ts default-exports one of these:
interface EditorPlugin {
  id: string;
  match(twistName: string): boolean;   // does this editor handle that twist?
  title: string;                        // heading on the editor's LCARS rail
  order?: number;                       // dispatch precedence for overlapping matchers
  requiredCaps?: Capability[];          // role gate (hidden if unmet)
  render(host: HTMLElement, ctx: EditorContext): void;
}
```

The key inversion (vs. the retired JS app): an editor **never scrapes the DOM**. It receives a
fully-resolved, typed `EditorContext` — the routed feeds, siblings, production, role check, and
cross-editor services — as *data*. Editors are pure functions of `data → UI`.

The flow when you click a twist:

```
twist click  →  app/main.ts openEditorForTwist(twistEl)
   ├─ registry.ts pluginFor(twistName)         # first plugin whose match() wins (by order)
   ├─ app/context.ts buildContext(...)          # resolve feeds → typed EditorContext
   ├─ platform/overlay.ts openOverlay(...)       # full-screen LCARS overlay + #/<prod>/<twist> hash
   ├─ gate on plugin.requiredCaps (ctx.can)      # ACCESS DENIED if the role lacks a cap
   ├─ plugin.render(host, ctx)                   # build the editor from data
   └─ applyScope(host)                           # hide [data-cap] controls the role can't use
```

Layering is a rule (`domain → model → platform → ui → editors → app`); a layer imports only
from above it, **editors never import editors**, and there are **no `window.*` globals**.
The **shared UI toolkit** lives in `src/ui/`:

| Module | What it gives you |
| --- | --- |
| `ui/dom.ts` | `el()` typed element builder, `qs()` (throws, non-null), `addStyles()` |
| `ui/widgets.ts` | `knob()`, `fader()`, `meter()` (animated, disposer-driven) |
| `ui/timers.ts` | a per-editor `Disposer` — register intervals/rAF, torn down on close |
| `ui/scopes.ts` | RGB parade + vectorscope; `ui/audio-scope.ts`, `ui/loudness.ts` |
| `EditorContext` | `sources`, `siblings`, `production`, `can(cap)`, `services`, `dispose` |

Other niceties baked into the chrome: the **entire top bar is an "escape bar"** (click anywhere,
or press Esc, to go back), and editors **deep-link** via the URL hash (`#/<production>/<twist>`)
so an open editor is bookmarkable, shareable, and survives reload (lazy-loads its destination).

### Roles & access (`src/platform/auth.ts` + `ui/console/auth-panel.ts`, `ui/console/schedule.ts`)

The app boots logged in as **Captain** (full control) with a LOG OUT / SWITCH ROLE flow (the
top-right badge). Each role carries a **capability set**; `platform/auth.ts` `can(cap)` decides
access (admin implies all), editors declare `requiredCaps` and/or tag controls with
`data-cap="<capability>"`, and `applyScope()` — called on every editor open — **hides** any
control the current role lacks (progressive disclosure, not greyed-out locks).

| Capability | Meaning | Held by (role) |
| --- | --- | --- |
| `admin` | full facility control (implies all) | Captain · Executive Producer |
| `switch` | vision mixing / switcher | First Officer · Director; Conn · TD |
| `route` | signal routing & resource mgmt | Conn · TD; Ops |
| `signal` | signal path & health | Director; Ops |
| `shade` | colour science / CCU shading | Chief Engineer · Shader |
| `gfx` | graphics & AR overlays | Tactical |
| `comms` | intercom matrix & talkback | Comms |
| `audio` | audio mixing | Comms |
| `book` | resource booking | Ops |
| `view` | view-only analytics | Science |

`ui/console/schedule.ts` (opened from the clock's seconds-dots) is the surface of the intended
**Schedule → Timeline → Resource-Booking** model:
a day's timeline of shows with assigned rooms and booked crew. The vision is that booked roles
load each operator's scope automatically, rather than hard-coding it. (Today only the camera
editor's Shading card is gated, via `data-cap="shade"` — the rest of the matrix is scaffolding
ready to be applied.)

---

### Video & switching

| Editor | File | Opens on twist named… | Title |
| --- | --- | --- | --- |
| Vision Mixer | `editors/vision-mixer/` | `vision`, `video mix`, `switch` | VISION MIXER |
| Multi Viewer | `editors/multi-viewer/` | `multi view` | MULTI VIEWER · LAYOUT MAKER |
| ISO Recorder | `editors/iso-recorder/` | `iso`, `replay` | ISO RECORDER · INSTANT REPLAY |

- **Vision Mixer** — a broadcast switcher: central **T-bar** between PROGRAM and PREVIEW
  monitors, bus source selection, transition styles (CUT / MIX / WIPE), and downstream keyers
  for lower-thirds and logos. This is the surface that *drives* tally — its PGM/PVW state is
  what the Signaling editor distributes.
- **Multi Viewer** — a configurable monitor wall (2×2 → 16×16, plus PiP). Drag tiles to
  reorder, cycle each window's tally state, and edit UMD labels inline.
- **ISO Recorder** — per-camera clean recording (timecode, disk space) paired with an instant
  **replay** engine: rolling buffer, jog/shuttle, angle select, variable speed, mark-to-air.

### Audio & comms

| Editor | File | Opens on twist named… | Title |
| --- | --- | --- | --- |
| Audio Mixer | `editors/audio-mixer/` | `audio mix` | AUDIO MIXER · CONSOLE |
| Audio Monitor | `editors/audio-monitor/` | `audio monitor`, `AFV`, `confidence` | AUDIO MONITOR · CONFIDENCE |
| Intercom | `editors/intercom/` | `intercom`, `comm` | INTERCOM · KEY PANEL |
| IFB | `editors/ifb/` | `ifb`, `foldback` | IFB · INTERRUPTIBLE FOLDBACK |

- **Audio Mixer** — a finger-friendly console: wide channel strips (fader + dB, VU, mute/solo,
  EQ, pan, two aux banks for mix-minus and monitoring), an LCARS layer rail, group buses that
  spill to child channels, and a pinned master tab. **Connects out** to the Stage Box editor:
  the "⚙ STAGE BOX" button calls `ctx.services.openStageBox(...)` to reach per-channel preamp gains.
- **Audio Monitor** — a confidence monitor scaling 1–24 channels across SDI quad-blocks, with
  PPM/VU ballistics + peak-hold, per-block phase (Lissajous) correlation, and an ITU-R BS.1770
  loudness master (LUFS, true-peak, −23 LUFS history plot).
- **Intercom** — the comms key panel: TALK/LISTEN per key with volume, gangable talk groups,
  and status cards for IFB, beltpacks, and the matrix. It is the **source layer** for IFB
  interrupts.
- **IFB** — assembles the talent earpiece feed: **mix-minus** (program minus the talent's own
  mic, to kill echo) plus the director's **interrupt**. Ducker graph, program/interrupt/threshold
  encoders, and a 3-tier talk priority hierarchy. Receives talk keys from Intercom.

### Camera (`src/editors/camera-control/` — a typed module set)

Opens on twist named `cam` / `camera` → **CAMERA CONTROL · CCU / RCP**. This is the most
elaborate editor, so it's split into a small module set that `index.ts` composes. It manages
**8 cameras**, with the active camera's state driving every panel each frame.

| Module | Responsibility / exports |
| --- | --- |
| `camera-control/state.ts` | `mkState()` per-camera state (pan/tilt/zoom/dolly/ped, iris, gains, blacks, gamma, shutter, presets) + `clamp()` |
| `camera-control/styles.ts` | the whole CCU stylesheet, injected once |
| `ui/scopes.ts` | `drawParade()` RGB waveform + `drawVectorscope()` — the shared colour-verification scopes (reused by Meter Input) |
| `camera-control/bars.ts` | `drawSMPTE()` precision colour bars + `stepDVD()` bouncing lineage badge |
| `camera-control/maps.ts` | `topSVG()`/`sideSVG()` studio robotics maps + `updateMaps()` (camera + FOV cone) |
| `camera-control/controls.ts` | builders: joystick (5-axis), shading (iris/gamma/gain + RGB-Venn), tally (8-cam), presets, functions |

A shared `ctx` threads the active camera's state and UI flags through every builder so a control
change ripples instantly to the scopes, maps, and parade. The **Shading Encoders card is gated
behind `data-cap="shade"`** — only the Chief Engineer (or Captain) sees it.

### Signal & infrastructure

| Editor | File | Opens on twist named… | Title |
| --- | --- | --- | --- |
| Encoder | `editors/encoder/` | `encoder`, `transcod`, `stream(ing) out`, `elemental` | ENCODER · TRANSCODING ENGINE |
| Signaling | `editors/signaling/` | `signal`, `tally`, `on-air` | SIGNALING · TALLY & TRIGGERS |
| Stage Box Input | `editors/stagebox-input/` | `stage box`, `preamp`, `mic input` | STAGE BOX INPUT · SMART OBJECT |
| Lighting | `editors/lighting/` | `light(ing)`, `key/fill/back light`, `cyc`, `gobo`, `dmx`, `fixture` (not `on-air`) | LIGHTING · DMX CONSOLE |
| WYSIWYG | `editors/wysiwyg/` | `wysiwyg`, `pre-viz`, `visualizer` | WYSIWYG · STUDIO PRE-VIZ |
| Meter Input | `editors/meter-input/` | `meter input` | METER INPUT · REAL-VIDEO TEST TOOLS |

- **Encoder** — a transcoding/streaming engine: 1:1 mezzanine in, one-to-many **ABR ladder**,
  RTMP/SRT destination vault, ST 2022-7 hitless failover, AES-128/DRM, live stream health.
  Auto-configures from the video/audio actually routed into the twist.
- **Signaling** — distributes **tally** from the vision mixer across 8 cameras (red PGM /
  green PVW / amber ISO), drives the studio On-Air light, switches Live/Rehearsal, and acts as
  a GPI/SCTE trigger panel with an event log. (Renamed from the old "Encoder" twist.)
- **Stage Box Input** — a "smart object" for a physical console input: preamp gain/headroom,
  interlocked +48V phantom (Smart-Verify guards ribbon mics), impedance match, cable HF comp,
  PPM history. Reached via the `services.openStageBox` context service the **Audio Mixer** calls.
- **Lighting** — a studio **DMX console** for a 3/4-point rig (Key/Fill/Back/Background) plus
  set lighting, with a top-down rig view, per-fixture intensity/colour-temp, scene recall, and
  a DMX-universe heartbeat.
- **WYSIWYG** — a top-down **pre-viz renderer** that mirrors the Lighting console's DMX state
  (beam cones, foot-candle heat-map, virtual talent + shadows, camera frustum, tally glow).
  The visual twin of the Lighting editor.

### How the editors connect

Most editors are self-contained surfaces driven by the sources routed into their twist, but a
few interact directly, and several share state by convention:

```
Vision Mixer ──(PGM/PVW tally)──►  Signaling ──►  camera tally bank
Intercom ─────(talk keys)───────►  IFB (mix-minus + interrupt → talent earpiece)
Audio Mixer ──ctx.services.openStageBox()──►  Stage Box Input (per-channel preamp)
Lighting (DMX state) ◄── mirrors ──►  WYSIWYG (pre-viz of the same rig)
camera-control/index.ts  ──composes──►  camera-control/{state,styles,bars,maps,controls}.ts + ui/scopes.ts
EditorContext.siblings  ◄── Audio Monitor & IFB tile sibling twists of the same kind
```

Cross-editor needs arrive as **typed services on `EditorContext`** (e.g. `services.openStageBox`),
never as `window.*` globals. Everything else flows through the routed-source data on the context —
change a patch on the map and every editor that reads from that twist reflects it.

---

## Data model

Everything is plain JSON under `Routes/`, discovered at runtime by `platform/discovery.ts`
(prefers an `index.json` manifest per folder; falls back to autoindex HTML). The renderer for a
source leaf is chosen from the **shape** of its data, not its folder — so a new file just appears:

```
Routes/Sources/        # draggable signals
  001_Sound/<Floor>/<box>.json     # audio stage boxes (channel banks)
  002_Video/<Floor>/<box>.json     # video stage boxes (cameras)
  003_Streams/…                    # YouTube/URL streams (video + stereo L/R)
  004_Play/…                       # playout banks
  005_Prod/<program>.json          # finished program outputs, re-exposed as sources
Routes/Destinations/   # twists that consume signal
  001_Control Rooms/<tier>/<room>.json
  002_Floors/<floor>/<room>.json
  003_Encoders/<encoder>.json
  004_Edit Suites/<suite>.json
  005_TEST TOOLS/…                 # e.g. the Meter Input real-video/audio scope bench
```

A **source** declares its channels, a colour class, a floor, and a `status`:

```json
{ "id": "stagebox-101", "name": "STAGEBOX 101", "prefix": "S101-", "count": 12,
  "extraClass": "audio-studio", "floor": "1st Floor", "items": ["CH 1", "…"],
  "status": "LOST CLOCK" }
```

A **destination** declares its twists. Each twist's `name` is what routes it to an editor (per
the tables above); `accepts` is `video` / `audio` / `both`; `inputs` and `maxVideo` / `maxAudio`
bound the switcher:

```json
{ "id": "prod3", "name": "PROD 3", "color": "#646DCC",
  "twists": [
    { "name": "Video Mixer", "accepts": "video", "inputs": ["SW IN 1", "…"] },
    { "name": "CAM 1", "accepts": "camera", "maxVideo": 1, "cameraInput": true },
    { "name": "Signaling", "accepts": "both" }
  ] }
```

## Running it

The app is **TypeScript**, built with **Vite**. Dev/test needs Node; the built app is a static
bundle that runs on any host.

```bash
npm install
npm run dev             # Vite dev server → open /index.next.html
npm run typecheck       # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm test                # vitest (routing-core + editor-dispatch tests)
npm run build           # → dist/  (content-hashed bundle + entry)
```

Deploy to a static host over FTPS:

```bash
npm run deploy          # build → publish the TS bundle as /index.htm (the cutover)
npm run deploy:all      # same, plus upload the ENTIRE Routes tree (first push)
npm run deploy:next     # SAFE side-by-side: publish as /index.next.html (leaves / untouched)
```

`deploy.py` builds the app, regenerates every `Routes/**` `index.json` manifest, then over one
FTPS connection uploads the content-hashed bundle (entry published as `/index.htm`, the site
default document) and the `Routes/` data (**only what changed** per `git status`, or all with
`--all`). Credentials come from a local `.env` (`FTP_HOST`, `FTP_USER`, `FTP_PASS`). Flags:
`--no-build`, `--no-clean`, `--next` (side-by-side).

### Layout (`src/` — layered TypeScript)

A layer imports only from the layers above it. No `window.*` globals; editors never import editors.

```
src/
  domain/routing-core/   # pure logic: take/clear/feedsInto/salvo/tally/mixMinus (+ tests)
  model/                 # the typed data shapes (Production, TwistConfig, SourceLeaf, Role…)
  platform/              # discovery (manifest/autoindex), overlay + deep-link hash, auth state
  ui/                    # dom/widgets/timers/scopes/loudness + console/ (the LCARS shell) + sources/
    console/             # footer tabs, destinations, matrix (DnD + drop), DNA helix, clock,
                         #   auth-panel, schedule, mission, portals, captains-log, dest-selector,
                         #   router-view (1990s), source-filter, lcars-pulse
    sources/             # the ingress panel: panel/pools/media-group/format/interact
  editors/               # one plugin package per editor (registry.ts globs them) + dispatch test
  app/                   # main.ts composition root + context.ts (twist → EditorContext)
index.next.html          # the entry (loads /src/app/main.ts in dev; the built bundle in prod)
lcars.css                # the shared LCARS stylesheet
```

The retired plain-JS app (the original `js/` tree, `index.htm`, `sw.js`) is preserved under
[`archive/`](archive/) for reference — nothing there is imported, built, or deployed. See
[`docs/TYPESCRIPT-WASM-REPORT.md`](docs/TYPESCRIPT-WASM-REPORT.md) §A.8 for the rebuild, and
[`docs/ARCHITECTURE-AUDIT.md`](docs/ARCHITECTURE-AUDIT.md) for the modularization history.

---

## Homage to the LCARS designers

This project is a love letter to **LCARS** — the *Library Computer Access/Retrieval System* —
the operating-system aesthetic of the 24th century. None of this look would exist without the
artists who invented it:

- **Michael Okuda**, scenic art supervisor for *Star Trek: The Next Generation*, *Deep Space
  Nine*, *Voyager*, and the films — the man who designed LCARS itself. The sweeping rounded
  "elbows," the flat candy-coloured panels, the confident typography, the idea that a starship
  interface could be *calm* — that's all Okuda. The fan community named the style the
  **"Okudagram"** in his honour, and this app's palette is taken straight from an Okudagram
  colour reference.
- **Denise Okuda**, scenic artist and video supervisor, Mike's collaborator and co-author of
  the *Star Trek Encyclopedia* — half of the partnership that made the future legible.
- **Rick Sternbach**, senior illustrator and technical consultant, who with Mike Okuda gave the
  hardware its grammar (the *Technical Manual*) so every readout felt like it meant something.
- **Gene Roddenberry**, for the conviction that the future's tools should look like they were
  built for people, not against them.

The colours here are credited to the *Okudagrams Color Complete Set Ver. 4.1*
(lcarsmania.com, Toshitin) and live in [`archive/lcars-styleguide.json`](archive/lcars-styleguide.json) —
LCARS Orange, Lilac, Blue Bell, Tomato, Sunflower, Red Alert, and the rest — used exactly as
intended: as flat, functional, beautiful blocks of information.

To Mike, Denise, Rick, and everyone who ever lined up a perfect LCARS elbow at 2 a.m. so a
panel would read right on camera — thank you. We're still trying to live up to the future
you drew.

> *"Tea. Earl Grey. Hot."* — and a clean signal path.

---

Created by **Anthony Peter Kuzub** · [like.audio/20260627/twist-like-audio](https://like.audio/20260627/twist-like-audio/)

LCARS is a trademark/design associated with *Star Trek* and its rights holders. This is a
non-commercial fan tribute and a working engineering tool; no affiliation or endorsement is
implied.
