# Technology-Needs Audit — Flexible, Software-Based Media Production Applications

**Source documents audited**

1. *Scope of Work & Response Grid* (spreadsheet, 8 tabs, ~3,400 requirement rows)
2. *Table of Figures* (34 functional block diagrams / architecture drawings)

**Purpose of this document.** This is a de-identified, technology-only distillation of what the request is actually asking for. All references to the requesting organization, its facilities, cities, events, and named incumbent equipment have been stripped or genericized. What remains is the *engineering demand*: the architecture, the applications, the signal formats, the control surfaces, the APIs, and the commercial/operational envelope a solution must satisfy.

> **Scale at a glance:** a single shared software platform, **76 distinct "Apps"** (30 specified in full detail as short-term priorities, 46 sketched as future needs), across **9 functional categories**, all driven by a **common API**, running on **generic COTS hardware or public cloud**, exchanging **uncompressed essence in memory**, and interoperating with **existing IP‑routing/broadcast‑control and tally infrastructure** over open standards.

---

## 1. Executive Summary — What Is Being Requested

The request describes a wholesale move away from fixed-purpose, hardware-based live-production facilities (dedicated vision mixers, audio consoles, playback servers, each wired to a specific studio/control room) toward an **agile, software-defined production fabric**. The core idea:

- Production functions are decomposed into **modular software "Apps."** Each App is roughly the software equivalent of one traditional hardware device (an input, a converter, a mixer, a multi-viewer, a recorder, etc.).
- Apps run on a **shared platform/framework** on **generic compute** (on-prem COTS servers *or* public cloud), and are composed into **"Workflows"** — a set of interconnected Apps implementing one production (a radio show, a news bulletin, a multi-camera entertainment show, a large live event, etc.).
- The same hardware pool is **re-purposed throughout the day**: one complement of Apps for one production, a different mix later. Capacity can **burst into the cloud** for short-duration peaks.
- Everything is **API-first**: every App is configured, launched, controlled, and monitored through a documented, openly published API — the same API the vendor's own GUIs use.
- Operators drive Apps through **HTML5 web GUIs** and/or **hardware control panels**, ideally composing a single operator surface from **multiple vendors' Apps**.
- The new software plant must **integrate with existing IP media routing, broadcast control, and tally systems** over open protocols rather than replacing them.
- Commercially, the buyer wants a **flexible licensing model** (perpetual + lease; per-App + pooled "points") to reconcile capital-based budgeting with elastic, event-driven demand.

The remainder of this document breaks down every layer of that demand.

---

## 2. Target Architecture — The Vision Being Bought Into

| Concept | Technology demand |
|---|---|
| **Flexible studios & control rooms** | Studio spaces and control rooms are fully decoupled from each other and from fixed equipment. Both may be local, at a remote regional site, or operated from home. The system must support production teams from a single all-functions operator up to large teams with one operator per function. |
| **Common compute infrastructure** | A generic server infrastructure that hosts many software functions (Apps). Same infrastructure, different App complement per production per time-of-day. |
| **Workflows** | Named, reusable graphs of interconnected Apps. The platform hosts **multiple concurrent Workflows** of widely varying size simultaneously. |
| **App-based decomposition** | Distinct Apps for inputs, video processing, audio processing, mixing, monitoring, playback, graphics, routing, etc. Patterned on the discrete hardware devices they replace. |
| **Cloud burst** | Ability to temporarily augment on-prem processing capacity using public cloud for short-duration events. |
| **Multi-vendor** | Best-of-breed: Workflows are expected to combine Apps from multiple vendors on a shared platform. |

**Referenced architecture drawings** (from the figures document): a top-level production vision; sample concurrent software workflows; the separation of input/processing/output into distinct Apps; a hypothetical multi-vendor workflow; two variants of inter-App communication within a shared platform; and a flexible-control-room concept mixing GUI positions with hardware-panel positions.

---

## 3. Platform / Framework Requirements

The request distinguishes the **Apps** (its primary focus) from the **Platform/Framework** that hosts them and lets them exchange media directly.

