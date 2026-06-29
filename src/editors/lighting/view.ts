// src/editors/lighting/view — the DMX console render (data-in, no DOM scraping).
//
// Faithful port of js/editors/lighting.js render(): the top-down rig diagram with
// clickable fixtures, the LED fixture strips (intensity + colour-temp sliders),
// the live subject beam, and the scenes/cues panel. Animation (the DMX heartbeat)
// is registered on ctx.dispose so the host tears it down on close.

import { addStyles, qs, el } from '../../ui/dom.js';
import type { EditorContext } from '../types.js';
import { CSS } from './styles.js';
import { initialFixtures, SCENES, CUES, tempK } from './state.js';

export function renderLighting(host: HTMLElement, ctx: EditorContext): void {
  addStyles('lt-styles', CSS);
  const st = initialFixtures();
  let sel = 0;

  host.innerHTML = `
      <div class="lt">
        <div class="lt-card" style="display:flex;flex-direction:column">
          <h4>Three / Four-Point Rig · Top-Down</h4>
          <div class="lt-stage"><div class="lt-beam"></div><div class="lt-subj"></div></div>
        </div>
        <div class="lt-rcol">
          <div class="lt-card lt-strips">
            <h4>LED Fixtures · DMX</h4>
            <div class="lt-list"></div>
            <div class="lt-dmx"></div>
          </div>
          <div class="lt-card">
            <h4>Scenes · Recall · Cues</h4>
            <div class="lt-scenes"></div>
            <div class="lt-cues"></div>
          </div>
        </div>
      </div>`;

  const stage = qs(host, '.lt-stage');
  const beam = qs(host, '.lt-beam');
  const list = qs(host, '.lt-list');
  const dmx = qs(host, '.lt-dmx');

  const fixEls = st.map((f, i) => {
    const e = el('div', { class: 'lt-fix', style: `left:${f.x}%;top:${f.y}%` });
    e.innerHTML = `${f.k}<div class="lbl">${f.sub}</div>`;
    e.addEventListener('click', () => {
      sel = i;
      paintSel();
    });
    stage.appendChild(e);
    return e;
  });

  const strips = st.map((f, i) => {
    const e = el('div', { class: 'lt-strip' });
    e.innerHTML = `<div class="nm">${f.k}<small>${f.sub}</small></div>
            <input class="int" type="range" min="0" max="1" step="0.01" value="${f.intensity}">
            <div class="pc"></div>
            <input class="ct" type="range" min="0" max="1" step="0.01" value="${f.temp}"><div class="kv"></div>`;
    e.addEventListener('mousedown', () => {
      sel = i;
      paintSel();
    });
    const intInput = qs<HTMLInputElement>(e, '.int');
    const ctInput = qs<HTMLInputElement>(e, '.ct');
    intInput.addEventListener('input', () => {
      f.intensity = +intInput.value;
      paint();
    });
    ctInput.addEventListener('input', () => {
      f.temp = +ctInput.value;
      paint();
    });
    list.appendChild(e);
    return e;
  });

  function paint(): void {
    st.forEach((f, i) => {
      const fixEl = fixEls[i];
      const strip = strips[i];
      if (!fixEl || !strip) return;
      const k = tempK(f.temp);
      const warm = `hsl(${38 - f.temp * 30},90%,${55 + f.intensity * 20}%)`;
      fixEl.style.background = warm;
      fixEl.style.color = warm;
      fixEl.style.opacity = (0.35 + f.intensity * 0.65).toFixed(2);
      qs(strip, '.pc').textContent = Math.round(f.intensity * 100) + '%';
      qs(strip, '.kv').textContent = k + 'K';
    });
    // subject illumination = sum of intensities, tinted by the key
    const key = st[0];
    const fill = st[1];
    if (key && fill) {
      const lum = 0.3 + (key.intensity * 0.5 + fill.intensity * 0.3);
      beam.style.background = `radial-gradient(circle at ${30 + (key.intensity - fill.intensity) * 20}% 42%, rgba(255,240,210,${(lum * 0.5).toFixed(2)}), transparent 60%)`;
    }
    const ch = st.reduce((a, f) => a + (f.intensity > 0.01 ? 2 : 0), 0);
    const keyK = key ? tempK(key.temp) : 0;
    dmx.textContent = `DMX Universe 1 · ${ch} channels active · ${st.length} fixtures · ${keyK}K key`;
  }

  function paintSel(): void {
    strips.forEach((s, i) => s.classList.toggle('sel', i === sel));
    fixEls.forEach((e, i) => e.classList.toggle('sel', i === sel));
  }

  // ---- scenes / recall + cue triggers into the console ----
  const scHost = qs(host, '.lt-scenes');
  SCENES.forEach(([nm, set]) => {
    const b = el('button', { class: 'lt-scene', textContent: nm });
    b.addEventListener('click', () => {
      set.forEach((v, i) => {
        const f = st[i];
        const strip = strips[i];
        if (f && strip) {
          f.intensity = v;
          qs<HTMLInputElement>(strip, '.int').value = String(v);
        }
      });
      paint();
      scHost.querySelectorAll('.lt-scene').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    });
    scHost.appendChild(b);
  });

  const cueHost = qs(host, '.lt-cues');
  CUES.forEach((l) => {
    const b = el('button', { class: 'lt-cue', textContent: l });
    b.addEventListener('click', () => {
      b.classList.add('fire');
      setTimeout(() => b.classList.remove('fire'), 350);
    });
    cueHost.appendChild(b);
  });

  paint();
  paintSel();
  ctx.dispose.interval(() => {
    /* live DMX heartbeat */
  }, 1000);
}
