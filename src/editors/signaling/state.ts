// src/editors/signaling/state — the local UI model for the SIGNALING panel.
//
// The legacy editor kept a `ui = { pgm, pvw, iso, mode, log }` closure over a
// hardcoded N=8 cam grid scraped from nowhere. Here the cam list is derived
// data-in from EditorContext.sources (the feeds routed into this twist), with
// the legacy `channelsFor` fallback chain preserved: sources → config.inputs →
// "CAM N". The pgm/pvw indices select the program/preview cells exactly as the
// legacy did; conceptually this is the routing-core tally (pgm = red on-air,
// pvw = green next), but kept index-local to mirror the legacy interactions 1:1.

import type { EditorContext } from '../types.js';

export type SignalMode = 'live' | 'reh';

/** One tally cell: a feed routed in, or a fallback channel slot. */
export interface Cam {
  label: string;
  color: string;
}

export interface SignalingState {
  pgm: number;
  pvw: number;
  iso: Set<number>;
  mode: SignalMode;
  log: string[];
}

/** One production trigger button on the "panel maker". */
export interface Trig {
  l: string;
  c: string;
}

/** Derive the tally cam list from ctx (sources → config.inputs → CAM N). */
export function camsFor(ctx: EditorContext): Cam[] {
  if (ctx.sources.length) {
    return ctx.sources.map((f) => ({ label: f.label, color: f.color }));
  }
  const inputs = ctx.twist.config?.inputs;
  if (inputs && inputs.length) {
    return inputs.map((label) => ({ label, color: '#cfe6ff' }));
  }
  return Array.from({ length: 8 }, (_unused, i) => ({ label: `CAM ${i + 1}`, color: '#cfe6ff' }));
}

export function initialState(count: number): SignalingState {
  return {
    pgm: 0,
    pvw: count > 1 ? 1 : 0,
    iso: new Set<number>(),
    mode: 'live',
    log: [],
  };
}

export const DEFAULT_TRIGS: ReadonlyArray<Trig> = [
  { l: 'SCTE-35 Ad Cue', c: 'scte' },
  { l: 'On-Air Light', c: '' },
  { l: 'GPI 1', c: '' },
  { l: 'GPI 2', c: '' },
  { l: 'Fade To Black', c: '' },
  { l: 'Instant Replay', c: '' },
];
