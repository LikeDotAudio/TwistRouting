# Audit — The General Patch (Matrix Routing) & Its Grouping Model

**Source:** *Vista 1 Digital Mixing System — Operating Instructions, SW V5.3* (§4.4.2 The General Patch; §4.7.6 General Patch Edit; §4.7.16–17 Pro-Bel). Screenshot callouts from the supplied General Patch image.
**Companion to:** `TwistRouting-vs-Requirements-Delta.md` (L0–L4 scale), `Production-Entities-People-Places-Things-Audit.md` (source/target naming), `Signal-Conditioner-Row-Design-Audit.md`.

**Focus of this audit:** explain the General Patch matrix-routing tool and — as requested — **the grouping**: how the enormous source×target matrix is sliced into **Source Groups, Target Groups, Page Groups, and User Patch Groups** ("sub-patches"), and how that model maps onto TwistRouting's own routing.

---

## 1. What the General Patch Is

The General Patch is a **software patch bay** — the main tool to establish and clear audio connections in the console. It deliberately mimics a conventional analog patch bay but does far more:

| Analog patch bay | General Patch equivalent |
|---|---|
| Patch cords | **Cross-points** in the X-Y field |
| Patch-jack pairs | **Sources** (Y/left axis) and **Targets** (X/bottom axis) |
| Rows of jacks | **Sources List** (upper) and **Targets List** (lower) |
| "Normalled" defaults | Default connection per source/target-type combo |
| — | **Cross-points saved into snapshot/preset memory** |

It uses an **X-Y axis representation**: pick a Source on the vertical axis and a Target on the horizontal axis; where the two **selection bars** intersect, you make or clear a cross-point. Because a full matrix of *every* source against *every* target would be unmanageably large, the General Patch is presented as **"sub-patches"** — you view **groups** of sources/targets at a time, or any predefined combination via **User Patch Groups**. **That grouping is the subject of §3, the heart of this audit.**

---

## 2. Anatomy (mapping the screenshot callouts)

| Callout | What it is |
|---|---|
| **Source Patch Group Selection** | Ribbon frame that chooses which group of **sources** fills the Y-axis (Input Ports, Bus Out, Direct Out, Insert Send, Generator, Shared Process…) |
| **Target Patch Group Selection** | Ribbon frame that chooses which group of **targets** fills the X-axis (Channel In1/2, Output Ports, Insert Return, Dyn Ext Key…) |
| **Page Patch Group Selection** | Chooses a **Page Group** that sets *both* axes at once (a predefined source+target combo) |
| **X-Y Field** | The matrix grid where cross-point icons live; make/clear/interrogate connections here |
| **Sources List** (Y/left) | The vertical list of sources in the selected source group |
| **Targets List** (X/bottom) | The horizontal list of targets in the selected target group |
| **Source Selection Bar** / **Target Selection Bar** | The highlighted row/column whose intersection is the active cross-point |
| **Label Type Selector** | Toggles all labels between **Fixed / User / Inherited(Device)** |
| **Sorting Order** | Sorts the lists alphabetically by **Fixed** or **User** label |
| **Inspector Display** | Detail panel for the selected source/target |

The matrix **auto-sizes** to the loaded configuration — number of channels, input/output interfaces, and DSP function blocks — and omits sections that don't exist (e.g. no Insert Send group if no inserts are configured).

---

## 3. The Grouping Model (the core of this audit)

A patch bay this large is only usable because it is **grouped**. There are **four tiers** of grouping, three fixed and one user-defined.

```
                         GENERAL PATCH  (full source × target matrix)
                                        │  sliced into "sub-patches" by…
        ┌───────────────────────┬───────────────────────┬───────────────────────┐
   SOURCE GROUPS            TARGET GROUPS            PAGE GROUPS             USER PATCH GROUPS
  (navigate Y axis only)  (navigate X axis only)  (navigate BOTH axes)    (custom, saved)
        │                       │                       │                       │
   Dir Out                 Channel In1             predefined              User Source Group
   Input Ports             Channel In2             source+target           User Target Group
   Insert Send             Channel In3             combination             User Page Group
   Bus Out                 Output Ports            = a ready-made          (may MIX source/target
   Generator               Insert Returns            "sub-patch" view        types freely)
   Shared Process          Dyn Ext Key
   Effect Out              Shared Process
                           Effect In
```

