# Delta Analysis — TwistRouting vs. the Flexible Software-Based Media Production Requirements

**Companion to:** `Flexible-Software-Media-Production-Requirements-Audit.md` (the de-identified requirements audit).
**Question this document answers:** given everything the request asks for, what does the TwistRouting codebase already do, what does it not do, what is *simulated* vs *real*, and what should be built — with the reasoning made explicit so the size of each gap is interpretable rather than just listed.

---

## 0. How To Read This Delta (the one idea that governs everything)

The request specifies a **product system**. Every fully-detailed App in it is defined in **three stacked layers**:

```
   Part 3 — Operator GUI          ← how a human drives the function
   Part 2 — Control-Plane API     ← how software configures/controls/monitors it
   Part 1 — Signal Processing     ← what actually happens to the audio/video essence
                                     …all hosted on a shared PLATFORM (data plane,
                                     containers, licensing, formats, transport, timing)
```

**TwistRouting lives almost entirely in Part 3 — and even there, as a *simulation*.** It is a browser-based **operator-GUI + routing-map visualizer**: it renders what the control surfaces *look and feel like*, with mathematically-correct instruments (BS.1770 loudness, RGB parade, vectorscope, IRE scales) driven by **synthetic data** (`Math.sin` / `Math.random` / `setInterval`). There is:

- **no Part 1** — no essence ever flows; no codec, no raster, no mixing math on real pixels/samples;
- **no Part 2** — there is no control-plane API at all (the app has no API surface, inbound or outbound);
- **no Platform** — no data plane, no containers, no formats, no transport, no licensing;
- **no real integration** — NMOS / SWP-08 / TSL / ST 2110 / SRT / SCTE / PTP appear **only as UI labels and log strings**, never as protocol I/O.

This single fact reframes the entire delta: **TwistRouting is not a partial implementation of the requested system — it is a high-fidelity design/prototype of one layer of it.** That is not a criticism; it is the correct lens for sizing every gap below.

### Delta severity scale used throughout

| Level | Meaning | Example in this codebase |
|---|---|---|
| **L0 — Absent** | Nothing in the code touches this requirement | Data plane, licensing, containers |
| **L1 — Named only** | Exists solely as a label / string / CSS class | "SMPTE 2110", "NMOS IS-07", "SRT" badges |
| **L2 — Simulated GUI** | A working operator UI exists, but driven by fake data; no real logic behind it | Audio mixer, camera CCU, encoder |
| **L3 — Real logic (front-end)** | Genuine, correct domain logic exists — but not wired to real signals/devices/APIs | `routing-core` graph ops; BS.1770 integrator; role/capability model |
| **L4 — Production-real** | Real signal / protocol / API / backend | *(nothing in the codebase reaches L4)* |

The "delta" for any requirement = distance from its current level to the level the request demands (which is effectively L4 for everything).

---

## 1. What TwistRouting Actually Is (understanding the project)

A precise one-line characterization: **TwistRouting is a zero-backend, LCARS-styled operator-control-surface simulator and signal-routing visualizer, with a clean TypeScript domain/plugin architecture underneath.**

Concretely, it delivers:

- **A routing map metaphor** — sources (JSON-discovered signal nodes) dragged onto **twists** (destination input points), visualized as a DNA-helix; fault status propagates end-to-end. *(Real front-end logic — `src/domain/routing-core`: `take/clear/salvo/computeTally/mixMinus/diff` over an immutable `RouteGraph`. L3.)*
- **13 role-specific "editor" control surfaces** — each a self-contained plugin that opens full-screen for a matching twist. *(All L2: real UI, synthetic data.)*
- **A role/capability model** — capabilities (`admin/switch/route/signal/shade/gfx/comms/audio/book/view`), progressive-disclosure gating (`applyScope` / `can()`), and a schedule→booking vision. *(L3 model, L2 enforcement, no real auth.)*
- **Zero-backend discovery** — drop a JSON file in `Routes/**` and it appears; works on any static host; offline via service worker.
- **A disciplined TS rebuild** — strict typing, layered (`domain → model → platform → ui → editors → app`), plugin auto-registry, unit tests; the `routing-core` module is explicitly designed to be the future WASM/server-portable core.

