// src/editors/signaling/view — builds the SIGNALING surface and wires its
// interactions. Faithful port of js/editors/signaling.js render(): a studio-state
// column (On-Air / mode), a tally bus (PGM red / PVW green / ISO amber + TAKE),
// and a GPI/SCTE trigger "panel maker" with a live log. Data-in only: the cam
// grid is driven from ctx.sources (see state.ts camsFor); no DOM scraping.

import { el, qs } from '../../ui/dom.js';
import type { EditorContext } from '../types.js';
import {
  camsFor,
  initialState,
  DEFAULT_TRIGS,
  type SignalingState,
  type Trig,
} from './state.js';

export function renderSignaling(host: HTMLElement, ctx: EditorContext): void {
  const cams = camsFor(ctx);
  const ui: SignalingState = initialState(cams.length);

  host.innerHTML = `
      <div class="sg">
        <div class="sg-col">
          <div class="sg-card"><h4>Studio State</h4>
            <div class="sg-onair">OFF AIR</div>
            <div class="sg-mode"><div class="b sel" data-mode="live">Live</div><div class="b" data-mode="reh">Rehearsal</div></div>
          </div>
          <div class="sg-card"><h4>On-Air Light</h4>
            <div class="sg-onlight" style="text-align:center;font:900 14px sans-serif;letter-spacing:2px;padding:18px;border-radius:10px;">DOOR LIGHT</div>
          </div>
        </div>

        <div class="sg-card sg-bus"><h4>Tally Bus · Switcher Program / Preview</h4>
          <button class="sg-take">▶ TAKE / CUT</button>
          <div class="sg-grid"></div>
        </div>

        <div class="sg-card sg-col"><h4>Production Triggers · GPI / SCTE</h4>
          <div class="sg-trigs"></div>
          <div class="sg-log"></div>
        </div>
      </div>`;

  const grid = qs<HTMLElement>(host, '.sg-grid');
  const onair = qs<HTMLElement>(host, '.sg-onair');
  const onlight = qs<HTMLElement>(host, '.sg-onlight');
  const logEl = qs<HTMLElement>(host, '.sg-log');

  function log(msg: string): void {
    ui.log.unshift(msg);
    ui.log = ui.log.slice(0, 8);
    logEl.innerHTML = ui.log.map((l) => l).join('<br>');
  }

  // ---- tally cams ----
  const camEls: HTMLElement[] = [];
  cams.forEach((cam, i) => {
    const cell = el('div', { class: 'sg-cam' });
    cell.innerHTML = `<div class="nm">${cam.label}</div><div class="st"></div>
            <div class="row"><button class="pgmb">PGM</button><button class="pvwb">PVW</button><button class="isob">ISO</button></div>`;
    qs<HTMLButtonElement>(cell, '.pgmb').addEventListener('click', () => {
      ui.pgm = i;
      paint();
      log(`<b>CUT</b> → ${cam.label} on Program`);
    });
    qs<HTMLButtonElement>(cell, '.pvwb').addEventListener('click', () => {
      ui.pvw = i;
      paint();
    });
    qs<HTMLButtonElement>(cell, '.isob').addEventListener('click', () => {
      if (ui.iso.has(i)) ui.iso.delete(i);
      else ui.iso.add(i);
      paint();
    });
    grid.append(cell);
    camEls.push(cell);
  });

  qs<HTMLButtonElement>(host, '.sg-take').addEventListener('click', () => {
    const t = ui.pgm;
    ui.pgm = ui.pvw;
    ui.pvw = t;
    paint();
    log(`<b>TAKE</b> → ${cams[ui.pgm]?.label ?? `CAM ${ui.pgm + 1}`} live (was preview)`);
  });

  function paint(): void {
    camEls.forEach((cell, i) => {
      cell.classList.toggle('pgm', i === ui.pgm);
      cell.classList.toggle('pvw', i === ui.pvw);
      cell.classList.toggle('iso', ui.iso.has(i) && i !== ui.pgm && i !== ui.pvw);
      qs<HTMLElement>(cell, '.st').textContent =
        i === ui.pgm ? '● PROGRAM' : i === ui.pvw ? '● PREVIEW' : ui.iso.has(i) ? '● ISO REC' : 'STANDBY';
    });
    const live = ui.mode === 'live';
    onair.className = 'sg-onair ' + (live ? 'live' : 'reh');
    onair.textContent = live ? 'ON AIR' : 'REHEARSAL';
    onlight.style.background = live ? '#3a0808' : '#3a2c08';
    onlight.style.color = live ? '#ff6a6a' : '#ffd76b';
    onlight.style.boxShadow = live ? '0 0 16px rgba(255,43,43,.5)' : '0 0 12px rgba(255,212,0,.35)';
    onlight.textContent = live ? 'DOOR LIGHT · RED (LIVE)' : 'DOOR LIGHT · AMBER (REH)';
  }

  const modeBtns = Array.from(host.querySelectorAll<HTMLElement>('.sg-mode .b'));
  modeBtns.forEach((b) => {
    b.addEventListener('click', () => {
      ui.mode = b.dataset['mode'] === 'reh' ? 'reh' : 'live';
      modeBtns.forEach((x) => x.classList.toggle('sel', x === b));
      paint();
      log(`Mode → <b>${ui.mode === 'live' ? 'LIVE' : 'REHEARSAL'}</b>`);
    });
  });

  // ---- trigger panel ("buttons on a panel maker") ----
  const trigsHost = qs<HTMLElement>(host, '.sg-trigs');
  const addBtn = el('div', { class: 'sg-add' }, ['＋ ADD TRIGGER']);

  function addTrig(t: Trig): void {
    const b = el('div', { class: 'sg-trig ' + (t.c || '') }, [t.l]);
    b.addEventListener('click', () => {
      b.classList.add('fire');
      ctx.dispose.add(() => b.classList.remove('fire'));
      setTimeout(() => b.classList.remove('fire'), 400);
      log(`⦿ TRIGGER · <b>${t.l}</b> fired`);
    });
    trigsHost.insertBefore(b, addBtn);
  }

  // addBtn must be a child BEFORE addTrig() inserts before it (insertBefore
  // requires the ref node to already be a child).
  trigsHost.append(addBtn);
  DEFAULT_TRIGS.forEach((t) => addTrig(t));
  addBtn.addEventListener('click', () => {
    const l = prompt('Trigger button label:', 'Custom Cue');
    if (l) addTrig({ l, c: '' });
  });

  paint();
  log('Signaling online · tally distributed via GPI / NMOS IS-07');

  // Legacy kept a heartbeat timer alive while the panel was open; preserve it
  // via the disposer so the host clears it on close (no manual teardown).
  ctx.dispose.interval(() => {}, 1000);
}
