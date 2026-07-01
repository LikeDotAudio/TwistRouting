// src/editors/meter-input/live-input — REAL video/audio capture + analysis (TS).
//
// Reads ACTUAL pixels + audio the browser is allowed to touch, so the scopes are
// genuine (not the synthetic state of ui/scopes.ts):
//   • Test Pattern — a generated bars+gradient source (offline; proves the pipeline)
//   • Capture Tab  — getDisplayMedia(): scope a real tab/window incl. a playing YouTube clip
//   • File / URL   — a local file (blob) or a CORS-enabled media URL
//
// A YouTube <iframe> itself can't be scoped: it is cross-origin → the canvas is
// tainted and getImageData()/WebAudio are blocked. Capture Tab sidesteps that —
// the captured MediaStream is readable, so the scopes run on the real frames+audio.
//
// Secure-context only (https or http://localhost): getDisplayMedia + canvas pixel
// reads require it — which the deployed https site and `python3 start.py` both are.

export type SourceMode = 'bars' | 'stream' | 'media';

export interface FrameData {
  AW: number; AH: number;
  rMin: Uint8Array; rMax: Uint8Array;
  gMin: Uint8Array; gMax: Uint8Array;
  bMin: Uint8Array; bMax: Uint8Array;
  yMin: Uint8Array; yMax: Uint8Array;
  pts: number[];               // flat [cb, cr, r, g, b, …] for the vectorscope
}

export interface LiveInput {
  readonly video: HTMLVideoElement;
  mode(): SourceMode;
  isTainted(): boolean;
  captureTab(): Promise<MediaStream>;
  useMedia(url: string, remote: boolean): Promise<void>;
  useBars(): void;
  grab(t: number): boolean;
  analyze(): FrameData | null;
  timeData(): Uint8Array | null;
  rmsL(): number;
  rmsR(): number;
  stop(): void;
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function createLiveInput(AW = 256, AH = 144): LiveInput {
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;

  const off = document.createElement('canvas');
  off.width = AW; off.height = AH;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const gen = document.createElement('canvas');
  gen.width = AW; gen.height = AH;
  const gctx = gen.getContext('2d');

  let mode: SourceMode = 'bars';
  let tainted = false;

  // --- audio graph (lazy) ---
  let actx: AudioContext | null = null;
  let anTime: AnalyserNode | null = null;
  let anL: AnalyserNode | null = null;
  let anR: AnalyserNode | null = null;
  let td: Uint8Array | null = null;
  let fL: Float32Array | null = null;
  let fR: Float32Array | null = null;
  let elemSrc: MediaElementAudioSourceNode | null = null;
  let streamSrc: MediaStreamAudioSourceNode | null = null;
  let curSrc: AudioNode | null = null;

  function ensureAudio(): void {
    if (!actx) {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Ctor) return;
      actx = new Ctor();
      anTime = actx.createAnalyser(); anTime.fftSize = 1024; td = new Uint8Array(anTime.fftSize);
      anL = actx.createAnalyser(); anR = actx.createAnalyser(); anL.fftSize = anR.fftSize = 1024;
      fL = new Float32Array(anL.fftSize); fR = new Float32Array(anR.fftSize);
    }
    if (actx.state === 'suspended') void actx.resume();
  }

  function wireAudio(isStream: boolean, stream?: MediaStream): void {
    ensureAudio();
    if (!actx || !anTime || !anL || !anR) return;
    if (curSrc) { try { curSrc.disconnect(); } catch { /* ignore */ } }
    if (isStream && stream) {
      if (streamSrc) { try { streamSrc.disconnect(); } catch { /* ignore */ } }
      streamSrc = actx.createMediaStreamSource(stream);
      curSrc = streamSrc;
    } else {
      if (!elemSrc) elemSrc = actx.createMediaElementSource(video); // once per element
      curSrc = elemSrc;
    }
    const split = actx.createChannelSplitter(2);
    curSrc.connect(split); split.connect(anL, 0); split.connect(anR, 1);
    curSrc.connect(anTime);
    if (!isStream) curSrc.connect(actx.destination); // play file/URL; don't echo captured tab
  }