- **Role of the platform:** enable Apps (including third-party Apps) to exchange audio, video, and metadata **essences directly with each other without leaving the software platform** — seen as critical to reducing latency, complexity, and cost.
- **Deployment targets:** on-prem COTS hardware **or** cloud provider resources.
- **Scale-out:** the platform must scale across **multiple servers** to host many Workflow instances, including very large ones.
- **In-memory essence exchange:** to minimize latency and compute overhead, Apps should exchange essence **uncompressed, in system memory**. When a Workflow spans multiple servers, uncompressed essence should still move server-to-server via **RDMA over RoCE, InfiniBand, or equivalent** low-latency memory-sharing transport.
- **Candidate host frameworks** the market is expected to align with (named as reference points, alphabetical; the buyer will *prefer* solutions compatible with an existing modular platform):
  - a production/media platform framework,
  - a media-communications-mesh / media-transport-library framework,
  - a media-processing origin framework,
  - a GPU-vendor "for media" framework,
  - or any other platform the proponent identifies.

Three vendor postures are explicitly recognized and ranked:
1. **App + own Platform** (ideally also hosting third-party Apps) — *Critical.*
2. **Apps only**, running on one or more third-party platforms — *Critical.*
3. **Standalone** apps that interconnect only through streaming media (ST 2110 / SRT / NDI / TS) with no shared data plane — *Nice to have / not desirable.*

A **Platform Compatibility matrix** must be completed: for each App, indicate current/near-term support across each candidate framework (with availability dates for "under development"/"planned").

---

## 4. Modularity, Containerization & Resource Declaration

| Requirement | Priority |
|---|---|
| Each App is a **self-contained module** performing one function or a tight group of sub-functions | Critical |
| Apps run on **generic COTS** (CPU, GPU, general-purpose NICs); **no broadcast-specific hardware** — no ASIC/FPGA codecs, no specialized media-optimized NICs | **Mandatory** |
| Apps can run on a **public cloud platform** (all supported clouds to be enumerated) | **Mandatory** |
| **Decoupled I/O and processing** — separate Apps for input (ST 2110, AES-67, SRT, TS…), processing, and output, so any processing function can be fed by any input/output type | Critical |
| All Apps are **containerized** (all dependencies packaged into a lightweight, host-OS-portable container) | Critical |
| Apps are **configured, launched, and controlled by an API** | **Mandatory** |
| Before launch, an App **declares its resource needs** via API: CPU cores, RAM, GPU (if used), and media-network bandwidth | Critical |
| Resource declaration packaged as a **Kubernetes Helm chart** or equivalent standardized descriptor | Important |
| The API **exposes 100% of configuration + operational parameters** so third parties can orchestrate/operate without limitation | Critical |
| **All of a vendor's Apps use the same API** | Important |

**Essence-exchange questions the proponent must answer explicitly:** how essence moves between two Apps (a) on the same server, (b) on different on-prem servers, (c) on different cloud hosts, and (d) with third-party Apps.

---

## 5. On-Premise Hardware Baseline

For on-prem hosting, a per-App server profile must be disclosed (buyer *prefers to source its own hardware*; vendor-supplied hardware is less desirable). Disclosure required for:

- OS support — **Linux** distributions *and* **Windows** versions supported.
- Base compute server (make/model/rack units), out-of-band management (iLO/iDRAC/etc.).
- CPU (qty/make/model), RAM (qty/type/speed), GPU (qty/make/model/VRAM).
- **PCIe slots** — count, lanes, speed.
- **Media NICs**, **memory-sharing NICs** (RDMA/RoCE/InfiniBand), and **management/control NICs** — separately enumerated.

Baseline assumption: *any* server must be able to handle *any* Workflow, including uncompressed ST 2110 I/O, compressed (H.264/265, JPEG XS) I/O over SRT/TS/WebRTC, and multiple concurrent audio/video processing services.

---

## 6. Control-Plane API & Orchestration

The API is the backbone of the entire request. Requirements (partly in AR.1, partly in the shared "Common Requirements — App Control Plane API" table):

