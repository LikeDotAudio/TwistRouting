// src/editors/camera-control — the CCU / RCP "Single Pane of Glass" camera
// console (the largest legacy editor). Port of js/editors/camera-control.js plus
// its ./camera/* modules (state / styles / bars / maps / controls); the RGB
// parade + vectorscope come from the shared, already-ported src/ui/scopes.ts.
//
// This file assembles the layout, owns the per-frame loop (registered on
// ctx.dispose), and is driven entirely from the typed EditorContext — NO DOM
// scraping (M3): the routed camera lineage comes from ctx.sources, role gating
// from ctx.can / requiredCaps.

import type { EditorPlugin } from '../types.js';
import { addStyles, qs } from '../../ui/dom.js';
import { drawParade, drawVectorscope } from '../../ui/scopes.js';
import { CSS } from './styles.js';
import { mkState, clamp } from './state.js';
import type { CameraConsole, CamState, UiState } from './state.js';
import { drawSMPTE, stepDVD } from './bars.js';
import { topSVG, sideSVG, updateMaps } from './maps.js';
import { buildShading, buildJoystick, buildTally, buildPresets, buildFunctions } from './controls.js';

interface ResizeOpts {
  minW?: number;
  minH?: number;
  square?: boolean;
  max?: number;
}

/** The robotics keys a fly-to interpolation eases between. */
const FLY_KEYS = ['pan', 'tilt', 'zoom', 'dolly', 'ped'] as const;
/** The RGB gains auto-white-balance trims toward neutral. */
const RGB_GAINS = ['rGain', 'gGain', 'bGain'] as const;

