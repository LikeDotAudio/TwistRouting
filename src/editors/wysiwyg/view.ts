// src/editors/wysiwyg/view — DOM build + the 60fps top-down pre-viz render loop.
//
// Faithful port of js/editors/wysiwyg.js: floor grid, foot-candle heat map, beam
// cones, camera frustum, virtual talent + ray-traced shadow, and per-fixture tally
// glow. Reads only the typed context; the animation loop runs through ctx.dispose.

import type { EditorContext } from '../types.js';
import { injectWysiwygStyles } from './styles.js';
import { buildFixtures } from './state.js';
import type { UiState } from './state.js';

/** Heat-map ramp: blue → cyan → yellow → red (verbatim legacy stops). */
function heatColor(v: number): string {
  const stops: ReadonlyArray<readonly [number, number, number]> = [
    [31, 58, 110],
    [33, 216, 192],
    [255, 225, 77],
    [255, 59, 59],
  ];
  const t = v * 3;
  const i = Math.min(2, Math.floor(t));
  const f = t - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return `rgb(${(a[0] + (b[0] - a[0]) * f) | 0},${(a[1] + (b[1] - a[1]) * f) | 0},${(a[2] + (b[2] - a[2]) * f) | 0})`;
}

export function renderWysiwyg(host: HTMLElement, ctx: EditorContext): void {
  injectWysiwygStyles();

  const fx = buildFixtures(ctx);
  const ui: UiState = { heat: true, beams: true, frustum: true, talentRot: 0.5 };

  host.innerHTML = `
      <div class="wy">
        <div class="wy-card" style="display:flex;flex-direction:column">
          <h4>Studio Pre-Viz · sACN / Art-Net mirror</h4>
          <div class="wy-stage"><canvas></canvas></div>
        </div>
        <div class="wy-right">
          <div class="wy-card"><h4>Overlays</h4><div class="wy-toggles">
            <div class="wy-tg on" data-t="heat">Foot-Candle Heat Map</div>
            <div class="wy-tg on" data-t="beams">Beam Cones</div>
            <div class="wy-tg on" data-t="frustum">Camera Frustum</div>
          </div><div class="wy-leg" style="margin-top:10px">LOW <i></i> HIGH</div></div>
          <div class="wy-card"><h4>Fixtures · DMX</h4><div class="wy-fx"></div></div>
          <div class="wy-card"><h4>Virtual Talent</h4>
            <div class="wy-fxr"><div class="nm">Face</div><input id="wy-rot" type="range" min="0" max="1" step="0.01" value="0.5"></div>
            <div class="wy-tag"></div>
          </div>
        </div>
      </div>`;

  const cv = host.querySelector<HTMLCanvasElement>('.wy-stage canvas');
  const tag = host.querySelector<HTMLElement>('.wy-tag');
  const fxHost = host.querySelector<HTMLElement>('.wy-fx');
  if (!cv || !tag || !fxHost) return;

  // G5 — guard the 2D context once, not per frame.
  const g = cv.getContext('2d');
  if (!g) return;

  host.querySelectorAll<HTMLElement>('.wy-tg').forEach((t) => {
    t.addEventListener('click', () => {
      const key = t.dataset['t'] as 'heat' | 'beams' | 'frustum' | undefined;
      if (!key) return;
      ui[key] = !ui[key];
      t.classList.toggle('on', ui[key]);
    });
  });

  fx.forEach((f) => {
    const r = document.createElement('div');
    r.className = 'wy-fxr';
    r.innerHTML = `<div class="nm">${f.k}</div><input type="range" min="0" max="1" step="0.01" value="${f.on}">`;
    const input = r.querySelector<HTMLInputElement>('input');
    if (input) input.addEventListener('input', (e) => { f.on = +(e.target as HTMLInputElement).value; });
    fxHost.appendChild(r);
  });

  const rot = host.querySelector<HTMLInputElement>('#wy-rot');
  if (rot) rot.addEventListener('input', (e) => { ui.talentRot = +(e.target as HTMLInputElement).value; });

  function frame(): void {
    const w = (cv!.width = cv!.clientWidth);
    const h = (cv!.height = cv!.clientHeight);
    if (!w || !h) return;
    g!.clearRect(0, 0, w, h);
    // floor + truss
    g!.fillStyle = '#0a1322';
    g!.fillRect(0, 0, w, h);
    g!.strokeStyle = 'rgba(60,90,130,.25)';
    for (let i = 1; i < 8; i++) {
      const x = (i / 8) * w;
      g!.beginPath();
      g!.moveTo(x, 0);
      g!.lineTo(x, h);
      g!.stroke();
    }
    for (let i = 1; i < 6; i++) {
      const y = (i / 6) * h;
      g!.beginPath();
      g!.moveTo(0, y);
      g!.lineTo(w, y);
      g!.stroke();
    }
    const sx = 0.5 * w;
    const sy = 0.46 * h;
    // heat map (coarse grid of accumulated intensity)
    if (ui.heat) {
      const G = 26;
      const cw = w / G;
      const chh = h / G;
      for (let gx = 0; gx < G; gx++)
        for (let gy = 0; gy < G; gy++) {
          const px = (gx + 0.5) * cw;
          const py = (gy + 0.5) * chh;
          let lux = 0;
          fx.forEach((f) => {
            const fxp = f.x * w;
            const fyp = f.y * h;
            const d = Math.hypot(px - fxp, py - fyp);
            lux += f.on * Math.max(0, 1 - d / (w * 0.5));
          });
          lux = Math.min(1, lux * 0.7);
          if (lux > 0.02) {
            g!.fillStyle = heatColor(lux);
            g!.globalAlpha = 0.5;
            g!.fillRect(gx * cw, gy * chh, cw + 1, chh + 1);
            g!.globalAlpha = 1;
          }
        }
    }
    // beam cones
    if (ui.beams)
      fx.forEach((f) => {
        const fxp = f.x * w;
        const fyp = f.y * h;
        const ang = Math.atan2(sy - fyp, sx - fxp);
        const spread = 0.32;
        g!.fillStyle = `hsla(${f.hue},90%,60%,${(0.06 + f.on * 0.14).toFixed(2)})`;
        g!.beginPath();
        g!.moveTo(fxp, fyp);
        g!.lineTo(fxp + Math.cos(ang - spread) * w, fyp + Math.sin(ang - spread) * w);
        g!.lineTo(fxp + Math.cos(ang + spread) * w, fyp + Math.sin(ang + spread) * w);
        g!.closePath();
        g!.fill();
      });
    // camera frustum (from bottom-centre toward subject)
    if (ui.frustum) {
      const cxp = 0.5 * w;
      const cyp = 0.98 * h;
      g!.strokeStyle = 'rgba(111,200,240,.7)';
      g!.lineWidth = 1.5;
      g!.beginPath();
      g!.moveTo(cxp, cyp);
      g!.lineTo(sx - 130, sy - 40);
      g!.moveTo(cxp, cyp);
      g!.lineTo(sx + 130, sy - 40);
      g!.stroke();
      g!.fillStyle = 'rgba(111,200,240,.06)';
      g!.beginPath();
      g!.moveTo(cxp, cyp);
      g!.lineTo(sx - 130, sy - 40);
      g!.lineTo(sx + 130, sy - 40);
      g!.closePath();
      g!.fill();
      g!.fillStyle = '#6FC8F0';
      g!.font = '10px Courier New, monospace';
      g!.fillText('CAM', cxp - 11, cyp - 4);
    }
    // talent + shadow (shadow opposite the key)
    const key = fx[0]!;
    const shAng = Math.atan2(sy - key.y * h, sx - key.x * w);
    g!.fillStyle = 'rgba(0,0,0,.4)';
    g!.beginPath();
    g!.ellipse(sx + Math.cos(shAng) * 26, sy + Math.sin(shAng) * 26, 30, 16, shAng, 0, 7);
    g!.fill();
    g!.fillStyle = '#e7b48a';
    g!.beginPath();
    g!.arc(sx, sy, 18, 0, 7);
    g!.fill();
    g!.fillStyle = '#caa15a';
    g!.beginPath();
    g!.arc(sx + (ui.talentRot - 0.5) * 18, sy - 3, 7, 0, 7);
    g!.fill(); // nose = facing dir
    // fixtures (circle + crosshair) with tally glow
    fx.forEach((f) => {
      const fxp = f.x * w;
      const fyp = f.y * h;
      const lit = f.on > 0.03;
      g!.strokeStyle = lit ? `hsl(${f.hue},90%,65%)` : '#33415f';
      g!.fillStyle = '#0a1326';
      g!.lineWidth = 2;
      if (lit) {
        g!.shadowColor = `hsl(${f.hue},90%,60%)`;
        g!.shadowBlur = 12;
      }
      g!.beginPath();
      g!.arc(fxp, fyp, 11, 0, 7);
      g!.fill();
      g!.stroke();
      g!.shadowBlur = 0;
      g!.beginPath();
      g!.moveTo(fxp - 11, fyp);
      g!.lineTo(fxp + 11, fyp);
      g!.moveTo(fxp, fyp - 11);
      g!.lineTo(fxp, fyp + 11);
      g!.stroke();
      g!.fillStyle = '#9fb6cc';
      g!.font = 'bold 9px Courier New, monospace';
      g!.fillText(f.k, fxp - 9, fyp + 24);
    });
    const active = fx.filter((f) => f.on > 0.03).length;
    tag!.innerHTML = `Universe 1 · ${active * 2} ch live<br>${active}/${fx.length} fixtures on<br>Ray-traced · shadow ${Math.round((1 - key.on) * 100)}% soft`;
  }

  ctx.dispose.raf(frame);
}
