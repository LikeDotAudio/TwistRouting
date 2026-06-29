// src/editors/audio-monitor/view — faithful port of audio-monitor.js buildOne()
// plus the loudness + Lissajous canvas painters. Builds one confidence-monitor
// panel from a sibling's resolved {name, config, sources}; animation runs on the
// shared Disposer (no module-global timer list).

import { qs } from '../../ui/dom.js';
import type { Disposer } from '../../ui/timers.js';
import type { Sibling } from '../types.js';
import { FORMATS, channelsFor, type ChState, type MasterState } from './state.js';

interface ChEl {
  ch: ChState;
  meter: HTMLElement;
  mask: HTMLElement;
  pk: HTMLElement;
}

interface Block {
  group: ChState[];
  chEls: ChEl[];
  liss: HTMLCanvasElement;
  ind: HTMLElement;
  corr: number;
  fmt: { idx: number };
}

/** Render a single Audio Monitor panel into `body`, driven by `sib`'s data. */
export function buildOne(body: HTMLElement, sib: Sibling, dispose: Disposer): void {
  const chans = channelsFor(sib.sources, sib.config, 'CH', 8).slice(0, 24);
  const st: ChState[] = chans.map((c, i) => ({
    label: c.label,
    color: c.color || '#39d353',
    level: 0.2,
    target: 0.35,
    peak: 0.2,
    cue: false,
    mute: false,
    fmtPair: i,
  }));
  const ui: MasterState = { master: 0.75, mute: false, dim: false, downmix: false, lufs: -23, tp: false };

  body.innerHTML = `<div class="am2"><div class="am2-bridge"></div><div class="am2-master"></div></div>`;
  const bridge = qs(body, '.am2-bridge');

  // ---- quad blocks ----
  const blocks: Block[] = [];
  for (let b = 0; b * 4 < st.length; b++) {
    const group = st.slice(b * 4, b * 4 + 4);
    const block = document.createElement('div');
    block.className = 'am2-block';
    const fmt = { idx: 0 };
    block.innerHTML = `<div class="am2-bh"><b>GROUP ${b + 1}</b><div class="am2-fmt">QUAD</div></div><div class="am2-meters"></div>
            <div class="am2-phase"><canvas class="am2-liss" width="74" height="74"></canvas>
              <div class="am2-corr"><div class="bar"><div class="ind"></div></div><div class="cl"><span>-1 ø</span><span>0</span><span>+1</span></div></div></div>`;
    const meters = qs(block, '.am2-meters');
    const chEls: ChEl[] = group.map((ch) => {
      const cell = document.createElement('div');
      cell.className = 'am2-ch';
      cell.innerHTML = `<div class="am2-meter"><div class="mask"></div><div class="pk"></div></div>
                <div class="am2-lab">${ch.label}</div>
                <div class="am2-cue">CUE</div><div class="am2-mute">MUTE</div>`;
      const cueEl = qs(cell, '.am2-cue');
      const muteEl = qs(cell, '.am2-mute');
      cueEl.addEventListener('click', () => {
        ch.cue = !ch.cue;
        cueEl.classList.toggle('on', ch.cue);
      });
      muteEl.addEventListener('click', () => {
        ch.mute = !ch.mute;
        muteEl.classList.toggle('on', ch.mute);
      });
      meters.appendChild(cell);
      return { ch, meter: qs(cell, '.am2-meter'), mask: qs(cell, '.mask'), pk: qs(cell, '.pk') };
    });
    const fmtEl = qs(block, '.am2-fmt');
    fmtEl.addEventListener('click', () => {
      fmt.idx = (fmt.idx + 1) % FORMATS.length;
      fmtEl.textContent = FORMATS[fmt.idx]!;
    });
    bridge.appendChild(block);
    blocks.push({
      group,
      chEls,
      liss: qs<HTMLCanvasElement>(block, '.am2-liss'),
      ind: qs(block, '.am2-corr .ind'),
      corr: 0.6,
      fmt,
    });
  }

  // ---- master section ----
  const master = qs(body, '.am2-master');
  master.innerHTML = `
      <div class="am2-card"><h4>Loudness · ITU-R BS.1770</h4>
        <div class="am2-lufs"><span class="v">-23.0</span><small>LUFS · MOMENTARY</small></div>
        <canvas class="am2-lhist"></canvas>
        <div class="am2-tp"><span class="led"></span><span class="t">TRUE PEAK OK</span></div>
      </div>
      <div class="am2-card"><h4>Monitor Output</h4>
        <div class="am2-vol"><input type="range" min="0" max="1" step="0.01" value="0.75"><b>-6 dB</b></div>
        <div class="am2-keys" style="margin-top:14px">
          <div class="am2-key warn" data-m="mute">Mute</div>
          <div class="am2-key dim" data-m="dim">Dim</div>
          <div class="am2-key" data-m="downmix">Downmix</div>
        </div>
        <div class="am2-keys" style="margin-top:10px">
          <div class="am2-key" data-m="solo-clear">Clear Cue</div>
          <div class="am2-key" data-m="failsafe">Fail-Safe</div>
          <div class="am2-key" data-m="ref">Ref −18</div>
        </div>
      </div>`;
  const lufsEl = qs(master, '.am2-lufs .v');
  const tpEl = qs(master, '.am2-tp');
  const tpTxt = qs(master, '.am2-tp .t');
  const lhEl = qs<HTMLCanvasElement>(master, '.am2-lhist');
  const lhist: number[] = [];
  const vol = qs<HTMLInputElement>(master, '.am2-vol input');
  const volLbl = qs(master, '.am2-vol b');
  const setVolLbl = (): void => {
    const db = ui.master <= 0 ? '-∞' : Math.round((ui.master - 1) * 60);
    volLbl.textContent = (ui.master <= 0 ? '-∞' : db) + ' dB';
  };
  vol.addEventListener('input', () => {
    ui.master = parseFloat(vol.value);
    setVolLbl();
  });
  setVolLbl();
  master.querySelectorAll<HTMLElement>('.am2-key[data-m]').forEach((k) =>
    k.addEventListener('click', () => {
      const m = k.dataset.m;
      if (m === 'mute') {
        ui.mute = !ui.mute;
        k.classList.toggle('on', ui.mute);
      } else if (m === 'dim') {
        ui.dim = !ui.dim;
        k.classList.toggle('on', ui.dim);
      } else if (m === 'downmix') {
        ui.downmix = !ui.downmix;
        k.classList.toggle('on', ui.downmix);
      } else if (m === 'solo-clear') {
        st.forEach((c) => (c.cue = false));
        body.querySelectorAll<HTMLElement>('.am2-cue.on').forEach((e) => e.classList.remove('on'));
      } else {
        k.classList.toggle('on');
      }
    }),
  );

  // ---- animation: ballistic meters, peak hold, phase, loudness ----
  let frame = 0;
  dispose.interval(() => {
    frame++;
    let sum = 0;
    let hot = false;
    st.forEach((ch) => {
      if (frame % 8 === 0) ch.target = ch.mute ? 0 : Math.max(0.05, Math.min(1, ch.target + (Math.random() - 0.5) * 0.5));
      const goal = ch.mute ? 0 : ch.target;
      ch.level += (goal - ch.level) * (goal > ch.level ? 0.55 : 0.12); // fast attack / slow release (PPM)
      if (ch.level > ch.peak) ch.peak = ch.level;
      else ch.peak = Math.max(ch.level, ch.peak - 0.006);
      sum += ch.level;
      if (ch.peak > 0.96) hot = true;
    });
    blocks.forEach((blk) => {
      blk.chEls.forEach(({ ch, meter, mask, pk }) => {
        mask.style.height = 100 - ch.level * 100 + '%';
        pk.style.bottom = ch.peak * 100 + '%';
        meter.classList.toggle('tp', ch.peak > 0.96);
      });
      // phase correlation wanders; Lissajous reflects it
      blk.corr += (Math.random() - 0.5) * 0.06;
      blk.corr = Math.max(-1, Math.min(1, blk.corr));
      blk.ind.style.left = `calc(${((blk.corr + 1) / 2) * 100}% - 2px)`;
      const first = blk.group[0];
      drawLiss(blk.liss, blk.corr, frame, first ? first.level : 0.3);
    });
    // integrated loudness drifts with program level
    const target = -28 + (sum / st.length) * 22;
    ui.lufs += (target - ui.lufs) * 0.05;
    lufsEl.textContent = ui.lufs.toFixed(1);
    tpEl.classList.toggle('hot', hot);
    tpTxt.textContent = hot ? 'TRUE PEAK!' : 'TRUE PEAK OK';
    lhist.push(ui.lufs);
    if (lhist.length > 240) lhist.shift();
    drawLoud(lhEl, lhist);
  }, 40);
}