const plugin: EditorPlugin = {
  id: 'camera-control',
  title: 'Camera Control · CCU / RCP',
  order: 6,
  match: (n) => /\bcam\b|camera/i.test(n),
  requiredCaps: ['shade'],
  render(host, ctx) {
    addStyles('cc-styles', CSS);

    // Title + camera number from the typed twist name (legacy scraped .twist-title).
    const titleTxt = ctx.twist.name.replace(/^[^A-Za-z0-9]*/, '').trim() || 'CAM';
    const numMatch = titleTxt.match(/\d+/);
    const myNum = (numMatch ? parseInt(numMatch[0], 10) : 1) || 1;

    // Lineage of the routed camera (parent › child › grandchild) for the badge —
    // resolved from ctx.sources rather than scraped from a .signal-node origin.
    const routed = ctx.sources[0];
    const origin = routed ? routed.label : '';
    const parts = origin
      .split(' — ')
      .map((s) => s.trim())
      .filter(Boolean);
    const lineage = (parts.length ? parts : [titleTxt]).join('  ›  ').toUpperCase();

    const cams = Array.from({ length: 8 }, mkState);
    const ui: UiState = {
      active: Math.min(7, myNum - 1),
      bars: false,
      autoiris: false,
      autowb: false,
      rec: false,
      drag: false,
      t: 0,
      pendingSave: false,
      vel: { x: 0, y: 0 },
    };

    host.innerHTML = `
      <div class="cc-wrap">
        <div class="cc-glass">
          <div class="cc-video">
            <div class="cc-scene"><div class="cc-subject"></div></div>
          </div>
          <div class="cc-smpte"><canvas></canvas><div class="cc-dvd"></div></div>
          <div class="cc-osd"></div>
          <div class="cc-rec">● REC</div>
          <!-- camera ROBOTICS visualization — docked RIGHT -->
          <div class="cc-map top"><div class="lbl">TOP-DOWN · PAN / DOLLY</div>${topSVG()}</div>
          <div class="cc-map side"><div class="lbl">SIDE · TILT / PED</div>${sideSVG()}</div>
          <!-- scopes — docked LEFT, each with a drag handle to grow -->
          <div class="cc-vecbox cc-scope"><canvas class="cc-vec"></canvas><div class="cc-rsz" title="Drag to resize"></div></div>
          <div class="cc-wfbox cc-scope"><div class="cc-wf-tag">RGB PARADE · IRE</div><canvas class="cc-wf"></canvas><div class="cc-rsz" title="Drag to resize"></div></div>
          <div class="cc-tel-box"><div class="cap">TELEMETRY</div><div class="cc-tel"></div></div>
          <div class="cc-fbtn cc-bars-btn">Color Bars</div>
          <div class="cc-fbtn cc-wb-btn">Auto WB<div class="fill"></div></div>
        </div>

        <div class="cc-rail">
          <div class="cc-card"><h4>5-Axis Master Controller</h4>
            <div class="cc-rate"><label>RATE</label><input type="range" min="0.2" max="3" step="0.05" value="1"><span class="cc-ratev">1.0×</span></div>
            <div class="cc-jsgrid">
              <div class="cc-vside"><label>PED</label><input class="cc-vbar" type="range" min="0" max="1" step="0.01" data-ax="ped"></div>
              <div class="cc-stick"><div class="ring"></div><div class="puck"></div></div>
              <div class="cc-vside"><label>ZOOM</label><input class="cc-vbar" type="range" min="0" max="1" step="0.01" data-ax="zoom"></div>
              <div class="cc-dollybar"><label>DOLLY</label><input type="range" min="0" max="1" step="0.01" data-ax="dolly"></div>
            </div>
            <div class="cc-hint">Drag the puck to Pan / Tilt · twist Zoom · slide Dolly / Ped</div>
          </div>

          <div class="cc-card" data-cap="shade"><h4>Shading Encoders</h4>
            <div class="cc-knobs cc-mono"></div>
            <div class="cc-venn"><div class="cc-venn-bg"><span class="r"></span><span class="g"></span><span class="b"></span></div></div>
          </div>

        </div>

        <div class="cc-foot">
          <div class="cc-card"><h4>Camera Bank · Tally</h4><input class="cc-nick" placeholder="Nickname — e.g. ANCHOR 1 (trickles to mixer/MV)"><div class="cc-tallies"></div></div>
          <div class="cc-card"><h4>Robotics &amp; Camera Presets · Scene Memory</h4>
            <div class="cc-pre"></div>
            <div class="cc-keys"><div class="cc-key" data-act="save">Save</div><div class="cc-key" data-act="path">Rec Path</div><div class="cc-key" data-act="lookat">Look-At</div></div>
          </div>
        </div>
      </div>`;

    const scene = qs(host, '.cc-scene');
    const subject = qs(host, '.cc-subject');
    const smpte = qs<HTMLCanvasElement>(host, '.cc-smpte canvas');
    const smpteBox = qs(host, '.cc-smpte');
    const wf = qs<HTMLCanvasElement>(host, '.cc-wf');
    const osd = qs(host, '.cc-osd');
    const vec = qs<HTMLCanvasElement>(host, '.cc-vec');
    const tel = qs(host, '.cc-tel');
    const dvd = qs(host, '.cc-dvd');
    dvd.textContent = lineage;

    // Drag the corner handle to grow a scope. The canvas redraws to its new client
    // size on the next frame (drawParade / drawVectorscope read clientWidth/Height).
    const makeResizable = (box: HTMLElement, handle: HTMLElement, opts: ResizeOpts): void => {
      let sx = 0;
      let sy = 0;
      let sw = 0;
      let sh = 0;
      const move = (e: PointerEvent): void => {
        // Handle is TOP-RIGHT. A square scope (top-anchored) tracks the rightward
        // drag; a free box (bottom-anchored) grows right + upward.
        if (opts.square) {
          let m = Math.max(opts.minW || 120, sw + (e.clientX - sx));
          if (opts.max) m = Math.min(m, opts.max);
          box.style.width = m + 'px';
          box.style.height = m + 'px';
          return;
        }
        let w = Math.max(opts.minW || 120, sw + (e.clientX - sx));
        let h = Math.max(opts.minH || 100, sh + (sy - e.clientY));
        if (opts.max) {
          w = Math.min(w, opts.max);
          h = Math.min(h, opts.max);
        }
        box.style.width = w + 'px';
        box.style.height = h + 'px';
      };
      const up = (): void => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = box.getBoundingClientRect();
        sw = r.width;
        sh = r.height;
        sx = e.clientX;
        sy = e.clientY;
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    };
    makeResizable(qs(host, '.cc-vecbox'), qs(host, '.cc-vecbox .cc-rsz'), {
      minW: 130,
      minH: 130,
      square: true,
      max: 520,
    });
    makeResizable(qs(host, '.cc-wfbox'), qs(host, '.cc-wfbox .cc-rsz'), { minW: 220, minH: 110, max: 640 });

    const cc: CameraConsole = {
      cams,
      ui,
      S(): CamState {
        return cams[ui.active]!;
      },
      knobEls: [],
      fly: null,
      body: host,
      $<T extends Element = HTMLElement>(sel: string): T {
        return qs<T>(host, sel);
      },
      shade(): void {
        const s = cams[ui.active]!;
        const bright = 0.45 + s.iris * 0.9 + s.mgain * 0.5 + (ui.autoiris ? 0.1 : 0);
        const hue = (s.rGain - s.bGain) * 40;
        const sat = 0.7 + (Math.abs(s.rGain - 0.5) + Math.abs(s.bGain - 0.5)) * 1.2;
        const contrast = 0.8 + s.gamma * 0.6;
        scene.style.filter = `brightness(${bright.toFixed(2)}) contrast(${contrast.toFixed(2)}) saturate(${sat.toFixed(2)}) hue-rotate(${hue.toFixed(0)}deg)`;
      },
      dvdState: { x: 14, y: 14, dx: 3.6, dy: 2.9, color: '#fff' },
    };

    buildShading(cc);
    const { placePuck, syncAxes } = buildJoystick(cc);
    const syncKnobs = (): void => {
      cc.knobEls.forEach((p) => p());
      cc.shade();
    };
    const syncPresets = buildPresets(cc);
    buildTally(cc, () => {
      syncKnobs();
      syncAxes();
      syncPresets();
    });
    buildFunctions(cc, syncKnobs);

    // Colour Bars — glass button (bottom-right).
    const barsBtn = qs(host, '.cc-bars-btn');
    barsBtn.addEventListener('click', () => {
      ui.bars = !ui.bars;
      barsBtn.classList.toggle('on', ui.bars);
      smpteBox.classList.toggle('on', ui.bars);
      dvd.classList.toggle('on', ui.bars);
      qs(host, '.cc-wf-tag').textContent = ui.bars ? 'RGB PARADE · COLOUR BARS' : 'RGB PARADE · IRE';
    });

    // Auto White Balance — glass button (left). Push & HOLD 2s to engage; a tap
    // while active de-activates immediately.
    const wbBtn = qs(host, '.cc-wb-btn');
    const wbFill = qs<HTMLElement>(wbBtn, '.fill');
    let wbT: number | null = null;
    let wbRAF = 0;
    const wbStart = (e?: Event): void => {
      if (e) e.preventDefault();
      if (wbBtn.classList.contains('on')) {
        wbBtn.classList.remove('on');
        ui.autowb = false;
        return;
      }
      const t0 = performance.now();
      const tick = (): void => {
        const p = Math.min(1, (performance.now() - t0) / 2000);
        wbFill.style.height = p * 100 + '%';
        if (wbT !== null) wbRAF = requestAnimationFrame(tick);
      };
      wbT = window.setTimeout(() => {
        wbBtn.classList.add('on');
        wbFill.style.height = '0';
        ui.autowb = true;
        wbT = null;
      }, 2000);
      tick();
    };
    const wbCancel = (): void => {
      if (wbT !== null) {
        clearTimeout(wbT);
        wbT = null;
      }
      cancelAnimationFrame(wbRAF);
      wbFill.style.height = '0';
    };
    wbBtn.addEventListener('mousedown', wbStart);
    window.addEventListener('mouseup', wbCancel);
    wbBtn.addEventListener('mouseleave', wbCancel);
    wbBtn.addEventListener('touchstart', wbStart, { passive: false });
    wbBtn.addEventListener('touchend', wbCancel);

    // Iris encoder — push & HOLD (without dragging) to auto-iris.
    const irisDial = qs(host, '.cc-mono .cc-dial');
    let irisHold: number | null = null;
    let irisMoved = false;
    let irisY = 0;
    const irisDown = (y: number): void => {
      irisMoved = false;
      irisY = y;
      irisHold = window.setTimeout(() => {
        if (!irisMoved) ui.autoiris = true;
      }, 250);
    };
    const irisUp = (): void => {
      if (irisHold !== null) clearTimeout(irisHold);
      ui.autoiris = false;
    };
    irisDial.addEventListener('mousedown', (e) => irisDown(e.clientY));
    window.addEventListener('mousemove', (e) => {
      if (Math.abs(e.clientY - irisY) > 5) irisMoved = true;
    });
    window.addEventListener('mouseup', irisUp);
    irisDial.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        if (t) irisDown(t.clientY);
      },
      { passive: true },
    );
    window.addEventListener('touchend', irisUp);

    // NOTE (M3): the legacy nickname field relabelled every other twist's routed
    // signal node by walking the DOM. That cross-twist mutation has no typed
    // service in EditorServices, so the field renders for parity but is inert.

    const frame = (): void => {
      ui.t += 0.05;
      const s = cc.S();
      if (ui.autoiris) {
        const tgt = 0.6 + Math.sin(ui.t * 0.6) * 0.05;
        s.iris += (tgt - s.iris) * 0.07;
        syncKnobs();
      }
      if (ui.autowb) {
        for (const k of RGB_GAINS) s[k] += (0.5 - s[k]) * 0.1;
        syncKnobs();
      }
      // Velocity joystick: integrate pan/tilt from the puck deflection at RATE.
      const v = ui.vel;
      if (!ui.drag) {
        v.x *= 0.55;
        v.y *= 0.55;
        if (Math.abs(v.x) < 0.004) v.x = 0;
        if (Math.abs(v.y) < 0.004) v.y = 0;
      }
      if (v.x || v.y) {
        s.pan = clamp(s.pan + v.x * s.rate * 0.02);
        s.tilt = clamp(s.tilt + v.y * s.rate * 0.02);
        placePuck();
      }
      const fly = cc.fly;
      if (fly) {
        fly.t = Math.min(1, fly.t + 0.04 * (s.rate || 1));
        const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
        for (const k of FLY_KEYS) s[k] = fly.from[k] + (fly.to[k] - fly.from[k]) * e;
        placePuck();
        syncAxes();
        if (fly.t >= 1) cc.fly = null;
      }
      scene.style.setProperty('--sx', 50 + (s.pan - 0.5) * 60 + '%');
      subject.style.setProperty('--subx', 50 - (s.pan - 0.5) * 80 + '%');
      const zs = 0.7 + s.zoom * 2.6 + s.dolly * 0.4;
      const ty = (s.tilt - 0.5) * -40 + (s.ped - 0.5) * -30;
      subject.style.transform = `translate(-50%,-50%) scale(${zs.toFixed(2)}) translateY(${ty}px)`;
      if (ui.bars) {
        drawSMPTE(smpte);
        stepDVD(dvd, smpteBox, cc.dvdState);
      }
      drawParade(wf, s, ui.bars);
      drawVectorscope(vec, s, ui.bars);
      updateMaps(host, s);
      const focal = Math.round(8 + s.zoom * 280);
      const fstop = (1.8 + (1 - s.iris) * 14).toFixed(1);
      osd.innerHTML = `CAM ${ui.active + 1} &nbsp; LIVE &nbsp; f/${fstop} &nbsp; ${focal}mm`;
      tel.innerHTML =
        `Focal&nbsp; <b>${focal}mm</b><br>Iris&nbsp;&nbsp; <b>f/${fstop}</b><br>Zoom&nbsp; <b>${Math.round(s.zoom * 100)}%</b><br>` +
        `Pan&nbsp;&nbsp; <b>${Math.round((s.pan - 0.5) * 340)}°</b> &nbsp; Tilt <b>${Math.round((s.tilt - 0.5) * 120)}°</b><br>` +
        `Dolly <b>${Math.round(s.dolly * 100)}%</b> &nbsp; Ped <b>${Math.round(s.ped * 100)}%</b>`;
    };

    syncAxes();
    syncPresets();
    placePuck();
    cc.shade();
    ctx.dispose.interval(frame, 33);
  },
};

export default plugin;
