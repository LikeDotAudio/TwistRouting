// js/editors/camera-control.js — orchestrator for the CCU / RCP "Single Pane of
// Glass" camera console. The feature work lives in ./camera/* modules:
//   styles.js   – all CSS
//   state.js    – per-camera shading/robotics state
//   scopes.js   – RGB parade waveform + vectorscope
//   bars.js     – precision SMPTE colour bars + bouncing lineage badge
//   maps.js     – top-down + side robotics maps
//   controls.js – encoders (incl. RGB-Venn), 5-axis joystick, tally, presets
// This file assembles the layout, owns the per-frame loop, and registers it.
import { register, addStyles, pushTimer } from './core.js';
import { CSS } from './camera/styles.js';
import { mkState } from './camera/state.js';
import { drawParade, vectorXY } from './camera/scopes.js';
import { drawSMPTE, stepDVD } from './camera/bars.js';
import { topSVG, sideSVG, updateMaps } from './camera/maps.js';
import { buildShading, buildJoystick, buildTally, buildPresets, buildFunctions } from './camera/controls.js';

function render(body, twist) {
    addStyles('cc-styles', CSS);
    const titleTxt = ((twist.querySelector('.twist-title') || {}).innerText || 'CAM').replace(/^[^A-Za-z0-9]*/, '').trim();
    const myNum = parseInt((titleTxt.match(/\d+/) || [1])[0], 10) || 1;
    // Lineage of the routed camera (parent › child › grandchild) for the badge.
    const routed = twist.querySelector('.drop-zone .signal-node');
    const origin = routed ? (routed.dataset.origin || '') : '';
    const parts = origin.split(' — ').map(s => s.trim()).filter(Boolean);
    const lineage = (parts.length ? parts : [titleTxt]).join('  ›  ').toUpperCase();

    const cams = Array.from({ length: 8 }, mkState);
    const ui = { active: Math.min(7, myNum - 1), bars: false, autoiris: false, rec: false, drag: false, t: 0, pendingSave: false };

    body.innerHTML = `
      <div class="cc-wrap">
        <div class="cc-glass">
          <div class="cc-video">
            <div class="cc-scene"><div class="cc-subject"></div></div>
            <canvas class="cc-smpte"></canvas>
            <div class="cc-dvd"></div>
          </div>
          <div class="cc-osd"></div>
          <div class="cc-rec">● REC</div>
          <div class="cc-map top"><div class="lbl">TOP-DOWN · PAN / DOLLY</div>${topSVG()}</div>
          <div class="cc-map side"><div class="lbl">SIDE · TILT / PED</div>${sideSVG()}</div>
          <div class="cc-vec"><div class="cross"></div><div class="dot"></div></div>
          <div class="cc-wf-tag">RGB PARADE · IRE</div>
          <canvas class="cc-wf"></canvas>
        </div>

        <div class="cc-rail">
          <div class="cc-card"><h4>5-Axis Master Controller</h4>
            <div class="cc-jsgrid">
              <div class="cc-vside"><label>PED</label><input class="cc-vbar" type="range" min="0" max="1" step="0.01" data-ax="ped"></div>
              <div class="cc-stick"><div class="ring"></div><div class="puck"></div></div>
              <div class="cc-vside"><label>ZOOM</label><input class="cc-vbar" type="range" min="0" max="1" step="0.01" data-ax="zoom"></div>
              <div class="cc-dollybar"><label>DOLLY</label><input type="range" min="0" max="1" step="0.01" data-ax="dolly"></div>
            </div>
            <div class="cc-hint">Drag the puck to Pan / Tilt · twist Zoom · slide Dolly / Ped</div>
          </div>

          <div class="cc-card"><h4>Shading Encoders</h4>
            <div class="cc-knobs cc-mono"></div>
            <div class="cc-venn"><div class="cc-venn-bg"><span class="r"></span><span class="g"></span><span class="b"></span></div></div>
          </div>

          <div class="cc-card"><h4>Functions</h4>
            <div class="cc-keys"><div class="cc-key" data-act="bars">Color Bars</div><div class="cc-key" data-act="autoiris">Auto Iris</div><div class="cc-key" data-act="wb">White Bal</div></div>
          </div>

          <div class="cc-card"><h4>Telemetry</h4><div class="cc-tel"></div></div>
        </div>

        <div class="cc-foot">
          <div class="cc-card"><h4>Camera Bank · Tally</h4><div class="cc-tallies"></div></div>
          <div class="cc-card"><h4>Robotics &amp; Camera Presets · Scene Memory</h4>
            <div class="cc-pre"></div>
            <div class="cc-keys"><div class="cc-key" data-act="save">Save</div><div class="cc-key" data-act="path">Rec Path</div><div class="cc-key" data-act="lookat">Look-At</div></div>
          </div>
        </div>
      </div>`;

    const $ = (s) => body.querySelector(s);
    const scene = $('.cc-scene'), subject = $('.cc-subject'), video = $('.cc-video');
    const smpte = $('.cc-smpte'), wf = $('.cc-wf'), osd = $('.cc-osd'), vecDot = $('.cc-vec .dot'), tel = $('.cc-tel');
    const dvd = $('.cc-dvd'); dvd.textContent = lineage;

    function shade() {
        const s = ctx.S();
        const bright = 0.45 + s.iris * 0.9 + s.mgain * 0.5 + (ui.autoiris ? 0.1 : 0);
        const hue = (s.rGain - s.bGain) * 40, sat = 0.7 + (Math.abs(s.rGain - 0.5) + Math.abs(s.bGain - 0.5)) * 1.2, contrast = 0.8 + s.gamma * 0.6;
        scene.style.filter = `brightness(${bright.toFixed(2)}) contrast(${contrast.toFixed(2)}) saturate(${sat.toFixed(2)}) hue-rotate(${hue.toFixed(0)}deg)`;
        const [vx, vy] = vectorXY(s);
        vecDot.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px))`;
    }

    const ctx = { S: () => cams[ui.active], ui, knobEls: [], fly: null, body, $, shade };

    buildShading(ctx);
    const { placePuck, syncAxes } = buildJoystick(ctx);
    const syncKnobs = () => { ctx.knobEls.forEach(p => p()); shade(); };
    const syncPresets = buildPresets(ctx);
    const syncBank = buildTally(ctx, () => { syncKnobs(); syncAxes(); syncPresets(); });
    buildFunctions(ctx, syncKnobs);
    ctx.dvdState = { x: 14, y: 14, dx: 1.7, dy: 1.3, color: '#fff' };

    function frame() {
        ui.t += 0.05; const s = ctx.S();
        if (ctx.fly) {
            ctx.fly.t = Math.min(1, ctx.fly.t + 0.04);
            const e = ctx.fly.t < .5 ? 2 * ctx.fly.t * ctx.fly.t : 1 - Math.pow(-2 * ctx.fly.t + 2, 2) / 2;
            ['pan', 'tilt', 'zoom', 'dolly', 'ped'].forEach(k => s[k] = ctx.fly.from[k] + (ctx.fly.to[k] - ctx.fly.from[k]) * e);
            placePuck(); syncAxes(); if (ctx.fly.t >= 1) ctx.fly = null;
        }
        scene.style.setProperty('--sx', (50 + (s.pan - 0.5) * 60) + '%');
        subject.style.setProperty('--subx', (50 - (s.pan - 0.5) * 80) + '%');
        const zs = 0.7 + s.zoom * 2.6 + s.dolly * 0.4, ty = (s.tilt - 0.5) * -40 + (s.ped - 0.5) * -30;
        subject.style.transform = `translate(-50%,-50%) scale(${zs.toFixed(2)}) translateY(${ty}px)`;
        if (ui.bars) { drawSMPTE(smpte); stepDVD(dvd, video, ctx.dvdState); }
        drawParade(wf, s, ui.bars); updateMaps(body, s);
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
