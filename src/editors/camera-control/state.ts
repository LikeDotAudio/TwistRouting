// src/editors/camera-control/state — per-camera shading + robotics state, and
// the typed CameraConsole context that the six camera modules share.
//
// Port of js/editors/camera/state.js. The legacy code threaded an untyped `ctx`
// blob through state/scopes/bars/maps/controls; here that contract is a typed
// `CameraConsole` interface so every builder agrees on its shape.

/** A recallable PTZ pose (what a preset stores / a fly-to interpolates). */
export interface PtzPose {
  pan: number;
  tilt: number;
  zoom: number;
  dolly: number;
  ped: number;
}

/** One camera's full shading + robotics state. */
export interface CamState {
  pan: number;
  tilt: number;
  zoom: number;
  dolly: number;
  ped: number;
  iris: number;
  gamma: number;
  mgain: number;
  shutter: number;
  mblack: number;
  rGain: number;
  gGain: number;
  bGain: number;
  rBlk: number;
  gBlk: number;
  bBlk: number;
  /** PTZ move-speed multiplier (the RATE slider). */
  rate: number;
  presets: Array<PtzPose | null>;
}

export function mkState(): CamState {
  return {
    pan: 0.5,
    tilt: 0.5,
    zoom: 0.32,
    dolly: 0.5,
    ped: 0.5,
    iris: 0.56,
    mblack: 0.5,
    rGain: 0.5,
    gGain: 0.5,
    bGain: 0.5,
    rBlk: 0.5,
    gBlk: 0.5,
    bBlk: 0.5,
    shutter: 0.5,
    mgain: 0.18,
    gamma: 0.5,
    rate: 1,
    presets: [null, null, null, null, null, null],
  };
}

export const clamp = (v: number): number => Math.max(0, Math.min(1, v));

/** Transient UI flags for the console (which camera is selected, modes, drag). */
export interface UiState {
  active: number;
  bars: boolean;
  autoiris: boolean;
  autowb: boolean;
  rec: boolean;
  drag: boolean;
  t: number;
  pendingSave: boolean;
  vel: { x: number; y: number };
}

/** A running fly-to-preset interpolation. */
export interface Fly {
  from: PtzPose;
  to: PtzPose;
  t: number;
}

/** The bouncing "DVD-logo" lineage-badge state. */
export interface DvdState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
}

/**
 * The shared context the six camera modules thread between them (the typed
 * replacement for the legacy untyped `ctx`). Named `CameraConsole` so it never
 * clashes with the editor's `EditorContext`.
 */
export interface CameraConsole {
  cams: CamState[];
  ui: UiState;
  /** The currently-selected camera's state. */
  S(): CamState;
  /** Repaint callbacks registered by every encoder. */
  knobEls: Array<() => void>;
  fly: Fly | null;
  /** The host element this console rendered into. */
  body: HTMLElement;
  /** Scoped, throwing querySelector against `body`. */
  $<T extends Element = HTMLElement>(sel: string): T;
  /** Re-apply the CSS filter that fakes the "video" look from shading. */
  shade(): void;
  dvdState: DvdState;
}
