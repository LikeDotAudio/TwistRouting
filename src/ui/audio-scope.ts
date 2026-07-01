// src/ui/audio-scope — broadcast AUDIO scopes, the audio companion to ui/scopes.ts
// (which holds the video parade + vectorscope). Ported to typed, context-guarded TS:
//   • drawAudioWave  — the oscilloscope trace (from js/editors/shared/audio-scope.js,
//                      itself lifted from the IFB confidence feed).
//   • drawLissajous  — the stereo PHASE scope (from the Audio Monitor's drawLiss):
//                      L/R rotated 45° into X/Y; green in-phase, red anti-phase.
// Shared so the IFB monitor, the Audio Monitor, and the Meter Input test tool all
// draw the same instruments from one place (Phase 4 consumes these).

export interface AudioWaveOpts {
  /** Red "attention" trace (the IFB uses it while a Talk key is held). */
  alert?: boolean;
  /** Override the normal trace colour. */
  color?: string;
  /** Sine cycles across the width (default 6). */
  cycles?: number;
}

/** Animated oscilloscope trace at `level` (0..1) amplitude. */
export function drawAudioWave(cv: HTMLCanvasElement, level: number, opts: AudioWaveOpts = {}): void {
  const w = (cv.width = cv.clientWidth);
  const h = (cv.height = cv.clientHeight);
  if (!w || !h) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const cycles = opts.cycles || 6;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = opts.alert ? 'rgba(255,120,120,.9)' : (opts.color || 'rgba(90,224,140,.9)');
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 3) {
    const t = (x / w) * Math.PI * 2 * cycles;
    const y = h / 2 + Math.sin(t + performance.now() * 0.004) * level * (h * 0.42) * (0.6 + Math.random() * 0.4);
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}

/**
 * Stereo Lissajous (phase) scope. `corr` is the phase correlation (-1..+1),
 * `frame` an animation counter, `amp` the level (0..1) scaling the figure. The
 * trace is green when in-phase, red when anti-correlated (mono-compatibility risk).
 */
export function drawLissajous(cv: HTMLCanvasElement, corr: number, frame: number, amp: number): void {
  const w = (cv.width = cv.clientWidth | 0);
  const h = (cv.height = cv.clientHeight | 0);
  if (!w || !h) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  // crosshair graticule
  ctx.strokeStyle = 'rgba(80,110,150,.25)';
  ctx.beginPath();
  ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4);
  ctx.moveTo(4, h / 2); ctx.lineTo(w - 4, h / 2);
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
    const y = h / 2 - (l + r) * a * 0.5;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}
