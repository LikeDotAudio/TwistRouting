// src/editors/audio-mixer/view — the console DOM, built from typed context.
//
// Faithful port of renderAudioMixer: a left LCARS rail (layer switch + deco
// elbows), a scrolling bank of channel strips (EQ / PAN / aux mix-minus + monitor
// sends / mute-solo / fader / VU), and a MASTER tab pinned to the right. Controls
// come from the shared widgets (knob/fader/meter); meters animate via ctx.dispose.

import type { Hex } from '../../model/index.js';
import type { EditorContext } from '../types.js';
import { el } from '../../ui/dom.js';
import { knob, fader, meter } from '../../ui/widgets.js';
import { buildChannels, LAYER } from './state.js';
import type { Channel } from './state.js';

interface StripOpts {
  master?: boolean;
}

export function renderConsole(host: HTMLElement, ctx: EditorContext): void {
  // Routed sources → one fader each; falls back to input slots / CH N when empty.
  const chans = buildChannels(ctx);
  let layer = 0;
  const layers = Math.max(1, Math.ceil(chans.length / LAYER));

  const console_ = el('div', { class: 'am-console' });

  // ----- LEFT LCARS RAIL: layer switch (vertical) + decorative elbows -----
  const rail = el('div', { class: 'am-rail' });
  rail.append(el('div', { class: 'am-rail-h', textContent: 'Layers' }));
  const layerBtns: HTMLElement[] = [];
  if (layers > 1) {
    for (let i = 0; i < layers; i++) {
      const b = el('div', {
        class: 'am-layerbtn' + (i === 0 ? ' sel' : ''),
        textContent: `CH ${i * LAYER + 1}–${Math.min((i + 1) * LAYER, chans.length)}`,
      });
      b.addEventListener('click', () => {
        layer = i;
        layerBtns.forEach((x, j) => x.classList.toggle('sel', j === i));
        draw();
      });
      rail.append(b);
      layerBtns.push(b);
    }
  } else {
    rail.append(el('div', { class: 'am-layerbtn sel static', textContent: 'MAIN' }));
  }
  rail.append(
    el('div', { class: 'am-elbow a' }),
    el('div', { class: 'am-elbow b' }),
    el('div', { class: 'am-elbow c' }),
    el('div', { class: 'am-rail-foot' }),
  );
  console_.append(rail);

  const strips = el('div', { class: 'am-strips' });
  console_.append(strips);

  // MASTER lives in its own tab pinned to the right — always visible, never
  // scrolled or swapped by the layer switch.
  const masterTab = el('div', { class: 'am-master-tab' });
  masterTab.append(el('div', { class: 'am-master-h', textContent: 'Master Out' }));
  masterTab.append(stripEl({ label: 'MASTER', color: '#d8c8ff' }, { master: true }));
  console_.append(masterTab);

  host.append(console_);

  function stripEl(c: Channel, opts: StripOpts): HTMLElement {
    const master = !!opts.master;
    const strip = el('div', { class: 'am-strip' + (master ? ' master' : '') });

    const name = el('div', {
      class: 'am-name',
      textContent: master ? 'MASTER' : c.label,
      style: `color:${master ? '#d8c8ff' : c.color}`,
    });
    strip.append(name);

    if (!master) {
      // EQ, PAN and the aux sends live in one collapsible bank.
      const rot = el('div', { class: 'am-rotaries' });

      const eq = el('div', { class: 'am-eq' });
      for (const l of ['HI', 'MID', 'LO']) eq.append(knob(l, 0.5, c.color));
      rot.append(eq);
      rot.append(knob('PAN', 0.5, '#9fb6cc'));

      // Aux sends: mix-minus bank (MM 1–4) then monitor bank (MON 1–4).
      const aux = el('div', { class: 'am-aux' });
      aux.append(el('div', { class: 'am-aux-h', textContent: 'Aux Sends' }));
      const ag = el('div', { class: 'am-aux-grid' });
      for (const l of ['MM 1', 'MM 2', 'MM 3', 'MM 4']) ag.append(knob(l, 0.3, '#FF9C63'));
      for (const l of ['MON 1', 'MON 2', 'MON 3', 'MON 4']) ag.append(knob(l, 0.3, '#3FC1C9'));
      aux.append(ag);
      rot.append(aux);
      strip.append(rot);

      // OPEN button into the full Stage Box Input digital twin for this channel
      // (legacy called window.openStageBox; here it is a typed context service).
      const ob = el('button', { class: 'am-pre-open', textContent: '⚙ STAGE BOX' });
      ob.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.services.openStageBox(c.label, c.color as Hex, [c.label]);
      });
      strip.append(ob);

      const ms = el('div', { class: 'am-ms' });
      const mute = el('button', { class: 'mute', textContent: 'M' });
      const solo = el('button', { class: 'solo', textContent: 'S' });
      mute.addEventListener('click', () => mute.classList.toggle('on'));
      solo.addEventListener('click', () => solo.classList.toggle('on'));
      ms.append(mute, solo);
      strip.append(ms);
    } else {
      strip.append(knob('BAL', 0.5, '#d8c8ff'));
    }

    const fa = el('div', { class: 'am-fadarea' });
    fa.append(fader('', master ? 0.8 : 0.7, master ? '#c3a8ff' : c.color));
    fa.append(meter(ctx.dispose, 0.3));
    if (master) fa.append(meter(ctx.dispose, 0.3));
    strip.append(fa);
    strip.append(el('div', { class: 'am-db', textContent: '0 dB' }));
    return strip;
  }

  function draw(): void {
    strips.innerHTML = '';
    for (const c of chans.slice(layer * LAYER, layer * LAYER + LAYER)) {
      strips.append(stripEl(c, {}));
    }
  }
  draw();
}