- **Read/Write access to every configuration ("set and forget") and operational parameter.**
- **The vendor's own GUIs and orchestration tools must use the same public API** — no private/privileged control paths.
- **Health reporting:** App state (starting / running normally / failed); compute-resource consumption (CPU/GPU/memory) with configurable thresholds and exception reporting.
- **Essence health reporting:** for each essence an App reads from the data plane — is it present? does the format match expectation? video freeze/black detect; audio silence detect; expected ANC present?
- **Presets:** each App instance stores/recalls **≥10 configuration presets** via the API.
- **Documentation & openness:** API **fully documented, regularly maintained, published in a public repository, and accessible to any third party without license or NDA.**
- **Orchestration:** a common tool to launch/configure/connect all Apps in a Workflow — ideally across vendors. (The orchestration tool itself is out of scope, but the *common API that underpins it* is in scope.)

---

## 7. Licensing & Acquisition Model

The buyer's funding is primarily capital-based (CAPEX) but demand is elastic. Four acquisition models are required — ideally **all four** supported:

| Model | Description | Priority |
|---|---|---|
| **1 — Flex + CAPEX** | Flexible "Points" purchased perpetually (+ annual support fee) | Important |
| **2 — Flex + OPEX** | Flexible "Points" leased short-term (yearly/monthly/hourly) | Important |
| **3 — App-Specific + CAPEX** | Specific App instances purchased perpetually (+ annual maintenance) | **Critical** |
| **4 — App-Specific + OPEX** | Specific App instances leased short-term | **Critical** |

**Flex "Points"** = a fungible license currency: simpler Apps consume fewer points, complex Apps more. Points may be bought (perpetual) or leased (burst). Points are understood to be **vendor-specific** (not portable across vendors).

Additional licensing demands:
- **Value protection:** point cost, and the point-cost of running any given App, remain constant for the contract term (3 years).
- **Off-line mode licenses:** fully functional for testing/validation/config, watermarked so they cannot go to air — and **free**.
- **Backup-mode licenses:** run standby instances of selected Apps without paying full price.
- **Disconnected operation:** system runs without a constant connection to a license server — periodic reconciliation (every few days / monthly) is acceptable.
- **Permissive enforcement:** allow temporarily exceeding owned licenses/points (protected by user-access levels) and reconcile usage afterward, so operations are never blocked mid-production.

---

## 8. Operator GUIs (HTML5, Composable, Touch)

| Requirement | Priority |
|---|---|
| Operators control Apps via a **GUI** | Critical |
| **All GUIs built in HTML5**, run in modern desktop browsers | **Mandatory** |
| **UTF-8** text representation | Critical |
| **Responsive design** — scale/reflow to different screen sizes, resolutions, orientations (target: desktop browser + touchscreen or laptop) | Important |
| **Touch-optimized** controls; multi-touch & gestures (e.g., two faders at once, pinch-zoom) | Critical |
| Each App ships a **default UI** | Critical |
| **Composable / user-definable GUIs:** admins/superusers build custom operator panels by mapping any function/status of any App onto any control object from a UI-design library | Critical |
| GUIs embed **live status objects** — video preview windows, audio meters, clocks/timers | Critical |
| **Workflow/connection-graph view** of App interconnections | Optional |
| **Multiple saved layouts** per operational role (e.g., video-op layout, audio-op layout, combined single-op layout), recallable per Workflow/position | Optional |
| Custom GUI can **combine Apps from multiple vendors** (via native UI objects or embedded iFrames) | Optional |

---

## 9. Hardware Control Panels & User Access

**Hardware panels** — two options recognized:
- Vendor-designed/built panels — *Nice to have.*
- **Third-party panels** (vendors to be named, with preferences) — *Critical.*

**User login & access control:**
- Define users and groups with access levels; lock/unlock and show/hide functionality/resources by level; management tooling for users/groups/privileges — *Critical.*
- On-prem authentication **integrates with corporate directory service** (Active Directory) — *Important.*
- **Federated identity / SSO** via standard protocols (**OAuth2, SAML2**, cloud directory) — *Critical.*
- **All control traffic and control sub-systems stay on-prem** for on-prem deployments — *Critical.*