  // --- sources ---
  function stopStream(): void {
    const s = video.srcObject as MediaStream | null;
    if (s) s.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
  function useBars(): void { stopStream(); mode = 'bars'; tainted = false; }
  async function captureTab(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    stopStream(); video.srcObject = stream; video.muted = true; await video.play();
    mode = 'stream'; tainted = false; wireAudio(true, stream); return stream;
  }
  async function useMedia(url: string, remote: boolean): Promise<void> {
    stopStream(); video.srcObject = null;
    if (remote) video.crossOrigin = 'anonymous'; else video.removeAttribute('crossorigin');
    video.src = url; video.muted = false;
    await video.play();
    mode = 'media'; tainted = false;
    try { wireAudio(false); } catch { /* audio may be blocked on tainted cross-origin */ }
  }
  function stop(): void { stopStream(); try { if (actx) void actx.close(); } catch { /* ignore */ } }

  // --- test pattern ---
  function drawBars(t: number): void {
    if (!gctx) return;
    const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    const w = AW / cols.length;
    for (let i = 0; i < cols.length; i++) { gctx.fillStyle = cols[i] ?? '#000'; gctx.fillRect(i * w, 0, w + 1, AH * 0.75); }
    const g = gctx.createLinearGradient(0, 0, AW, 0);
    g.addColorStop(0, '#000'); g.addColorStop((Math.sin(t / 1000) + 1) / 2, '#fff'); g.addColorStop(1, '#000');
    gctx.fillStyle = g; gctx.fillRect(0, AH * 0.75, AW, AH * 0.25);
  }

  // --- per-frame video ---
  function grab(t: number): boolean {
    if (!octx) return false;
    if (mode === 'bars') { drawBars(t); octx.drawImage(gen, 0, 0, AW, AH); return true; }
    if (video.readyState < 2) return false;
    try { octx.drawImage(video, 0, 0, AW, AH); return true; } catch { return false; }
  }
  function analyze(): FrameData | null {
    if (!octx) return null;
    let img: Uint8ClampedArray;
    try { img = octx.getImageData(0, 0, AW, AH).data; tainted = false; }
    catch { tainted = true; return null; } // cross-origin without CORS → tainted
    const rMin = new Uint8Array(AW).fill(255), rMax = new Uint8Array(AW);
    const gMin = new Uint8Array(AW).fill(255), gMax = new Uint8Array(AW);
    const bMin = new Uint8Array(AW).fill(255), bMax = new Uint8Array(AW);
    const yMin = new Uint8Array(AW).fill(255), yMax = new Uint8Array(AW);
    const pts: number[] = [];
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = (y * AW + x) * 4;
      const r = img[i] ?? 0, g = img[i + 1] ?? 0, b = img[i + 2] ?? 0;
      if (r < (rMin[x] ?? 255)) rMin[x] = r; if (r > (rMax[x] ?? 0)) rMax[x] = r;
      if (g < (gMin[x] ?? 255)) gMin[x] = g; if (g > (gMax[x] ?? 0)) gMax[x] = g;
      if (b < (bMin[x] ?? 255)) bMin[x] = b; if (b > (bMax[x] ?? 0)) bMax[x] = b;
      const Y = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
      if (Y < (yMin[x] ?? 255)) yMin[x] = Y; if (Y > (yMax[x] ?? 0)) yMax[x] = Y;
      if (((x + y) & 3) === 0) {
        const cb = -0.1146 * r - 0.3854 * g + 0.5 * b, cr = 0.5 * r - 0.4542 * g - 0.0458 * b;
        pts.push(cb, cr, r, g, b);
      }
    }
    return { AW, AH, rMin, rMax, gMin, gMax, bMin, bMax, yMin, yMax, pts };
  }

  // --- audio reads ---
  function timeData(): Uint8Array | null { if (anTime && td) { anTime.getByteTimeDomainData(td); return td; } return null; }
  function rmsOf(an: AnalyserNode | null, buf: Float32Array | null): number {
    if (!an || !buf) return -70;
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) { const v = buf[i] ?? 0; s += v * v; }
    return 20 * Math.log10(Math.sqrt(s / buf.length) || 1e-7);
  }

  return {
    video, mode: () => mode, isTainted: () => tainted,
    captureTab, useMedia, useBars, stop, grab, analyze, timeData,
    rmsL: () => rmsOf(anL, fL), rmsR: () => rmsOf(anR, fR),
  };
}

// ---- draw helpers (render analysis onto editor canvases) -------------------
function ctx2d(cv: HTMLCanvasElement): CanvasRenderingContext2D | null { return cv.getContext('2d'); }