And it deliberately does **not** deliver: any real media, any device/protocol control, any API, any platform services.

---

## 2. Coverage Map — Editors vs. the Requested App Catalog

Each TwistRouting editor is, at most, a **Part-3 (Operator GUI) analog** of one or more requested Apps — simulated. This table is the heart of the "what's built" answer.

| TwistRouting editor | Nearest requested App(s) | Layer covered | Level | Notes |
|---|---|---|---|---|
| **Vision Mixer** (T-bar, PGM/PVW, DSK, transitions) | AR.4.5 Small Vision Mixer; AR.4.6 Downstream Keyer; AR.4.24 Full Vision Mixer | GUI only | L2 | No compositing/keying on real video; DSK is UI state |
| **Multi Viewer** (2×2→16×16, PiP, UMD, tally) | AR.8.1 Multi-Viewer (incl. its layout editor) | GUI only | L2 | Tiles are placeholders; strong match to the *layout-editor* requirement |
| **ISO Recorder / Replay** (jog/shuttle, angles) | AR.6.1 Record, AR.6.2 Playback, AR.6.3 Instant Replay | GUI only | L2 | No media capture; timecode is a counter |
| **Audio Mixer** (strips, faders, EQ, aux, buses) | AR.5.1 Scalable 5.1/Stereo Mixer; AR.5.10 Small Mixer | GUI only | L2 | No audio; faders are range inputs |
| **Audio Monitor** (PPM/VU, phase, BS.1770) | AR.8.11 Loudness Monitor; AR.8.10 Level Meter | GUI + real math | L2/L3 | BS.1770 math correct; fed synthetic levels |
| **Camera Control (CCU/RCP)** + scopes | AR.4.21 Camera Shading; AR.4.1 Proc Amp/Colour; AR.8.12 Waveform Monitor | GUI only | L2 | Parade/vectorscope correct; synthetic pixels; no CCU protocol |
| **Encoder** (ABR, RTMP/SRT vault, 2022-7, DRM) | AR.3.11 SRT/RIST Enc; AR.3.13 MPEG-TS Enc; AR.3.15 WebRTC Enc | GUI only | L2 | Protocols are labels; metrics random |
| **Signaling** (tally, GPI/SCTE, on-air) | AR.1.5 Tally integration; AR.9.2/9.3 SCTE Reader/Inserter | GUI only | L2 | "NMOS IS-07/GPI" is a log string; no I/O |
| **Stage Box Input** (preamp, +48V, impedance) | AR.3.3 ST 2110-30/AES-67 Audio Input | GUI only | L2 | No audio, no NMOS IS-08 mapping |
| **Meter Input** (test tool: scopes+meters+loudness) | AR.8.10–8.14 Meters & Probes | GUI + real math | L2/L3 | Explicitly self-labeled "no real pixels in this sim" |
| **Router matrix / twists** | AR.7.1 Router Bus w/ Audio Shuffling; AR.1.5 routing integration | Map + real graph logic | L3 | `routing-core` is genuine; not a router-bus *editor*, and not wired to SWP-08/IS-05 |
| **Intercom** (talk/listen keys, groups) | *(not in the requested catalog)* | — | L2 | TwistRouting extension |
| **IFB** (mix-minus, interrupt, ducker) | partial to AR.5 audio processing (mix-minus) | GUI only | L2 | Not a named App; useful concept |
| **Lighting (DMX)** | *(out of scope — not a media App)* | — | L2 | TwistRouting extension |
| **WYSIWYG (pre-viz)** | *(out of scope)* | — | L2 | TwistRouting extension |