### 3A. Source Patch Groups — navigate the **source** (Y) side only
| Group | Contains |
|---|---|
| **Dir Out** | All Direct Outputs of all channel types |
| **Input Ports** | All input audio interfaces (AES/EBU, MADI, D21m A/D) |
| **Insert Send** | Sends from the inserts of all channel types |
| **Bus Out** | Any bus as a source (a mono AUX bus can feed an output, or become a channel input) |
| **Generator** | The test generator's signal |
| **Shared Process** | Outputs of the shared-process DSP (CR/ST monitoring, downmixers, shared delays…) |
| **Effect Out** | Output signals from the FX engines |

### 3B. Target Patch Groups — navigate the **target** (X) side only
| Group | Contains |
|---|---|
| **Channel In1** | First input to all channel types (default bus connection for output channels) |
| **Channel In2** | Second input to all channel types (free) |
| **Channel In3** | Third input (default = test generator; re-patchable) |
| **Output Ports** | All output audio interfaces (AES/EBU, MADI, D/A) |
| **Insert Returns** | Returns to the inserts of all channel types |
| **Dyn Ext Key** | External key input to the Dynamics sidechain |
| **Shared Process** | Inputs to the shared-process DSP |
| **Effect In** | Inputs to the FX engines |

### 3C. Page Patch Groups — navigate **both** axes at once
A **Page Group** sets the Source list *and* the Target list simultaneously — a **predefined source+target combination**, i.e. a ready-made **sub-patch view**. Instead of separately choosing "Input Ports" on Y and "Channel In1" on X, one Page Group click stages the whole common view. This is the fastest routine-navigation path.

### 3D. User Patch Groups — custom, saved sub-patches
The most powerful tier. In **General Patch Edit** mode (SysAdmin), the operator builds custom groups and saves them as:
- **User Source Group** — saves only the edited vertical source list (Y).
- **User Target Group** — saves only the edited horizontal target list (X).
- **User Page Group** — saves *both* lists (a complete custom sub-patch).

Key properties:
- **Mix types freely** — a User Group can contain some Bus Outs *and* some Direct Outs *and* some Input Ports together (fixed groups are single-type). This is the whole point: assemble exactly the sources/targets a given production/task needs into one compact matrix.
- **Built by assignment** — in Edit mode the grid is replaced by additional source/target lists with search boxes; double-click (or Shift/Ctrl-select + arrow) to assign items; assigned items turn **green**. **Move Up/Down** reorders. **Clear** starts from scratch.
- **Cross-group assembly** — while editing, you can switch to another source/target group and pull channels from it into the group you're building.
- **Saved via right-click → Save New / Update** on an existing user group.

### 3E. Rearranging groups (Edit mode)
Groups can be **repositioned**: right-click a group → **Pick**, move to the desired slot, right-click → **Swap** — the two groups exchange places. This lets a facility order the ribbon to match its workflow.

**Why grouping matters (the takeaway):** the full patch is far too large to view at once; grouping turns it into **task-sized sub-patches**. Fixed groups slice by *signal role* (inputs, buses, direct outs, inserts, FX…); Page Groups pre-stage common source+target pairings; **User Patch Groups let you author a bespoke, mixed-type sub-matrix per production and recall it instantly.**

---

## 4. How Patching Works (cross-points)

- **Make/clear:** cross the Source and Target selection bars, then **double-click** the X-Y intersection, or use the **MAKE CONNECT / CLEAR CONNECT** keys (fastest). MAKE applies the **default connection** for that source/target-type combo.
- **Connection-type menus** (double-click) depend on mono/stereo combos:
  - Mono→Mono: connect / protect / clear.
  - Stereo→Mono: Left→Mono or Right→Mono.
  - Mono→Stereo: Mono→both, →Left only, →Right only.
  - Stereo→Stereo: L→L R→R, L→R R→L, or **unlinked** (a stereo target split across two sources — shown **yellow**).