// Loudness-over-time plot, with the −23 LUFS broadcast target line.
function drawLoud(cv: HTMLCanvasElement, hist: number[]): void {
  const w = (cv.width = cv.clientWidth);
  const h = (cv.height = cv.clientHeight);
  const ctx = cv.getContext('2d');
  if (!ctx || !w || !h) return;
  ctx.clearRect(0, 0, w, h);
  const lo = -40;
  const hi = -8;
  const y = (v: number): number => h - ((v - lo) / (hi - lo)) * h;
  // gridlines + labels
  ctx.font = '8px Courier New, monospace';
  [-12, -18, -23, -30].forEach((v) => {
    const yy = y(v);
    ctx.strokeStyle = v === -23 ? 'rgba(57,211,83,.45)' : 'rgba(80,110,150,.18)';
    ctx.beginPath();
    ctx.moveTo(20, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
    ctx.fillStyle = v === -23 ? 'rgba(120,235,150,.8)' : 'rgba(120,150,190,.6)';
    ctx.fillText(String(v), 1, yy + 3);
  });
  ctx.beginPath();
  hist.forEach((v, i) => {
    const x = 20 + (i / 240) * (w - 20);
    const yy = y(v);
    i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
  });
  ctx.strokeStyle = '#6FC8F0';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function drawLiss(cv: HTMLCanvasElement, corr: number, frame: number, amp: number): void {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const w = cv.width;
  const h = cv.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(80,110,150,.25)';
  ctx.beginPath();
  ctx.moveTo(w / 2, 4);
  ctx.lineTo(w / 2, h - 4);
  ctx.moveTo(4, h / 2);
  ctx.lineTo(w - 4, h / 2);
  ctx.stroke();
  ctx.strokeStyle = corr < 0 ? 'rgba(255,90,90,.85)' : 'rgba(120,235,150,.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const a = (0.5 + amp * 0.5) * (w / 2 - 8);
  const spread = (1 - Math.abs(corr)) * 0.9;
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * Math.PI * 2;
    const l = Math.sin(t + frame * 0.06);
    const r = Math.sin(t + frame * 0.06 + spread * Math.PI * (corr < 0 ? 1 : 0.3));
    // rotate L/R into X/Y (45°): the classic audio Lissajous
    const x = w / 2 + (l - r) * a * 0.5;
    const yv = h / 2 - (l + r) * a * 0.5;
    i ? ctx.lineTo(x, yv) : ctx.moveTo(x, yv);
  }
  ctx.stroke();
}