---

## 10. Integration With Existing Routing/Broadcast Control & Tally

The software plant must slot into an existing IP facility rather than replace its control layer. Five integration cases are specified (each with a functional diagram):

| Case | Demand | Protocols |
|---|---|---|
| **1 — App controls its own ST 2110 inputs** | An App/GUI requesting a new source from the real-time media network must route via the **external broadcast/router controller** (for bandwidth management & centralized status). | **NMOS IS-05**; XY route request/status via **Probel SWP-08** (or equivalent) |
| **2 — External controller drives App inputs** | Operators/automation using the external controller connect network sources into an App's ST 2110 input. | **NMOS IS-05** to complete the connection; **SWP-08** status |
| **3 — Report internal App-to-App connections** | External controller must *see* the status of internal (in-platform) essence connections and help manage source/destination names. | **SWP-08** (or other XY protocol) read/status |
| **4 — Control internal App-to-App connections** | External controller must *drive* internal essence routing so existing automation/operators use the familiar router-control system. | **SWP-08** (or other XY protocol) control |
| **5 — Tally & source-name exchange** | Software Apps (vision mixers, multi-viewers, etc.) exchange tally + source names with the existing tally-management system, bidirectionally. | **TSL 5.0** (alternatives may be offered) |

Supporting media-network functions referenced generically: an SDN/media-control service reserves bandwidth and presets routes; the broadcast controller resolves XY source/destination IDs. All router-control, status, and tally traffic **must remain on the local network** on-prem.

---

## 11. Common Media-Format Requirements (Shared Tables)

Rather than repeat formats per App, the request centralizes them in shared tables (each App then references the relevant table and notes exceptions). These define the **format matrix every media App is measured against**.

### 11.1 Video essence formats (Table CR.1)
- **HD/UHD rasters, 4:2:2 10-bit:** 720p59.94; 1080i29.97; **1080p59.94 (Critical)**; 1080p50/29.97; 1080p23.98; **UHD 3840×2160 p59.94 (Critical)**, p50/p29.97/p23.98.
- **Non-16:9 / social rasters:** Square 1:1 (1080×1080); Vertical 4:5 (1080×1350); Vertical 9:16 (1080×1920).
- **"Fully definable"** (any resolution/aspect/rate/sampling) — Nice to have.
- **Color / dynamic range:** SDR **BT.709 gamma (Critical)**; **HDR10** (BT.2100, PQ/ST 2084, BT.2020, ST 2086 static metadata); **HLG** (BT.2100, BT.2020).

### 11.2 Audio essence formats (Table CR.2)
- **48 kHz / 24-bit (Critical)**; 96 kHz / 24-bit (Nice to have); other formats by exception.

### 11.3 Media file formats — record/playback (Table CR.3)
Explicit, codec-exact profiles required (Critical unless noted):
- Long-GOP MPEG-2 422 50 Mbps, MXF OP1A (HD 1080i).
- Intra H.264 422 10-bit, MXF OP1A — HD (100-class) and UHD (300-class, ≤600 Mbps); plus a 200-class long-GOP UHD variant (Nice to have).
- **VC-3 / DNxHD** 145 & 220, 8-bit 422, MXF OP1A (progressive and 1080i).
- **Apple ProRes 422 HQ** and **ProRes 4444 XQ (with alpha)**, QuickTime MOV.
- Smartphone/drone/action-cam (H.264/H.265 4:2:0 8/10-bit, AAC-LC, MOV) and social-media (H.264 4:2:0, AAC-LC, MP4) — Important.
- Must handle **16 audio channels in MXF OP1A**; open list for additional formats.

### 11.4 Compressed I/O codecs (Table CR.4)
- **H.264/AVC** and **H.265/HEVC** across HD & UHD, 4:2:0 8-bit and **4:2:2 10-bit** (the 422/10 variants are Critical).
- **Low-latency web codecs for WebRTC:** VP8, VP9 (Profile 3), AV1 (Profile 2).
- Audio: MPEG-2 audio; **AAC-LC 2.0/5.1 (Critical)**; **Opus ≤256 kbps, 5 ms low-latency mode (Critical)**.

