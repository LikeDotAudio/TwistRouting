// js/editors/camera-control.js — orchestrator for the CCU / RCP "Single Pane of
// Glass" camera console. The feature work lives in ./camera/* modules:
//   styles.js   – all CSS
//   state.js    – per-camera shading/robotics state
//   bars.js     – precision SMPTE colour bars + bouncing lineage badge
//   maps.js     – top-down + side robotics maps
//   controls.js – encoders (incl. RGB-Venn), 5-axis joystick, tally, presets
// This file assembles the layout, owns the per-frame loop, and registers it.
import { register, addStyles, pushTimer } from './core.js';
import { CSS } from './camera/styles.js';
import { mkState, clamp } from './camera/state.js';
import { drawParade, drawVectorscope } from './shared/video-scopes.js';
import { drawSMPTE, stepDVD } from './camera/bars.js';
import { topSVG, sideSVG, updateMaps } from './camera/maps.js';
import { buildShading, buildJoystick, buildTally, buildPresets, buildFunctions } from './camera/controls.js';

function render(body, twist) {
    addStyles('cc-styles', CSS);
    const titleTxt = ((twist.querySelector('.twist-title') || {}).innerText || 'CAM').replace(/^[^A-Za-z0-9]*/, '').trim();
    const myNum = parseInt((titleTxt.match(/\d+/) || [1])[0], 10) || 1;
    // Lineage of the routed camera (parent › child › grandchild) for the badge.
    const routed = twist.querySelector('.drop-zone .signal-node');
    let origin = routed ? (routed.dataset.origin || '') : '';
    if (!origin && routed) { const c = routed.querySelector('[data-origin]'); if (c) origin = c.dataset.origin || ''; }
    const parts = origin.split(' — ').map(s => s.trim()).filter(Boolean);
    const lineage = (parts.length ? parts : [titleTxt]).join('  ›  ').toUpperCase();

    const cams = Array.from({ length: 8 }, mkState);
    const ui = { active: Math.min(7, myNum - 1), bars: false, autoiris: false, rec: false, drag: false, t: 0, pendingSave: false, vel: { x: 0, y: 0 } };

    body.innerHTML = `
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

    const $ = (s) => body.querySelector(s);
    const scene = $('.cc-scene'), subject = $('.cc-subject'), video = $('.cc-video');
    const smpte = $('.cc-smpte canvas'), smpteBox = $('.cc-smpte'), wf = $('.cc-wf'), osd = $('.cc-osd'), vec = $('.cc-vec'), tel = $('.cc-tel');
    const dvd = $('.cc-dvd'); dvd.textContent = lineage;

    // Drag the corner handle to grow a scope. The canvas redraws to its new client
    // size on the next frame (drawParade / drawVectorscope read clientWidth/Height).
    function makeResizable(box, handle, opts) {
        opts = opts || {};
        let sx, sy, sw, sh;
        const pt = (e) => e.touches ? e.touches[0] : e;
        const move = (e) => {
            const p = pt(e);
            // Handle is TOP-RIGHT. A square scope (top-anchored) tracks the rightward
            // drag; a free box (bottom-anchored) grows right + upward.
            if (opts.square) {
                let m = Math.max(opts.minW || 120, sw + (p.clientX - sx));
                if (opts.max) m = Math.min(m, opts.max);
                box.style.width = m + 'px'; box.style.height = m + 'px';
                return;
            }
            let w = Math.max(opts.minW || 120, sw + (p.clientX - sx));
            let h = Math.max(opts.minH || 100, sh + (sy - p.clientY));
            if (opts.max) { w = Math.min(w, opts.max); h = Math.min(h, opts.max); }
            box.style.width = w + 'px'; box.style.height = h + 'px';
        };
        const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            const r = box.getBoundingClientRect(); sw = r.width; sh = r.height;
            const p = pt(e); sx = p.clientX; sy = p.clientY;
            document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
        });
    }
    makeResizable($('.cc-vecbox'), $('.cc-vecbox .cc-rsz'), { minW: 130, minH: 130, square: true, max: 520 });
    makeResizable($('.cc-wfbox'), $('.cc-wfbox .cc-rsz'), { minW: 220, minH: 110, max: 640 });

    function shade() {
        const s = ctx.S();
        const bright = 0.45 + s.iris * 0.9 + s.mgain * 0.5 + (ui.autoiris ? 0.1 : 0);
        const hue = (s.rGain - s.bGain) * 40, sat = 0.7 + (Math.abs(s.rGain - 0.5) + Math.abs(s.bGain - 0.5)) * 1.2, contrast = 0.8 + s.gamma * 0.6;
        scene.style.filter = `brightness(${bright.toFixed(2)}) contrast(${contrast.toFixed(2)}) saturate(${sat.toFixed(2)}) hue-rotate(${hue.toFixed(0)}deg)`;
    }

    const ctx = { S: () => cams[ui.active], ui, knobEls: [], fly: null, body, $, shade };

    buildShading(ctx);
    const { placePuck, syncAxes } = buildJoystick(ctx);
    const syncKnobs = () => { ctx.knobEls.forEach(p => p()); shade(); };
    const syncPresets = buildPresets(ctx);
    const syncBank = buildTally(ctx, () => { syncKnobs(); syncAxes(); syncPresets(); });
    buildFunctions(ctx, syncKnobs);
    ctx.dvdState = { x: 14, y: 14, dx: 3.6, dy: 2.9, color: '#fff' };

    // Colour Bars — glass button (bottom-right).
    const barsBtn = $('.cc-bars-btn');
    barsBtn.addEventListener('click', () => {
        ui.bars = !ui.bars; barsBtn.classList.toggle('on', ui.bars);
        smpteBox.classList.toggle('on', ui.bars); dvd.classList.toggle('on', ui.bars);
        $('.cc-wf-tag').textContent = ui.bars ? 'RGB PARADE · COLOUR BARS' : 'RGB PARADE · IRE';
    });

    // Auto White Balance — glass button (left). Push & HOLD 2s to engage; a tap
    // while active de-activates immediately.
    const wbBtn = $('.cc-wb-btn'), wbFill = wbBtn.querySelector('.fill');
    let wbT = null, wbRAF = 0;
    const wbStart = (e) => {
        if (e) e.preventDefault();
        if (wbBtn.classList.contains('on')) { wbBtn.classList.remove('on'); ui.autowb = false; return; }
        const t0 = performance.now();
        const tick = () => { const p = Math.min(1, (performance.now() - t0) / 2000); wbFill.style.height = (p * 100) + '%'; if (wbT) wbRAF = requestAnimationFrame(tick); };
        wbT = setTimeout(() => { wbBtn.classList.add('on'); wbFill.style.height = '0'; ui.autowb = true; wbT = null; }, 2000);
        tick();
    };
    const wbCancel = () => { if (wbT) { clearTimeout(wbT); wbT = null; } cancelAnimationFrame(wbRAF); wbFill.style.height = '0'; };
    wbBtn.addEventListener('mousedown', wbStart); window.addEventListener('mouseup', wbCancel); wbBtn.addEventListener('mouseleave', wbCancel);
    wbBtn.addEventListener('touchstart', wbStart, { passive: false }); wbBtn.addEventListener('touchend', wbCancel);

    // Iris encoder — push & HOLD (without dragging) to auto-iris.
    const irisDial = $('.cc-mono .cc-dial');
    let irisHold = null, irisMoved = false, irisY = 0;
    const irisDown = (y) => { irisMoved = false; irisY = y; irisHold = setTimeout(() => { if (!irisMoved) ui.autoiris = true; }, 250); };
    const irisUp = () => { clearTimeout(irisHold); ui.autoiris = false; };
    irisDial.addEventListener('mousedown', e => irisDown(e.clientY));
    window.addEventListener('mousemove', e => { if (Math.abs(e.clientY - irisY) > 5) irisMoved = true; });
    window.addEventListener('mouseup', irisUp);
    irisDial.addEventListener('touchstart', e => irisDown(e.touches[0].clientY), { passive: true });
    window.addEventListener('touchend', irisUp);

    // Nickname — relabel the camera; trickle to every consumer of this feed.
    const nickEl = $('.cc-nick');
    nickEl.addEventListener('input', () => {
        const nm = nickEl.value.trim();
        if (!origin) return;
        document.querySelectorAll('.twist-container .drop-zone .signal-node').forEach(n => {
            const own = n.dataset.origin || '', childO = n.querySelector('[data-origin]');
            if (!(own === origin || (childO && childO.dataset.origin === origin))) return;
            if (n.classList.contains('dropped-group')) {
                let cap = n.querySelector('.dg-parent'); const hd = n.querySelector('.dropped-group-header');
                if (!cap && hd) { cap = document.createElement('span'); cap.className = 'dg-parent'; hd.prepend(cap); }
                if (cap) cap.textContent = nm;
            } else if (!n.querySelector('.multiplex-children')) {
                if (n.dataset.orig === undefined) n.dataset.orig = n.textContent;
                n.textContent = nm || n.dataset.orig;
            }
        });
    });

    function frame() {
        ui.t += 0.05; const s = ctx.S();
        if (ui.autoiris) { const tgt = 0.6 + Math.sin(ui.t * 0.6) * 0.05; s.iris += (tgt - s.iris) * 0.07; syncKnobs(); }
        if (ui.autowb) { ['rGain', 'gGain', 'bGain'].forEach(k => s[k] += (0.5 - s[k]) * 0.1); syncKnobs(); }
        // Velocity joystick: integrate pan/tilt from the puck deflection at RATE.
        const v = ui.vel;
        if (!ui.drag) { v.x *= 0.55; v.y *= 0.55; if (Math.abs(v.x) < 0.004) v.x = 0; if (Math.abs(v.y) < 0.004) v.y = 0; }
        if (v.x || v.y) { s.pan = clamp(s.pan + v.x * s.rate * 0.02); s.tilt = clamp(s.tilt + v.y * s.rate * 0.02); placePuck(); }
        if (ctx.fly) {
            ctx.fly.t = Math.min(1, ctx.fly.t + 0.04 * (s.rate || 1));
            const e = ctx.fly.t < .5 ? 2 * ctx.fly.t * ctx.fly.t : 1 - Math.pow(-2 * ctx.fly.t + 2, 2) / 2;
            ['pan', 'tilt', 'zoom', 'dolly', 'ped'].forEach(k => s[k] = ctx.fly.from[k] + (ctx.fly.to[k] - ctx.fly.from[k]) * e);
            placePuck(); syncAxes(); if (ctx.fly.t >= 1) ctx.fly = null;
        }
        scene.style.setProperty('--sx', (50 + (s.pan - 0.5) * 60) + '%');
        subject.style.setProperty('--subx', (50 - (s.pan - 0.5) * 80) + '%');
        const zs = 0.7 + s.zoom * 2.6 + s.dolly * 0.4, ty = (s.tilt - 0.5) * -40 + (s.ped - 0.5) * -30;
        subject.style.transform = `translate(-50%,-50%) scale(${zs.toFixed(2)}) translateY(${ty}px)`;
        if (ui.bars) { drawSMPTE(smpte); stepDVD(dvd, smpteBox, ctx.dvdState); }
        drawParade(wf, s, ui.bars); drawVectorscope(vec, s, ui.bars); updateMaps(body, s);
        const focal = Math.round(8 + s.zoom * 280), fstop = (1.8 + (1 - s.iris) * 14).toFixed(1);
        osd.innerHTML = `CAM ${ui.active + 1} &nbsp; LIVE &nbsp; f/${fstop} &nbsp; ${focal}mm`;
        tel.innerHTML = `Focal&nbsp; <b>${focal}mm</b><br>Iris&nbsp;&nbsp; <b>f/${fstop}</b><br>Zoom&nbsp; <b>${Math.round(s.zoom * 100)}%</b><br>`
            + `Pan&nbsp;&nbsp; <b>${Math.round((s.pan - .5) * 340)}°</b> &nbsp; Tilt <b>${Math.round((s.tilt - .5) * 120)}°</b><br>`
            + `Dolly <b>${Math.round(s.dolly * 100)}%</b> &nbsp; Ped <b>${Math.round(s.ped * 100)}%</b>`;
    }

    syncAxes(); syncPresets(); placePuck(); shade();
    pushTimer(setInterval(frame, 33));
}

register(n => /\bcam\b|camera/i.test(n), 'Camera Control · CCU / RCP', render);
