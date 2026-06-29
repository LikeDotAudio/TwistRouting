// src/editors/ifb/state — the per-instance IFB model (the legacy `s` object) plus
// the interrupt hierarchy table and the dB formatter. Pure data; no DOM.

/** The three encoder targets — also the keys the dials drive on the state. */
export type DialKey = 'progGain' | 'intGain' | 'threshold';

/** Live IFB ballistics state (mirrors the legacy `s` object verbatim). */
export interface IfbState {
  progGain: number;
  intGain: number;
  threshold: number;
  prog: number;
  progTarget: number;
  intLvl: number;
  /** Active talk priority (0 = clear, 1..3 = held key). */
  talk: number;
}

export const initialState = (): IfbState => ({
  progGain: 0.7,
  intGain: 0.8,
  threshold: 0.55,
  prog: 0.4,
  progTarget: 0.45,
  intLvl: 0,
  talk: 0,
});

/** One interrupt-hierarchy talk key. */
export interface Prio {
  p: number;
  nm: string;
  sub: string;
  c: string;
}

/** Talk hierarchy: P1 Director (breaks program) · P2 TD · P3 Production Asst. */
export const PRIO: readonly Prio[] = [
  { p: 1, nm: 'DIRECTOR', sub: 'Breaks program', c: '#ff3b3b' },
  { p: 2, nm: 'TECH DIRECTOR', sub: 'Urgent technical', c: '#ffd400' },
  { p: 3, nm: 'PRODUCTION ASST', sub: 'Timing cues', c: '#6FC8F0' },
];

/** Linear level → relative dB readout (verbatim from the legacy editor). */
export const dB = (v: number): string =>
  v <= 0.001 ? '-∞ dB' : `${Math.round((v - 1) * 48)} dB`;