export function drawParadeReal(cv: HTMLCanvasElement, d: FrameData): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const pw = W / 3;
  const chans: Array<[Uint8Array, Uint8Array, string]> = [
    [d.rMin, d.rMax, '#ff5a5a'], [d.gMin, d.gMax, '#5aff7a'], [d.bMin, d.bMax, '#5a9dff'],
  ];
  chans.forEach((ch, p) => {
    c.save(); c.beginPath(); c.rect(p * pw, 0, pw, H); c.clip();
    c.strokeStyle = '#12324a';
    for (let i = 0; i <= 4; i++) { const y = H * i / 4; c.beginPath(); c.moveTo(p * pw, y); c.lineTo((p + 1) * pw, y); c.stroke(); }
    c.globalAlpha = 0.55; c.fillStyle = ch[2];
    for (let x = 0; x < pw; x++) {
      const sx = (x / pw * d.AW) | 0;
      const lo = H - (ch[1][sx] ?? 0) / 255 * H, hi = H - (ch[0][sx] ?? 0) / 255 * H;
      c.fillRect(p * pw + x, lo, 1, Math.max(1, hi - lo));
    }
    c.globalAlpha = 1; c.restore();
  });
}

export function drawWaveReal(cv: HTMLCanvasElement, mins: Uint8Array, maxs: Uint8Array, AW: number, color = '#d7f0ff'): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  c.strokeStyle = '#12324a';
  for (let i = 0; i <= 4; i++) { const y = H * i / 4; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.globalAlpha = 0.55; c.fillStyle = color;
  for (let x = 0; x < W; x++) {
    const sx = (x / W * AW) | 0;
    const lo = H - (maxs[sx] ?? 0) / 255 * H, hi = H - (mins[sx] ?? 0) / 255 * H;
    c.fillRect(x, lo, 1, Math.max(1, hi - lo));
  }
  c.globalAlpha = 1;
}

export function drawVectorReal(cv: HTMLCanvasElement, pts: number[]): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 6;
  c.clearRect(0, 0, W, H);
  c.strokeStyle = '#12324a'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
  c.strokeStyle = '#3a5a2a'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R * Math.cos(-2.15), cy + R * Math.sin(-2.15)); c.stroke();
  const sc = R / 140; c.globalAlpha = 0.65;
  for (let i = 0; i < pts.length; i += 5) {
    c.fillStyle = `rgb(${(pts[i + 2] ?? 0) | 0},${(pts[i + 3] ?? 0) | 0},${(pts[i + 4] ?? 0) | 0})`;
    c.fillRect(cx + (pts[i] ?? 0) * sc - 1, cy - (pts[i + 1] ?? 0) * sc - 1, 2, 2);
  }
  c.globalAlpha = 1;
}

export function drawScopeReal(cv: HTMLCanvasElement, td: Uint8Array | null): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  c.strokeStyle = '#12324a'; c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
  if (!td) return; c.strokeStyle = '#6FC8F0'; c.beginPath();
  for (let x = 0; x < W; x++) { const v = (td[(x / W * td.length) | 0] ?? 128) / 128 - 1; const y = H / 2 - v * H / 2 * 0.9; x ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
}

export interface PeakState { l: number; r: number; }
export function drawMetersReal(cv: HTMLCanvasElement, dbL: number, dbR: number, peak: PeakState): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const norm = (db: number): number => Math.max(0, Math.min(1, (db + 60) / 60));
  peak.l = Math.max(norm(dbL), peak.l - 0.01); peak.r = Math.max(norm(dbR), peak.r - 0.01);
  const bars: Array<[number, number, number, string]> = [[norm(dbL), peak.l, dbL, 'L'], [norm(dbR), peak.r, dbR, 'R']];
  bars.forEach((m, i) => {
    const bw = W / 2 - 14, x = i * (W / 2) + 8;
    c.fillStyle = '#0c1322'; c.fillRect(x, 8, bw, H - 30);
    const g = c.createLinearGradient(0, H - 22, 0, 8);
    g.addColorStop(0, '#19c54b'); g.addColorStop(0.7, '#e6e23a'); g.addColorStop(1, '#ff3b3b');
    c.fillStyle = g; c.fillRect(x, 8 + (H - 30) * (1 - m[0]), bw, (H - 30) * m[0]);
    c.fillStyle = '#fff'; c.fillRect(x, 8 + (H - 30) * (1 - m[1]), bw, 2);
    c.fillStyle = '#bcd3ee'; c.font = 'bold 10px monospace';
    c.fillText(`${m[3]} ${isFinite(m[2]) ? m[2].toFixed(0) : '-∞'}`, x, H - 6);
  });
}