- **Surround:** a 5.1 source auto-patches to a 5.1 target in one click; a **`+` unfold** on a 5.1 target exposes all six legs for individual patching.
- **Diagonal / auto multi-patch:** drag a region across the grid, right-click → **Auto** to connect many cross-points at once (also lock/unlock/clear en masse).
- **Protected connections:** double-click → padlock; target turns **red**; a snapshot recall or user edit can't change it until unlocked.
- **Connection colours (navigation aid):**
  - **Green** = a single connection on that source/target.
  - **Yellow** = two or more connections.
  - **Red** = protected connection.
  Double-clicking a highlighted label jumps the selection bars straight to its cross-point (repeat to cycle through multiple).
- **Persistence:** all cross-points (and labels, and protection state) are **saved in snapshots/presets**.

---

## 5. Labels & Sorting (what fills the lists)

Three label types, toggled globally by the **Label Type Selector**:
- **Fixed labels** — auto-generated hardware identity (`AES In 4L (Local)`, `Line Output 07`); only SysAdmin may change.
- **User labels** — session names the operator assigns (`DAT 1`, `Snare`, `Foldback 1`), up to ~13 chars, shown on channel strips.
- **Inherited / Device labels** — the source signal's label, propagated to whatever channel it's patched into ("you see what you hear"); device labels come from a central `__DeviceLabels.pre` file so studio wiring is defined once.

**Sorting** orders the lists alphabetically by **Fixed** or **User** label (independent of which label type is displayed). **Label propagation** means you name a source once in the patch and the name follows it to every channel it's connected to — the same "name-by-source-mnemonic" principle covered in the People/Places/Things audit.

---

## 6. Integration & Companion View

- **Pro-Bel P-02/08 (SW-P-08) third-party control** (§4.7.16–17): external routers/controllers can drive console patch points natively over serial. Setup maps selected **targets** (and their connections) to **Pro-Bel source/destination combinations** — i.e. the console patch is exposed to the same **SWP-08 XY protocol** used elsewhere in this project's integration audits (delta report Cases 1–4). Selected targets show **pink** in Pro-Bel setup mode.
- **Channel Patch** (companion page): a *channel-oriented* view (one channel at a time) showing that channel's In1/In2/Gen/Snd/Ret/Ext/Dir patch points as a block diagram; double-clicking a point **jumps into the General Patch** with that point pre-selected. It's the "edit this one channel's routing" lens over the same cross-point data.

---

## 7. Mapping To TwistRouting

TwistRouting *is* a routing/patch tool, so the General Patch is a close relative — and TwistRouting already has a strong analog.

### 7A. What already lines up
| General Patch concept | TwistRouting today | Level |
|---|---|---|
| **X-Y cross-point matrix** | **`js/router-view.js` — the "1990s VIEW"**: rows = senders (sources) grouped by box, columns = receivers (destination twists) grouped by production, click a crosspoint to make/break the route, fold group headers | **L2/L3** — a real, interactive grouped crosspoint grid |
| **Cross-point make/clear** | drag-to-patch + router-view click; `src/domain/routing-core` `take/clear/salvo/diff` over an immutable graph | **L3** logic |
| **Source Groups** (slice Y by role) | source **pools** by category (`001_Sound / 002_Video / 003_Streams / 004_Play / 005_Prod`) and by `floor` | **L2** |
| **Target Groups** (slice X by role) | destination **categories** (`Control Rooms / Floors / Encoders / Edit Suites / Test Tools`) and per-destination twists | **L2** |
| **Connection colours** | fault colours (helix corrupts red) + route highlight; router-view crosshair | **L2** |
| **Labels** | source/twist names, `extraClass`, discovery-driven | **L2** |
| **Per-twist switcher matrix** | `matrix.js` generic switcher-matrix modal (drag rows to set switcher-input assignment/priority) | **L2** |

