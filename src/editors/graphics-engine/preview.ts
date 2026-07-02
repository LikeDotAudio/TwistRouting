// src/editors/graphics-engine/preview — the RENDER + lifecycle layer (audit §3A).
//
// A 16:9 stage with SMPTE title-safe (90%) / action-safe (93%) guides. It drives
// one template instance through ANIMATE-IN → HOLD → ANIMATE-OUT, plus UPDATE
// (re-take-free data mutation, audit §5A) and NEXT (multi-state reveal). Only
// transform/opacity animate — the "compositor-friendly" rule (audit §3C) — via a
// CSS `.on` class toggle, so it behaves like a real fill+key graphic on air.

import { el } from '../../ui/dom.js';
import type { Disposer } from '../../ui/timers.js';
import { renderGraphic, stateCount, type GfxTemplate, type Values } from './templates.js';

export type LifecycleState = 'clear' | 'live';

export interface PreviewStage {
  root: HTMLElement;
  /** Load (or reload) the template + values the controls act on. */
  load(tpl: GfxTemplate, values: Values): void;
  play(): void;
  update(values: Values): void;
  next(): void;
  out(): void;
  state(): LifecycleState;
  onStateChange(cb: (s: LifecycleState, reveal: number, total: number) => void): void;
}

/** Build a titled preview stage (PROGRAM or PREVIEW) into `host`. */
export function createStage(host: HTMLElement, label: string, dispose: Disposer): PreviewStage {
  const safe = el('div', { class: 'gfx-safe-title' });
  const action = el('div', { class: 'gfx-safe-action' });
  const layer = el('div', { class: 'gfx-layer' });          // graphics stack (z-order)
  const badge = el('div', { class: 'gfx-stage-badge' }, [label]);
  const stage = el('div', { class: 'gfx-stage' }, [action, safe, layer, badge]);
  host.append(stage);

  let tpl: GfxTemplate | null = null;
  let values: Values = {};
  let reveal = 1;
  let cur: LifecycleState = 'clear';
  let outTimer = 0;
  let listeners: Array<(s: LifecycleState, r: number, t: number) => void> = [];

  const total = (): number => (tpl ? stateCount(tpl, values) : 1);
  const emit = (): void => listeners.forEach((cb) => cb(cur, reveal, total()));

  function paint(animateIn: boolean): void {
    if (!tpl) return;
    layer.replaceChildren();
    const g = renderGraphic(tpl, values, reveal);
    layer.append(g);
    if (animateIn) {
      // force reflow so the transition from the off-state actually plays
      void g.offsetWidth;
      g.classList.add('on');
    } else {
      g.classList.add('on');
    }
  }

  return {
    root: stage,
    load(t, v) {
      tpl = t; values = { ...v }; reveal = Math.min(reveal, total());
      // Re-take on load if we were live, otherwise just hold the definition.
      if (cur === 'live') { reveal = 1; paint(false); emit(); }
    },
    play() {
      if (!tpl) return;
      window.clearTimeout(outTimer);
      reveal = 1;
      cur = 'live';
      paint(true);
      emit();
    },
    update(v) {
      values = { ...v };
      if (cur !== 'live') return;
      const g = layer.firstElementChild as HTMLElement | null;
      // update-in-place: swap content, flash, no full out/in (audit §5A)
      paint(false);
      const ng = layer.firstElementChild as HTMLElement | null;
      if (ng) { ng.classList.add('gfx-updated'); window.setTimeout(() => ng.classList.remove('gfx-updated'), 450); }
      void g;
      emit();
    },
    next() {
      if (!tpl || cur !== 'live') return;
      if (reveal < total()) { reveal += 1; paint(false); emit(); }
    },
    out() {
      const g = layer.firstElementChild as HTMLElement | null;
      if (g) {
        g.classList.remove('on');
        g.classList.add('gfx-out');
        window.clearTimeout(outTimer);
        outTimer = window.setTimeout(() => layer.replaceChildren(), 650);
      }
      cur = 'clear';
      reveal = 1;
      emit();
    },
    state: () => cur,
    onStateChange(cb) { listeners.push(cb); dispose.add(() => { listeners = []; }); },
  };
}
