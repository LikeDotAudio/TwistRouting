// src/editors/lighting/state — the rig model + scene/cue tables.
//
// Pure data, no DOM. The legacy console is a self-contained three/four-point rig
// (Key / Fill / Back / Background) plus set lighting (Cyc, Effect): a fixed
// fixture list rather than something read from routed sources, so it ports as a
// data table. Each fixture carries an LED intensity + colour-temperature value.

/** A fixture's static definition (position on the top-down rig + base colour). */
export interface FixtureDef {
  k: string;
  sub: string;
  x: number;
  y: number;
  color: string;
}

/** A live fixture: definition + its current intensity (0..1) and temp (0..1). */
export interface Fixture extends FixtureDef {
  intensity: number;
  temp: number;
}

export const FIXTURES: readonly FixtureDef[] = [
  { k: 'KEY', sub: 'Key · 30–45°', x: 32, y: 30, color: '#ffd9a0' },
  { k: 'FILL', sub: 'Fill · soft', x: 68, y: 30, color: '#cfe0ff' },
  { k: 'BACK', sub: 'Back / Hair', x: 50, y: 14, color: '#ffffff' },
  { k: 'BG', sub: 'Background', x: 50, y: 82, color: '#9fd6ff' },
  { k: 'CYC', sub: 'Cyclorama', x: 16, y: 70, color: '#7ad0ff' },
  { k: 'FX', sub: 'Effect / Gobo', x: 84, y: 70, color: '#c79bff' },
];

/** Fresh fixture state with the legacy default intensities (Key hot, Fill soft). */
export function initialFixtures(): Fixture[] {
  return FIXTURES.map((f) => ({
    ...f,
    intensity: f.k === 'KEY' ? 0.85 : f.k === 'FILL' ? 0.45 : 0.6,
    temp: 0.5,
  }));
}

/** Recallable scene presets: [name, per-fixture intensity set]. */
export const SCENES: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['NEWS', [0.85, 0.45, 0.7, 0.6, 0.5, 0.4]],
  ['INTERVIEW', [0.7, 0.6, 0.6, 0.5, 0.4, 0.3]],
  ['WIDE', [0.9, 0.7, 0.8, 0.8, 0.7, 0.5]],
  ['DRAMATIC', [0.95, 0.2, 0.8, 0.3, 0.6, 0.7]],
  ['PROMO', [0.6, 0.5, 0.6, 0.7, 0.9, 0.9]],
  ['BLACKOUT', [0, 0, 0, 0, 0, 0]],
];

/** Cue trigger buttons fired into the console. */
export const CUES: readonly string[] = [
  'CUE GO ▶',
  'CUE BACK ◀',
  'SNAP',
  'FADE 3 s',
  'STORE',
  'TRIGGER → CONSOLE',
];

/** Map a 0..1 temp slider to Kelvin (3200K → 5600K). */
export function tempK(t: number): number {
  return Math.round(3200 + t * 2400);
}
