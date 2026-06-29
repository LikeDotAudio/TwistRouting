// src/ui/widgets — the shared LCARS control vocabulary (M4).
//
// Framework-free factory widgets ported from js/editors/core.js (knob, meterBar)
// and the audio-mixer faders. Each returns an HTMLElement and injects its CSS
// once. Animated widgets take a Disposer so the host can stop them on close —
// no module-global timer list (unlike the legacy core.js).

import { el, addStyles } from './dom.js';
import type { Disposer } from './timers.js';

const CSS_ID = 'tr-ui-widgets';
const CSS = `
.tr-kw{display:inline-flex;flex-direction:column;align-items:center;gap:4px;}
.tr-knob{width:42px;height:42px;border-radius:50%;cursor:ns-resize;position:relative;
  background:radial-gradient(circle at 50% 38%,#27344d,#0b1422);
  box-shadow:0 0 0 2px var(--cyan,#00ffff)55,inset 0 2px 6px #000;}
.tr-knob::after{content:"";position:absolute;left:50%;top:5px;width:2px;height:13px;
  background:var(--cyan,#00ffff);transform-origin:50% 16px;transform:translateX(-50%) rotate(var(--rot,0deg));}
.tr-klabel{font-size:9px;letter-spacing:1px;color:#9fb6cc;text-transform:uppercase;}
.tr-fader{display:inline-flex;flex-direction:column;align-items:center;gap:4px;}
.tr-fader-track{position:relative;width:18px;height:120px;border-radius:9px;
  background:linear-gradient(#0a1322,#152138);box-shadow:inset 0 0 4px #000;cursor:ns-resize;}
.tr-fader-cap{position:absolute;left:-4px;width:26px;height:14px;border-radius:3px;
  background:var(--cyan,#00ffff);box-shadow:0 1px 4px #000;transform:translateY(-50%);}
.tr-meter{position:relative;width:9px;height:120px;border-radius:3px;overflow:hidden;
  background:#0a1322;box-shadow:inset 0 0 4px #000;}
.tr-meter>i{position:absolute;bottom:0;left:0;right:0;height:30%;
  background:linear-gradient(#39d353 0%,#39d353 60%,#e8d44a 80%,#ff5a5a 100%);transition:height .1s;}
`;

/** A rotary knob: vertical drag changes value 0..1 → −135..+135°. */
export function knob(label: string, value = 0.5, color = '#00ffff'): HTMLElement {
  addStyles(CSS_ID, CSS);
  const k = el('div', { class: 'tr-knob', style: `--cyan:${color}` });
  let v = value;
  const apply = (): void => k.style.setProperty('--rot', `${v * 270 - 135}deg`);
  apply();
  let startY = 0;
  let startV = 0;
  let dragging = false;
  k.addEventListener('mousedown', (e) => {
    dragging = true;
    startY = e.clientY;
    startV = v;
    e.preventDefault();
  });
  const move = (e: MouseEvent): void => {
    if (!dragging) return;
    v = Math.max(0, Math.min(1, startV + (startY - e.clientY) / 120));
    apply();
  };
  const up = (): void => {
    dragging = false;
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  const wrap = el('div', { class: 'tr-kw' }, [k]);
  if (label) wrap.append(el('div', { class: 'tr-klabel', textContent: label }));
  return wrap;
}

/** A channel fader: vertical drag sets 0..1 (bottom..top). */
export function fader(label: string, value = 0.7, color = '#00ffff'): HTMLElement {
  addStyles(CSS_ID, CSS);
  const track = el('div', { class: 'tr-fader-track', style: `--cyan:${color}` });
  const cap = el('div', { class: 'tr-fader-cap' });
  track.append(cap);
  let v = value;
  const apply = (): void => {
    cap.style.top = `${(1 - v) * 100}%`;
  };
  apply();
  let dragging = false;
  const setFromEvent = (clientY: number): void => {
    const r = track.getBoundingClientRect();
    v = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height));
    apply();
  };
  track.addEventListener('mousedown', (e) => {
    dragging = true;
    setFromEvent(e.clientY);
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => dragging && setFromEvent(e.clientY));
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  const wrap = el('div', { class: 'tr-fader' }, [track]);
  if (label) wrap.append(el('div', { class: 'tr-klabel', textContent: label }));
  return wrap;
}

/** An animated VU meter. Registers its interval with the disposer (port of meterBar). */
export function meter(dispose: Disposer, seed = 0.3): HTMLElement {
  addStyles(CSS_ID, CSS);
  const m = el('div', { class: 'tr-meter' });
  const fill = el('i');
  m.append(fill);
  let lvl = seed;
  dispose.interval(() => {
    lvl = Math.max(0.05, Math.min(1, lvl + (Math.random() - 0.5) * 0.4));
    fill.style.height = `${lvl * 100}%`;
  }, 120);
  return m;
}
