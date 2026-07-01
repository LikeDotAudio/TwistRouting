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

### The framework (`js/editors/core.js`)

Every editor is a self-contained module that **registers itself** with a shared dispatcher.
There is no central switch statement — `core.js` keeps a registry and matches twists to
editors by name:

```js
// Each editor file calls this once, at import time:
register(test, title, render)
//   test(name)  → true if this editor handles a twist with that title
//   title       → the heading shown on the editor's LCARS rail
//   render(body, twist, config) → builds the editor UI into `body`
```

The flow when you click a twist:

```
matrix.js  openTwistModal(twist)
   └─► core.js  openForTwist(twist)
          ├─ find first KIND whose test(twistName) matches
          ├─ open full-screen overlay, set LCARS colour + title
          ├─ call that editor's render(body, twist, config)
          ├─ Auth.applyScope(body)   ← hide controls the role can't use
          └─ (no match? ) → matrix.js generic switcher-matrix fallback modal
```

`core.js` also provides the **shared toolkit** every editor builds from, so they look and
behave consistently:

| Helper | What it gives you |
| --- | --- |
| `addStyles(id, css)` | inject an editor's CSS chunk once |
| `gatherSources(twist)` | the source feeds routed into this twist (expands dropped groups) |
| `channelsFor(twist, …)` | real routed sources, else the twist's input slots, else N defaults |
| `parseConfig(twist)` | the twist's JSON config from its `data-config` attribute |
| `knob(label, val, color)` | a reusable drag-rotary control |
| `meterBar(cls)` | a self-animating level meter |
| `pushTimer(id)` | register an interval so it's cleaned up on close |

Other shared niceties baked into the chrome: the **entire top bar is an "escape bar"** (click
anywhere on it, or press Esc, to go back), and editors **deep-link** via the URL hash
(`#/<production>/<twist>`) so an open editor is bookmarkable and survives reload.

### Roles & access (`js/auth.js`, `js/schedule.js`)

The app boots logged in as **Captain** (full control) with a LOG OUT / SWITCH ROLE flow.
Each role carries a **capability set**; editors tag controls with `data-cap="<capability>"`,
and `Auth.applyScope()` — called on every editor open — **hides** any control the current
role lacks (progressive disclosure, not greyed-out locks). `window.can(cap)` exposes the same
check to code.

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

`schedule.js` is the surface of the intended **Schedule → Timeline → Resource-Booking** model:
a day's timeline of shows with assigned rooms and booked crew. The vision is that booked roles
load each operator's scope automatically, rather than hard-coding it. (Today only the camera
editor's Shading card is gated, via `data-cap="shade"` — the rest of the matrix is scaffolding
ready to be applied.)

---

### Video & switching

| Editor | File | Opens on twist named… | Title |
| --- | --- | --- | --- |
| Vision Mixer | `vision-mixer.js` | `vision`, `video mix`, `switch` | VISION MIXER |
| Multi Viewer | `multi-viewer.js` | `multi view` | MULTI VIEWER · LAYOUT MAKER |
| ISO Recorder | `iso-recorder.js` | `iso`, `replay` | ISO RECORDER · INSTANT REPLAY |

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
| Audio Mixer | `audio-mixer.js` | `audio mix` | AUDIO MIXER · CONSOLE |
| Audio Monitor | `audio-monitor.js` | `audio monitor`, `AFV`, `confidence` | AUDIO MONITOR · CONFIDENCE |
| Intercom | `intercom.js` | `intercom`, `comm` | INTERCOM · KEY PANEL |
| IFB | `ifb.js` | `ifb`, `foldback` | IFB · INTERRUPTIBLE FOLDBACK |

- **Audio Mixer** — a finger-friendly console: wide channel strips (fader + dB, VU, mute/solo,
  EQ, pan, two aux banks for mix-minus and monitoring), an LCARS layer rail, group buses that
  spill to child channels, and a pinned master tab. **Connects out** to the Stage Box editor:
  the "⚙ STAGE BOX" button calls `window.openStageBox(...)` to reach per-channel preamp gains.
- **Audio Monitor** — a confidence monitor scaling 1–24 channels across SDI quad-blocks, with
  PPM/VU ballistics + peak-hold, per-block phase (Lissajous) correlation, and an ITU-R BS.1770
  loudness master (LUFS, true-peak, −23 LUFS history plot).
- **Intercom** — the comms key panel: TALK/LISTEN per key with volume, gangable talk groups,
  and status cards for IFB, beltpacks, and the matrix. It is the **source layer** for IFB
  interrupts.
- **IFB** — assembles the talent earpiece feed: **mix-minus** (program minus the talent's own
  mic, to kill echo) plus the director's **interrupt**. Ducker graph, program/interrupt/threshold
  encoders, and a 3-tier talk priority hierarchy. Receives talk keys from Intercom.

### Camera (`camera-control.js` + the `camera/` module set)

Opens on twist named `cam` / `camera` → **CAMERA CONTROL · CCU / RCP**. This is the most
elaborate editor, so it's split into a small module set that `camera-control.js` composes.
It manages **8 cameras** (`Array.from({length: 8}, mkState)`), with the active camera's state
driving every panel each frame.

| Module | Responsibility / exports |
| --- | --- |
| `camera/state.js` | `mkState()` per-camera state (pan/tilt/zoom/dolly/ped, iris, gains, blacks, gamma, shutter, presets) + `clamp()` |
| `camera/styles.js` | `CSS` — the whole CCU stylesheet, injected once |
| `camera/scopes.js` | `drawParade()` RGB waveform + `drawVectorscope()` — colour verification scopes |
| `camera/bars.js` | `drawSMPTE()` precision colour bars + `stepDVD()` bouncing lineage badge |
| `camera/maps.js` | `topSVG()`/`sideSVG()` studio robotics maps + `updateMaps()` (camera + FOV cone) |
| `camera/controls.js` | builders: `buildJoystick` (5-axis), `buildShading` (iris/gamma/gain + RGB-Venn), `buildTally` (8-cam), `buildPresets`, `buildFunctions` |