**Reading of the map:**
- **Best-covered requirement area:** AR.2 Operator GUIs and AR.8 Monitoring surfaces — TwistRouting has real, thoughtful GUI answers here (composable, touch-friendly, role-gated, deep-linkable).
- **Requested Apps with *no* representation at all (not even a GUI):** ST 2110 I/O (AR.3.1–3.4); most video processing (AR.4.1–4.4, 4.7–4.8 graphics/converters/failover — vision mixer aside); the great majority of audio processing (AR.5.2–5.28: delay, up/down-mix, EQ, dynamics, limiter, gate, loudness normalizer, tone/clip); NDI/Dante/SIP/WebRTC-conf inputs (AR.3.20–3.26); most probes and the ANC apps (AR.9).
- **TwistRouting features with *no* corresponding request:** Intercom, IFB, DMX Lighting, WYSIWYG pre-viz, and the LCARS aesthetic. These are legitimate extensions but should not be counted as requirement coverage.

---

## 3. The Delta by Requirement Domain

Each row: what the request demands → current level in TwistRouting → the gap.

| Requirement domain (from the audit) | Requested (target) | Current level | Delta |
|---|---|---|---|
| **Signal processing / data plane (Part 1)** — real essence in/out, formats, codecs | L4 across 76 Apps | **L0** | **Total.** No essence anywhere. This is the largest gap and, by design, not what the project attempts. |
| **Control-plane API (Part 2)** — full R/W to every param, health, presets, public/documented | L4, *mandatory* | **L0** | **Total.** The app has no API of any kind. The single most important requirement of the request is entirely unaddressed. |
| **Shared platform / framework** — in-memory essence exchange, RDMA/RoCE, scale-out | L4 | **L0** | **Total.** |
| **Containerization / Helm / resource declaration** | L4 | **L0** | **Total.** (App is a static browser bundle.) |
| **Orchestration** (launch/configure/connect Apps) | common tool + API | **L0–L1** | The *routing map* is a conceptual cousin; no launch/lifecycle. |
| **Media format matrix** (rasters, SDR/HDR, codecs, file profiles) | L4, detailed CR tables | **L0–L1** | Formats appear as occasional labels only; no format handling. |
| **ST 2110 / NMOS / PTP** (IS-04/05/08, 2022-7, timing) | L4, part of eval test | **L1** | Names in UI/logs only. A PTP-styled clock widget exists but is cosmetic. |
| **External control integration** (SWP-08, IS-05, TSL 5.0, tally/source-name) | L4 critical | **L1–L2** | Signaling editor *simulates* tally distribution; no wire protocol. This is the **most reachable** integration gap. |
| **Operator GUI (AR.2)** — HTML5, composable, touch, responsive, status objects | L4 | **L2–L3** | **Smallest delta.** HTML5 ✓, browser ✓, touch/drag ✓, deep-link ✓, embedded status objects ✓, role-gated ✓. Missing: true user-composable panel *builder*, multi-vendor iFrame embedding, verified responsive targets. |
| **Hardware control panels** | third-party panels (critical) | **L0** | No panel/HID integration. |
| **User login & access** (AD, OAuth2/SAML2, SSO) | L4 | **L2–L3** | Real capability *model* (L3) but simulated single admin role; no AD/SSO, no real auth. |
| **Licensing model** (perpetual/lease, points, offline/backup) | L4, 4 models | **L0** | Nothing. |
| **Commercial / service wrap** (SLAs, warranty, docs, training, acceptance) | full | **L0** | Nothing (nor should a codebase carry it — noted for completeness). |
| **Routing state / fault / tally logic** | (implied by AR.7 / AR.1.5) | **L3** | Genuine, unit-tested pure logic in `routing-core`. The one place the code is *ahead* of a typical prototype. |

---

## 4. What Is Missing — Grouped by "Should It Be Built Here?"

