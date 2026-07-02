// src/editors/meter-input/hover — a shared "readout + markers" layer for scopes.
//
// Every scope canvas gets the same two affordances:
//   • HOVER  → a live badge showing the pointer's position in that scope's own
//     axis units plus the measured value under it (e.g. "R · col 47% · 62 IRE ·
//     n=123", "hue 112° · sat 74%", "t 40% · −18 dBFS").
//   • RIGHT-CLICK → drops a persistent marker at that point, labelled with the
//     readout. Markers live in the scope's DATA space, so they track pan/zoom and
//     card resize; click a marker (or its ×) to remove it. Call sync() each frame
//     to keep them pinned as the view transform changes.
//
// A scope supplies a `read(dx,dy,W,H)` that maps DATA-space backing coords to a
// readable {pos, val}. For pan/zoom scopes it also supplies its `view` so the
// layer can invert the transform (client→backing→data) consistently.
import { el, addStyles } from '../../ui/dom.js';
import type { View } from './live-input.js';

export interface ProbeResult { pos: string; val?: string }
export interface Probe {
  view?: View;
  read(dx: number, dy: number, W: number, H: number): ProbeResult | null;
}

interface Marker { cv: HTMLCanvasElement; view?: View; dx: number; dy: number; node: HTMLElement }

export interface HoverLayer {
  attach(cv: HTMLCanvasElement, probe: Probe): void;
  sync(): void;          // reposition markers (call once per animation frame)
  dispose(): void;
}

const HOVER_CSS = `
.mi-probe{position:fixed;z-index:100001;display:none;pointer-events:none;white-space:nowrap;
    background:#06101f;border:1px solid #2c4370;border-radius:6px;padding:4px 8px;
    color:#bfe0ff;font:11px/1.3 'Courier New',monospace;box-shadow:0 6px 18px rgba(0,0,0,.6);}
.mi-probe.open{display:block;} .mi-probe b{color:#ffd27f;}
.mi-marker{position:absolute;z-index:6;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;
    display:flex;align-items:center;gap:3px;}
.mi-marker .x{width:11px;height:11px;border-radius:50%;border:1.5px solid #ffd27f;position:relative;
    box-shadow:0 0 6px rgba(255,210,127,.7);background:rgba(255,210,127,.12);}
.mi-marker .x::before,.mi-marker .x::after{content:'';position:absolute;background:#ffd27f;}
.mi-marker .x::before{left:50%;top:1px;bottom:1px;width:1px;transform:translateX(-50%);}
.mi-marker .x::after{top:50%;left:1px;right:1px;height:1px;transform:translateY(-50%);}
.mi-marker .lbl{font:9px/1.2 'Courier New',monospace;color:#ffe9b0;background:rgba(6,16,31,.85);
    border:1px solid #3a2f10;border-radius:4px;padding:1px 4px;white-space:nowrap;}
.mi-marker:hover .lbl{color:#fff;border-color:#ffd27f;}`;

export function createHoverLayer(): HoverLayer {
  addStyles('meter-hover-styles', HOVER_CSS);
  const probe = el('div', { class: 'mi-probe' });
  document.body.append(probe);
  const markers: Marker[] = [];

  // client (mouse) → DATA-space backing coords, inverting the pan/zoom view.
  const toData = (cv: HTMLCanvasElement, view: View | undefined, clientX: number, clientY: number): [number, number] => {
    const r = cv.getBoundingClientRect();
    const bx = (clientX - r.left) * (cv.width / (r.width || 1));
    const by = (clientY - r.top) * (cv.height / (r.height || 1));
    if (!view) return [bx, by];
    return [(bx - view.px) / view.z, (by - view.py) / view.z];
  };
  // DATA-space → percentage within the canvas backing store (for CSS placement).
  const toPct = (cv: HTMLCanvasElement, view: View | undefined, dx: number, dy: number): [number, number] => {
    const bx = view ? dx * view.z + view.px : dx;
    const by = view ? dy * view.z + view.py : dy;
    return [(bx / (cv.width || 1)) * 100, (by / (cv.height || 1)) * 100];
  };

  const placeProbe = (x: number, y: number): void => {
    const w = probe.offsetWidth, h = probe.offsetHeight;
    probe.style.left = `${Math.max(6, Math.min(x + 14, window.innerWidth - w - 6))}px`;
    probe.style.top = `${Math.max(6, Math.min(y + 16, window.innerHeight - h - 6))}px`;
  };

  const syncOne = (m: Marker): void => {
    const [lx, ly] = toPct(m.cv, m.view, m.dx, m.dy);
    m.node.style.left = `${lx}%`; m.node.style.top = `${ly}%`;
    // Fade a marker that has been panned/zoomed off its canvas.
    m.node.style.opacity = (lx < -2 || lx > 102 || ly < -2 || ly > 102) ? '0.15' : '1';
  };

  const attach = (cv: HTMLCanvasElement, p: Probe): void => {
    cv.addEventListener('mousemove', (e) => {
      const [dx, dy] = toData(cv, p.view, e.clientX, e.clientY);
      const r = p.read(dx, dy, cv.width, cv.height);
      if (!r) { probe.classList.remove('open'); return; }
      probe.innerHTML = `<b>${r.pos}</b>${r.val ? ` · ${r.val}` : ''}`;
      probe.classList.add('open'); placeProbe(e.clientX, e.clientY);
    });
    cv.addEventListener('mouseleave', () => probe.classList.remove('open'));
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const host = cv.parentElement; if (!host) return;
      const [dx, dy] = toData(cv, p.view, e.clientX, e.clientY);
      const r = p.read(dx, dy, cv.width, cv.height);
      const label = r ? (r.val ? `${r.pos} · ${r.val}` : r.pos) : `${dx | 0},${dy | 0}`;
      const node = el('div', { class: 'mi-marker', title: 'Click to remove marker' }, [
        el('span', { class: 'x' }), el('span', { class: 'lbl' }, [label]),
      ]);
      const m: Marker = { cv, view: p.view, dx, dy, node };
      node.addEventListener('click', (ev) => { ev.stopPropagation(); node.remove(); const i = markers.indexOf(m); if (i >= 0) markers.splice(i, 1); });
      node.addEventListener('contextmenu', (ev) => ev.preventDefault());
      host.append(node); markers.push(m); syncOne(m);
    });
  };

  return {
    attach,
    sync: () => { for (const m of markers) syncOne(m); },
    dispose: () => { probe.remove(); markers.forEach((m) => m.node.remove()); markers.length = 0; },
  };
}
