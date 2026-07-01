# Audit — Production Entities: People, Places & Things

**Companion to:** `Flexible-Software-Media-Production-Requirements-Audit.md` (App IDs `AR.x`), `TwistRouting-vs-Requirements-Delta.md` (L0–L4 scale), `Signal-Conditioner-Row-Design-Audit.md`, `Graphics-Engine-Audit.md`.

**What this audits.** How a broadcast/radio facility models the **people, places, and things** of a production — the people on screen, the people at the console, the mics/cameras/IFBs they use, where they sit — and how a person "plays in the sandbox" by being **bound** to their kit and location for a given show. The goal is a **production-entities data model**: first-class, reusable entities and the per-show bindings between them. Client identifiers stripped; technology only.

---

## 0. The Core Idea — Entities + Per-Show Bindings

A facility has a stable inventory of **entities** and a changing set of **bindings**:

- **People** — talent (seen/heard by the audience) and crew (operate equipment, never on air).
- **Places** — facility → studio/floor → control room → **position/seat**.
- **Things** — mics, inputs/preamps, IFB feeds, cameras, name-supers, stage boxes.

A **production/show** is not new hardware — it is a **set of bindings** between a Person and Things at a Place, for a span of time:

```
   PERSON ⇄ SEAT(place) ⇄ MIC ⇄ INPUT/preamp(source name) ⇄ IFB(mix-minus)
          ⇄ CAMERA(tally, CCU/RCP) ⇄ NAME-SUPER(rundown/CG)
```

Every edge is a per-show **assignment**; the shared join key is the **position/seat + source mnemonic**. Because names are role/position mnemonics (`ANCHOR-1`, not a serial number), the *same physical kit serves different people across shows just by re-binding*. This reconfigurability is exactly the "sandbox" — and exactly what a flexible/software facility (ST 2110 / NMOS / AoIP) should represent as reusable objects.

> **The single most important gap for TwistRouting (previewed here, detailed in §5):** the codebase models **Things** (sources = mics/cameras) and **crew roles** (auth), and has a **booking vision** (schedule) — but it has **no first-class "Person" (talent) entity** and **no binding graph** tying a person to their mic/IFB/camera/seat/name-super. That graph is the missing spine.

---

## 1. People — Two Different Person-Types

Talent and crew are described by *different* attribute sets and bound to *different* resource classes. Model them as one `Person` entity with a `kind` and role-specific fields.

### 1A. On-air talent (people on screen / on mic)
| Attribute | Why it matters | Consumed by |
|---|---|---|
| **Display name + title/role** (often several per show) | Drives the **name super / lower-third / aston / chyron** | Graphics engine (see Graphics-Engine-Audit) |
| **Name pronunciation** (phonetic) | Read aloud / verified by presenters | Talent, prompter |
| **Good side / bad side / preferred side** | Blocking + which camera favours them | Director, camera ops, CCU |
| **Mic preference** (lav · handheld · headset · boom/shotgun · desk) | Default capture choice | A1/A2, stage box |
| **IFB / earpiece listen-source + interrupt rights** | What they hear (program / **mix-minus**) and who can interrupt | IFB, comms |
| **Seat / position / mark** on set | Location; correlates to favouring camera + mic placement | Floor, cameras, audio |
| **Talent type** | host · co-host · panelist · in-studio guest · correspondent · **remote/at-home contributor** (radio: host/co-host/guest/phone-in) | Rundown, comms |
| **Continuity notes** | Makeup/wardrobe continuity | Production |

### 1B. Crew / operating positions (people at the console)
Each role maps to **(a) a scope of functions, (b) a control surface, (c) a physical position** in the control room / OB truck.

