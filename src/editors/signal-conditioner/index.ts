// src/editors/signal-conditioner — the per-remote SIGNAL CONDITIONER.
//
// Each production's REMOTE twists open this: a studio-edge conditioner that frame-
// syncs an incoming remote feed to house reference, delays it for lip-sync, and
// runs a proc-amp (gain / black / chroma / hue) to legalize + dress the picture —
// the frame-sync + delay + colour "glue" from the Signal-Conditioner-Row audit
// (AR.4.22 frame sync, AR.5.3 delay, AR.4.1 proc-amp). Bypass gives a clean pass.
//
// It is a control surface (simulation): the preview shows the proc-amp applied to
// house colour bars via CSS filters, and every control is advertised as an R/W
// MQTT param (audit CR.6) so an external controller can drive it too.

import type { EditorPlugin } from '../types.js';
import { el, addStyles } from '../../ui/dom.js';

interface CondState {
  bypass: boolean;
  reference: 'house' | 'input' | 'freerun';
  delayMs: number;   // A/V delay, 0..1000
  gain: number;      // luma gain %, 50..150
  black: number;     // pedestal, -50..50
  sat: number;       // chroma saturation %, 0..200
  hue: number;       // hue rotate, -180..180
}

const DEFAULTS: CondState = { bypass: false, reference: 'house', delayMs: 0, gain: 100, black: 0, sat: 100, hue: 0 };

// Named house presets (audit: preset-driven conditioning, ≥ several per conditioner).
const PRESETS: Record<string, Partial<CondState>> = {
  'Clean Bypass': { bypass: true },
  'House 1080i': { bypass: false, reference: 'house', delayMs: 0, gain: 100, black: 0, sat: 100, hue: 0 },
  '+1 Frame': { bypass: false, delayMs: 17 },
  '+2 Frame': { bypass: false, delayMs: 33 },
  'Legalize': { bypass: false, gain: 96, black: 2, sat: 92 },
  'Warm': { bypass: false, sat: 108, hue: -8 },
  'Cool': { bypass: false, sat: 104, hue: 10 },
  'Flat / Log': { bypass: false, gain: 108, black: 8, sat: 78 },
  'Free-run': { reference: 'freerun' },
};

const CSS_ID = 'signal-conditioner-styles';
const CSS = `
.sc{display:flex;flex-direction:column;gap:14px;padding:4px 2px;color:#cfe6ff;font-family:sans-serif;}
.sc-top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;}
.sc-title{font:900 14px sans-serif;letter-spacing:3px;text-transform:uppercase;color:#08131f;
  background:#64c8a0;padding:9px 20px;border-radius:6px 6px 6px 18px;white-space:nowrap;}
.sc-src{font:bold 10px 'Courier New',monospace;letter-spacing:1px;padding:6px 11px;border-radius:6px;
  background:#0c1730;border:1px solid #2c3e5e;color:#cfe6ff;}
.sc-src.empty{opacity:.55;font-style:italic;}
.sc-bypass{margin-left:auto;font:900 12px sans-serif;letter-spacing:2px;text-transform:uppercase;padding:9px 20px;
  border:none;border-radius:16px;cursor:pointer;background:#1b2740;color:#8fd0f0;transition:background .15s,color .15s;}
.sc-bypass.on{background:#ffb020;color:#201400;box-shadow:0 0 12px rgba(255,176,32,.55);}
.sc-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:14px;}
.sc-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.4);}
.sc-card h4{margin:0;padding:8px 14px;font:900 11px sans-serif;letter-spacing:2px;text-transform:uppercase;color:#08131f;background:var(--hc,#64c8a0);}
.sc-card .sc-body{padding:12px 14px;display:flex;flex-direction:column;gap:12px;}
.sc-wide{grid-column:1 / -1;}
.sc.bypass .sc-card:not(.sc-refcard){opacity:.45;pointer-events:none;}
.sc-row{display:flex;align-items:center;gap:12px;}
.sc-lbl{flex:0 0 108px;font:bold 11px sans-serif;letter-spacing:1px;color:#9fb6cc;text-transform:uppercase;}
.sc-slider{flex:1;-webkit-appearance:none;appearance:none;height:12px;border-radius:6px;background:#12203a;outline:none;}
.sc-slider::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;border-radius:50%;background:#64c8a0;cursor:pointer;box-shadow:0 0 0 5px rgba(100,200,160,.25);}
.sc-slider::-moz-range-thumb{width:28px;height:28px;border:none;border-radius:50%;background:#64c8a0;cursor:pointer;box-shadow:0 0 0 5px rgba(100,200,160,.25);}
.sc-val{flex:0 0 82px;text-align:right;font:bold 13px 'Courier New',monospace;color:#cfe6ff;}
.sc-ref{display:flex;gap:8px;}
.sc-refbtn{font:bold 10px sans-serif;letter-spacing:1px;text-transform:uppercase;padding:7px 12px;border:none;border-radius:10px;background:#1b2740;color:#bcd3ee;cursor:pointer;}
.sc-refbtn.on{background:#64c8a0;color:#08131f;}
.sc-lock{display:flex;align-items:center;gap:10px;font:bold 11px 'Courier New',monospace;letter-spacing:1px;}
.sc-led{width:11px;height:11px;border-radius:50%;background:#2a6f4f;box-shadow:0 0 8px rgba(57,211,83,.8);}
.sc-led.warn{background:#c9a227;box-shadow:0 0 8px rgba(230,200,60,.8);}
.sc-note{font:11px sans-serif;color:#6b82a3;}
.sc-preview{height:120px;border-radius:8px;border:1px solid #1d2942;
  background:linear-gradient(90deg,#bfbfbf 0 14.28%,#bfbf00 14.28% 28.57%,#00bfbf 28.57% 42.85%,#00bf00 42.85% 57.14%,#bf00bf 57.14% 71.42%,#bf0000 71.42% 85.71%,#0000bf 85.71% 100%);}
.sc-presets{display:flex;flex-wrap:wrap;gap:11px;}
.sc-preset{font:bold 13px sans-serif;letter-spacing:1.5px;text-transform:uppercase;padding:13px 22px;border:none;border-radius:14px;background:#16233d;color:#bcd3ee;cursor:pointer;transition:filter .15s;}
.sc-preset:hover{filter:brightness(1.3);}
`;

