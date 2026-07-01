// src/ui/loudness — shared loudness metering (ITU-R BS.1770 / LUFS), the audio
// companion to ui/scopes.ts + ui/audio-scope.ts. Ported from js/editors/shared/
// loudness.js so the Audio Monitor and the Meter Input tool derive the SAME
// integrated-loudness reading and draw the SAME volume-over-time graph.

export interface LoudnessTracker {
  readonly lufs: number;
  readonly history: number[];
  /** Feed the mean channel level (0..1) each tick; returns the new LUFS. */
  update(avgLevel: number): number;
}

/** Integrated loudness that drifts toward the program level (target = -28 + avg*22, slew 0.05). */
export function createLoudnessTracker(opts: { integrate?: number; historyMax?: number; start?: number } = {}): LoudnessTracker {
  const integrate = opts.integrate == null ? 0.05 : opts.integrate;
  const historyMax = opts.historyMax || 240;
  let lufs = opts.start == null ? -23 : opts.start;
  const history: number[] = [];
  return {
    get lufs() { return lufs; },
    get history() { return history; },
    update(avgLevel: number): number {
      const target = -28 + avgLevel * 22;
      lufs += (target - lufs) * integrate;
      history.push(lufs);
      if (history.length > historyMax) history.shift();
      return lufs;
    },
  };
}

/** Loudness-over-time plot, with the −23 LUFS broadcast target line highlighted. */
export function drawLoudnessPlot(cv: HTMLCanvasElement, hist: number[], opts: { span?: number; lo?: number; hi?: number } = {}): void {
  const w = (cv.width = cv.clientWidth);
  const h = (cv.height = cv.clientHeight);
  if (!w || !h) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const span = opts.span || 240;
  const lo = opts.lo == null ? -40 : opts.lo;
  const hi = opts.hi == null ? -8 : opts.hi;
  const y = (v: number): number => h - ((v - lo) / (hi - lo)) * h;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '8px Courier New, monospace';
  for (const v of [-12, -18, -23, -30]) {
    const yy = y(v);
    ctx.strokeStyle = v === -23 ? 'rgba(57,211,83,.45)' : 'rgba(80,110,150,.18)';
    ctx.beginPath();
    ctx.moveTo(20, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
    ctx.fillStyle = v === -23 ? 'rgba(120,235,150,.8)' : 'rgba(120,150,190,.6)';
    ctx.fillText(String(v), 1, yy + 3);
  }
  ctx.beginPath();
  hist.forEach((v, i) => {
    const x = 20 + (i / span) * (w - 20);
    const yy = y(v);
    i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
  });
  ctx.strokeStyle = '#6FC8F0';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}
