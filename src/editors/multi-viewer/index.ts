// src/editors/multi-viewer — port of js/editors/multi-viewer.js.
//
// A multiviewer "layout maker": an LCARS-framed wall of tiles fed from the
// twist's routed sources (ctx.sources, NOT DOM scraping). Preset buttons reshape
// the wall (NxN / PIP), tiles cycle PGM/PVW/off tally on click, carry an editable
// UMD label and an animated VU meter, and reorder by drag-and-drop.

import type { EditorPlugin, EditorContext } from '../types.js';
import type { Disposer } from '../../ui/timers.js';
import { el } from '../../ui/dom.js';
import { injectMultiViewerStyles } from './styles.js';

type Tally = 'pgm' | 'pvw' | 'off';
interface Win {
  label: string;
  color: string;
  tally: Tally;
}

const next = (t: Tally): Tally => (t === 'off' ? 'pgm' : t === 'pgm' ? 'pvw' : 'off');

// Channels for the wall: real routed sources, else the twist's input slots,
// else a sensible default count (mirrors the legacy channelsFor(twist,cfg,'MV',9)).
function channelsFor(ctx: EditorContext): Array<{ label: string; color: string }> {
  if (ctx.sources.length) return ctx.sources.map((f) => ({ label: f.label, color: f.color }));
  const inputs = ctx.twist.config?.inputs;
  if (inputs && inputs.length) return inputs.map((i) => ({ label: i, color: '#4d94ff' }));
  return Array.from({ length: 9 }, (_, i) => ({ label: `MV ${i + 1}`, color: '#4d94ff' }));
}

// Port of core.js meterBar('mv-meter'): a thin VU strip animated via the disposer.
function meterBar(dispose: Disposer): HTMLElement {
  const m = el('div', { class: 'mv-meter' });
  const fill = el('i');
  m.append(fill);
  let lvl = 0.3;
  dispose.interval(() => {
    lvl = Math.max(0.05, Math.min(1, lvl + (Math.random() - 0.5) * 0.4));
    fill.style.height = `${lvl * 100}%`;
  }, 120);
  return m;
}

const plugin: EditorPlugin = {
  id: 'multi-viewer',
  title: 'MULTI VIEWER · LAYOUT MAKER',
  order: 2,
  match: (n) => /multi\s*view/i.test(n),
  requiredCaps: ['view'],
  render(host, ctx) {
    injectMultiViewerStyles();

    const wins: Win[] = channelsFor(ctx).map((s, i) => ({
      label: s.label,
      color: s.color,
      tally: i === 0 ? 'pgm' : i === 1 ? 'pvw' : 'off',
    }));

    // PIP=0 (special). NxN presets render a full cols×cols wall; cells beyond
    // the available sources show as empty tiles, like a real multiviewer.
    const PRESETS: Record<string, number> = {
      '2×2': 2,
      '3×3': 3,
      '4×4': 4,
      '8×8': 8,
      '16×16': 16,
      PIP: 0,
    };
    let preset = '3×3';

    // LCARS elbow frame wrapping the preset bar + wall. Frame colour comes from
    // the production (data-in), replacing the legacy inherited --ed-color.
    const frame = el('div', { class: 'mv-frame', style: `--ed-color:${ctx.production.color}` });
    frame.append(el('div', { class: 'mv-frame-label', innerHTML: 'MULTI<br>VIEWER' }));
    host.appendChild(frame);

    const pbar = el('div', { class: 'mv-presets' });
    Object.keys(PRESETS).forEach((name) => {
      const b = el('div', {
        class: 'mv-pbtn' + (name === preset ? ' sel' : ''),
        textContent: name,
      });
      b.addEventListener('click', () => {
        preset = name;
        draw();
      });
      pbar.appendChild(b);
    });
    frame.appendChild(pbar);

    const grid = el('div', { class: 'mv-grid' });
    frame.appendChild(grid);

    let dragIdx: number | null = null;

    function fullWin(w: Win, i: number): HTMLElement {
      const winEl = el('div', {
        class: 'mv-win ' + (w.tally === 'pgm' ? 'pgm' : w.tally === 'pvw' ? 'pvw' : ''),
      });
      if (preset === 'PIP' && i === 0) winEl.style.gridRow = `span ${Math.max(2, wins.length - 1)}`;
      winEl.draggable = true;
      const tally = el('span', {
        class: 'mv-tally',
        textContent: w.tally === 'pgm' ? 'PGM' : w.tally === 'pvw' ? 'PVW' : 'IN ' + (i + 1),
      });
      const screen = el('div', { class: 'mv-screen', textContent: `▣ ${w.label}` });
      const umd = el('div', { class: 'mv-umd', style: `--umd:${w.color}`, textContent: w.label });
      umd.contentEditable = 'true';
      winEl.append(tally, screen, umd, meterBar(ctx.dispose));
      screen.addEventListener('click', () => {
        w.tally = next(w.tally);
        draw();
      });
      umd.addEventListener('input', () => {
        w.label = umd.textContent ?? '';
      });
      winEl.addEventListener('dragstart', () => {
        dragIdx = i;
        winEl.classList.add('dragging');
      });
      winEl.addEventListener('dragend', () => winEl.classList.remove('dragging'));
      winEl.addEventListener('dragover', (e) => e.preventDefault());
      winEl.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === i) return;
        const m = wins.splice(dragIdx, 1)[0];
        if (m) wins.splice(i, 0, m);
        dragIdx = null;
        draw();
      });
      return winEl;
    }

    // A lightweight tile for the dense 8×8 / 16×16 walls (no per-tile chrome).
    function compactWin(w: Win | undefined): HTMLElement {
      const has = !!w;
      const winEl = el('div', {
        class:
          'mv-win' + (w ? (w.tally === 'pgm' ? ' pgm' : w.tally === 'pvw' ? ' pvw' : '') : ' empty'),
      });
      winEl.append(el('div', { class: 'mv-tile', textContent: w ? w.label : '—' }));
      if (w) {
        winEl.addEventListener('click', () => {
          w.tally = next(w.tally);
          draw();
        });
      }
      return winEl;
    }

    function draw(): void {
      pbar
        .querySelectorAll<HTMLElement>('.mv-pbtn')
        .forEach((b) => b.classList.toggle('sel', b.textContent === preset));
      const cols = PRESETS[preset] || 3;
      const compact = cols >= 8;
      grid.classList.toggle('compact', compact);
      grid.style.gridTemplateColumns = preset === 'PIP' ? '3fr 1fr' : `repeat(${cols},1fr)`;
      grid.innerHTML = '';
      if (compact) {
        // Fill a full cols×cols wall; map cells to sources, rest stay empty.
        for (let i = 0; i < cols * cols; i++) grid.appendChild(compactWin(wins[i]));
      } else {
        wins.forEach((w, i) => grid.appendChild(fullWin(w, i)));
      }
    }
    draw();
  },
};

export default plugin;
