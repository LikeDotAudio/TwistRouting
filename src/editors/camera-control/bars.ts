// src/editors/camera-control/bars — the precision SMPTE colour-bar test pattern,
// plus the bouncing "DVD-logo" lineage badge shown over the bars. Port of
// js/editors/camera/bars.js, with the canvas 2D context guarded (G5).
//
// SMPTE layout: top 2/3 = seven 75% bars; a thin reverse-castellation strip;
// bottom = -I / 100% white / +Q / PLUGE (super-black, black, lighter) for black-
// level line-up.

import type { DvdState } from './state.js';

const TOP = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'] as const;
const MID = ['#0000bf', '#131313', '#bf00bf', '#131313', '#00bfbf', '#131313', '#bfbfbf'] as const;

export function drawSMPTE(cv: HTMLCanvasElement): void {
  const w = cv.clientWidth | 0;
  const h = cv.clientHeight | 0;
  if (!w || !h) return;
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const topH = Math.round(h * 0.66);
  const midH = Math.round(h * 0.08);
  const botY = topH + midH;
  const botH = h - botY;
  const cw = w / 7;
  TOP.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(i * cw), 0, Math.ceil(cw) + 1, topH);
  });
  MID.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(i * cw), topH, Math.ceil(cw) + 1, midH);
  });
  let x = 0;
  const u = w / 7;
  const seg = (width: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), botY, Math.ceil(width) + 1, botH);
    x += width;
  };
  seg(u * 1.2, '#00214c'); // -I
  seg(u * 1.2, '#ffffff'); // 100% white
  seg(u * 1.2, '#2a0a52'); // +Q
  seg(u * 1.06, '#131313'); // black
  seg(u * 0.42, '#0a0a0a'); // PLUGE super-black (3.5 IRE)
  seg(u * 0.42, '#151515'); // PLUGE black (7.5 IRE)
  seg(u * 0.42, '#1f1f1f'); // PLUGE lighter (11.5 IRE)
  seg(w - x, '#131313'); // black
  ctx.fillStyle = 'rgba(160,190,220,.5)';
  ctx.font = '8px Courier New, monospace';
  ctx.fillText('PLUGE', Math.round(u * 4.6), botY + botH - 4);
}

const DVD_COLORS = ['#ff4d4d', '#28e04a', '#4d83ff', '#ffd400', '#ff5bd1', '#5be0ff', '#ffffff'] as const;

/** Advance the bouncing badge one frame; recolour (≠ current) on each bounce. */
export function stepDVD(elm: HTMLElement, vid: HTMLElement, st: DvdState): void {
  const W = vid.clientWidth;
  const H = vid.clientHeight;
  const dw = elm.offsetWidth;
  const dh = elm.offsetHeight;
  if (!W || !H) return;
  st.x += st.dx;
  st.y += st.dy;
  let bounced = false;
  if (st.x <= 0) {
    st.x = 0;
    st.dx = Math.abs(st.dx);
    bounced = true;
  }
  if (st.x + dw >= W) {
    st.x = W - dw;
    st.dx = -Math.abs(st.dx);
    bounced = true;
  }
  if (st.y <= 0) {
    st.y = 0;
    st.dy = Math.abs(st.dy);
    bounced = true;
  }
  if (st.y + dh >= H) {
    st.y = H - dh;
    st.dy = -Math.abs(st.dy);
    bounced = true;
  }
  if (bounced) {
    let c: string;
    do {
      c = DVD_COLORS[Math.floor(Math.random() * DVD_COLORS.length)]!;
    } while (c === st.color);
    st.color = c;
    elm.style.color = c;
  }
  elm.style.left = st.x + 'px';
  elm.style.top = st.y + 'px';
}