Not every gap is a TODO for this project. Separating them is the useful part.

### 4A. Missing *and* out of scope for a front-end project (build elsewhere, or never here)
- **Signal processing (Part 1)** for all Apps — requires native/WASM/GPU pipelines, real transport. This is the vendor Apps' job, not a control surface's.
- **The shared platform / data plane / RDMA / containers / Helm.**
- **Licensing enforcement and the commercial/service wrap.**
- **Real codec/format engines.**

> These define why TwistRouting can never *be* the requested system on its own. They are ~70% of the request's substance and belong to the media-processing Apps and the platform vendor.

### 4B. Missing but *directly buildable* here — the high-leverage gaps
These turn TwistRouting from "simulation" into "real control surface" without rebuilding the UI:

1. **A control-plane API client layer (Part 2, inbound side).** The request's centerpiece is that every App exposes a full R/W control/monitoring API. TwistRouting is the natural *consumer* of such APIs. Build a typed API-client seam so editors read/write **real** parameters and telemetry instead of `Math.random()`.
2. **Real external-control integration** — the reachable protocols:
   - **NMOS IS-05** connection management + **IS-04** discovery to make the routing map *actually route* ST 2110 crosspoints;
   - **Probel SWP-08** (or XY) so the map both reports and drives connections;
   - **TSL 5.0** so the Signaling editor exchanges *real* tally and source names.
   These map 1:1 onto integration Cases 1–5 in the audit and onto existing editors (matrix, signaling).
3. **Real user auth** — replace the P3 stub admin role with AD/LDAP + OAuth2/SAML2 SSO and the existing capability model (which is already L3-ready).
4. **The user-composable GUI *builder*** — the request wants admins to map any App function/status onto any control object to build custom panels. TwistRouting already has the object library and role gating; the missing piece is the *authoring* mode and layout persistence.
5. **Feeding the correct instruments with real telemetry** — the BS.1770 loudness, parade, vectorscope, and meters are already correct math; point them at real level/waveform data (from App APIs or WebRTC/Web Audio) and they become genuine monitoring (L3→L4).