A shared `ctx` object threads the active camera's state and UI flags through every builder so a
control change ripples instantly to the scopes, maps, and parade. The **Shading Encoders card
is gated behind `data-cap="shade"`** — only the Chief Engineer (or Captain) sees it.

### Signal & infrastructure

| Editor | File | Opens on twist named… | Title |
| --- | --- | --- | --- |
| Encoder | `encoder.js` | `encoder`, `transcod`, `stream(ing) out`, `elemental` | ENCODER · TRANSCODING ENGINE |
| Signaling | `signaling.js` | `signal`, `tally`, `on-air` | SIGNALING · TALLY & TRIGGERS |
| Stage Box Input | `stagebox-input.js` | `stage box`, `preamp`, `mic input` | STAGE BOX INPUT · SMART OBJECT |
| Lighting | `lighting.js` | `light(ing)`, `key/fill/back light`, `cyc`, `gobo`, `dmx`, `fixture` (not `on-air`) | LIGHTING · DMX CONSOLE |
| WYSIWYG | `wysiwyg.js` | `wysiwyg`, `pre-viz`, `visualizer` | WYSIWYG · STUDIO PRE-VIZ |

- **Encoder** — a transcoding/streaming engine: 1:1 mezzanine in, one-to-many **ABR ladder**,
  RTMP/SRT destination vault, ST 2022-7 hitless failover, AES-128/DRM, live stream health.
  Auto-configures from the video/audio actually routed into the twist.
- **Signaling** — distributes **tally** from the vision mixer across 8 cameras (red PGM /
  green PVW / amber ISO), drives the studio On-Air light, switches Live/Rehearsal, and acts as
  a GPI/SCTE trigger panel with an event log. (Renamed from the old "Encoder" twist.)
- **Stage Box Input** — a "smart object" for a physical console input: preamp gain/headroom,
  interlocked +48V phantom (Smart-Verify guards ribbon mics), impedance match, cable HF comp,
  PPM history. Exposes `window.openStageBox()` — the entry point the **Audio Mixer** calls.
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
Audio Mixer ──window.openStageBox()──►  Stage Box Input (per-channel preamp)
Lighting (DMX state) ◄── mirrors ──►  WYSIWYG (pre-viz of the same rig)
camera-control.js  ──composes──►  camera/{state,styles,scopes,bars,maps,controls}.js
multi.js  renderGridOfSiblings()  ◄── used by Audio Monitor & IFB to tile sibling twists
```

Everything else flows through the shared `core.js` toolkit and the routed-source data — change
a patch on the map and every editor that reads from that twist reflects it.

---

## Data model

Everything is plain JSON under two roots:

```
Sources/        # draggable signals
  Audio/<Floor>/<box>.json
  Video/<Floor>/<box>.json
  Productions/<program>.json
Destinations/   # twists that consume signal
  Control Rooms/<tier>/<room>.json
  Edit Suites/<suite>.json
  Encoders/<encoder>.json
  Floors/<floor>/<room>.json
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

Local, no dependencies (uses Python's stdlib server, which provides the autoindex fallback):

```bash
python3 start.py        # serves the UI and opens your browser on a free port
```

Build the TypeScript app and deploy it to a static host over FTPS:

```bash
npm run deploy          # npm run build → upload dist/ + Routes/ → remove legacy js/
npm run deploy:all      # same, but upload the ENTIRE Routes tree (first cutover / full push)
```

`deploy.py` builds the app, regenerates every `Routes/**` `index.json` manifest, then uploads the
built bundle (publishing the entry as `/index.htm`, the site default document), uploads the
`Routes/` data (**only what changed** per `git status`, or all with `--all`), and removes the
retired legacy `js/` shell + `sw.js` from the server. FTP credentials come from a local `.env`
(`FTP_HOST`, `FTP_USER`, `FTP_PASS`). Flags: `--no-build` (deploy existing `dist/`), `--no-clean`
(leave legacy files on the server).

### Front-end layout

The app is plain HTML/CSS/JS — native ES modules, no framework, no build step. `js/main.js` is
the import root; `sw.js` caches the shell for offline use (bump `CACHE_VERSION` + the `?v=` query
to ship an update).

```
index.htm                     # shell + all the LCARS styling
js/main.js                    # import root: pulls in every editor + the app bootstrap
js/app.js                     # boot: build the tree, wire everything up
js/globals.js                 # discovery (listDirectory/fetchJSON), folding, tabs
js/matrix.js                  # twists, routing, fault logic, generic switcher modal
js/visuals.js                 # the DNA-helix SVG rendering
js/dragDrop.js / touchDrag.js # drag-and-drop patching (mouse + touch)
js/poolVideo.js / poolAudio.js / productions.js   # render the source pools
js/topbar.js                  # destination tabs / groups
js/auth.js / js/schedule.js   # role gateway + production schedule
js/editors/core.js            # editor framework: register/open/dispatch + shared toolkit
js/editors/*.js               # the editors documented above
js/editors/camera/*.js        # the camera-control module set
```

See [`docs/ARCHITECTURE-AUDIT.md`](docs/ARCHITECTURE-AUDIT.md) for the modularization history.

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
(lcarsmania.com, Toshitin) and live in [`lcars-styleguide.json`](lcars-styleguide.json) —
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
