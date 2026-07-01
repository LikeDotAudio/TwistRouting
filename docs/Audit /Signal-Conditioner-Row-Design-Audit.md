# Design Audit — The Per-Studio "Signal Conditioner Row"

**Companion to:**
- `Flexible-Software-Media-Production-Requirements-Audit.md` (the requirements catalog; App IDs `AR.x` referenced throughout)
- `TwistRouting-vs-Requirements-Delta.md` (the codebase gap analysis; L0–L4 severity scale reused here)

**The idea being audited.** Put a standardized **row of signal-conditioner Apps in every production studio** — a replicable bank of small utility functions that *condition* signal on the way in and on the way out: frame syncs, meters, audio shufflers, re-routers, closed-caption strippers, format/standards converters, delays, loudness processors, and the rest of the "glue." Each studio gets the same row; the row is instanced from software Apps on the shared platform rather than wired from discrete hardware.

This document defines that pattern, enumerates the conditioners, orders them into signal-integrity chains, sizes the platform/control/licensing implications, and maps the whole thing back onto what TwistRouting has and what it would need to build.

---

## 1. What a Signal Conditioner Row Is (and why it belongs per-studio)

In a traditional plant, every studio/control room has a rack of **"glue" gear** at its edge — frame syncs, up/down/cross converters, embedders/de-embedders, ARC boxes, proc amps, audio shufflers, delay lines, loudness processors, CC/ANC bridges, changeover switches. It sits *between* the shared facility (router, media network, incoming contribution) and the studio's *production* devices (vision mixer, audio console, replay).

The **Signal Conditioner Row** is that rack, rebuilt as a **standardized bank of conditioner Apps** instanced per studio on the shared software platform.

```
   Shared media network / contribution / sources
                    │
        ┌───────────▼────────────┐
        │   INGRESS CONDITIONER   │   ← frame-sync, convert, legalize, strip,
        │        ROW  (studio N)  │      shuffle, level, meter  (per source)
        └───────────┬────────────┘
                    │  clean, aligned, in-house-spec essence on the data plane
        ┌───────────▼────────────┐
        │   PRODUCTION Apps       │   vision mixer · audio mixer · replay · gfx
        │        (studio N)       │
        └───────────┬────────────┘
                    │  program / iso / mix-minus
        ┌───────────▼────────────┐
        │   EGRESS CONDITIONER    │   ← loudness, CC/SCTE insert, format, embed,
        │        ROW  (studio N)  │      failover, meter  (per output)
        └───────────┬────────────┘
                    │
         to air / network / record / distribution
```

**Why per-studio and why a *row*:**