// A labelled slider row → returns [row, input, valueEl]; caller wires input + formats value.
function slider(label: string, min: number, max: number, step: number): [HTMLElement, HTMLInputElement, HTMLElement] {
  const input = el('input', { class: 'sc-slider', type: 'range', min: String(min), max: String(max), step: String(step) });
  const val = el('span', { class: 'sc-val' });
  const row = el('div', { class: 'sc-row' }, [el('span', { class: 'sc-lbl' }, [label]), input, val]);
  return [row, input as HTMLInputElement, val];
}

const plugin: EditorPlugin = {
  id: 'signal-conditioner',
  title: 'SIGNAL CONDITIONER · FRAME-SYNC / DELAY / PROC-AMP',
  order: 12,
  match: (n) => /\bremote\b|conditioner/i.test(n),
  render(host, ctx) {
    addStyles(CSS_ID, CSS);
    const s: CondState = { ...DEFAULTS };

    const srcChips = ctx.sources.length
      ? ctx.sources.map((f) => el('span', { class: 'sc-src', style: `border-color:${f.color}` }, [f.label]))
      : [el('span', { class: 'sc-src empty' }, ['no remote feed routed — route a source into this REMOTE'])];
    const bypassBtn = el('button', { class: 'sc-bypass' }, ['Bypass']);

    // Frame sync
    const refBtns: Array<[HTMLElement, CondState['reference']]> = [
      [el('button', { class: 'sc-refbtn' }, ['House PTP']), 'house'],
      [el('button', { class: 'sc-refbtn' }, ['Input']), 'input'],
      [el('button', { class: 'sc-refbtn' }, ['Free-run']), 'freerun'],
    ];
    const led = el('span', { class: 'sc-led' });
    const lockTxt = el('span', {}, ['LOCKED']);
    const timing = el('span', { class: 'sc-note' }, ['input timing: +0.0 ms']);
    const refCard = el('div', { class: 'sc-card sc-refcard', style: '--hc:#8fd0f0' }, [
      el('h4', {}, ['Frame Sync · Reference']),
      el('div', { class: 'sc-body' }, [
        el('div', { class: 'sc-ref' }, refBtns.map(([b]) => b)),
        el('div', { class: 'sc-lock' }, [led, lockTxt]),
        timing,
        el('div', { class: 'sc-note' }, ['30-min holdover · graceful re-lock on reference loss']),
      ]),
    ]);

    // Delay
    const [delRow, delIn, delVal] = slider('A/V Delay', 0, 1000, 1);
    const delFrames = el('div', { class: 'sc-note' });
    const delayCard = el('div', { class: 'sc-card', style: '--hc:#c2b74b' }, [
      el('h4', {}, ['Delay · Lip-sync']),
      el('div', { class: 'sc-body' }, [delRow, delFrames]),
    ]);

    // Proc amp
    const [gRow, gIn, gVal] = slider('Video Gain', 50, 150, 1);
    const [bRow, bIn, bVal] = slider('Black', -50, 50, 1);
    const [sRow, sIn, sVal] = slider('Chroma / Sat', 0, 200, 1);
    const [hRow, hIn, hVal] = slider('Hue', -180, 180, 1);
    const preview = el('div', { class: 'sc-preview' });
    const procCard = el('div', { class: 'sc-card sc-wide', style: '--hc:#64c8a0' }, [
      el('h4', {}, ['Proc Amp · Colour Legalize']),
      el('div', { class: 'sc-body' }, [preview, gRow, bRow, sRow, hRow]),
    ]);

    // Presets
    const presetCard = el('div', { class: 'sc-card sc-wide', style: '--hc:#b46757' }, [
      el('h4', {}, ['Presets']),
      el('div', { class: 'sc-body' }, [
        el('div', { class: 'sc-presets' }, Object.keys(PRESETS).map((name) => {
          const b = el('button', { class: 'sc-preset' }, [name]);
          b.addEventListener('click', () => { Object.assign(s, PRESETS[name]); sync(true); });
          return b;
        })),
      ]),
    ]);

    const root = el('div', { class: 'sc' }, [
      el('div', { class: 'sc-top' }, [el('div', { class: 'sc-title' }, ['Signal Conditioner']), ...srcChips, bypassBtn]),
      el('div', { class: 'sc-grid' }, [refCard, delayCard, procCard, presetCard]),
    ]);
    host.append(root);

    // Advertise every control as a read/write param (audit CR.6 full R/W config).
    ctx.services.advertiseParams?.([
      { name: 'bypass', type: 'bool', writable: true },
      { name: 'reference', type: 'string', writable: true },
      { name: 'delay_ms', type: 'number', unit: 'ms', writable: true },
      { name: 'gain', type: 'number', unit: '%', writable: true },
      { name: 'black', type: 'number', writable: true },
      { name: 'sat', type: 'number', unit: '%', writable: true },
      { name: 'hue', type: 'number', unit: 'deg', writable: true },
    ]);
    const pub = (): void => {
      const p = ctx.services.publishParam; if (!p) return;
      p('bypass', s.bypass); p('reference', s.reference); p('delay_ms', s.delayMs);
      p('gain', s.gain); p('black', s.black); p('sat', s.sat); p('hue', s.hue);
    };

    // Reflect state → DOM + live preview (+ publish when the change is local).
    function sync(publish = false): void {
      root.classList.toggle('bypass', s.bypass);
      bypassBtn.classList.toggle('on', s.bypass);
      bypassBtn.textContent = s.bypass ? 'Bypassed' : 'Bypass';
      refBtns.forEach(([b, r]) => b.classList.toggle('on', r === s.reference));
      const free = s.reference === 'freerun';
      led.classList.toggle('warn', free);
      lockTxt.textContent = free ? 'FREE-RUN' : 'LOCKED';
      timing.textContent = free ? 'input timing: unreferenced' : `input timing: +${(s.delayMs / 10).toFixed(1)} ms → aligned`;
      delIn.value = String(s.delayMs); delVal.textContent = `${s.delayMs} ms`;
      delFrames.textContent = `≈ ${(s.delayMs / 16.68).toFixed(1)} frames @ 59.94`;
      gIn.value = String(s.gain); gVal.textContent = `${s.gain} %`;
      bIn.value = String(s.black); bVal.textContent = (s.black > 0 ? '+' : '') + s.black;
      sIn.value = String(s.sat); sVal.textContent = `${s.sat} %`;
      hIn.value = String(s.hue); hVal.textContent = `${s.hue > 0 ? '+' : ''}${s.hue}°`;
      // Proc-amp preview via CSS filters (bypass → clean pass-through).
      const bright = s.bypass ? 1 : (s.gain / 100) + (s.black / 400);
      const contrast = s.bypass ? 1 : 1 - (s.black / 200);
      preview.style.filter = s.bypass ? 'none' : `brightness(${bright.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${(s.sat / 100).toFixed(3)}) hue-rotate(${s.hue}deg)`;
      if (publish) pub();
    }

    bypassBtn.addEventListener('click', () => { s.bypass = !s.bypass; sync(true); });
    refBtns.forEach(([b, r]) => b.addEventListener('click', () => { s.reference = r; sync(true); }));
    delIn.addEventListener('input', () => { s.delayMs = +delIn.value; sync(true); });
    gIn.addEventListener('input', () => { s.gain = +gIn.value; sync(true); });
    bIn.addEventListener('input', () => { s.black = +bIn.value; sync(true); });
    sIn.addEventListener('input', () => { s.sat = +sIn.value; sync(true); });
    hIn.addEventListener('input', () => { s.hue = +hIn.value; sync(true); });

    // External control: honour writes from the bus / other consoles (CR.6 R/W).
    ctx.services.onParam?.('bypass', (v) => { s.bypass = !!v; sync(); });
    ctx.services.onParam?.('reference', (v) => { if (v === 'house' || v === 'input' || v === 'freerun') { s.reference = v; sync(); } });
    ctx.services.onParam?.('delay_ms', (v) => { if (typeof v === 'number') { s.delayMs = v; sync(); } });
    ctx.services.onParam?.('gain', (v) => { if (typeof v === 'number') { s.gain = v; sync(); } });
    ctx.services.onParam?.('black', (v) => { if (typeof v === 'number') { s.black = v; sync(); } });
    ctx.services.onParam?.('sat', (v) => { if (typeof v === 'number') { s.sat = v; sync(); } });
    ctx.services.onParam?.('hue', (v) => { if (typeof v === 'number') { s.hue = v; sync(); } });

    sync(true);
  },
};

export default plugin;