### 7B. What the General Patch has that TwistRouting lacks (the grouping delta)
| Concept | Why it's valuable | TwistRouting |
|---|---|---|
| **Page Patch Groups** — predefined *source+target* sub-patch views | One click stages a common routing view (e.g. "Stagebox → Control Room 3") — a named **workflow sub-matrix** | **L0** — router-view groups by box/production, but there's no saved *combined* source+target view |
| **User Patch Groups** — custom, **mixed-type**, saved sub-matrices | Author exactly the sources+targets a production needs (mix streams + stageboxes + buses) and recall instantly | **L0** — no user-defined saved groups |
| **Label-type toggle** (Fixed / User / Device) + sorting | Same signal, three naming lenses; propagation | **L1** — single label per source |
| **Snapshots / presets of cross-points** | Save & recall an entire routing state (with labels + protection) | **L0** — no snapshot of the route graph |
| **Protected / locked connections** | Guard a route from accidental change or snapshot recall | **L0** |
| **Connection-type semantics** (mono/stereo/surround leg mapping, unlinked stereo) | Fine-grained L/R/5.1 patching | **L1** — routes whole feeds; audio-shuffle lives in conditioner-row concept |
| **Connection-count colours** (green=1, yellow=2+, red=protected) | Instant read of fan-out & locks | **L1** — fault colour only |

### 7C. Interpretation
TwistRouting's **1990s VIEW is essentially a General-Patch-style X-Y matrix already** — grouped senders/receivers, clickable crosspoints, foldable groups, real route make/break, shareable URL. The gap is the **grouping *model* on top of it**: the General Patch's power isn't the grid, it's that the grid is sliced into **fixed role groups, predefined Page Groups, and saved User Patch Groups** — plus **snapshots, protection, and label modes**. Those are the additive concepts worth importing.

---

## 8. Recommendations (build the grouping model into TwistRouting)

| Phase | Build | Maps to |
|---|---|---|
| **P1** | **Page Groups / "sub-patch views"** — a saved `{sources[], targets[]}` view (JSON in `Routes/**`) that stages both axes of the 1990s VIEW at once; a picker in the router-view ribbon | §3C Page Patch Groups |
| **P1** | **Group-by selectors** for the router-view axes (by pool/category, by floor, by type) mirroring Source/Target Group slicing | §3A/3B |
| **P2** | **User Patch Groups** — an edit mode to assemble a **mixed-type** custom source+target list (assign/clear/reorder) and save it; recall from the ribbon | §3D |
| **P2** | **Route snapshots/presets** — save/recall the whole `routing-core` crosspoint graph (with labels) as a named snapshot | §4 persistence |
| **P3** | **Protected routes** — lock a crosspoint against change/recall; red state; warning on edit | §4 protection |
| **P3** | **Label-type toggle** (fixed/user/device) + sorting on the source/target lists | §5 labels |
| **P4** | **Connection-count colours** (green=1 / yellow=2+ / red=locked) on source/target headers | §4 colours |

All of this is additive over the existing `router-view.js` + `routing-core` and fits the zero-backend `Routes/**` data model — no rewrite. Under Interpretation B (delta report), the same grouped matrix serves as simulation today and drives real crosspoints (SWP-08 / NMOS IS-05) later — exactly as the General Patch exposes its patch to Pro-Bel.

---

## 9. Bottom Line

- **The General Patch is a software patch bay** presented as an **X-Y matrix**: Sources (Y) × Targets (X), cross-points = patch cords, all **saved in snapshots/presets**.
- **The grouping is the key to using it.** Four tiers: **Source Groups** and **Target Groups** slice each axis by signal role; **Page Groups** pre-stage a combined source+target **sub-patch**; **User Patch Groups** let you author and save a bespoke, **mixed-type** sub-matrix per production — reorderable, cross-assembled, saved as Source/Target/Page variants in Edit mode.
- **Patching mechanics** add connection-type menus (mono/stereo/surround, unlinked stereo), **protected** (locked) routes, diagonal/auto multi-patch, and **colour cues** (green=1, yellow=2+, red=protected), all over three **label modes** (fixed/user/device) with propagation.
- **In TwistRouting:** the **1990s VIEW (`router-view.js`) is already a grouped X-Y crosspoint matrix** — the closest thing in the project to a General Patch. The delta is the **grouping model on top**: **Page Groups**, **User Patch Groups**, **route snapshots**, **protected routes**, and **label modes** — all additive over the existing `routing-core` graph and `Routes/**` data.

> **One sentence:** the General Patch is a patch bay drawn as an X-Y grid, and its genius is the **grouping** — fixed role-groups, predefined Page sub-patches, and saved mixed-type User Patch Groups — which is exactly the layer to add on top of TwistRouting's existing crosspoint matrix.
