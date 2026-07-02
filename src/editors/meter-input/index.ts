// src/editors/meter-input — Meter Input test tool with REAL video/audio scopes.
//
// Route any source into the METER INPUT twist (TEST TOOLS) and it becomes a bench
// of measurement instruments running on ACTUAL pixels + audio — not synthetic state.
// Pick a source for the ANALYZED SOURCE: Test Pattern (offline), Capture Tab
// (getDisplayMedia — scope any tab/window incl. a playing clip), Load File, or a
// CORS media URL. A cross-origin <iframe> can't be scoped directly (tainted canvas)
// — Capture Tab sidesteps that.
//
// Each scope card starts in a default spot, then drag-moves (header) + resizes
// (corner). Loudness reuses ui/loudness.ts; the audio scope shows L / R / L+R.

import type { EditorPlugin } from '../types.js';
import { el, qs } from '../../ui/dom.js';
import { createLoudnessTracker, drawLoudnessPlot } from '../../ui/loudness.js';
import { injectMeterInputStyles } from './styles.js';
import {
  createLiveInput, drawParadeReal, drawWaveReal, drawChromaReal, drawVectorReal, drawScope3, drawMetersReal, drawVUpair, drawGonio, drawRecorder,
  drawRGBOverlay, drawRGBStacked, drawCIE, drawDiamond, drawHSL,
  type PeakState, type FrameData,
} from './live-input.js';
import { createHoverLayer, type ProbeResult } from './hover.js';

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// A card becomes drag-move (via its header) + resize (native corner handle); its
// position/size is set by a layout preset (see PRESETS / applyPreset). Double-
// clicking the header — or the ⤢ button — snaps it back to the preset spot.
function floatCard(card: HTMLElement, bringToFront: () => number, onRestore: () => void): void {
  Object.assign(card.style, { position: 'absolute', margin: '0', resize: 'both', overflow: 'hidden' });
  const handle = card.querySelector<HTMLElement>('h4');
  if (!handle) return;
  handle.style.cursor = 'move'; handle.style.userSelect = 'none';
  // ⤢ restores this card to its preset position/size; × closes (hides) it.
  const restore = document.createElement('span');
  restore.className = 'mi-btnicon mi-restore'; restore.textContent = '⤢'; restore.title = 'Restore to preset view (or double-click the title)';
  restore.addEventListener('pointerdown', (e) => e.stopPropagation());
  restore.addEventListener('click', (e) => { e.stopPropagation(); onRestore(); });
  const x = document.createElement('span');
  x.className = 'mi-btnicon mi-x'; x.textContent = '×'; x.title = 'Close (a preset restores it)';
  x.addEventListener('pointerdown', (e) => e.stopPropagation());
  x.addEventListener('click', (e) => { e.stopPropagation(); card.style.display = 'none'; });
  handle.append(restore, x);
  handle.addEventListener('dblclick', (e) => { e.preventDefault(); onRestore(); });
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY, ox = card.offsetLeft, oy = card.offsetTop;
    card.style.zIndex = String(bringToFront());
    const move = (ev: PointerEvent): void => { card.style.left = `${Math.max(0, ox + ev.clientX - sx)}px`; card.style.top = `${Math.max(0, oy + ev.clientY - sy)}px`; };
    const up = (): void => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
  });
}