| Role | Operates | Scope |
|---|---|---|
| **Director** | monitor wall / multiviewer (commands crew) | Shot selection, calls the show |
| **TD / Technical Director** | **vision mixer / switcher** | Cuts, transitions, keys |
| **Producer / EP** | rundown, comms | Content, timing, editorial |
| **Audio A1** | **audio console** | Program mix; builds mix-minus/IFB |
| **Audio A2** | stage/floor audio | Rigs mics/IFB/comms; RF wrangling |
| **CCU / Shader / Racks** | **CCU / RCP** | Iris, black balance, colour matching |
| **Graphics / CG op** | graphics/CG system | Plays lower thirds, tickers, scores |
| **Replay / EVS op** | replay server | Records, builds, plays replays |
| **Camera ops** | camera + pan-bar (tally + comms) | Framing, focus, moves |
| **Lighting Director** | lighting console | Studio lighting |
| **Floor Manager** | talkback/IFB to talent | Cues talent, relays director |

This crew→surface→scope→position mapping is *precisely* the model TwistRouting's role/capability system already gestures at (§5).

---

## 2. Things — Resources & Their Attributes

### 2A. Microphones & mic sources
- **Type** (`mic.type`): lavalier/lav, handheld, headset/headworn, boom/shotgun, desk/podium, hanging; radio adds the studio arm mic.
- **Connection** (`mic.connection`): wired (XLR balanced) vs **wireless** (an **RF channel/frequency** = a TX/RX pair; store band/freq, TX id, RX slot).
- **Phantom `+48V`**: condenser mics need it; dynamics don't; **ribbons can be damaged** by it → a per-input boolean tracked against mic type (safety interlock — the Stage-Box editor already models this).
- **Signal chain / where it lands:** mic → (stage box / I/O box) → **mic preamp** (≈19–75 dB gain) → console **channel/fader**. The landing point is a **preamp/stage-box channel number** (`SB1 IN 07`); in AoIP it is a named channel (Dante `Device@Channel`, ST 2110-30 flow).
- **Model relationship:** **mic (asset) → input/preamp channel (address) → source name (mnemonic) → fader**.

### 2B. IFB / comms / talkback
- **IFB (Interruptible Foldback):** one-way cue to talent; they hear a **listen source** (program or mix-minus), a producer can **interrupt** with their mic.
- **Mix-minus:** program **minus that talent's own audio** — one bus **per talent/remote** (the coupling: `IFB feed = program − their mic`, interruptible).
- **Program vs interrupt** channels for dual-ear headsets (US convention: interrupt = left, program = right).
- **Party-line vs matrix:** party-line = shared conference channels via **beltpacks**; **matrix intercom** = crosspoint router of named **ports** (panel/beltpack/IFB output/4-wire), each with a mnemonic assigned to a person/position.
- **Naming:** IFB feeds named by person/position/location — `IFB ANCHOR`, `IFB FIELD-1`, `IFB TALENT-2`. Attributes: feed name, listen source (mix-minus bus id), interrupt source, matrix port, delivery (wired / RF freq).

### 2C. Cameras
- **Identity/position:** camera number (`CAM 1…N`) + named position (`CAM3-HH`, `JIB`, `HIGH-WIDE`).
- **Control** (`camera.control`): manned vs **robotic/PTZ** (preset shots per camera).
- **CCU / RCP:** CCU = base station; **RCP/OCP** = shader panel (iris/black/paint); RCP can be delegated across cameras.
- **Tally** (`tally` enum): **PGM** (red/on-air), **PVW/PST** (green/next), **ISO** (record) — driven from the switcher via GPIO / switcher protocol / **TSL**, shown on camera + multiviewer UMD.
- **Framing/shots** (WS/MS/CU/2-shot) — the operational descriptor a person's camera provides.

### 2D. Name-supers (the on-screen identity thing)
A person's lower-third graphic (`line1=name, line2=title`), driven from the **rundown / NRCS** over **MOS** into a **CG template** — see `Graphics-Engine-Audit.md`. It is a *Thing bound to a Person*.

---

## 3. Places — The Location Model

Hierarchy the facility tracks: **facility → studio/floor → control room(s) → position/seat**. Rooms: studio floor, **PCR/gallery**, **ACR** (audio control room), **MCR** (master control), edit suites; radio adds on-air studio + control room (with an auto **on-air light** when a mic opens).

