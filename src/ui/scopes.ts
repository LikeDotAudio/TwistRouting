// src/ui/scopes — broadcast canvas scopes (RGB parade + vectorscope), ported
// faithfully from js/editors/camera/scopes.js into typed, DOM-context-guarded TS.
//
// Pure-ish drawing functions over a typed ShadingState — no globals, no scraping.
// The camera console (and any future scope consumer) composes these.

export interface ShadingState {
  pan: number; iris: number; mgain: number; mblack: number; gamma: number;
  rGain: number; gGain: number; bGain: number;
  rBlk: number; gBlk: number; bBlk: number;
}

const BARS75: ReadonlyArray<readonly [number, number, number]> = [
  [0.75, 0.75, 0.75], [0.75, 0.75, 0], [0, 0.75, 0.75], [0, 0.75, 0],
  [0.75, 0, 0.75], [0.75, 0, 0], [0, 0, 0.75],
];
const RGBCOL = ['255,64,64', '64,235,96', '92,128,255'] as const;
const LBL = ['R', 'G', 'B'] as const;

const clamp = (v: number): number => Math.max(0, Math.min(1, v));

function channel(s: ShadingState, c: 0 | 1 | 2, x: number): number {
  const expoGain = 0.42 + s.iris * 1.15 + s.mgain * 0.55;
  const floor = Math.max(0, s.mblack - 0.5) * 0.55;
  const gammaExp = 0.55 + (1 - s.gamma) * 0.9;
  const lightX = 0.5 + (s.pan - 0.5) * 0.6;
  const subjX = 0.5 - (s.pan - 0.5) * 0.8;
  const g = (xx: number, m: number, sg: number): number => Math.exp(-((xx - m) * (xx - m)) / (2 * sg * sg));
  const base = 0.12 + g(x, lightX, 0.16) * 0.78 + (Math.abs(x - subjX) < 0.13 ? 0.42 : 0) + 0.12 * (1 - Math.abs(x - 0.5) * 2);
  const gains = [s.rGain, s.gGain, s.bGain] as const;
  const blks = [s.rBlk, s.gBlk, s.bBlk] as const;
  let v = floor + base * expoGain;
  v = Math.pow(clamp(v), gammaExp);
  v = v * (0.62 + gains[c] * 0.82) + (blks[c] - 0.5) * 0.28;
  return clamp(v);
}

export function drawParade(cv: HTMLCanvasElement, s: ShadingState, barsOn: boolean): void {
  const w = cv.clientWidth | 0;
  const h = cv.clientHeight | 0;
  if (!w || !h) return;
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const top = 12;
  const bot = h - 6;
  const span = bot - top;
  const padL = 26;
  const gap = 10;
  const pw = (w - padL - 4 - gap * 2) / 3;
  const ire2y = (ire: number): number => bot - ((ire + 10) / 120) * span;
  ctx.font = '9px Courier New, monospace';
  for (let c = 0 as 0 | 1 | 2; c < 3; c = (c + 1) as 0 | 1 | 2) {
    const x0 = padL + c * (pw + gap);
    ctx.fillStyle = 'rgba(255,255,255,.02)';
    ctx.fillRect(x0, top, pw, span);
    for (const p of [-10, 0, 25, 50, 75, 100, 110]) {
      const y = ire2y(p);
      const edge = p === -10 || p === 110;
      ctx.strokeStyle = p === 100 ? 'rgba(255,90,90,.3)' : edge ? 'rgba(120,160,210,.30)' : 'rgba(80,110,150,.16)';
      if (edge) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + pw, y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (c === 0) {
        ctx.fillStyle = edge ? 'rgba(155,190,230,.95)' : 'rgba(120,150,190,.7)';
        ctx.fillText(String(p), 2, y + 3);
      }
    }
    ctx.fillStyle = `rgba(${RGBCOL[c]},.9)`;
    ctx.fillText(LBL[c], x0 + 5, top + 9);
    ctx.globalCompositeOperation = 'lighter';
    const N = 90;
    for (let i = 0; i < N; i++) {
      const fx = i / (N - 1);
      const px = x0 + fx * pw;
      const bar = BARS75[Math.min(6, Math.floor(fx * 7))]!;
      const val = barsOn ? bar[c] : channel(s, c, fx);
      const jit = barsOn ? 0.012 : 0.03 + s.mgain * 0.12;
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = `rgba(${RGBCOL[c]},.5)`;
        ctx.fillRect(px, ire2y(clamp(val + (Math.random() - 0.5) * jit) * 100), 2, 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

const TARGETS: Record<string, readonly [number, number, number]> = {
  R: [0.75, 0, 0], Yl: [0.75, 0.75, 0], G: [0, 0.75, 0],
  Cy: [0, 0.75, 0.75], B: [0, 0, 0.75], Mg: [0.75, 0, 0.75],
};

function ypbpr(r: number, g: number, b: number): [number, number] {
  const Y = 0.299 * r + 0.587 * g + 0.114 * b;
  return [(b - Y) * 0.564, (r - Y) * 0.713];
}

export function drawVectorscope(cv: HTMLCanvasElement, s: ShadingState, barsOn: boolean): void {
  const w = (cv.width = cv.clientWidth | 0);
  const h = (cv.height = cv.clientHeight | 0);
  if (!w || !h) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 4;
  const K = R * 1.78;
  ctx.clearRect(0, 0, w, h);
  const xy = (r: number, g: number, b: number): [number, number] => {
    const [pb, pr] = ypbpr(r, g, b);
    return [cx + pb * K, cy - pr * K];
  };
  ctx.strokeStyle = 'rgba(80,110,150,.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.5, 0, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.stroke();
  const [sx, sy] = xy(0.78, 0.55, 0.42);
  ctx.strokeStyle = 'rgba(255,200,120,.35)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + (sx - cx) * 1.5, cy + (sy - cy) * 1.5);
  ctx.stroke();
  ctx.font = '8px Courier New, monospace';
  ctx.strokeStyle = 'rgba(150,180,220,.6)';
  ctx.fillStyle = 'rgba(150,180,220,.7)';
  for (const k of Object.keys(TARGETS)) {
    const [x, y] = xy(...TARGETS[k]!);
    ctx.strokeRect(x - 4, y - 4, 8, 8);
    ctx.fillText(k, x + 6, y + 3);
  }
  if (barsOn) {
    for (const c of [[0.75, 0.75, 0.75] as const, ...Object.values(TARGETS)]) {
      const [x, y] = xy(...c);
      ctx.fillStyle = '#dff0ff';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, 7);
      ctx.fill();
    }
  } else {
    const gr = (v: number, k: 'rGain' | 'gGain' | 'bGain'): number => v * (0.62 + s[k] * 0.82);
    ctx.fillStyle = 'rgba(255,224,96,.85)';
    for (let i = 0; i < 50; i++) {
      const [x, y] = xy(gr(0.78, 'rGain'), gr(0.55, 'gGain'), gr(0.42, 'bGain'));
      ctx.fillRect(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, 1.5, 1.5);
    }
    const [nx, ny] = xy(gr(0.5, 'rGain'), gr(0.5, 'gGain'), gr(0.5, 'bGain'));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(nx, ny, 3, 0, 7);
    ctx.fill();
  }
}