### 11.5 ST 2110 / IP transport (Table CR.5) — a full sub-specification
The request calls out that software ST 2110 support is *historically problematic* and will be **part of the evaluation test plan**. Key demands:

- **Full ST 2110 suite compliance** (-10/-20/-21/-30/-40/-43…), full dynamic RTP payload range, full port range (per RFC 6535), configurable multicast TTL.
- **ST 2022-7** seamless protection switching; **Class D** ultra-low-skew stream reconstruction (receiver).
- **Same-host / same-NIC edge cases:** consuming a multicast originated by an output App on the same host/NIC; multiple input Apps consuming the same multicast on a shared NIC — proponents must explain how these are handled.
- **SDP:** senders emit compliant SDP per essence; receivers interpret SDP to connect.
- **NMOS:** **IS-04** discovery/registration; **IS-05** connection management; **IS-08** audio channel mapping (receiver); **BCP-004-01** receiver capabilities; **BCP-002-01/-02** grouping & human-readable info.
- **Per-receiver error reporting** before/after -7 packet merging (to health-check redundant network legs).
- **Video (-20/-21):** software senders qualify as *Wide*; receiver buffers qualify *Wide* and *Asynchronous*; hardware qualifies *Narrow*.
- **Audio (-30/AES-67):** ≥3 audio streams per video I/O; conformity **Levels A/B/C** (and AX/BX/CX at 96 kHz, Nice to have); defined channel orders (stereo; 5.1; 5.1+2); per-sender/per-receiver profiles (different channel counts & packet times, 125 µs vs 1 ms); buffering qualifications (wide receiver ≥20× packet time, adjustable, manual override, 125 µs capable).
- **ANC (-40):** ≥1 ANC stream per video I/O (CC + timecode + SCTE minimum); desired: 3 independent ANC streams.
- **Timing / PTP:** **IEEE 1588-2008**, **ST 2059-2** & **AES67** media profiles, multicast/unicast, end-to-end delay, slave-only; each of two NICs locks PTP independently; lock within 30 s; **30-minute free-run holdover** on PTP loss with graceful re-alignment (no glitch); real-time PTP-lock and grandmaster-ID reporting via API.

### 11.6 App Control-Plane API common table (Table CR.6)
As summarized in §6 — R/W to all parameters, shared-API-for-own-GUIs, health & resource reporting, essence-health reporting, ≥10 presets per instance.

---

## 12. The Application Catalog (76 Apps / 9 Categories)

Legend: **[P]** = specified in full detail (short-term priority, 30 total) · **[F]** = future/briefly described (46 total).

### AR.3 — System Input/Output Apps ("on/off ramps")
Input/output Apps have one leg on an external media network and one on the internal data plane, decoupling transport from processing.

| # | App | Tier |
|---|---|---|
| 3.1 | ST 2110 Video/ANC/Audio **Input** | P |
| 3.2 | ST 2110 Uncompressed Video+Audio+ANC **Output** | P |
| 3.3 | ST 2110-30 / AES-67 Audio **Input** | P |
| 3.4 | ST 2110-30 / AES-67 Audio **Output** | P |
| 3.10 | **SRT/RIST** Input & Decoder | P |
| 3.11 | **SRT/RIST** Encoder & Output | P |
| 3.12 | **MPEG-TS** Input & Decoder | P |
| 3.13 | **MPEG-TS** Encoder & Output | P |
| 3.14 | **WebRTC** Input & Decoder | P |
| 3.15 | **WebRTC** Encoder & Output | P |
| 3.20 / 3.21 | **DANTE** Audio Input / Output | F |
| 3.22 / 3.23 | **NDI** Input / Output | F |
| 3.24 | **SIP** Line | F |
| 3.25 | Audio/Video **Web-Conferencing Bridge** | F |
| 3.26 | **Web-Browser Video Grabber** | F |
| 3.30 | **System Genlock** | F |