### 4C. Present but shallow — should be deepened
- **Signaling → real tally** (currently a log line).
- **Encoder** → drive a real encoder App's API rather than random metrics.
- **Router matrix** → connect `routing-core` to a real crosspoint backend (it's already the right shape).
- **Responsive/touch** claims → verify against the request's explicit targets (desktop browser + touchscreen; multi-touch gestures like dual-fader / pinch-zoom).

---

## 5. What Should Be Built — Prioritized

Ordered by leverage (impact on requirement coverage ÷ effort), and aligned to the request's own priority weighting (Mandatory → Critical → Important).

| Priority | Build | Why (maps to) | From → To |
|---|---|---|---|
| **P1** | **Typed control-plane API-client seam** feeding editor state | Part 2 (mandatory); unblocks everything real | L0 → L3 |
| **P1** | **NMOS IS-05/IS-04 + SWP-08** wiring for the routing map | Integration Cases 1–4 (critical); AR.7 | L1 → L3/L4 |
| **P2** | **TSL 5.0 real tally/source-name** in Signaling + Multi-Viewer | Integration Case 5 (critical) | L1 → L4 |
| **P2** | **Real auth** (AD + OAuth2/SAML2 SSO) on the existing capability model | AR.2.3 user access (critical) | L2 → L4 |
| **P2** | **Real telemetry into the correct instruments** (loudness/scopes/meters via App API or Web Audio/WebRTC) | AR.8 monitoring; AR.2 status objects | L2 → L3/L4 |
| **P3** | **User-composable panel *builder*** + layout persistence | AR.2.1 composable GUI (critical) | L2 → L3 |
| **P3** | **Multi-vendor UI embedding** (iFrame/host-object model) | AR.2 multi-vendor GUI (optional but signaled) | L0 → L2 |
| **P4** | **GUI analogs for un-covered priority Apps** (ST 2110 I/O status, up/down/cross, graphics renderer, key audio processors) | AR.3/4/5 coverage breadth | L0 → L2 |
| **P4** | **Finish the TS cutover items** (schedule, clock, meter-input port, portals) | internal debt; enables the above | L2 → L3 |

**Deliberately *not* recommended for this repo:** building signal-processing Apps, a data plane, licensing, or codec engines (§4A) — pursue those as separate services/vendor Apps and let TwistRouting *control* them.

---

## 6. Three Interpretations of the Project (and the delta each implies)

The size of the "delta" depends entirely on what you decide TwistRouting *is meant to be*. There are three coherent readings.

### Interpretation A — TwistRouting as a **design/demo/training artifact** *(what it is today)*
A visual language, a pitch, an operator-training simulator, and a living spec-visualizer for the very vision the request describes. **Delta to the request: ~90–95%** — but that's the wrong yardstick, because this reading never intends to process signal. Under Interpretation A the project is already *successful*: it makes the AR.0 vision (apps, workflows, flexible control rooms, role-based operation) legible and interactive. **Recommended framing for stakeholders.**

### Interpretation B — TwistRouting as the **Operator-GUI + Orchestration front-end** for real vendor Apps *(the high-value path)*
Keep every simulation editor as the *presentation layer*, and back it with the **control-plane API client + integration protocols** (§4B). TwistRouting becomes a concrete answer to **AR.2 (composable, multi-vendor operator GUI)**, **AR.1.5 (control/tally integration)**, and the **orchestration front-end** the request explicitly wants (while noting orchestration itself is "out of scope, but the common API is in scope"). **Delta: moderate and well-scoped** — it's an *additive API/integration layer*, not a UI rewrite. This is where the routing-core design and plugin architecture pay off, and where the project could deliver genuine requirement compliance. **Recommended technical direction.**

### Interpretation C — TwistRouting as a **full platform implementation** *(not advised)*
Actually implement Part 1 processing + platform + formats + licensing. **Delta: effectively the entire request (~100%).** This means building the media-processing product the request is shopping for — a multi-year, native/WASM/GPU + transport + platform effort that a browser control surface is architecturally the wrong home for. The `routing-core` "WASM-portable core" gestures at this ambition, but note it concerns **routing/tally state**, not **essence processing** — so even that seed does not shorten this path materially.

---

## 7. Bottom Line

- **What's built:** a polished, correct-where-it-counts **operator-GUI + routing-visualization layer** (Part 3, simulated) plus a genuinely good **routing/tally domain core** and **role model** (L3), on a clean TypeScript architecture. It maps most strongly to **AR.2 (Operator GUIs)** and **AR.8 (Monitoring)**, with conceptual coverage of **AR.7 routing** and **AR.1.5 tally/integration**.
- **What's simulated vs real:** *everything a human sees* is real UI with correct broadcast math; *everything behind it* is synthetic. No essence, no API, no protocol I/O, no backend — anywhere, in either the JS or TS build.
- **What's missing:** the two lower layers of every App (**Part 1 processing, Part 2 API**), the **platform**, **formats**, **real integration**, **licensing**, and the **commercial wrap** — i.e., most of the request's substance, most of which correctly belongs *outside* a control-surface project.
- **What should be built here:** the **API-client + integration layer** (NMOS IS-05/IS-04, SWP-08, TSL 5.0), **real auth**, **real telemetry into the existing instruments**, and the **composable panel builder** — the additive work that promotes TwistRouting from *simulation of a control surface* to *an actual control surface* for real Apps (Interpretation B).

> **The clarifying sentence:** The request wants a *system that processes signal and exposes it through APIs and GUIs*. TwistRouting has built — beautifully — the **GUI dream of that system**, and a clean skeleton to hang reality on. The delta is not "finish the UI"; it is "give the UI something real to talk to."