const plugin: EditorPlugin = {
  id: 'meter-input',
  title: 'METER INPUT · REAL-VIDEO TEST TOOLS',
  order: 10,
  match: (n) => /meter\s*input/i.test(n),
  render(host, ctx) {
    injectMeterInputStyles();

    const bBars = el('button', { class: 'mi-pill on' }, ['▦ Test Pattern']);
    const bCap = el('button', { class: 'mi-pill' }, ['⧉ Capture Tab']);
    const bFile = el('button', { class: 'mi-pill' }, ['▶ Load File']);
    const url = el('input', { class: 'mi-url', type: 'text', placeholder: '…CORS .mp4/.webm URL' });
    const bUrl = el('button', { class: 'mi-pill' }, ['Load URL']);
    const file = el('input', { type: 'file', accept: 'video/*', style: 'display:none' });
    const pDef = el('button', { class: 'mi-pill on' }, ['✦ Default']);
    const pAud = el('button', { class: 'mi-pill' }, ['♪ Audio']);
    const pVid = el('button', { class: 'mi-pill' }, ['▤ All Video']);
    const pCol = el('button', { class: 'mi-pill' }, ['◉ Colour']);
    const pLum = el('button', { class: 'mi-pill' }, ['◂ Luma']);
    const sSub = el('button', { class: 'mi-pill' }, ['Subtle']);
    const sNorm = el('button', { class: 'mi-pill on' }, ['Normal']);
    const sHard = el('button', { class: 'mi-pill' }, ['Hard']);
    const bLayout = el('button', { class: 'mi-pill' }, ['▦ Layout']);
    const stat = el('span', { class: 'mi-stat' }, ['source: test pattern (SMPTE colour bars)']);

    const li = createLiveInput();
    li.video.className = 'mi-vid';
    li.video.controls = true;

    const scope = (tag: string, hClass: string, canvasClass: string): HTMLElement =>
      el('div', { class: `mi-scope ${hClass}` }, [el('span', { class: 'mi-tag' }, [tag]), el('canvas', { class: canvasClass })]);

    // A preview canvas shows the offline test pattern (the <video> element only has
    // real pixels for file/capture sources); one is shown, the other hidden, per mode.
    const cPreview = el('canvas', { class: 'mi-vid mi-preview' });
    const cardVideo = el('div', { class: 'mi-vidcard' }, [el('h4', {}, ['Input Under Test']), li.video, cPreview]);
    const cardParade = el('div', { class: 'mi-card' }, [el('h4', {}, ['RGB Parade · IRE']), scope('R · G · B', '', 'c-parade')]);
    const cardWave = el('div', { class: 'mi-card' }, [el('h4', {}, ['Luma Waveform']), scope("Y'", '', 'c-wave')]);
    const cardChroma = el('div', { class: 'mi-card' }, [el('h4', {}, ['Chroma Waveform · Saturation']), scope('SAT %', '', 'c-chroma')]);
    const cardVec = el('div', { class: 'mi-card' }, [el('h4', {}, ['Vectorscope']), scope('', '', 'c-vec')]);
    const cardAud = el('div', { class: 'mi-card' }, [el('h4', {}, ['Audio Oscilloscope · L / R / L+R']), scope('', '', 'c-aud')]);
    const cardMeter = el('div', { class: 'mi-card' }, [el('h4', {}, ['Meters · L / R dBFS']), scope('', '', 'c-meter')]);
    const cardVU = el('div', { class: 'mi-card' }, [el('h4', {}, ['VU · Analog']), scope('', '', 'c-vu')]);
    const cardGonio = el('div', { class: 'mi-card' }, [el('h4', {}, ['Goniometer · Lissajous']), scope('', '', 'c-gonio')]);
    const cardRec = el('div', { class: 'mi-card' }, [el('h4', {}, ['Level Recorder · dBFS over time']), scope('', '', 'c-rec')]);
    const cardRGBA = el('div', { class: 'mi-card' }, [el('h4', {}, ['RGB Overlay · Waveform (RGBA)']), scope('R·G·B·A', '', 'c-rgba')]);
    const cardStack = el('div', { class: 'mi-card' }, [el('h4', {}, ['RGB Stacked · Waveform']), scope('R / G / B', '', 'c-stack')]);
    const cardCIE = el('div', { class: 'mi-card' }, [el('h4', {}, ['CIE 1931 · xy Gamut']), scope('', '', 'c-cie')]);
    const cardDiamond = el('div', { class: 'mi-card' }, [el('h4', {}, ['Diamond · RGB Gamut']), scope('', '', 'c-diamond')]);
    const cardHSL = el('div', { class: 'mi-card' }, [el('h4', {}, ['Lightness / Saturation']), scope('', '', 'c-hsl')]);
    const cardLoud = el('div', { class: 'mi-card' }, [
      el('h4', {}, ['Loudness Over Time · ITU-R BS.1770']),
      el('div', { class: 'mi-loudrow' }, [
        el('div', { class: 'mi-lufs' }, [el('span', { class: 'lufs-v' }, ['-∞']), el('small', {}, ['LUFS'])]),
        el('div', { class: 'mi-scope', style: 'flex:1' }, [el('canvas', { class: 'c-loud' })]),
      ]),
    ]);
    // Edit detector — average luminance (AVG bar) + a time-stamped log of scene cuts.
    const luminBar = el('i', { class: 'mi-lumin-bar' });
    const luminVal = el('span', { class: 'mi-lumin-val' }, ['—']);
    const luminCount = el('b', {}, ['0']);
    const luminTempo = el('b', {}, ['0.0']);
    const cardLumin = el('div', { class: 'mi-card' }, [
      el('h4', {}, ['Luminance']),
      el('div', { class: 'mi-lumin' }, [
        el('div', { class: 'mi-luminrow' }, [el('span', { class: 'mi-lumin-lbl' }, ['AVG']), el('div', { class: 'mi-lumin-track' }, [luminBar]), luminVal]),
        el('div', { class: 'mi-lumin-count' }, ['edits detected: ', luminCount]),
        el('div', { class: 'mi-lumin-tempo' }, ['edit tempo: ', luminTempo, ' / min']),
        // Edit-detection sensitivity lives with the luminance meter (drives the edit log below).
        el('div', { class: 'mi-lumin-sens' }, [el('span', { class: 'mi-lumin-lbl' }, ['SENS']), sSub, sNorm, sHard]),
      ]),
    ]);
    const editList = el('div', { class: 'mi-editlist' }, [el('div', { class: 'mi-edit-empty' }, ['watching for edits…'])]);
    const editCountEl = el('span', { class: 'mi-editlog-count' }, ['0 events']);
    const bClear = el('button', { class: 'mi-pill mi-clear' }, ['Clear']);
    const cardEditLog = el('div', { class: 'mi-card' }, [
      el('h4', {}, ['Edit Log']),
      el('div', { class: 'mi-editlog' }, [el('div', { class: 'mi-editlog-top' }, [bClear, editCountEl]), editList]),
    ]);

    // The video is a floating card too (first → painted behind), so scopes/meters
    // can be dragged on top of it, or the video moved + resized.
    const grid = el('div', { class: 'mi-grid' }, [cardVideo, cardParade, cardWave, cardChroma, cardVec, cardAud, cardMeter, cardVU, cardGonio, cardRec, cardRGBA, cardStack, cardCIE, cardDiamond, cardHSL, cardLoud, cardLumin, cardEditLog]);

    const grp = (cls: string, label: string, btns: HTMLElement[]): HTMLElement =>
      el('div', { class: `mi-grp ${cls}` }, [el('span', { class: 'mi-grp-lbl' }, [label]), el('div', { class: 'mi-grp-btns' }, btns)]);
    host.append(el('div', { class: 'mi' }, [
      el('div', { class: 'mi-bar' }, [
        el('div', { class: 'mi-bar-row' }, [el('div', { class: 'mi-title' }, ['Edit Detector']), el('div', { class: 'mi-title-line' }), bLayout]),
        el('div', { class: 'mi-bar-row' }, [grp('mi-grp-src', 'Source', [bBars, bCap, bFile, url, bUrl, file])]),
        el('div', { class: 'mi-bar-row' }, [grp('mi-grp-pre', 'Presets', [pDef, pAud, pVid, pCol, pLum])]),
        el('div', { class: 'mi-bar-row mi-bar-stat' }, [stat]),
      ]),
      grid,
    ]));

    // Each card is drag-movable (header) + resizable (corner); a LAYOUT PRESET
    // sets positions — Default, or bias the bench toward audio or video work.
    let zTop = 10;
    const front = (): number => ++zTop;
    // Forward-declared here: assigned once the PRESETS table below is in scope, but
    // referenced by each card's restore handler (⤢ / double-click) created above it.
    let restoreCard: (key: string) => void = () => {};
    let editSens = 0.35;   // edit-detection threshold, set by the SENS pills below
    const cardMap: Record<string, HTMLElement> = {
      video: cardVideo, parade: cardParade, wave: cardWave, chroma: cardChroma, vec: cardVec,
      aud: cardAud, meter: cardMeter, vu: cardVU, gonio: cardGonio, rec: cardRec,
      rgba: cardRGBA, stack: cardStack, cie: cardCIE, diamond: cardDiamond, hsl: cardHSL, loud: cardLoud,
      lumin: cardLumin, editlog: cardEditLog,
    };
    // Per-card LCARS header colour (the "okudagram" palette) — the edit-detector
    // trio gets the amber/blue/orange of the mock; the scopes cycle the LCARS hues.
    const HC: Record<string, string> = {
      video: '#f2b25c', lumin: '#8fcdf0', editlog: '#f2955c',
      parade: '#c19eb0', wave: '#b46757', chroma: '#ae697d', vec: '#97587b',
      aud: '#c67d3a', meter: '#b28452', vu: '#c2b74b', gonio: '#bcb9df', rec: '#b0679b',
      rgba: '#c19eb0', stack: '#97587b', cie: '#c2b74b', diamond: '#b46757', hsl: '#ae697d', loud: '#8fcdf0',
    };
    for (const [key, card] of Object.entries(cardMap)) {
      card.style.setProperty('--hc', HC[key] ?? '#3a5573');
      floatCard(card, front, () => restoreCard(key));
    }
    type Dims = [number, number, number, number];
    const PRESETS: Record<string, Record<string, Dims>> = {
      default: {   // video with its luma waveform beneath; edit detector along the bottom
        video: [330, 0, 560, 300], parade: [0, 0, 320, 250], wave: [330, 310, 560, 200],
        vec: [900, 0, 300, 300], aud: [330, 515, 560, 185], meter: [8, 405, 314, 294],
        vu: [0, 260, 327, 139], gonio: [900, 310, 300, 240], loud: [900, 560, 300, 150],
        chroma: [900, 715, 300, 175], lumin: [0, 715, 590, 240], editlog: [600, 715, 290, 240],
      },
      audio: {   // big audio instruments + the video source tucked top-right
        video: [1100, 0, 300, 180],
        aud: [0, 310, 570, 250],
        meter: [480, 0, 300, 300],
        vu: [0, 0, 470, 300],
        gonio: [790, 0, 300, 300],
        rec: [0, 570, 1090, 170],
        loud: [580, 310, 510, 250],
      },
      video: {   // ALL VIDEO: source + every chroma/luma scope, no audio instruments
        video: [0, 0, 640, 320], parade: [650, 0, 320, 270], wave: [0, 330, 640, 230],
        vec: [650, 280, 625, 462], rgba: [14, 649, 970, 220], stack: [1303, 0, 589, 549],
        cie: [1017, 567, 320, 320], diamond: [976, 0, 306, 289], hsl: [1299, 552, 441, 302],
      },
      colour: {   // full colour bench: video + every chroma scope; audio hidden
        video: [340, 0, 560, 300], wave: [340, 310, 560, 180],
        parade: [0, 0, 330, 240], rgba: [0, 250, 330, 250],
        vec: [910, 0, 300, 300], cie: [910, 310, 300, 320],
        stack: [0, 505, 330, 320], diamond: [340, 495, 320, 320], hsl: [670, 495, 540, 320],
        chroma: [910, 635, 300, 190],
      },
      luma: {   // brightness + edit detection: video, luma waveform, luminance + edit log
        video: [420, 0, 600, 330], wave: [420, 340, 600, 300],
        parade: [0, 0, 410, 310], stack: [0, 320, 410, 320],
        chroma: [420, 645, 600, 190], lumin: [1030, 0, 380, 190], editlog: [1030, 200, 380, 430],
      },
    };
    // A preset positions the cards it lists AND hides the rest — so it also selects
    // WHICH analyzers are shown. (A per-card × hides one; ⤢ / a preset restores it.)
    let activePreset = 'default';
    const setDims = (card: HTMLElement, d: Dims): void => { card.style.display = ''; Object.assign(card.style, { left: `${d[0]}px`, top: `${d[1]}px`, width: `${d[2]}px`, height: `${d[3]}px` }); };
    const applyPreset = (name: string): void => {
      const layout = PRESETS[name]; if (!layout) return;
      activePreset = name;
      for (const [key, card] of Object.entries(cardMap)) {
        const d = layout[key];
        if (d) setDims(card, d); else card.style.display = 'none';
      }
    };
    // ⤢ / double-click on a card snaps it back to its slot in the active preset
    // (falling back to the default preset if this preset doesn't place it).
    restoreCard = (key: string): void => {
      const d = (PRESETS[activePreset] ?? {})[key] ?? PRESETS.default?.[key];
      const card = cardMap[key]; if (!card || !d) return;
      setDims(card, d); card.style.zIndex = String(front());
    };
    const presetBtns: Array<[HTMLElement, string]> = [[pDef, 'default'], [pAud, 'audio'], [pVid, 'video'], [pCol, 'colour'], [pLum, 'luma']];
    const selectPreset = (name: string): void => { applyPreset(name); presetBtns.forEach(([b, n]) => b.classList.toggle('on', n === name)); };
    presetBtns.forEach(([b, n]) => b.addEventListener('click', () => selectPreset(n)));
    applyPreset('default');

    // SENS — how big a luminance jump counts as an edit (higher = only hard cuts).
    const sensBtns: Array<[HTMLElement, number]> = [[sSub, 0.22], [sNorm, 0.35], [sHard, 0.5]];
    sensBtns.forEach(([b, thr]) => b.addEventListener('click', () => { editSens = thr; sensBtns.forEach(([bb]) => bb.classList.toggle('on', bb === b)); }));

    // Layout inspector — the LAYOUT pill toggles a readout of each visible card's
    // [x, y, w, h], formatted as a preset object (handy for authoring new presets).
    const layoutPop = el('div', { class: 'mi-layout' });
    const layoutBtn = bLayout;
    layoutBtn.addEventListener('click', () => {
      const shown = layoutPop.classList.toggle('open');
      if (!shown) return;
      const lines = Object.entries(cardMap)
        .filter(([, card]) => card.style.display !== 'none')
        .map(([key, card]) => `  ${key}: [${card.offsetLeft}, ${card.offsetTop}, ${card.offsetWidth}, ${card.offsetHeight}],`);
      const text = `{\n${lines.join('\n')}\n}`;
      layoutPop.textContent = text;
      // Copy the layout to the clipboard so it can be pasted straight into a preset.
      navigator.clipboard?.writeText(text).catch(() => {});
    });
    host.append(layoutPop);

    // ── Hover-help: a "how to read this scope" tooltip on each card title ──────
    // These scopes visualize the same audio/video as an objective source of truth;
    // the guidance below (lead + ✓ good / ✕ bad signal) is surfaced on title hover.
    type Help = { t: string; lead: string; good?: string; bad?: string };
    const INTRO =
      'These scopes can look intimidating, but they are just different ways of visualizing the same audio &amp; video data. ' +
      'Once you can read them they become an objective source of truth — showing what your eyes/ears miss due to monitor calibration or room acoustics. ' +
      'Hover any scope’s title (ⓘ) for how to read it.';
    const HELP: Record<string, Help> = {
      video: { t: 'Analyzed Source', lead: 'The actual frames + audio every scope reads (test pattern, captured tab, file, or URL). Everything else on this bench is measured from this signal.' },
      wave: { t: 'Luma Waveform', lead: 'Brightness only (colour ignored). Horizontal = left→right position in the frame; vertical = 0 (black) → 100 (white).', good: 'Detail well-distributed; faces sit ~40–70.', bad: 'Trace pinned at 100 (highlights clipped) or 0 (shadows crushed) — that data is gone.' },
      chroma: { t: 'Chroma Waveform', lead: 'Saturation (max−min of RGB) per left→right position — the colour counterpart of the luma waveform. Vertical = 0 % (neutral grey) → 100 % (fully saturated).', good: 'Colour sits at a sensible, consistent level for the shot; neutral greys/whites hug the bottom (near 0 %).', bad: 'The trace slams to the top = over-saturated / possibly broadcast-illegal; a supposed-neutral area riding high = an unwanted colour cast.' },
      parade: { t: 'RGB Parade · IRE', lead: 'Red, Green, Blue shown side-by-side. Horizontal = frame position; vertical = brightness (0–100).', good: 'On neutral whites/greys the R, G, B traces sit level with each other; faces ~40–70.', bad: 'A channel riding higher in the mid-tones = colour cast; traces flat-lining at 0/100 = crushed/clipped.' },
      rgba: { t: 'RGB Overlay', lead: 'The same R/G/B waveform data as the Parade, layered on top of each other for direct comparison.', good: 'Neutral areas keep the three channels aligned.', bad: 'Channels splitting apart = colour cast; tops clipped at 100.' },
      stack: { t: 'RGB Stacked', lead: 'The same R/G/B waveform data as the Parade, stacked vertically instead of side-by-side. Read it the same way.', good: 'Channels level on neutral tones.', bad: 'Clipping at 0/100 or a channel offset from the others.' },
      vec: { t: 'Vectorscope', lead: 'Colour only — brightness ignored. Angle = hue, distance from centre = saturation.', good: 'Neutrals sit near centre; skin rides the top-left “skin line” (nearly all skin, any ethnicity, aligns to it).', bad: 'Trace pushes past the target boxes = oversaturated / broadcast-illegal (bleed or artifacts on some TVs).' },
      cie: { t: 'CIE 1931 · xy Gamut', lead: 'Gamut check. The horseshoe = all of human vision; the triangle = your target space (e.g. Rec.709).', good: 'The glowing blob stays inside the triangle.', bad: 'It spills outside — colours the display physically can’t show → clipping / shifts on export.' },
      diamond: { t: 'Diamond · RGB Gamut', lead: 'Gamut check that verifies R/G/B combinations are mathematically legal for the target space.', good: 'Trace stays inside the diamond shape.', bad: 'Spilling out = illegal colours that will clip or shift on export.' },
      hsl: { t: 'Lightness / Saturation', lead: 'Vertical = brightness, horizontal = saturation. Cameras/screens struggle with heavy saturation at extreme bright or dark.', good: 'Saturation tapers off top and bottom into a rounded shape.', bad: 'A hard rectangular block pushing full saturation into highlights/shadows.' },
      aud: { t: 'Audio Oscilloscope', lead: 'The real-time wave shape of the sound (L / R / L+R).', good: 'Smooth, rounded wave peaks.', bad: 'Squared-off flat tops = heavy distortion / clipping.' },
      meter: { t: 'Meters · L/R dBFS', lead: 'Digital peak meters — instant and exact. 0 dBFS is the absolute digital ceiling.', good: 'Peaks dance between −12 and −6 dB, leaving headroom.', bad: 'Touching 0 dBFS = digital clipping (harsh crackle); barely moving = too quiet, high noise floor.' },
      vu: { t: 'VU · Analog', lead: 'Retro needle showing average perceived loudness (slow ballistics), not exact peaks.', good: 'Needle bounces around 0, dipping into the red only on loud hits.', bad: 'Pinned in the red (too hot) or motionless at the bottom (too quiet).' },
      gonio: { t: 'Goniometer · Lissajous', lead: 'Stereo phase + width. Mono = a straight vertical line; wide stereo = a tangled ball of yarn.', good: 'Shape is taller than it is wide.', bad: 'Stretched horizontal = phase cancellation — on a mono speaker (a phone) the audio goes quiet/hollow.' },
      rec: { t: 'Level Recorder', lead: 'Plots L/R level (dBFS) over ~2 minutes so you can see trends, not just the instant.', good: 'Consistent levels with headroom under 0 dBFS.', bad: 'Constant slamming at the top (clipping) or long stretches near the floor (too quiet).' },
      loud: { t: 'Loudness · ITU-R BS.1770', lead: 'Perceived average loudness in LUFS over time — the metric streaming platforms normalise to.', good: 'A stable line near your target (YouTube ≈ −14 LUFS; broadcast −23/−24 LUFS).', bad: 'Wild swings silent→loud, or a line parked well above/below target.' },
      lumin: { t: 'Luminance', lead: 'The average brightness of the whole frame (0–100 %), updated every frame, plus a running count and tempo of detected edits. The AVG bar is the live mean; a sudden frame-to-frame jump is what flags a cut.', good: 'A steady level within a shot; the bar only leaps when the picture really changes.', bad: 'Constant wild swings = flicker / exposure pumping; a high edit tempo = footage cutting very fast.' },
      editlog: { t: 'Edit Log', lead: 'A time-stamped list of detected scene cuts. Each row logs when a big luminance change happened, so you can find every edit point. SENS (Subtle → Hard) sets how big a change counts; edit tempo shows how fast cuts are coming.', good: 'Rows land exactly where the video actually cuts.', bad: 'Missed cuts (lower SENS to Subtle) or false hits on flashes / fast motion (raise SENS to Hard).' },
    };
    const tipEl = el('div', { class: 'mi-tip' });
    document.body.append(tipEl);
    const placeTip = (x: number, y: number): void => {
      const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
      tipEl.style.left = `${clamp(x + 14, 6, window.innerWidth - w - 6)}px`;
      tipEl.style.top = `${clamp(y + 16, 6, window.innerHeight - h - 6)}px`;
    };
    const attachTip = (target: HTMLElement, html: string): void => {
      target.addEventListener('mouseenter', (e) => { tipEl.innerHTML = html; tipEl.classList.add('open'); placeTip(e.clientX, e.clientY); });
      target.addEventListener('mousemove', (e) => placeTip(e.clientX, e.clientY));
      target.addEventListener('mouseleave', () => tipEl.classList.remove('open'));
    };
    const helpHtml = (h: Help): string =>
      `<b>${h.t}</b><br>${h.lead}` +
      (h.good ? `<br><span class="g">✓ Good:</span> ${h.good}` : '') +
      (h.bad ? `<br><span class="bad">✕ Bad:</span> ${h.bad}` : '');
    for (const [key, card] of Object.entries(cardMap)) {
      const h4 = card.querySelector('h4'); const h = HELP[key];
      if (h4 && h) { h4.classList.add('mi-help'); attachTip(h4, helpHtml(h)); }
    }
    // The whole-bench intro rides the "EDIT DETECTOR" title tab.
    const introChip = host.querySelector<HTMLElement>('.mi-title');
    if (introChip) { introChip.classList.add('mi-help'); attachTip(introChip, `<b>Reading the scopes</b><br>${INTRO}`); }

    const cParade = qs<HTMLCanvasElement>(host, '.c-parade');
    const cWave = qs<HTMLCanvasElement>(host, '.c-wave');
    const cChroma = qs<HTMLCanvasElement>(host, '.c-chroma');
    const cVec = qs<HTMLCanvasElement>(host, '.c-vec');
    const cAud = qs<HTMLCanvasElement>(host, '.c-aud');
    const cMeter = qs<HTMLCanvasElement>(host, '.c-meter');
    const cVU = qs<HTMLCanvasElement>(host, '.c-vu');
    const cGonio = qs<HTMLCanvasElement>(host, '.c-gonio');
    const cRec = qs<HTMLCanvasElement>(host, '.c-rec');
    const cRGBA = qs<HTMLCanvasElement>(host, '.c-rgba');
    const cStack = qs<HTMLCanvasElement>(host, '.c-stack');
    const cCIE = qs<HTMLCanvasElement>(host, '.c-cie');
    const cDiamond = qs<HTMLCanvasElement>(host, '.c-diamond');
    const cHSL = qs<HTMLCanvasElement>(host, '.c-hsl');
    const cLoud = qs<HTMLCanvasElement>(host, '.c-loud');
    const lufsEl = qs<HTMLElement>(host, '.lufs-v');

    // Pan + zoom on the parade / luma / vectorscope / goniometer: the mouse wheel
    // zooms centred ON THE POINTER (the point under the cursor stays put), and
    // dragging the canvas pans. Each scope keeps its own view {z, px, py}.
    const mkView = (): { z: number; px: number; py: number } => ({ z: 1, px: 0, py: 0 });
    const views = { parade: mkView(), wave: mkView(), chroma: mkView(), vec: mkView(), gonio: mkView(), rgba: mkView(), stack: mkView(), cie: mkView(), diamond: mkView(), hsl: mkView() };
    const panZoom = (cv: HTMLCanvasElement, v: { z: number; px: number; py: number }): void => {
      cv.style.cursor = 'grab';
      const toBacking = (clientX: number, clientY: number): [number, number] => {
        const r = cv.getBoundingClientRect();
        return [(clientX - r.left) * (cv.width / r.width), (clientY - r.top) * (cv.height / r.height)];
      };
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const [mx, my] = toBacking(e.clientX, e.clientY);
        const nz = clamp(v.z * (e.deltaY < 0 ? 1.12 : 0.89), 0.25, 24), f = nz / v.z;
        v.px = mx - (mx - v.px) * f; v.py = my - (my - v.py) * f; v.z = nz;   // keep pointer fixed
      }, { passive: false });
      cv.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;   // let right-click through to the marker handler
        e.preventDefault(); cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
        const r = cv.getBoundingClientRect(), sx = cv.width / r.width, sy = cv.height / r.height;
        let lx = e.clientX, ly = e.clientY;
        const move = (ev: PointerEvent): void => { v.px += (ev.clientX - lx) * sx; v.py += (ev.clientY - ly) * sy; lx = ev.clientX; ly = ev.clientY; };
        const up = (): void => { cv.style.cursor = 'grab'; cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); };
        cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
      });
    };
    panZoom(cParade, views.parade); panZoom(cWave, views.wave); panZoom(cChroma, views.chroma); panZoom(cVec, views.vec); panZoom(cGonio, views.gonio);
    panZoom(cRGBA, views.rgba); panZoom(cStack, views.stack); panZoom(cCIE, views.cie);
    panZoom(cDiamond, views.diamond); panZoom(cHSL, views.hsl);

    // ── Edit detector: average luminance + luma-histogram frame-differencing ──
    // A big frame-to-frame change in the global luma histogram = a scene cut, which
    // we log with a timestamp. `editSens` (the SENS pills) sets how big a jump counts.
    let prevG: Float32Array | null = null;   // previous frame's normalised luma histogram
    let editStart = performance.now();        // fallback clock when the source has no timeline
    let lastCutT = -1, editCount = 0, curLuma = 0;
    const editTimes: number[] = [];           // source-time (s) of recent cuts → tempo
    const srcTime = (now: number): number => {
      const m = li.mode();
      if ((m === 'media' || m === 'stream') && isFinite(li.video.currentTime) && li.video.currentTime > 0) return li.video.currentTime;
      return (now - editStart) / 1000;   // test pattern / no timeline → elapsed wall time
    };
    const utcClock = (): string => `${new Date().toISOString().slice(11, 19)} UTC`;   // HH:MM:SS time-of-day
    const editTempo = (): number => {
      if (editTimes.length < 2) return 0;
      const span = (editTimes[editTimes.length - 1] ?? 0) - (editTimes[0] ?? 0);
      return span > 0 ? 60 * (editTimes.length - 1) / span : 0;   // cuts per minute
    };
    const resetEdits = (): void => {
      prevG = null; lastCutT = -1; editCount = 0; editStart = performance.now(); editTimes.length = 0;
      editList.replaceChildren(el('div', { class: 'mi-edit-empty' }, ['watching for edits…']));
      editCountEl.textContent = '0 events'; luminCount.textContent = '0'; luminTempo.textContent = '0.0';
    };
    const addEdit = (t: number, luma: number): void => {
      editCount++; editTimes.push(t); if (editTimes.length > 40) editTimes.shift();
      if (editCount === 1) editList.replaceChildren();   // drop the "watching…" placeholder
      editList.insertBefore(el('div', { class: 'mi-edit-row' }, [
        el('span', { class: 'dot' }, ['●']), el('span', {}, ['Edit here']),
        el('span', { class: 't' }, [utcClock()]), el('span', { class: 'l' }, [`${luma.toFixed(0)}%`]),
      ]), editList.firstChild);   // newest on top
      editCountEl.textContent = `${editCount} event${editCount === 1 ? '' : 's'}`;
      luminCount.textContent = String(editCount);
    };
    bClear.addEventListener('click', resetEdits);

    const setStat = (t: string, warn = false): void => { stat.textContent = t; stat.style.color = warn ? '#ff6a6a' : '#e6a13a'; };
    bBars.addEventListener('click', () => { li.useBars(); bBars.classList.add('on'); resetEdits(); setStat('source: test pattern (SMPTE colour bars)'); });
    bCap.addEventListener('click', () => {
      li.captureTab().then(() => { bBars.classList.remove('on'); resetEdits(); setStat('source: captured tab (real pixels + audio)'); })
        .catch((e: Error) => setStat('capture cancelled: ' + e.message, true));
    });
    bFile.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0]; if (!f) return;
      li.useMedia(URL.createObjectURL(f), false).then(() => { bBars.classList.remove('on'); resetEdits(); setStat('source: file · ' + f.name); })
        .catch((e: Error) => setStat('load failed: ' + e.message, true));
    });
    bUrl.addEventListener('click', () => {
      const u = url.value.trim(); if (!u) return;
      li.useMedia(u, true).then(() => { bBars.classList.remove('on'); resetEdits(); setStat('source: url'); })
        .catch((e: Error) => setStat('load failed: ' + e.message, true));
    });

    const peak: PeakState = { l: 0, r: 0 };
    const vu = { l: -60, r: -60 };   // ballistic-smoothed dBFS for the analog needles
    const loudness = createLoudnessTracker({ start: -23 });
    const recL: number[] = [], recR: number[] = [], REC_SPAN = 600; let lastRec = 0;   // ~2 min at 200ms
    let last = 0;
    let lastFrame: FrameData | null = null;   // latest analyzed frame — for hover density readouts

    // Advertise this bench's measurements as read-only telemetry params (audit §4.5),
    // then publish them ~10 Hz over MQTT. No-op unless a broker is configured.
    ctx.services.advertiseParams?.([
      { name: 'loudness', type: 'number', unit: 'LUFS', writable: false },
      { name: 'rms_l', type: 'number', unit: 'dBFS', writable: false },
      { name: 'rms_r', type: 'number', unit: 'dBFS', writable: false },
      { name: 'peak_l', type: 'number', unit: 'dBFS', writable: false },
      { name: 'peak_r', type: 'number', unit: 'dBFS', writable: false },
      { name: 'avg_luma', type: 'number', unit: '%', writable: false },
      { name: 'edits', type: 'number', writable: false },
      { name: 'edit_tempo', type: 'number', unit: '/min', writable: false },
    ]);
    let lastPub = 0;
    const fit = (cv: HTMLCanvasElement): void => { if (cv.width !== cv.clientWidth || cv.height !== cv.clientHeight) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; } };

    // ── Hover readout + right-click markers on every scope (see ./hover) ───────
    // Each probe maps DATA-space backing coords to that scope's own axis units and,
    // where available, the measured value (density counts from the latest frame).
    const hover = createHoverLayer();
    const IRE_LO = -10, IRE_HI = 110;
    const ireFromY = (y: number, H: number): number => IRE_LO + ((H - 1 - y) / (H - 2)) * (IRE_HI - IRE_LO);
    const cl = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
    // Pixel count in a per-column histogram at a given column-fraction + value (0..100).
    const densAt = (hist: Uint32Array | undefined, colFrac: number, val0to100: number): number => {
      if (!hist || !lastFrame) return 0;
      const { AW, BINS } = lastFrame;
      const col = cl(Math.floor(colFrac * AW), 0, AW - 1);
      const bin = cl(Math.round((val0to100 / 100) * (BINS - 1)), 0, BINS - 1);
      return hist[col * BINS + bin] ?? 0;
    };
    const pctS = (f: number): string => `${(f * 100).toFixed(0)}%`;
    const waveCh = (hist: () => Uint32Array | undefined, label: string, unit: string) =>
      (dx: number, dy: number, W: number, H: number): ProbeResult => {
        const col = cl(dx / W, 0, 1), v = cl(ireFromY(dy, H), 0, 100);
        return { pos: `${label} · col ${pctS(col)} · ${v.toFixed(0)} ${unit}`, val: `n=${densAt(hist(), col, v)}` };
      };

    hover.attach(cParade, { view: views.parade, read: (dx, dy, W, H) => {
      const pw = W / 3, p = cl(Math.floor(dx / pw), 0, 2);
      const within = cl((dx - p * pw) / pw, 0, 1), v = cl(ireFromY(dy, H), 0, 100);
      const ch = ['R', 'G', 'B'][p], hist = [lastFrame?.rH, lastFrame?.gH, lastFrame?.bH][p];
      return { pos: `${ch} · col ${pctS(within)} · ${v.toFixed(0)} IRE`, val: `n=${densAt(hist, within, v)}` };
    } });
    hover.attach(cWave, { view: views.wave, read: waveCh(() => lastFrame?.yH, "Y'", 'IRE') });
    hover.attach(cChroma, { view: views.chroma, read: (dx, dy, W, H) => {
      const col = cl(dx / W, 0, 1), s = cl(ireFromY(dy, H), 0, 100);
      return { pos: `col ${pctS(col)} · ${s.toFixed(0)}% sat`, val: `n=${densAt(lastFrame?.cH, col, s)}` };
    } });
    hover.attach(cRGBA, { view: views.rgba, read: (dx, dy, W, H) => {
      const col = cl(dx / W, 0, 1), v = cl(ireFromY(dy, H), 0, 100);
      return { pos: `col ${pctS(col)} · ${v.toFixed(0)} IRE`, val: `R${densAt(lastFrame?.rH, col, v)} G${densAt(lastFrame?.gH, col, v)} B${densAt(lastFrame?.bH, col, v)}` };
    } });
    hover.attach(cStack, { view: views.stack, read: (dx, dy, W, H) => {
      const lh = H / 3, p = cl(Math.floor(dy / lh), 0, 2), bot = (p + 1) * lh;
      const v = cl(IRE_LO + ((bot - 1 - dy) / (lh - 2)) * (IRE_HI - IRE_LO), 0, 100), col = cl(dx / W, 0, 1);
      const ch = ['R', 'G', 'B'][p], hist = [lastFrame?.rH, lastFrame?.gH, lastFrame?.bH][p];
      return { pos: `${ch} · col ${pctS(col)} · ${v.toFixed(0)} IRE`, val: `n=${densAt(hist, col, v)}` };
    } });
    hover.attach(cVec, { view: views.vec, read: (dx, dy, W, H) => {
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 6, ex = dx - cx, ey = dy - cy;
      let ang = Math.atan2(-ey, ex) * 180 / Math.PI; if (ang < 0) ang += 360;
      return { pos: `hue ${ang.toFixed(0)}° · sat ${cl(Math.hypot(ex, ey) / R * 100, 0, 999).toFixed(0)}%` };
    } });
    hover.attach(cGonio, { view: views.gonio, read: (dx, dy, W, H) => {
      const cx = W / 2, cy = H / 2, k = (Math.min(W, H) / 2 - 8) / Math.SQRT2;
      const s = (dx - cx) / k, m = (cy - dy) / k;   // s = L−R (width), m = L+R (mono sum)
      return { pos: `L ${cl((m + s) / 2, -1, 1).toFixed(2)} · R ${cl((m - s) / 2, -1, 1).toFixed(2)}`, val: `width ${s.toFixed(2)}` };
    } });
    hover.attach(cCIE, { view: views.cie, read: (dx, dy, W, H) => {
      const pad = 18, x = (dx - pad) / (W - 2 * pad) * 0.75, y = (H - pad - dy) / (H - 2 * pad) * 0.85;
      return { pos: `x ${x.toFixed(3)} · y ${y.toFixed(3)}`, val: 'CIE xy' };
    } });
    hover.attach(cDiamond, { view: views.diamond, read: (dx, dy, W, H) => {
      const cx = W / 2, mid = H / 2, hw = Math.min(W * 0.36, H / 2 - 14);
      if (dy < mid) return { pos: `R−G ${cl((dx - cx) / hw, -1, 1).toFixed(2)} · Y ${cl((mid - dy) / (mid - 14), 0, 1).toFixed(2)}`, val: 'upper' };
      return { pos: `B−G ${cl((dx - cx) / hw, -1, 1).toFixed(2)} · Y ${cl((dy - mid) / (H - 14 - mid), 0, 1).toFixed(2)}`, val: 'lower' };
    } });
    hover.attach(cHSL, { view: views.hsl, read: (dx, dy, W, H) => {
      const padX = 30, baseY = H - 22, apexY = 14;
      return { pos: `L ${cl((dx - padX) / (W - 2 * padX), 0, 1).toFixed(2)} · Sat ${cl((baseY - dy) / (baseY - apexY), 0, 1).toFixed(2)}` };
    } });
    hover.attach(cAud, { read: (dx, dy, W, H) => {
      const lh = H / 3, p = cl(Math.floor(dy / lh), 0, 2), mid = p * lh + lh / 2;
      const amp = cl((mid - dy) / ((lh / 2) * 0.82), -1, 1), lane = ['L', 'R', 'L+R'][p];
      return { pos: `${lane} · t ${pctS(dx / W)} · amp ${amp.toFixed(2)}` };
    } });
    hover.attach(cRec, { read: (dx, dy, W, H) => {
      const db = -60 + ((H - dy) / H) * 60, t = cl((dx - 22) / (W - 22), 0, 1);
      return { pos: `t ${pctS(t)} · ${db.toFixed(1)} dBFS` };
    } });
    hover.attach(cMeter, { read: (dx, dy, W, H) => {
      const lane = dx < W / 2 ? 'L' : 'R', db = cl(1 - (dy - 8) / (H - 30), 0, 1) * 60 - 60;
      return { pos: `${lane} · ${db.toFixed(1)} dBFS` };
    } });
    hover.attach(cVU, { read: (dx, dy, W, H) => {
      const w = W / 2, i = dx < w ? 0 : 1, cx = i * w + w / 2, cy = H * 0.9;
      const A0 = -Math.PI / 2 - 0.92, A1 = -Math.PI / 2 + 0.92;
      const vu = cl(-20 + ((Math.atan2(dy - cy, dx - cx) - A0) / (A1 - A0)) * 23, -20, 3);
      return { pos: `${i ? 'R' : 'L'} ≈ ${vu.toFixed(0)} VU` };
    } });
    hover.attach(cLoud, { read: (dx, dy, W, H) => {
      const lo = -40, hi = -8, lufs = lo + ((H - dy) / H) * (hi - lo), t = cl((dx - 20) / (W - 20), 0, 1);
      return { pos: `t ${pctS(t)} · ${lufs.toFixed(1)} LUFS` };
    } });

    ctx.dispose.raf(() => {
      [cParade, cWave, cChroma, cVec, cAud, cMeter, cVU, cGonio, cRec, cRGBA, cStack, cCIE, cDiamond, cHSL, cLoud].forEach(fit);
      const now = performance.now();
      if (li.grab(now) && now - last > 33) {
        last = now;
        const d = li.analyze();
        if (d) {
          lastFrame = d;
          drawParadeReal(cParade, d, views.parade); drawWaveReal(cWave, d.yH, d.AW, d.BINS, '130,255,140', views.wave); drawVectorReal(cVec, d.pts, views.vec);
          drawChromaReal(cChroma, d.cH, d.AW, d.BINS, views.chroma);
          drawRGBOverlay(cRGBA, d, views.rgba); drawRGBStacked(cStack, d, views.stack); drawCIE(cCIE, d.pts, views.cie);
          drawDiamond(cDiamond, d.pts, views.diamond); drawHSL(cHSL, d.pts, views.hsl);
          // Edit detector: collapse the per-column luma histogram to one global one,
          // read its mean (AVG %), then compare to the previous frame — a big shift = cut.
          const BINS = d.BINS, AWc = d.AW, g = new Float32Array(BINS);
          for (let x = 0; x < AWc; x++) { const base = x * BINS; for (let bin = 0; bin < BINS; bin++) g[bin] = (g[bin] ?? 0) + (d.yH[base + bin] ?? 0); }
          let tot = 0; for (let i = 0; i < BINS; i++) tot += g[i] ?? 0;
          let mean = 0;
          if (tot > 0) for (let i = 0; i < BINS; i++) { g[i] = (g[i] ?? 0) / tot; mean += (i / (BINS - 1)) * (g[i] ?? 0); }
          mean *= 100; curLuma = mean;
          let diff = 0;
          if (prevG) { for (let i = 0; i < BINS; i++) diff += Math.abs((g[i] ?? 0) - (prevG[i] ?? 0)); diff *= 0.5; }
          prevG = g;
          luminBar.style.width = `${clamp(mean, 0, 100)}%`;
          luminVal.textContent = `${mean.toFixed(1)}%`;
          const st = srcTime(now);
          if (diff > editSens && st - lastCutT > 0.4) { lastCutT = st; addEdit(st, mean); }   // 0.4s debounce
          luminTempo.textContent = editTempo().toFixed(1);
        }
        else if (li.isTainted()) setStat('cross-origin source without CORS — use Capture Tab or Load File', true);
      }
      // Input Under Test: the canvas mirrors the offline test pattern; the <video>
      // element (real pixels only) is shown for captured tab / file / URL sources.
      const barsMode = li.mode() === 'bars';
      cPreview.style.display = barsMode ? 'block' : 'none';
      li.video.style.display = barsMode ? 'none' : 'block';
      if (barsMode) { fit(cPreview); li.paint(cPreview); }
      const tL = li.timeDataL(), tR = li.timeDataR();
      drawScope3(cAud, tL, tR, li.timeData());
      drawGonio(cGonio, tL, tR, views.gonio);
      const dbL = li.rmsL(), dbR = li.rmsR();
      drawMetersReal(cMeter, dbL, dbR, peak);
      vu.l += (dbL - vu.l) * 0.08; vu.r += (dbR - vu.r) * 0.08;   // ~300ms VU ballistics
      drawVUpair(cVU, vu.l, vu.r);
      if (now - lastRec > 200) {   // slow chart recorder: sample every 200ms
        lastRec = now;
        recL.push(dbL); recR.push(dbR);
        if (recL.length > REC_SPAN) recL.shift();
        if (recR.length > REC_SPAN) recR.shift();
      }
      drawRecorder(cRec, recL, recR, REC_SPAN);
      const mix = 10 * Math.log10((Math.pow(10, dbL / 10) + Math.pow(10, dbR / 10)) / 2 || 1e-9);
      loudness.update(clamp((mix + 60) / 60, 0, 1));
      lufsEl.textContent = loudness.lufs > -70 ? loudness.lufs.toFixed(1) : '-∞';
      drawLoudnessPlot(cLoud, loudness.history);
      if (ctx.services.publishParam && now - lastPub > 100) {
        lastPub = now;
        ctx.services.publishParam('loudness', loudness.lufs > -70 ? +loudness.lufs.toFixed(1) : null);
        ctx.services.publishParam('rms_l', +dbL.toFixed(1));
        ctx.services.publishParam('rms_r', +dbR.toFixed(1));
        ctx.services.publishParam('peak_l', +peak.l.toFixed(1));
        ctx.services.publishParam('peak_r', +peak.r.toFixed(1));
        ctx.services.publishParam('avg_luma', +curLuma.toFixed(1));
        ctx.services.publishParam('edits', editCount);
        ctx.services.publishParam('edit_tempo', +editTempo().toFixed(1));
      }
      // The luma waveform tracks the video feed's WIDTH + horizontal position so
      // each column reads directly against the picture (a real waveform monitor).
      cardWave.style.left = `${cardVideo.offsetLeft}px`;
      cardWave.style.width = `${cardVideo.offsetWidth}px`;
      hover.sync();   // keep right-click markers pinned as views pan/zoom/resize
    });

    ctx.dispose.add(() => { li.stop(); hover.dispose(); });
  },
};

export default plugin;