### AR.4 — Video Processing Apps
| # | App | Tier |
|---|---|---|
| 4.1 | Proc Amp / Colour Corrector | P |
| 4.2 | Up/Down/Cross Converter | P |
| 4.3 | Frame-Rate Converter | P |
| 4.4 | Audio/Video A-B Mixer | P |
| 4.5 | **Small Vision Mixer** (mix, keying, DVE) | P |
| 4.6 | Downstream Keyer | P |
| 4.7 | **HTML5 Graphics Renderer** | P |
| 4.8 | Audio/Video Automatic Changeover (failover) Switch | P |
| 4.20 | Aspect-Ratio Conversion / Crop & Scale | F |
| 4.21 | Camera Shading Processing | F |
| 4.22 | Frame Sync / A/V Delay | F |
| 4.23 | SDR/HDR Converter | F |
| 4.24 | **Full-Size Vision Mixer** (64×64, 32+ key layers) | F |
| 4.25 | Chroma Keyer | F |
| 4.26 | Test Signal Generator | F |
| 4.27 | A/V Profanity Delay | F |

### AR.5 — Audio Processing Apps
| # | App | Tier |
|---|---|---|
| 5.1 | **Scalable 5.1 & Stereo Audio Mixer** | P |
| 5.2 | Audio Shuffling & Processing | P |
| 5.3 | Standalone Audio Delay | P |
| 5.4 | Standalone Audio Downmix | P |
| 5.5 | Standalone Audio Upmix | P |
| 5.10 | Small/Mini Audio Mixer | F |
| 5.11 | Auto-Mix Processor | F |
| 5.12 | Audio Fader | F |
| 5.13 | Gain Stage | F |
| 5.14 | Monitoring Output Control | F |
| 5.15 | Audio Noise Reducer | F |
| 5.16 | Audio Dynamics Processor | F |
| 5.17 | Audio Limiter | F |
| 5.18 | Multiband Audio Limiter | F |
| 5.19 | Audio Compressor | F |
| 5.20 | Audio Expander | F |
| 5.21 | Audio Gate | F |
| 5.22 | Autonomous Audio Dynamics Processor | F |
| 5.23 | Multi-Band Audio EQ | F |
| 5.24 | High-Pass / Low-Pass Filter | F |
| 5.25 | Loudness Normalization / Loudness Processor | F |
| 5.26 | Audio Tone Generator | F |
| 5.27 | Audio Signal Generator | F |
| 5.28 | Audio Clip Player | F |

### AR.6 — Audio/Video Record & Playback
| # | App | Tier |
|---|---|---|
| 6.1 | A/V Record Channel | P |
| 6.2 | A/V Playback Channel | P |
| 6.3 | **Instant Replay / Slow-Mo Playback** | P |
| 6.10 | A/V Short-Clip / Loop Player | F |

### AR.7 — Audio/Video Routing
| # | App | Tier |
|---|---|---|
| 7.1 | **Audio/Video Router Bus with Audio Shuffling** | P |

### AR.8 — Audio/Video Monitoring
| # | App | Tier |
|---|---|---|
| 8.1 | **Multi-Viewer** (with layout editor) | P |
| 8.2 | Quad Split | P |
| 8.3 | Real-Time Video Monitor | P |
| 8.10 | Standalone Audio Level Meter | F |
| 8.11 | Audio Loudness Monitor | F |
| 8.12 | Video Waveform Monitor | F |
| 8.13 | Video Signal Detector / Probe | F |
| 8.14 | Audio Signal Detector / Probe | F |
| 8.15 | End-to-End A/V Sync Generator & Reader | F |

### AR.9 — ANC Insertion & Processing (all future)
| # | App | Tier |
|---|---|---|
| 9.1 | Live Closed-Captioning Inserter | F |
| 9.2 | SCTE Trigger Reader | F |
| 9.3 | SCTE Trigger Inserter | F |
| 9.4 | Audience-Measurement Audio Watermark Encoder | F |

---

## 13. Per-App Requirement Structure (How Each App Is Specified)