- **Location** answers *where a person/mic/camera physically is* = room + **position/seat** (`ANCHOR DESK SEAT-1`, `GUEST-2`, `WEATHER WALL`).
- **Location-based naming:** a **stage box / I/O panel per floor or room** gives inputs like `FLOOR-A SB1 IN 07`, so a mic's source name inherits its physical location. This is what lets "seat 2's mic" resolve to a specific preamp channel and mnemonic. *(TwistRouting sources already carry a `floor` field — the seed of this.)*

---

## 4. Naming & Propagation — The Glue That Makes Bindings Visible

The reason the binding model works live is a naming + propagation layer:

- **Mnemonics / labels:** short, human-readable names per router source/destination, encoding **role + position** (not serials) so they survive re-patching. Legacy 4/8-char fields; AoIP allows longer (Dante ≤30).
- **Source / destination tables:** the router/broadcast controller holds a source table + destination table (index + mnemonic + physical I/O). *(This is the AR.1.5 integration surface — SWP-08 XY, NMOS IS-05.)*
- **UMD (Under-Monitor Display) & multiviewer:** each MV window shows the source mnemonic + tally; "follow" naming shows whatever source is currently routed.
- **TSL protocol:** the de-facto lightweight protocol carrying **dynamic label text + tally** between router, switcher, tally controller, multiviewer, cameras. Addressing: screen→display index; per-display `lh_tally`/`rh_tally`/`txt_tally`; v3.1 = 16-char label + 2 tally bits; v5 = longer labels, UDP. *(This is the TSL 5.0 integration in the delta/conditioner audits.)*
- **NRCS + MOS:** the newsroom rundown drives name-supers into CG templates, so a person's on-screen ID can change live.

**One label, many edges:** because `ANCHOR-1` is a role/position mnemonic, it resolves across the person's audio input, their IFB, their camera tally, and their lower-third — TSL/router/NRCS keep all of them consistent. That shared mnemonic *is* the join key of the binding graph.

---

## 5. The Binding Graph (the heart) & How TwistRouting Maps To It

### 5A. The graph
```
                       ┌─────────────┐
          name-super ──│   PERSON    │── seat / position ──► PLACE (room)
      (rundown/CG)     │ talent|crew │
                       └──┬───┬───┬──┘
              mic ────────┘   │   └──────── camera (tally, CCU/RCP, shot)
               │              │
        preamp/input          IFB feed = program − own mic (interruptible)
     (source mnemonic)             │
               │                   └──── matrix port / RF / mix-minus bus
        console fader
```
Each edge = a per-show binding. Crew add: person → **operating position** → **control surface (scope)** → **PCR seat** → **intercom port** (talk/listen rights). **Tally** is the shared runtime "on-air" signal linking switcher ⇄ talent ⇄ cameras.

### 5B. What TwistRouting has vs. needs

| Entity / relationship | In TwistRouting today | Level | Gap |
|---|---|---|---|
| **Things — mics/cameras/stage boxes** as data | `Routes/Sources/**` JSON (`{id,name,prefix,count,floor,items,status}`); Stage-Box editor models preamp/+48V/impedance | **L2/L3** | Real, thing-centric. Missing per-input mic *type/RF/preference* metadata |
| **Places — floor/room** | Sources carry `floor`; Destinations = rooms/twists | **L2** | No explicit **seat/position** sub-entity |
| **Crew — roles/positions/scope** | `auth.js` roles + capability model + progressive disclosure; README's Schedule→Booking vision | **L3 model** | No real per-show crew *assignment* wired (scaffolding) |
| **People — TALENT (on screen)** | **none** — sources are *signals*, not people | **L0** | **The biggest gap: no talent Person entity** (name/pronunciation/good-side/mic-pref/IFB/seat/super) |
| **Binding: person ↔ mic ↔ input** | implicit only (a source *is* a channel) | **L0–L1** | No person→mic→input link |
| **Binding: person ↔ IFB (mix-minus)** | IFB editor models mix-minus + interrupt as UI | **L2** | Not bound to a specific *person* |
| **Binding: person ↔ camera/tally** | Camera-Control (8 cams, CCU/RCP, tally); Signaling distributes tally | **L2** | Tally not tied to a person/seat |
| **Binding: person ↔ name-super** | none (no graphics engine — see Graphics audit) | **L0** | Needs the graphics-engine + person link |
| **Naming/propagation (mnemonics, UMD, TSL)** | source/twist names, fault propagation via `routing-core`; tally simulated | **L1–L3** | Real graph logic exists; TSL/UMD is labels only |
| **Per-show assignment (call sheet/crew list/rundown)** | `schedule.js` timeline of shows + booked crew (vision) | **L2 vision** | The **join table** exists in spirit; not the talent+binding side |

