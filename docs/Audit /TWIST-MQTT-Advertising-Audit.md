# TWIST → MQTT Advertising Audit

**A path forward for the TWIST interface to advertise every room, route, resource, and Captain's Log event onto an MQTT topic tree — modelled on the OPEN-AIR `comMQTT` pattern, delivered as a TypeScript strategy.**

- **Date:** 2026-07-01
- **Scope:** `src/**` (the A.8 TypeScript build) of TwistRouting, vs. `/OPEN-AIR/FrontEnd/comMQTT` as the reference implementation.
- **Status:** IMPLEMENTED (2026-07-01). All phases P0–P4 shipped in `src/platform/mqtt/**` + taps in main/matrix/captains-log/meter-input, plus the `twist-mqtt-tree.html` diagnostic. Verified end-to-end against a live Mosquitto broker (rooms/twists/sources advertised, presence birth+LWT, crosspoints, and Captain's Log → `Twist/log/**`). Disabled by default; enable with `?mqtt=<host>` or the bottom-left MQTT chip.
- **Related:** [Flexible-Software-Media-Production-Requirements-Audit](./Flexible-Software-Media-Production-Requirements-Audit.md), [TwistRouting-vs-Requirements-Delta](./TwistRouting-vs-Requirements-Delta.md), `docs/TYPESCRIPT-WASM-REPORT.md`.

---

## 0. Executive Summary

The OPEN-AIR front-end (`comMQTT`) proves a pattern we want here: **a browser UI that mirrors its entire widget tree onto an MQTT broker, one topic per parameter, retained, so any subscriber — Python backend, a second browser, a diagnostic tree explorer — sees the live state of the console.** Its central trick is that **the topic hierarchy *is* the on-disk folder hierarchy**: `/Gui_Frames/.../0_Frequency/yak_frequency.json` becomes `OpenAir/Gui/Spectrum/YAK/N9340B/Frequency`.

TWIST already has the two halves of that trick and does not know it:

1. **A folder-derived resource tree.** `src/platform/discovery.ts` walks `Routes/Sources/**` and `Routes/Destinations/**` via `index.json` manifests — the exact same "folder path is the schema" model comMQTT uses. We can build a topic from a discovery path with almost no new logic.
2. **An event that narrates every state change.** `src/ui/console/captains-log.ts` runs a `MutationObserver` over the destinations pane and produces one structured entry per routing change ("The destination of PGM-1 … received the CAM 4 by the user at …"). That is *already* a server-event stream; it simply has no wire.

TWIST is missing only the wire and the publish discipline. This audit proposes a self-contained TypeScript module, **`src/platform/mqtt/` (the "TwistBus")**, that:

- connects to a broker over WebSockets (`mqtt.js`), with a per-session identity, birth/heartbeat/last-will, and reconnect — a faithful TS port of `MqttProvider.jsx`;
- on boot, runs an **advertisement pass** that enumerates every source, destination, twist and its parameters, and publishes a **retained `…/config` metadata message per node** — this is the "advertise all parameters in the rooms" requirement;
- exposes a typed **`publish(topicSuffix, value)` / `subscribe(topic, cb)`** surface that editors receive through `EditorContext.services`, so any editor (meter-input, audio-mixer, camera-control, …) can push its live parameters without touching the DOM or a `window` global;
- taps the **Captain's Log** so every routing narrative is republished as a retained event on a `Twist/log/**` topic — "topics in every … Captain's Log".

The design deliberately reuses TWIST's existing seams (the plugin `EditorContext`, the pure `routing-core` graph, the discovery walker, the auth capability gate) rather than bolting on a parallel state system. **No new source of truth is introduced** — MQTT becomes a *projection* of the routing graph, exactly as it is a projection of the widget tree in OPEN-AIR.

---

## 1. The Reference: how `comMQTT` advertises state

Distilled from `/OPEN-AIR/FrontEnd/comMQTT` (React/JSX + `mqtt.js` over WebSockets). The mechanics we intend to replicate:

| Concern | comMQTT implementation | Why it matters for TWIST |
|---|---|---|
| **Transport** | `window.mqtt.connect(ws://HOST:9001, {username:'guest', keepalive:60, reconnectPeriod:5000})`. Broker over **WebSockets** (browser requirement). Host from `?mqtt=` URL param, default `44.44.44.152`. | Any browser MQTT layer must be WS. Config must be overridable at runtime — TWIST is a static site with no build-time backend address. |
| **Topic = folder path** | `topicMaker.jsx` strips numeric prefixes (`0_Spectrum`→`Spectrum`), drops layout tokens (window/left/right/top/bottom), joins device folders under root `OpenAir/Gui`. | TWIST's `discovery.ts` already produces the same kind of path. The topic builder is a ~30-line pure function. |
| **Per-widget advertisement** | On mount each widget publishes **`{topic}/config`** with its node JSON (type, min/max, unit) **and** a default value to `{topic}`. | This *is* "advertise all the parameters." Every TWIST resource should publish a `…/config` describing what it is and what params it carries. |
| **Value publish** | `{ "value": <n|s|bool>, "full_id": "GUID:WEB:ts" }`, **`retain:true`**, QoS 0. | Retained = late subscribers get current state for free. `full_id` = self-echo suppression. Both are directly applicable. |
| **Session identity** | `OA_SESSION_FULL_ID = "8hex:WEB:epochMs"`, stamped into every payload so the backend can drop its own reflections. | TWIST needs the same to avoid feedback loops once a backend echoes state back. |
| **Heartbeat / failover** | 1 Hz retained publish to `OpenAir/System/Failover/WEB/Heartbeat/{guid}`; on unload, a final `active:false`. | Liveness + "this console is present" advertisement. Maps to a TWIST birth/LWT. |
| **Throttle** | Leading-edge + guaranteed-trailing coalescing at ~45 Hz (`PUBLISH_INTERVAL_MS=22`), optimistic local UI. | Meter/fader-style editors in TWIST (meter-input, audio-mixer) will drag-fire; identical throttle needed. |
| **Subscription** | Browser subscribes `OpenAir/Gui/#`; incoming stored `messages[topic]=payload`; a `useEffect` syncs component state. | TWIST's equivalent is subscribe `Twist/#` and fan messages to registered handlers. |
| **Diagnostics** | `MqttConnectionTester.html` subscribes `#` and renders a live topic tree; `window.OA_MQTT_DEBUG/FILTER/LAST`. | Cheap, high-value. Ship an equivalent `twist-mqtt-tree.html`. |

**Key architectural takeaways to carry over verbatim:**

1. **The broker is a mirror, not the model.** comMQTT never treats MQTT as its state store; the widget tree is. MQTT is a retained projection. TWIST must keep `routing-core`'s `RouteGraph` as truth and publish *from* it.
2. **Config vs. value are two topics.** `…/config` (retained, rarely changes: identity + parameter schema) and `…` (retained, changes live: the value). This cleanly separates *advertisement* from *telemetry* — precisely the user's "advertise all the parameters" vs. live state.
3. **Folders are free structure.** No topic registry service. The directory tree carries the namespace.

---

## 2. The Substrate: what TWIST already has

From direct reading of `src/**`:

### 2.1 A folder-derived resource tree (the future topic tree)
`src/platform/discovery.ts` — `listDirectory(url)` prefers `${url}index.json` (a `Manifest = string[]`), falls back to autoindex HTML. `buildDestinations()` (`src/ui/console/destinations.ts`) walks `Routes/Destinations/**`; the Sources panel walks `Routes/Sources/**`. **These paths are the natural topic segments.** `stripOrder()` already removes numeric ordering prefixes — the same normalization `topicMaker.jsx` does.

### 2.2 Typed domain shapes (the parameters to advertise)
`src/model/index.ts` already names every parameter we'd advertise:
- **`Production`** — `id, name, color, parentName, status, outputs{video,audio,intercom}, twists[]`. This is the "room"/program-row analogue.
- **`StageBox`** — `id, name, prefix, count, color, floor, level, items[], status`.
- **`SourceLeaf`** — the permissive union every `Routes/Sources/**` leaf conforms to (stage box / playout / production / stream).
- **`TwistConfig`** — `name, accepts('video'|'audio'|'both'|'camera'), inputs[], monitor, row, maxVideo, maxAudio, cameraInput`. **This is the per-resource parameter set.**
- **`Feed`, `Crosspoint`, `RouteGraph`** (`src/domain/routing-core/index.ts`) — the pure routing graph: `take()/clear()` crosspoints, `isFaultStatus()`. **The single source of truth we project onto MQTT.**

### 2.3 An editor plugin contract (per-resource param owners)
`src/editors/types.ts` — every editor implements `EditorPlugin { match, title, render }` and receives a typed **`EditorContext`**: `{ twist, sources, production, siblings, can(cap), services, dispose }`. Services today = `{ openStageBox }`. **This is the injection point for a typed `publish/subscribe` service** — editors already get their services as data, never via `window`. There are 14 editors (`audio-mixer, audio-monitor, camera-control, encoder, ifb, intercom, iso-recorder, lighting, meter-input, multi-viewer, signaling, stagebox-input, vision-mixer, wysiwyg`), auto-registered by `registry.ts` via `import.meta.glob` and locked by `dispatch.test.ts`.

### 2.4 A change-event stream with no wire (the Captain's Log)
`src/ui/console/captains-log.ts` — a `MutationObserver` on the destinations content produces a structured `Entry { id, ts, twist, dest, prod, added[], removed[], text }` for **every** routing change, grouped into `Narrative` "voyages", with human narration (`narrate()`). **This is already the "server event" per Captain's Log entry** — it just terminates in a DOM panel instead of a topic.

### 2.5 An auth capability gate + the one existing pub/sub precedent
`src/platform/auth.ts` + `src/model/index.ts` `Capability` union (`admin, switch, route, signal, shade, gfx, comms, audio, book, view`). `EditorContext.can(cap)` gates behavior. **Publishing can be gated the same way** (e.g. don't advertise control topics an operator can't drive). Note also that `auth.ts` is the *only* place TWIST already has a listener/observer pattern today — `onRoleChange(cb)` over a `Set<(r:Role)=>void>`, fired by `setRole()`. That is the precedent the TwistBus generalizes, and `setRole()` is itself a natural publish tap (`Twist/system/role`).

> **"Rooms" clarified.** TWIST has no first-class `Room` object. What operators call a room is a **`Production`** discovered from `Routes/Destinations/**` (e.g. `Routes/Destinations/001_Control Rooms/002_Secondary/002_Production 7.json` → `{id:"prod7", name:"PROD 7", color:"#5566EE", twists:[{name:"CAM 1", accepts:"camera", maxVideo:1, row:"cameras"}, …]}`). The word also appears as a free-text `Slot.room` in `schedule.ts` ("Primary Control Room"). This audit takes **room = Production**, and its **parameters = the twists' `TwistConfig` fields**. "Resources" are currently only aspirational (the `book` capability / resource-booking model, `src/README.md` P1+); the resource topics here cover sources + twists, which is the concrete resource set that exists today.

### 2.6 Build system
**Vite** (`npm run dev`/`build`), `tsc --noEmit` typecheck, `vitest`. `mqtt.js` can be a real dependency (`npm i mqtt`) bundled by Vite — cleaner than comMQTT's unpkg `<script>`; or kept as an external CDN `<script>` + `window.mqtt` to match OPEN-AIR exactly. Recommendation: **npm dependency**, dynamically imported so the console still boots with no broker.

**Bottom line:** the gap between TWIST and comMQTT is *not* architectural. TWIST has the tree, the types, the event stream, and a clean injection seam. It lacks (a) an MQTT client, (b) a topic builder, (c) an advertisement pass, and (d) three tap points (boot, editor, Captain's Log).

---

## 3. Proposed Topic Namespace

Root prefix **`Twist`** (parallels `OpenAir/Gui`). Mirror the discovery folders; strip order prefixes; lower-kebab or preserve as-is per `stripOrder`. Two message classes per node: **`…/config`** (retained identity+schema) and **`…`** / **`…/<param>`** (retained live value).

```
Twist/
├─ system/
│  ├─ presence/{sessionGuid}          ← retained heartbeat, LWT active:false   (console liveness)
│  └─ config/broker                   ← negotiated settings, optional
├─ routes/
│  ├─ sources/<Category>/<…>/<Leaf>          ← retained: source is present
│  │  └─ config                              ← retained: SourceLeaf shape (kind, channels, color, status)
│  └─ destinations/<Category>/<Program>/<Twist>
│     ├─ config                              ← retained: TwistConfig (accepts, maxVideo/Audio, inputs, row…)
│     ├─ crosspoints                         ← retained: which sources are currently routed in
│     └─ params/<paramName>                  ← retained live value published by the twist's editor
├─ rooms/<Production>/                        ← "room" = production/program-row
│  ├─ config                                 ← retained: Production (color, outputs{video,audio,intercom})
│  └─ status                                 ← retained live: OK / fault
└─ log/
   ├─ <voyageId>/<entryId>                    ← retained: one Captain's Log narrative entry
   └─ latest                                  ← retained: most-recent entry (cheap dashboard subscribe)
```

**"advertise all the parameters in the rooms into a TWIST topic"** = the **advertisement pass** populates every `…/config` under `Twist/rooms/**` and `Twist/routes/**` at boot (and on discovery/refresh).

**"topics in each and every create route / resource / captains log"** =
- *create route* → publishing a crosspoint change (`Twist/routes/destinations/**/crosspoints`) and the narrative (`Twist/log/**`) each time a route is made;
- *resource* → each source/destination/twist gets its `…/config` + live `params/*`;
- *captains log* → every `Entry` becomes a retained `Twist/log/<voyage>/<entry>` message.

Payloads carry `full_id` for self-echo suppression, matching comMQTT.

---

## 4. TypeScript Strategy — the TwistBus module

New package **`src/platform/mqtt/`**, self-contained, DOM-free at its core, following the same "services-as-data, no window globals" rule the editors already obey.

```
src/platform/mqtt/
├─ client.ts        // connection, session id, birth/LWT/heartbeat, reconnect, publish/subscribe
├─ topics.ts        // pure: discovery path → topic; TwistConfig/Production/SourceLeaf → payload
├─ advertise.ts     // the boot pass: enumerate routes+rooms, publish retained …/config
├─ throttle.ts      // leading+trailing coalescer (port of comMQTT throttle) for live params
├─ log-bridge.ts    // subscribe to Captain's Log entries → publish Twist/log/**
├─ types.ts         // TwistBus interface, payload schemas (below)
└─ index.ts         // createTwistBus(): the one export app/main.ts wires
```

### 4.1 The core contract (`types.ts`)

```ts
// A retained "who am I / what params do I carry" advertisement.
export interface ConfigMsg {
  kind: 'source' | 'destination' | 'twist' | 'room';
  name: string;
  color?: string;
  params?: ParamSpec[];         // the advertised parameters (name, type, unit, range, writable)
  status?: string;              // 'OK' | fault text
  full_id: string;
}

export interface ParamSpec {
  name: string;                 // e.g. "gain", "iris", "tally", "peak"
  type: 'number' | 'bool' | 'string' | 'enum';
  unit?: string; min?: number; max?: number;
  values?: string[];            // for enum
  writable?: boolean;           // requires a Capability to drive
  cap?: Capability;             // auth gate for writes
}

// A live value on …/params/<name>.
export interface ValueMsg<T = unknown> { value: T; ts: number; full_id: string; }

// One Captain's Log narrative entry, retained on Twist/log/**.
export interface LogMsg {
  voyage: number; entry: number; ts: number;
  dest: string; prod: string;
  added: string[]; removed: string[];
  text: string; full_id: string;
}

export interface TwistBus {
  readonly ready: Promise<void>;
  readonly sessionId: string;
  status(): { connected: boolean };
  publishConfig(topicSuffix: string, msg: Omit<ConfigMsg, 'full_id'>): void;
  publishValue<T>(topicSuffix: string, value: T, opts?: { throttle?: boolean }): void;
  subscribe(topicFilter: string, cb: (topic: string, payload: unknown) => void): () => void;
  dispose(): void;
}
```

### 4.2 The client (`client.ts`) — faithful port of `MqttProvider.jsx`

- `connect(url, { keepalive:60, reconnectPeriod:5000, connectTimeout:30_000 })` over `ws|wss` chosen by page protocol; host from `?mqtt=` param (default a configured constant) — **identical resolution to comMQTT** so both consoles can share a broker.
- **Session identity:** `sessionId = ${8hex}:TWIST:${epochMs}` (mirrors `WEB:` partition with a `TWIST:` partition so a shared broker can distinguish the two consoles). Stored, logged, stamped into every payload as `full_id`.
- **Birth + LWT:** connect with a `will` on `Twist/system/presence/{guid}` = `{active:false}` retained; on `connect`, publish `{active:true}` retained; 1 Hz heartbeat; on `beforeunload`, final `{active:false}`.
- **Self-echo suppression:** in `subscribe`, drop any message whose `full_id === sessionId`.
- **No broker? No problem.** `createTwistBus` resolves `ready` even if the connection never opens; publishes become no-ops (buffered最新? no — just dropped) so the console is never blocked on MQTT. This preserves TWIST's "zero-backend, static-host" property.
- **`mqtt` imported dynamically** (`await import('mqtt')`) so the bundle/boot cost is paid only when a broker is configured.

### 4.3 Topic + payload builders (`topics.ts`, pure)

```ts
// Reuse discovery's path → strip order prefixes → join. Mirrors topicMaker.jsx.
export function topicForRoute(discoveryPath: string): string;     // "Routes/Destinations/0_PGM/…" → "routes/destinations/pgm/…"
export function configForTwist(t: TwistConfig): Omit<ConfigMsg,'full_id'>;   // maps accepts/maxVideo/maxAudio/inputs → ParamSpec[]
export function configForProduction(p: Production): Omit<ConfigMsg,'full_id'>;// outputs{video,audio,intercom} → params
export function configForSource(s: SourceLeaf): Omit<ConfigMsg,'full_id'>;
```

These are unit-testable (vitest) with zero DOM — same discipline as `routing-core`.

### 4.4 The advertisement pass (`advertise.ts`) — "advertise all parameters in the rooms"

Runs once after boot discovery completes (and again on any discovery refresh):

```ts
export async function advertiseAll(bus: TwistBus): Promise<void> {
  // 1. Rooms: every Production/program-row → Twist/rooms/<name>/config
  // 2. Sources: walk Routes/Sources/** (reuse discovery.listDirectory) → …/config per leaf
  // 3. Destinations & twists: walk Routes/Destinations/** → per-twist …/config (TwistConfig params)
  // 4. Crosspoints: project routing-core RouteGraph → …/crosspoints per destination
}
```

Because every message is **retained**, a subscriber that connects an hour later still receives the full advertised catalogue for free — the same guarantee OPEN-AIR relies on.

**Concrete tap points** (so this stays a thin projection, not a fork): `advertiseAll` reuses `destinations.ts addDestinationTree()` (already called per footer-tab activation — a natural "room discovered" moment) and the Sources walk; crosspoint publishes hook `matrix.ts placeSourceInTwist()` / `enforceTwistLimits()`; role publishes hook `auth.ts setRole()`. All four are existing functions — no new state, no new source of truth.

### 4.5 Editor integration — live params without globals

Extend `EditorServices` (`src/editors/types.ts`) from `{ openStageBox }` to also carry a **scoped publisher** the host binds to the twist being edited:

```ts
export interface EditorServices {
  openStageBox(name: string, color: Hex, channels: string[]): void;
  // NEW — scoped to this twist's topic; editor doesn't know the full path.
  advertiseParams(params: ParamSpec[]): void;             // one-time: what this editor exposes
  publishParam(name: string, value: unknown): void;        // live value (auto-throttled)
  onParam(name: string, cb: (v: unknown) => void): () => void; // subscribe (backend echoes / other consoles)
}
```

`src/app/main.ts` (`buildContext` / `openEditorForTwist`) already resolves the twist's identity — it binds these three closures to `Twist/routes/destinations/<path>/params/*` before handing the editor its context. Concretely:
- **meter-input** advertises `peak, rms, loudness` (read-only telemetry) and publishes live values off its existing `createLoudnessTracker`/`rmsL()/rmsR()` loop through `publishParam` (throttled).
- **audio-mixer** advertises `gain, mute, pan` per channel (writable, `cap:'audio'`).
- **camera-control** advertises `iris, focus, tally` (`cap:'shade'`/`'switch'`).

No editor imports the bus; it receives typed closures — consistent with the M1/M3 "data-in, typed services" rule the codebase already enforces.

### 4.6 Captain's Log bridge (`log-bridge.ts`) — "topics in every Captain's Log"

`captains-log.ts` currently keeps entries internal. Add a **thin observer hook** (an optional `onEntry(entry)` callback, or reuse its existing `Entry` creation site) that `log-bridge.ts` subscribes to, mapping each `Entry` → `LogMsg` → retained publish on `Twist/log/<voyage>/<entry>` plus `Twist/log/latest`. Because the log already narrates *every* mutation (drag-drop, 1990s view, portals), this single tap satisfies "every create route" and "every Captain's Log" with one wire. Reverse Course (undo) publishes a follow-up entry, keeping the topic tree eventually-consistent with the panel.

---

## 5. Phased Implementation Plan

| Phase | Deliverable | Files | Verifies |
|---|---|---|---|
| **P0 — Bus skeleton** | `createTwistBus()` connects (WS), session id, birth/LWT/heartbeat, reconnect, self-echo drop. No-broker no-op path. | `src/platform/mqtt/{client,types,index}.ts` | Connect to a local Mosquitto (`ws:1884`); see `Twist/system/presence/*` in `twist-mqtt-tree.html`. |
| **P1 — Topic + advertise** | Pure `topics.ts`; `advertiseAll()` publishes retained `…/config` for every room/source/dest/twist at boot. | `topics.ts`, `advertise.ts`, wire in `app/main.ts` after discovery. | vitest on topic/payload builders; tree explorer shows the full catalogue. |
| **P2 — Log bridge** | Every Captain's Log entry → `Twist/log/**`. | `log-bridge.ts`, minimal hook in `captains-log.ts`. | Drag a source into a twist → new retained log topic appears with the narration. |
| **P3 — Editor params** | Extend `EditorServices`; meter-input + audio-mixer publish live params; subscribe path for echoes. | `editors/types.ts`, `app/context.ts`, `editors/meter-input/*`, `editors/audio-mixer/*`, `throttle.ts` | Open meter-input on a live source → `…/params/loudness` updates at ~45 Hz throttled. |
| **P4 — Crosspoints + hardening** | Publish `routing-core` graph projection on every take/clear; auth-gate writable params; diagnostics + `OA`-style debug flags. | `advertise.ts`, `auth` gate, `twist-mqtt-tree.html` | Two browsers on one broker see each other's routes; capabilities suppress unauthorized control topics. |

Each phase is independently shippable and leaves the console fully working with **no broker present** (graceful degradation is a hard requirement, given TWIST is a static, zero-backend site).

---

## 6. Design Decisions & Risks

1. **MQTT is a projection, never the model.** Truth stays in `routing-core` `RouteGraph` + discovery. If the two ever diverge, the graph wins and re-advertises. (Same stance as comMQTT re: the widget tree.) — *Decision, not risk.*
2. **Retain everything.** Matches comMQTT; gives late-joiners full state. Cost: broker must be told to clear on topic deletion — publish an empty retained payload when a resource disappears (advertisement pass diff). *Risk if skipped:* stale `…/config` for deleted routes.
3. **`mqtt` dependency vs. CDN `<script>`.** Recommend npm + dynamic import (Vite-friendly, versioned, offline dev). comMQTT's unpkg approach is the fallback if we want byte-identical parity. *Low risk.*
4. **Broker address on a static site.** Reuse comMQTT's `?mqtt=` convention + a compiled default; document it. Consider `wss://` behind the deployed HTTPS site (mixed-content blocks `ws://` from an `https://` page — comMQTT already handles this by protocol-matching). *Real deployment risk; mitigated by protocol match.*
5. **Auth-gated advertisement.** Do we advertise control topics an operator cannot drive? Recommend: advertise `config` always (read is harmless), but mark `writable`/`cap` on each `ParamSpec` and let the backend enforce; optionally omit `params/*` writes the session lacks capability for. *Policy decision for the user.*
6. **Shared broker with OPEN-AIR.** Distinct roots (`Twist/` vs `OpenAir/`) and partition (`TWIST:` vs `WEB:`) let both consoles coexist on one broker — a bonus if the two systems are meant to interoperate. *Opportunity, confirm intent.*
7. **Throughput.** Meter/scope editors can fire fast; the port of comMQTT's leading+trailing throttle (~45 Hz, overridable) is mandatory for those, optional elsewhere. *Handled in P3.*

---

## 7. Appendix — comMQTT ⇄ TWIST mapping

| comMQTT (reference) | TWIST (target) |
|---|---|
| `MqttProvider.jsx` (connect, session, heartbeat, throttle) | `src/platform/mqtt/client.ts` + `throttle.ts` |
| `topicMaker.jsx` (folder → topic) | `src/platform/mqtt/topics.ts` (discovery path → topic) |
| `useMqttState(topic, default, nodeJson)` hook | `EditorServices.publishParam/onParam` (typed closures, no globals) |
| Widget publishes `{topic}/config` on mount | `advertiseAll()` publishes `…/config` per room/route/resource |
| `OpenAir/Gui/#` subscription | `Twist/#` subscription |
| `OpenAir/System/Failover/WEB/Heartbeat/{guid}` | `Twist/system/presence/{guid}` (birth/LWT/heartbeat) |
| `full_id: "GUID:WEB:ts"` self-echo suppression | `full_id: "GUID:TWIST:ts"` |
| Gui_Frames folder tree | `Routes/Sources/**` + `Routes/Destinations/**` |
| `MqttConnectionTester.html` | `twist-mqtt-tree.html` diagnostic |
| *(no server-event concept — pure pub/sub)* | **Captain's Log `MutationObserver` → `Twist/log/**`** (TWIST's edge: it already generates the events) |

**Where TWIST is actually ahead of the reference:** OPEN-AIR has no change-narration; TWIST's Captain's Log already produces a structured, human-readable event per state change. Wiring it to MQTT gives TWIST an *event/audit stream* the OPEN-AIR side would have to build from scratch — arguably the most valuable topic in the whole tree.