Every fully-detailed App is specified in **three parts**, each separately evaluated:

1. **Part 1 — Signal Processing & Data-Plane I/O:** what the App does to essence; which shared format tables it must satisfy (CR.1–CR.5); functional behaviors; compute type (CPU/GPU/either).
2. **Part 2 — Control-Plane API:** the exact parameters and statuses the App must expose for read/write (conformance to CR.6 plus App-specific status/telemetry — e.g., stream presence, decoder status, freeze/black, silence/clip detect, ANC presence).
3. **Part 3 — Operator GUI:** the controls and status objects the App's GUI must provide; a **screenshot** of the actual GUI is required as evidence.

Each App also requires the **product-line and App name**, and a **functional block diagram** (the figures document supplies the buyer's reference diagram for each priority App).

**Representative depth (SRT/RIST Input & Decoder).** A single "simple" input App carries ~30 discrete requirements: SRT + RIST receive; CBR/VBR decode; configurable receiver buffer; **Caller/Listener/Rendezvous** modes; FEC; payload decryption; **SRT bonding** in Broadcast (1+1), Backup, and Balancing modes; ITU-R BS.1770 true-peak audio metering (mono/stereo/5.1); audio channel re-mapping/shuffling; cross-vendor encoder interoperability; plus the full API read/write and GUI surface above. This depth multiplies across all 30 priority Apps.

**Notable per-App complexity signals.**
- **Vision mixers** (small → full 64×64 with 32+ key layers), **downstream keyer**, **chroma keyer**, **DVE** — layered compositing at scale.
- **Multi-Viewer** includes a **layout editor** (custom mosaics, UMD, tally, meters, clocks).
- **Scalable 5.1 & stereo audio mixer** is specified as a full processing chain: input channels → basic processing blocks → busses/outputs → monitoring output & level measurement.
- **Record/Playback** must hit the codec-exact CR.3 file profiles; **Instant Replay/Slow-Mo** adds jog/shuttle/replay semantics.
- **Router App** provides in-platform XY routing with per-crosspoint **audio shuffling**, exposed to the external broadcast controller (§10).

---

## 14. Commercial, Service & Operational Requirements

Beyond functionality, a solution must clear a substantial commercial/operational bar:

- **Business continuity (for managed-service/SaaS components):** documented BCP/DR, periodic tested, third-party audited/certified, third-party-dependency disclosure, cloud-backup protection.
- **Account management:** named account manager, technical support, order-desk, and invoicing contacts; periodic business reviews; EOL/phase-out notification and price-concession policy.
- **Proven track record:** references for similar systems deployed in live/on-air production at major broadcasters.
- **Demonstrations & evaluation:** hands-on demos (remote and/or on-prem), driven by user stories; on-prem eval window up to ~15 business days.
- **Integration & commissioning:** proponent responsible for integrating multi-vendor App/platform combinations; priced consulting days for design/commissioning/deployment; cross-vendor technical support.
- **Documentation:** full operational + maintenance manuals at no extra cost, electronic/portable (PDF), **available offline** (no app/platform login required), plus final block diagrams.
- **Acceptance:** joint test plan; deficiencies corrected at proponent expense; **≥30 days error-free operation** post go-live before acceptance; termination rights on milestone failure.
- **Training:** operator/end-user and maintenance/support training; multiple methodologies; priced; in-person in two locations; training on major upgrades.
- **Maintenance & support (24/7/365 operation):**
  - Software maintenance = security patches + bug fixes + upgrades (feature & new-feature releases).
  - **Response:** L1 24/7 < 15 min; L2 24/7 < 1 hr.
  - **Resolution:** recover 1–4 hr; bug fix 1–5 business days.
  - Upgrades: **backward-compatible with saved data** (presets/templates/workflow config); rollback/risk-mitigation support; published known-issues list; disclosed service-life / end-of-support.
  - Support communication channel must be **non-subscription / no extra cost**.
- **Cost model:** priced against all four acquisition models; OPEX **billed on actual usage** with detailed usage/points reports per invoice; a model for pricing new products/features introduced post-contract.
- **Awarding:** buyer may award **per category / per App across multiple suppliers** — pricing must not assume a single bulk award.
- **Warranty:** **≥3 years** from production go-live.
- **Sustainability & accessibility:** environmental-sustainability response and accessibility-conformance response both required.
- **Business relationship:** proof of manufacturer or authorized-representative status; bilingual (French/English) submissions permitted.

---

## 15. Evaluation & Priority Scheme (How Compliance Is Judged)

- **Item types:** *Information* (acknowledge), *Requirement* (comply/…), *Question* (free-text answer).
- **Priority weighting:** **M = Mandatory** (must exist at response time — failure = disqualification); **1 = Critical**; **3 = Important**; **4 = Nice to have**; **5 = Optional**. (A "Significant" tier also appears in commercial items.)
- **Response scale:** Comply / Partially Comply / Comply-In-Development (firm date required) / Custom Development (firm estimate + cost) / Don't Comply — comments strongly required regardless.
- **Evaluation criteria buckets:** Commercial · Modularity · Licensing Model · Platform Compatibility · Integration · Common GUI · L1 App Processing · L1 App API · L1 App GUI · L2 (future-App basic compatibility) · Sustainability.
- **Mandatory gates** (disqualifying if unmet): runs on generic COTS (no broadcast-specific hardware); runs on public cloud; API-configured/launched/controlled; HTML5 GUI in standard browsers.

---

## 16. Consolidated Technology-Needs Checklist

A solution is fundamentally shaped by these non-negotiable and high-weight demands:

1. **Modular, containerized Apps** on **generic COTS + public cloud**; no specialized broadcast silicon.
2. **Shared data plane** for **uncompressed, in-memory** essence exchange; **RDMA/RoCE/InfiniBand** across servers.
3. **Open, complete, publicly published API** covering 100% of config + operation + health; **vendor GUIs use the same API**; Helm-style resource declaration.
4. **Standards-grade ST 2110** (full suite, 2022-7, NMOS IS-04/05/08 + BCPs, PTP with 30-min holdover) — treated as a live test.
5. **Broad codec/format matrix** — uncompressed HD/UHD 422-10 + SDR/HDR; H.264/265 422-10; low-latency web codecs; codec-exact MXF/MOV/MP4 file profiles; AAC-LC & Opus.
6. **HTML5, composable, touch, multi-vendor operator GUIs**; optional hardware panels (own + third-party).
7. **Directory/SSO integration** (AD, OAuth2, SAML2); on-prem control traffic stays on-prem.
8. **Integration with existing IP-routing/broadcast control & tally** via **NMOS IS-05, Probel SWP-08, TSL 5.0**.
9. **Flexible licensing** — perpetual + lease, per-App + pooled points, offline/backup/disconnected/permissive.
10. **Enterprise service wrap** — 24/7 SLAs, ≥3-yr warranty, ≥30-day acceptance, training, docs, commissioning, multi-supplier awarding.

---

## 17. Relevance To This Repository

This project is a browser-based routing/production control surface. The audited request validates several architectural bets and surfaces concrete targets worth tracking:

- **API-first, everything-controllable** — matches an app that drives production functions through control APIs; the "single API, same API the GUI uses, fully documented/public" demand is a direct design north-star.
- **HTML5 composable operator GUIs with embedded status objects** (video previews, meters, tally, clocks), touch/multi-touch, per-role saved layouts, and multi-vendor panel composition — a precise feature checklist for a routing/console UI.
- **External control integration** (SWP-08 XY routing, IS-05 connection management, TSL 5.0 tally, source-name management) — the interop protocols a routing surface would speak.
- **Router App with per-crosspoint audio shuffling** and **presets** — directly analogous to routing/matrix features.
- **App catalog** — a taxonomy of the production functions any such control surface may need to represent, monitor, and route between.

> This document is a technology-and-requirements distillation only. It is intentionally free of any client, facility, location, event, or incumbent-product identifiers; incumbent control/routing/tally systems are referred to by their generic role and the open protocols they use.