**Interpretation:** TwistRouting is **signal-and-crew-centric**; it lacks the **talent Person entity** and the **binding graph** that ties people to their kit, seat, and super. But it already has the three hardest ingredients — a **Things inventory** (sources), a **crew/role model** (auth), and a **per-show assignment vision** (schedule/booking). Adding People (talent) + bindings is *additive*, and it's the spine that makes the existing editors (Stage-Box, IFB, Camera, Signaling, and a future Graphics engine) cohere around a person rather than around a raw signal.

---

## 6. Recommended Build Path (phased)

| Phase | Build | Result |
|---|---|---|
| **E1** | **`Person` entity in `Routes/**`** — talent + crew, with the §1 attributes (name, pronunciation, title/super, good-side, mic-preference, IFB listen-source, seat, type; crew: role/scope/position/skills). Zero-backend discovery like every other resource | People become first-class data (L0→L2) |
| **E1** | **Seat/Position sub-entity** under rooms (place model) | Location model completes (L2) |
| **E2** | **A "Roster / Bindings" editor** — assign, for a show, each Person → seat, → mic (→ input/source mnemonic), → IFB (mix-minus), → camera (tally/CCU), → name-super. One screen that builds the §5 graph | The binding spine exists (L2→L3), reusing `core.js`, role gating |
| **E2** | **Wire existing editors to the person** — Stage-Box shows *whose* mic; IFB shows *whose* mix-minus; Camera/Signaling tally shows *who* is on air; label everything by the shared **mnemonic** | Editors cohere around people, not raw channels |
| **E3** | **Name-super link** — bind a Person to a Graphics-engine lower-third template (`line1/line2`) so taking a super is "put PERSON on air" | Ties People ↔ Graphics engine |
| **E3** | **Fold into the Schedule/Booking vision** — booked crew load their scope automatically (already the README's intent); booked talent load their bindings | The join table (call sheet/crew list/rundown) becomes real |
| **E4** | **Real propagation** — mnemonics/UMD via **TSL 5.0**, router tables via **SWP-08/NMOS IS-05**, supers via **MOS** (Interpretation B) | Names + tally consistent across a real plant |

**Out of scope here:** the actual audio/RF/camera hardware — TwistRouting models the **entities, bindings, naming, and control**, not the transport (that's the platform/vendor Apps).

---

## 7. The Sandbox — How It All Plays Together

Per production, nothing is rewired — resources are **re-bound and re-labelled**: the router re-points crosspoints, the matrix intercom re-assigns IFB/PL ports, the console loads a show file (preamps→faders→mix-minus), robotic cameras load preset shots, and **TSL** repaints every UMD label + tally. Because names are **role/position mnemonics**, the same kit serves different people show to show by re-binding.

A software-defined facility models everything as **reconfigurable, reusable objects**:
- **People** (talent/crew) — stable ID, profile, preferences.
- **Places** (facility→room→seat) — where things and people are.
- **Things** (mics, inputs/preamps, IFB feeds, cameras, name-supers) — stable ID, **mnemonic/label**, **address** (stage-box/Dante channel / matrix port / IP flow), **state** (tally, phantom, on/off).
- **Production/Show** — a set of **bindings** between a Person and Things at a Place, with router/TSL/NRCS as the propagation layer keeping names + tally consistent across console, router, multiviewer, cameras, comms, and graphics.

This is the person↔place↔thing reconfigurability a routing/production data model should represent — and it is the unifying layer under every editor already in TwistRouting.

---

## 8. Bottom Line

- **The model is entities + per-show bindings.** People (talent + crew), Places (facility→room→seat), Things (mics, inputs, IFB feeds, cameras, name-supers) — joined per show by the graph **Person ⇄ Seat ⇄ Mic ⇄ Input(mnemonic) ⇄ IFB(mix-minus) ⇄ Camera(tally/CCU) ⇄ Name-super**, propagated by **TSL / router tables / NRCS-MOS**.
- **Talent attributes are concrete and specific:** name + pronunciation + title (→ super), good/bad side (→ framing), mic preference (→ capture), IFB listen-source + interrupt (→ what they hear), seat (→ location + favouring camera), type (host/guest/**remote**). Crew attributes are role → **scope + control surface + position + comms port**.
- **TwistRouting today** models **Things** (sources) and **crew roles** (auth) and has a **booking vision** (schedule) — but has **no talent Person entity (L0)** and **no binding graph (L0–L1)**. That graph is the missing spine that would make Stage-Box, IFB, Camera, Signaling, and a future Graphics engine all revolve around *people* instead of raw channels.
- **Build it additively:** a `Person` entity + a **Roster/Bindings editor** that assembles the graph, wired into the existing editors and the schedule/booking vision — real GUI now, real propagation (TSL/SWP-08/NMOS/MOS) when connected (Interpretation B).

> **One sentence:** a production is people bound to things at places for a while — model People (talent + crew), Places (rooms + seats), and Things (mics, IFBs, cameras, supers) as reusable objects, and make a show nothing more than the set of bindings between them, kept consistent everywhere by shared mnemonics and tally.

---

## Sources

- IFB / mix-minus / comms: en.wikipedia.org/wiki/Interruptible_foldback; rfvenue.com (All About IFBs); clearcom.com & clear-com.atlassian.net (IFB); studio-tech.com (IFB beltpacks); thebroadcastbridge.com (Monitoring, Mix-Minus & Comms)
- Crew & control room: en.wikipedia.org (Production control room, Television crew, Production truck); classicteleproductions.com (live sports positions); mediacollege.com (CCU)
- Intercom: tcfurlong.com (party-line intercom); fullcompass.com (intercom buyers guide); datavideo.com (ITC-100 talkback+tally); rtsintercoms.com (VLink cloud/SIP IFB)
- Mics & signal chain: shure.com (shotgun mics, phantom power); editmentor.com (mic types); sound-au.com (phantom/preamp/stage box); audinate.com (Dante device/channel names; Dante/AES67/ST 2110)
- Cameras/CCU/PTZ: cyanview.com; av-iq.com / telemetrics (RCCP); kb.ct-group.com (Panasonic RoP/RCP + CCU/PTZ)
- Tally & naming: tslumd.readthedocs.io (TSL UMD protocol); xichtee.com (TSL overview); tslproducts.com (tally/UMD/camera delegation); help.rossvideo.com (TSL ID / UMD name setup); support.rascular.com (TSL UMD source/dest→display mapping)
- Name supers / rundown: en.wikipedia.org/wiki/Lower_third; nbcuacademy.com (chyrons/lower thirds); newscaststudio.com (Aston); rundowncreator.com (CG from rundown); avid.com (iNEWS Command MOS)
- Talent mic choice: 4wall.com, springtree.net (lav/headworn/handheld)
- Rundown/call sheet: dramatify.com (rundowns); studiobinder.com (call sheet)
- Radio: en.wikipedia.org/wiki/Radio_producer; beonair.com (radio production jobs); spotlight.com & mediarealm.com.au (radio/voice studio setups)
- Remote contribution: quicklink.tv (remote guests); ictbroadcast.com (WebRTC + SIP)