- **Decoupling (the request's cornerstone).** The audit's AR.1.05 explicitly wants input/processing/output as *separate* Apps so any processing can be fed by any transport. A conditioner row is the physical embodiment of that principle at the studio boundary — the studio's production Apps never see raw, unaligned, wrong-format, wrongly-shuffled signal.
- **Standardization & replication.** One row template → stamped into every studio. Same App set, same order, same presets, same monitoring. New studio = instantiate the template.
- **Signal integrity.** Conditioners enforce house rules (reference lock, raster/rate, colour legality, loudness target, channel map, ANC hygiene) *once, at the edge*, so downstream production and delivery are predictable.
- **Elastic sizing.** A radio studio needs a few audio conditioners; a large multicamera studio needs dozens across video + audio + ANC. Because they're Apps, the row scales per production per day — the exact "different App complement at different times" use-case in AR.0.

---

## 2. The Conditioner Catalog

Every conditioner maps to an App already enumerated in the requirements audit. Column **Tier** = P (priority/full-detail in the request) or F (future). Column **In TwistRouting** = current level from the delta report (L0–L3).

### 2A. Video conditioners
| Conditioner | Conditions… | Request App | Tier | In TwistRouting |
|---|---|---|---|---|
| **Frame Sync / A-V Delay** | aligns async/off-reference video to house PTP; timing offset | AR.4.22 | F | **L0** (only a cosmetic PTP clock) |
| **Genlock / reference** | studio-wide timing reference | AR.3.30 | F | L1 (label) |
| **Up/Down/Cross Converter** | raster + scan (e.g. 1080i↔1080p↔UHD) | AR.4.2 | P | L0 |
| **Frame-Rate Converter** | 50↔59.94↔23.98 etc. | AR.4.3 | P | L0 |
| **Aspect-Ratio / Crop & Scale** | 16:9 ↔ 1:1 / 4:5 / 9:16 social rasters | AR.4.20 | F | L0 |
| **SDR/HDR Converter** | BT.709 ↔ HDR10/HLG (BT.2100) | AR.4.23 | F | L0 |
| **Proc Amp / Colour Corrector** | legalize/normalize luma-chroma, gamut | AR.4.1 | P | **L2** (camera CCU shading + scopes) |
| **Automatic Changeover / Failover** | main/backup hitless switch | AR.4.8 | P | L1 (encoder "2022-7" label) |
| **Test-Signal Generator** | bars/patterns for line-up | AR.4.26 | F | L2 (camera bars, cosmetic) |

### 2B. Audio conditioners
| Conditioner | Conditions… | Request App | Tier | In TwistRouting |
|---|---|---|---|---|
| **Audio Shuffler / Mapper** | channel re-order, embed/de-embed map (IS-08) | AR.5.2 / AR.7.1 | P | L2 (stagebox/mixer channel concepts); L3 route graph |
| **Standalone Audio Delay** | lip-sync align to video | AR.5.3 | P | L0 |
| **Downmix** | 5.1 → stereo/Lo-Ro/Lt-Rt | AR.5.4 | P | L0 |
| **Upmix** | stereo → 5.1 | AR.5.5 | P | L0 |
| **Gain Stage / Fader** | trim, unity | AR.5.12 / AR.5.13 | F | L2 (mixer strips) |
| **EQ / HPF-LPF** | tonal correction, rumble filter | AR.5.23 / AR.5.24 | F | L2 (mixer EQ UI) |
| **Dynamics / Limiter / Gate** | protect, control range | AR.5.16–5.22 | F | L0 |
| **Loudness Normalization** | to −23 LUFS (BS.1770) delivery target | AR.5.25 | F | **L2/L3** (Audio-Monitor BS.1770 *measures*; does not *process*) |
| **Tone / Signal Generator** | line-up tone | AR.5.26 / AR.5.27 | F | L0 |

### 2C. ANC / metadata conditioners
| Conditioner | Conditions… | Request App | Tier | In TwistRouting |
|---|---|---|---|---|
| **Closed-Caption Strip / Extract / Convert** | remove, extract, or re-map CC/608-708 in ANC | AR.9.1 (insertion; strip/extract is the inverse) | F | L1 (labels in Signaling/Encoder) |
| **CC Inserter** | (egress) insert captions into ANC | AR.9.1 | F | L1 |
| **SCTE Trigger Reader** | extract ad/splice cues | AR.9.2 | F | **L2** (Signaling editor UI) |
| **SCTE Trigger Inserter** | (egress) inject splice cues | AR.9.3 | F | L2 (Signaling UI) |
| **Audience-Measurement Watermark** | (egress) encode watermark | AR.9.4 | F | L0 |
| **Timecode / A-V Sync Reader** | verify sync, read/insert TC | AR.8.15 | F | L0 |

### 2D. Metering, probing, routing
| Conditioner | Conditions… | Request App | Tier | In TwistRouting |
|---|---|---|---|---|
| **Audio Level Meter** | PPM/VU/true-peak (BS.1770) | AR.8.10 | F | **L2/L3** (Audio-Monitor, Meter-Input) |
| **Loudness Monitor** | integrated/short/momentary LUFS | AR.8.11 | F | **L2/L3** |
| **Video Waveform / Vectorscope** | levels, gamut confidence | AR.8.12 | F | **L2** (camera scopes, Meter-Input) |
| **Video Signal Probe** | freeze/black/format detect | AR.8.13 | F | L1 (label) |
| **Audio Signal Probe** | silence/clip/no-modulation detect | AR.8.14 | F | L1 |
| **Re-Router / Router Bus** | in-platform crosspoint + shuffle | AR.7.1 | P | **L3** (`routing-core`) — the strongest existing piece |
| **System Input / Output (on/off ramp)** | ST 2110 / SRT / TS / NDI edge | AR.3.1–3.15 | P/F | L0 processing; L2 encoder GUI |

**Takeaway:** the conditioner row is dominated by Apps TwistRouting **does not yet represent** (frame sync, converters, delays, downmix/upmix, dynamics, loudness *processing*, CC/ANC processing). The pieces it *does* have — **metering/probe surfaces (Meter-Input, Audio-Monitor), scopes, and the routing/tally core** — are exactly the *monitoring and routing* slots of the row, which is a natural first foothold.

---

## 3. The Conditioning Chains (order matters)

A row is not a random bag of Apps — it's an **ordered chain** per signal, because conditioning steps are sequence-dependent (you legalize colour *after* converting raster; you normalize loudness *after* shuffling to the correct channel map; you meter *at* the point you care about).

### 3A. Ingress chain (per incoming source, before production)
```
System Input (on-ramp)                         AR.3.x
  → Frame Sync / reference align               AR.4.22 / AR.3.30
  → Raster/Scan convert (Up/Down/Cross)        AR.4.2
  → Frame-rate convert                         AR.4.3
  → Aspect-ratio / crop-scale                  AR.4.20
  → SDR/HDR convert                            AR.4.23
  → Proc-amp / colour legalize                 AR.4.1
  → ANC hygiene: CC strip/extract, SCTE read   AR.9.1 / AR.9.2
  → Audio de-embed + SHUFFLE to house map      AR.5.2 / IS-08
  → Audio delay (lip-sync)                     AR.5.3
  → Down/Up-mix to house program format        AR.5.4 / AR.5.5
  → Gain / EQ / loudness pre-condition         AR.5.x / AR.5.25
  → METER + PROBE tap (confidence)             AR.8.10–8.14
  → RE-ROUTE onto data plane → production Apps  AR.7.1
```

### 3B. Egress chain (per studio output, before it leaves)
```
Production program / iso / clean feed
  → Loudness normalize to delivery target      AR.5.25
  → ANC insert: CC, SCTE, timecode             AR.9.1 / AR.9.3
  → Watermark encode                           AR.9.4
  → Format convert to delivery raster/codec    AR.4.2 / AR.4.3 / AR.4.23
  → A/V sync verify + embed                    AR.8.15
  → Automatic changeover / failover            AR.4.8
  → METER + PROBE tap (as-delivered)           AR.8.10–8.15
  → System Output / Encoder (off-ramp)         AR.3.x
```

**Design rules this exposes (worth enforcing in any implementation):**
- **Frame sync / reference is first** — everything downstream assumes aligned timing (ties to CR.5 PTP: 30-min holdover, graceful re-lock, per-NIC lock).
- **Shuffle before loudness/mix** — you must be on the correct channel map before you process levels.
- **Meter is a *tap*, not an in-line block** — probes read the data plane at a point without altering it (matches the request's "read essence health from the data plane" API pattern, CR.6).
- **Re-router is the spine** — the row is really a *series of crosspoints* with a conditioner hung on each; this is why the routing core is the right foundation (§5).
- **Bypass is mandatory** — every conditioner needs a clean-bypass path so a failed/mis-set conditioner can be taken out without dropping the studio.

---

## 4. Platform, Control & Licensing Implications

The conditioner-row pattern stresses exactly the parts of the request that are *platform*, not *App*:

- **Instancing at scale.** A large studio's row = dozens of small App instances (per source × per conditioner stage). This is the archetypal use of the request's **resource declaration** (AR.1.11 — each App declares CPU/RAM/GPU/bandwidth) and **containerization / Helm** (AR.1.09/1.12): a row is a *Helm-chart-shaped bundle* of conditioners with declared resources.
- **In-memory data plane.** Conditioners chain best when essence passes **uncompressed in memory** between them (AR.0 platform vision; RDMA/RoCE across servers) — otherwise each conditioner adds a compress/transport/decompress penalty. The row is the strongest argument for the shared data plane.
- **Control-plane API (the centrepiece).** A row is only manageable if every conditioner exposes **full R/W config + operational params + health + ≥10 presets** over a common API (CR.6). Row-level orchestration = "instantiate this template, apply this preset set, wire these crosspoints" — pure API choreography.
- **Presets & templates.** House conditioning is preset-driven: a "1080i59.94 / −23 LUFS / house 5.1 map" preset applied across the row. Backward-compatible preset persistence is a maintenance requirement (COM.10.15).
- **Health & probing telemetry.** Each conditioner reports essence health (freeze/black/silence/clip/format-mismatch/ANC-present) per CR.6.6 — the row *is* a distributed probe network.
- **Licensing — the perfect flex-points case.** Many small, transient conditioners = the exact workload the request's **Flex Points** model (AR.1.3, Acquisition Models 1–2) is designed for: spin up extra frame syncs/meters for a big show, release them after. Plus **off-line** (watermarked, free) and **backup** (reduced-cost standby) modes (AR.1.3.12–3.16) map directly to line-up rows and redundant conditioners.
- **Integration.** The row's crosspoints and the studio's tally must be visible to and drivable by the external broadcast controller (SWP-08 / NMOS IS-05) and tally system (TSL 5.0) — integration Cases 1–5 in the audit.
- **Formats.** Conditioners must honour the full CR.1–CR.5 matrix (rasters incl. vertical/social, SDR/HDR, audio 48k/96k, ST 2110 levels, PTP).

---

## 5. Mapping To TwistRouting — What Exists, What's New

The conditioner row is a **natural next surface for TwistRouting**, because TwistRouting already has the two hardest-to-fake pieces: a **routing spine** and **monitoring instruments**. But most conditioners are new.

### 5A. What TwistRouting can reuse today
| Row need | TwistRouting asset | Level |
|---|---|---|
| The spine (crosspoint + shuffle + fault/tally) | `src/domain/routing-core` (`take/clear/salvo/computeTally/mixMinus/diff`) | **L3** — genuine logic |
| Metering conditioner (audio) | Audio-Monitor + **Meter-Input** test tool (PPM/VU/BS.1770) | L2/L3 |
| Metering conditioner (video) | Camera scopes / Meter-Input (parade, vectorscope) | L2 |
| Proc-amp-ish surface | Camera-Control shading | L2 |
| Discovery / instancing UI | `Routes/**` JSON discovery + twist/editor plugin registry | L2/L3 |
| Role gating on conditioner controls | capability model (`route`, `signal`, `audio`, `shade`) | L3 model |
| A test/instrumentation destination | new `005_TEST TOOLS/` + Meter-Input pattern | L2 |

**The Meter-Input tool is effectively the first conditioner already prototyped** — a destination twist that any source routes into, presenting a bank of instruments. That is the row's *metering slot* in miniature.

### 5B. What's new (delta to build)
| Row element | Build | New in TwistRouting? |
|---|---|---|
| **A "Conditioner Row" destination/panel** — one studio's row as a strip of conditioner twists in signal order | new UI: a horizontal rack of twists with per-stage bypass/health | **Yes** |
| **Frame-sync / delay editor** | new editor (AR.4.22) — offset, reference-lock status, holdover | Yes (L0) |
| **Converter editors** (up/down/cross, frame-rate, ARC, SDR/HDR) | new editors (AR.4.2/4.3/4.20/4.23) | Yes (L0) |
| **Audio shuffler editor** | new editor over `routing-core` mixMinus/map (AR.5.2, IS-08) | Partial — logic exists, no editor |
| **Delay / downmix / upmix / dynamics / loudness *processor* editors** | new editors (AR.5.3/5.4/5.5/5.16–25) | Yes (L0) |
| **CC strip/insert + SCTE + timecode ANC editors** | new editors (AR.9.x, AR.8.15) | Partial — Signaling has SCTE UI |
| **Signal probe editors** (freeze/black/silence/clip) | new — extend Meter-Input into a probe with alarms (AR.8.13/14) | Yes (L1) |
| **Row template / preset system** | JSON row template + preset apply across the strip | Yes |
| **Bypass + failover affordance** per conditioner | UI + state | Yes |

### 5C. How it slots into the recommended direction
This is a concrete instance of **Interpretation B** from the delta report ("operator-GUI + orchestration front-end for real Apps"):
- Model the row as **data** (`Routes/**` — a studio's conditioner strip is just a destination with an ordered list of conditioner twists). Zero-backend discovery means adding a studio's row is a JSON edit.
- Each conditioner editor is a **Part-3 GUI** over a **typed control-plane API client** (the delta's P1 build) — so the *same editors* work as (a) simulation today and (b) real control once wired to conditioner Apps' APIs.
- The row's crosspoints ride the existing `routing-core`; wiring it to **NMOS IS-05 / SWP-08** (delta P1) makes the re-router real; **TSL 5.0** (delta P2) makes tally real.

---

## 6. Recommended Build Path (phased)

Ordered by leverage, reusing the delta report's L0→L levels.

| Phase | Build | Maps to | Result |
|---|---|---|---|
| **C1** | **"Conditioner Row" destination + panel**: model a studio row as ordered conditioner twists (JSON), render as a signal-order rack with per-stage health/bypass | §3 chains; AR.0 workflow | The pattern becomes visible & navigable (L2) |
| **C1** | **Generalize Meter-Input → "Probe" conditioner** (video+audio) with freeze/black/silence/clip alarms | AR.8.13/8.14 | First conditioner beyond metering (L2→L3) |
| **C2** | **Frame-Sync, Delay, Shuffler, Loudness** editors (the four most-used conditioners); shuffler + router over `routing-core` | AR.4.22, AR.5.3, AR.5.2, AR.5.25 | Core ingress conditioning modelled (L2) |
| **C2** | **Row template + preset apply** across the strip | AR.1 presets; CR.6 | House-spec conditioning in one action |
| **C3** | **Converter editors** (up/down/cross, frame-rate, ARC, SDR/HDR) | AR.4.2/4.3/4.20/4.23 | Format-conditioning breadth (L2) |
| **C3** | **CC strip/insert + SCTE + A/V-sync** ANC editors (extend Signaling) | AR.9.x, AR.8.15 | ANC conditioning (L2) |
| **C4** | **Wire to real APIs**: control-plane client + NMOS IS-05/SWP-08 (re-router) + TSL 5.0 (tally) | delta P1/P2; integration Cases 1–5 | Row becomes a *real* control surface (L3→L4) |
| **C4** | **Row-as-Helm-bundle** view + resource declaration + flex-points cost readout | AR.1.09/1.11; AR.1.3 licensing | Instancing/licensing made legible |

**Explicitly not in scope here (per the delta report):** the conditioners' actual DSP/processing (Part 1), the data plane, and licensing *enforcement* — those live in the vendor Apps/platform. TwistRouting builds the **row's control, monitoring, orchestration, and visualization**.

---

## 7. Bottom Line

- **The concept is sound and standards-aligned.** A per-studio signal-conditioner row is the direct, physical expression of the request's decouple-input/processing/output principle (AR.1.05) and its per-time-of-day App-complement vision (AR.0). Every conditioner named — frame sync, metering, shufflers, re-routers, CC strippers — is an App already in the requirements catalog (frame sync AR.4.22, metering AR.8.10–15, shuffler AR.5.2/AR.7.1, re-router AR.7.1, CC AR.9.1).
- **It stresses the *platform* layer most:** in-memory data plane, containerized instancing with resource declaration, a common control-plane API with presets/health — and it is the **ideal showcase for the flex-points licensing model** (many small, transient Apps).
- **TwistRouting already owns the row's two anchor slots** — the **routing spine** (`routing-core`, L3) and the **monitoring instruments** (Meter-Input / Audio-Monitor / scopes, L2/L3). Meter-Input is, in effect, the first conditioner prototype.
- **The build is mostly new conditioner editors** hung on the existing spine, modelled as `Routes/**` data, and — following Interpretation B — backed by a control-plane API client so the same GUIs serve both today's simulation and tomorrow's real control.
- **Sequence it ingress-first** (frame-sync → convert → legalize → strip → shuffle → level → meter → route), enforce **bypass on every stage**, and treat **meters/probes as taps** on the data plane, not in-line blocks.

> **One sentence:** the conditioner row turns TwistRouting's routing map into a *studio-edge processing map* — a rack of small, orderable, preset-driven conditioner Apps that clean signal in and dress signal out, built on the routing/monitoring foundation the project already has and the API/integration layer the delta already recommends.
