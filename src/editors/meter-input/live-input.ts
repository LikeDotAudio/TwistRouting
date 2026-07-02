// src/editors/meter-input/live-input — REAL video/audio capture + analysis (TS).
//
// Reads ACTUAL pixels + audio the browser is allowed to touch, so the scopes are
// genuine (not the synthetic state of ui/scopes.ts):
//   • Test Pattern — standard SMPTE colour bars (offline; proves the pipeline end-to-end)
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
  AW: number; AH: number; BINS: number;
  // Per-column value HISTOGRAMS (AW columns × BINS value bins). Brightness when
  // drawn = pixel count → the real waveform-monitor density look. cH = chroma
  // (saturation = max−min of RGB), the colour counterpart of the luma waveform.
  rH: Uint32Array; gH: Uint32Array; bH: Uint32Array; yH: Uint32Array; aH: Uint32Array; cH: Uint32Array;
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
  paint(cv: HTMLCanvasElement): void;   // blit the current analysed frame to a visible canvas
  analyze(): FrameData | null;
  timeData(): Uint8Array | null;    // summed (L+R mono downmix)
  timeDataL(): Uint8Array | null;   // left channel
  timeDataR(): Uint8Array | null;   // right channel
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
  let td: Uint8Array<ArrayBuffer> | null = null;
  let tdL: Uint8Array<ArrayBuffer> | null = null;
  let tdR: Uint8Array<ArrayBuffer> | null = null;
  let fL: Float32Array<ArrayBuffer> | null = null;
  let fR: Float32Array<ArrayBuffer> | null = null;
  let elemSrc: MediaElementAudioSourceNode | null = null;
  let streamSrc: MediaStreamAudioSourceNode | null = null;
  let curSrc: AudioNode | null = null;

  // --- line-up tone: a 1 kHz sine at −22 dBFS on the test pattern; 5 s LEFT,
  //     5 s RIGHT, 5 s SILENCE, looping (a standard L/R identification tone). ---
  const TONE_LEVEL = Math.pow(10, -22 / 20);   // −22 dBFS ≈ 0.0794 linear
  let toneStarted = false;
  let toneGL: GainNode | null = null;   // left-channel gate
  let toneGR: GainNode | null = null;   // right-channel gate
  function ensureTone(): void {
    ensureAudio();
    if (toneStarted || !actx || !anTime || !anL || !anR) return;
    const osc = actx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 1000;
    toneGL = actx.createGain(); toneGR = actx.createGain(); toneGL.gain.value = 0; toneGR.gain.value = 0;
    const merger = actx.createChannelMerger(2);
    osc.connect(toneGL); osc.connect(toneGR);
    toneGL.connect(merger, 0, 0); toneGR.connect(merger, 0, 1);
    const split = actx.createChannelSplitter(2);
    merger.connect(split); split.connect(anL, 0); split.connect(anR, 1);   // per-channel meters/scopes
    merger.connect(anTime); merger.connect(actx.destination);               // sum + audible
    osc.start();
    toneStarted = true;
  }
  function silenceTone(): void { if (toneGL) toneGL.gain.value = 0; if (toneGR) toneGR.gain.value = 0; }
  function updateTone(now: number): void {
    if (!toneGL || !toneGR) return;
    const phase = (now % 15000) / 1000;   // 0..15 s
    toneGL.gain.value = phase < 5 ? TONE_LEVEL : 0;               // 0–5 s: LEFT
    toneGR.gain.value = phase >= 5 && phase < 10 ? TONE_LEVEL : 0;   // 5–10 s: RIGHT; 10–15 s: OFF
  }

  function ensureAudio(): void {
    if (!actx) {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Ctor) return;
      actx = new Ctor();
      anTime = actx.createAnalyser(); anTime.fftSize = 1024; td = new Uint8Array(anTime.fftSize);
      anL = actx.createAnalyser(); anR = actx.createAnalyser(); anL.fftSize = anR.fftSize = 1024;
      fL = new Float32Array(anL.fftSize); fR = new Float32Array(anR.fftSize);
      tdL = new Uint8Array(anL.fftSize); tdR = new Uint8Array(anR.fftSize);
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
  function useBars(): void { stopStream(); mode = 'bars'; tainted = false; ensureTone(); }
  async function captureTab(): Promise<MediaStream> {
    const md = navigator.mediaDevices;
    if (!md || typeof md.getDisplayMedia !== 'function') {
      throw new Error('screen capture needs a secure context (https:// or http://localhost)');
    }
    const stream = await md.getDisplayMedia({ video: true, audio: true });
    stopStream(); video.srcObject = stream; video.muted = true; await video.play();
    mode = 'stream'; tainted = false; silenceTone(); wireAudio(true, stream); return stream;
  }
  async function useMedia(url: string, remote: boolean): Promise<void> {
    stopStream(); video.srcObject = null;
    if (remote) video.crossOrigin = 'anonymous'; else video.removeAttribute('crossorigin');
    video.src = url; video.muted = false;
    await video.play();
    mode = 'media'; tainted = false; silenceTone();
    try { wireAudio(false); } catch { /* audio may be blocked on tainted cross-origin */ }
  }
  function stop(): void { stopStream(); try { if (actx) void actx.close(); } catch { /* ignore */ } }

  // --- test pattern: standard SMPTE colour bars (SMPTE ECR 1-1978) ---
  // Static: top 2/3 = seven 75% colour bars; a reverse "castellation" strip; then
  // the -I / 100 % white / +Q patches and the PLUGE (-4 % · 0 · +4 %) at the bottom.
  function drawBars(_t: number): void {
    if (!gctx) return;
    const topH = Math.round(AH * 2 / 3), midH = Math.round(AH / 12), botY = topH + midH, botH = AH - botY, bw = AW / 7;
    const top = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'];
    top.forEach((c, i) => { gctx.fillStyle = c; gctx.fillRect(i * bw, 0, bw + 1, topH); });
    const mid = ['#0000bf', '#131313', '#bf00bf', '#131313', '#00bfbf', '#131313', '#bfbfbf'];
    mid.forEach((c, i) => { gctx.fillStyle = c; gctx.fillRect(i * bw, topH, bw + 1, midH); });
    // Bottom row in 28ths: -I, white, +Q, black, then PLUGE (-4 % · 0 · +4 %), black.
    const seg: Array<[number, string]> = [
      [5, '#00214c'], [5, '#ffffff'], [5, '#32006a'], [1, '#0a0a0a'],
      [1, '#000000'], [1, '#0a0a0a'], [1, '#141414'], [9, '#0a0a0a'],
    ];
    let x = 0;
    for (const [u, c] of seg) { const w = (u / 28) * AW; gctx.fillStyle = c; gctx.fillRect(x, botY, w + 1, botH); x += w; }
  }

  // --- per-frame video ---
  function grab(t: number): boolean {
    if (!octx) return false;
    if (mode === 'bars') { drawBars(t); octx.drawImage(gen, 0, 0, AW, AH); ensureTone(); updateTone(t); return true; }
    if (video.readyState < 2) return false;
    try { octx.drawImage(video, 0, 0, AW, AH); return true; } catch { return false; }
  }
  // Blit the current analysed frame (the offscreen source, incl. the test pattern)
  // onto a visible canvas so the "Input Under Test" panel shows the test pattern.
  function paint(cv: HTMLCanvasElement): void {
    const c = cv.getContext('2d'); if (!c) return;
    c.drawImage(off, 0, 0, cv.width, cv.height);
  }
  const BINS = 128;
  function analyze(): FrameData | null {
    if (!octx) return null;
    let img: Uint8ClampedArray;
    try { img = octx.getImageData(0, 0, AW, AH).data; tainted = false; }
    catch { tainted = true; return null; } // cross-origin without CORS → tainted
    const rH = new Uint32Array(AW * BINS), gH = new Uint32Array(AW * BINS);
    const bH = new Uint32Array(AW * BINS), yH = new Uint32Array(AW * BINS), aH = new Uint32Array(AW * BINS), cH = new Uint32Array(AW * BINS);
    const pts: number[] = [];
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = (y * AW + x) * 4;
      const r = img[i] ?? 0, g = img[i + 1] ?? 0, b = img[i + 2] ?? 0, a = img[i + 3] ?? 255;
      const col = x * BINS;
      const ri = col + ((r * BINS) >> 8), gi = col + ((g * BINS) >> 8), bi = col + ((b * BINS) >> 8), ai = col + ((a * BINS) >> 8);
      rH[ri] = (rH[ri] ?? 0) + 1; gH[gi] = (gH[gi] ?? 0) + 1; bH[bi] = (bH[bi] ?? 0) + 1; aH[ai] = (aH[ai] ?? 0) + 1;
      const Y = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
      const yi = col + ((Y * BINS) >> 8); yH[yi] = (yH[yi] ?? 0) + 1;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);   // saturation, 0..255
      const ci = col + ((chroma * BINS) >> 8); cH[ci] = (cH[ci] ?? 0) + 1;
      if (((x + y) & 3) === 0) {
        const cb = -0.1146 * r - 0.3854 * g + 0.5 * b, cr = 0.5 * r - 0.4542 * g - 0.0458 * b;
        pts.push(cb, cr, r, g, b);
      }
    }
    return { AW, AH, BINS, rH, gH, bH, yH, aH, cH, pts };
  }

  // --- audio reads ---
  function timeData(): Uint8Array | null { if (anTime && td) { anTime.getByteTimeDomainData(td); return td; } return null; }
  function timeDataL(): Uint8Array | null { if (anL && tdL) { anL.getByteTimeDomainData(tdL); return tdL; } return null; }
  function timeDataR(): Uint8Array | null { if (anR && tdR) { anR.getByteTimeDomainData(tdR); return tdR; } return null; }
  function rmsOf(an: AnalyserNode | null, buf: Float32Array<ArrayBuffer> | null): number {
    if (!an || !buf) return -70;
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) { const v = buf[i] ?? 0; s += v * v; }
    return 20 * Math.log10(Math.sqrt(s / buf.length) || 1e-7);
  }

  return {
    video, mode: () => mode, isTainted: () => tainted,
    captureTab, useMedia, useBars, stop, grab, paint, analyze, timeData, timeDataL, timeDataR,
    rmsL: () => rmsOf(anL, fL), rmsR: () => rmsOf(anR, fR),
  };
}

// ---- draw helpers (render analysis onto editor canvases) -------------------
function ctx2d(cv: HTMLCanvasElement): CanvasRenderingContext2D | null { return cv.getContext('2d'); }

// --- phosphor look: fade the previous frame (persistence trail) instead of a hard
//     clear, then plot sparse, low-alpha, ADDITIVE dots so the signal glows where
//     it dwells and leaves soft ghosts. The graticule is redrawn crisp each frame.
function fade(c: CanvasRenderingContext2D, W: number, H: number, a: number): void {
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = `rgba(3,6,15,${a})`;
  c.fillRect(0, 0, W, H);
}

// The vertical axis runs -10…110 IRE so 0 and 100 sit inside the frame with margin
// (sub-black / super-white headroom, like a broadcast waveform monitor).
const IRE_LO = -10, IRE_HI = 110;
const ireFrac = (ire: number): number => (ire - IRE_LO) / (IRE_HI - IRE_LO);   // -10→0, 110→1
const ireY = (ire: number, H: number): number => H - ireFrac(ire) * (H - 2) - 1;

// A pan+zoom view for a scope: content is drawn in natural coords, then a canvas
// transform scales by `z` and translates by (px,py) — so wheel-zoom can centre on
// the pointer and drag can pan. Fades run at IDENTITY (they cover the full canvas).
export interface View { z: number; px: number; py: number }
export const IDENTITY_VIEW: View = { z: 1, px: 0, py: 0 };
const applyView = (c: CanvasRenderingContext2D, v: View): void => { c.setTransform(v.z, 0, 0, v.z, v.px, v.py); };
const resetView = (c: CanvasRenderingContext2D): void => { c.setTransform(1, 0, 0, 1, 0, 0); };

// Orange IRE graticule within [x0, x0+w]; majors every 20 IRE, labelled. The
// -10 / 110 margins get a faint boundary line.
function drawIRE(c: CanvasRenderingContext2D, x0: number, w: number, H: number): void {
  c.lineWidth = 1; c.font = 'bold 9px Arial'; c.textAlign = 'left';
  for (const ire of [-10, 110]) {
    const y = ireY(ire, H);
    c.strokeStyle = 'rgba(224,138,30,0.12)'; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w, y); c.stroke();
  }
  for (let ire = 0; ire <= 100; ire += 10) {
    const y = ireY(ire, H), major = ire % 20 === 0;
    c.strokeStyle = major ? 'rgba(224,138,30,0.5)' : 'rgba(224,138,30,0.2)';
    c.beginPath(); c.moveTo(x0 + (major ? 18 : 0), y); c.lineTo(x0 + w, y); c.stroke();
    if (major) { c.fillStyle = 'rgba(224,138,30,0.85)'; c.fillText(String(ire), x0 + 2, y - 2); }
  }
}

// Per-column histogram → density dots (brightness = pixel count), additive, with
// a persistence trail. `hist` is AW×BINS; draws within [x0, x0+w].
function drawDensity(c: CanvasRenderingContext2D, hist: Uint32Array, AW: number, BINS: number, x0: number, w: number, H: number, rgb: string): void {
  c.globalCompositeOperation = 'lighter';
  const bh = Math.max(1, (H - 2) / BINS);
  for (let x = 0; x < w; x++) {
    const col = ((x / w * AW) | 0) * BINS;
    for (let bin = 0; bin < BINS; bin++) {
      const cnt = hist[col + bin]; if (!cnt) continue;
      const y = ireY((bin / (BINS - 1)) * 100, H);   // value 0..255 → 0..100 IRE
      c.fillStyle = `rgba(${rgb},${Math.min(0.85, cnt * 0.05)})`;
      c.fillRect(x0 + x, y - bh / 2, 1, bh);
    }
  }
  c.globalCompositeOperation = 'source-over';
}

export function drawParadeReal(cv: HTMLCanvasElement, d: FrameData, view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height, pw = W / 3;
  resetView(c); fade(c, W, H, 0.28); applyView(c, view);
  const chans: Array<[Uint32Array, string]> = [[d.rH, '255,64,64'], [d.gH, '64,255,96'], [d.bH, '96,150,255']];
  chans.forEach(([hist, rgb], p) => { drawIRE(c, p * pw, pw, H); drawDensity(c, hist, d.AW, d.BINS, p * pw, pw, H, rgb); });
  resetView(c);
}

// RGB Stacked waveform — R, G, B each in its own full-width lane (red top, green
// middle, blue bottom), density-plotted with a per-lane IRE graticule.
export function drawRGBStacked(cv: HTMLCanvasElement, d: FrameData, view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height;
  resetView(c); fade(c, W, H, 0.28); applyView(c, view);
  const lh = H / 3, BINS = d.BINS, bh = Math.max(1, (lh - 2) / BINS);
  const chans: Array<[Uint32Array, string]> = [[d.rH, '255,64,64'], [d.gH, '64,255,96'], [d.bH, '96,150,255']];
  chans.forEach(([hist, rgb], p) => {
    const bot = p * lh + lh;
    const yOf = (ire: number): number => bot - ireFrac(ire) * (lh - 2) - 1;
    c.strokeStyle = 'rgba(224,138,30,0.22)'; c.lineWidth = 1; c.font = '8px Arial'; c.textAlign = 'left';
    for (const ire of [0, 50, 100]) { const y = yOf(ire); c.beginPath(); c.moveTo(16, y); c.lineTo(W, y); c.stroke(); c.fillStyle = 'rgba(224,138,30,0.7)'; c.fillText(String(ire), 1, y + 3); }
    c.globalCompositeOperation = 'lighter';
    for (let x = 0; x < W; x++) {
      const col = ((x / W * d.AW) | 0) * BINS;
      for (let bin = 0; bin < BINS; bin++) {
        const cnt = hist[col + bin]; if (!cnt) continue;
        c.fillStyle = `rgba(${rgb},${Math.min(0.85, cnt * 0.05)})`;
        c.fillRect(x, yOf((bin / (BINS - 1)) * 100) - bh / 2, 1, bh);
      }
    }
    c.globalCompositeOperation = 'source-over';
  });
  resetView(c);
}

// CIE 1931 xy chromaticity gamut. Each sampled pixel's RGB is linearised (sRGB
// decode), converted to XYZ (sRGB/D65 matrix), normalised to xy, and plotted
// (coloured by the pixel) over the spectral-locus "horseshoe" + the Rec.709/sRGB
// primary triangle + the D65 white point. Additive, with persistence + pan/zoom.
const CIE_LOCUS: ReadonlyArray<readonly [number, number]> = [
  [0.1733, 0.0048], [0.1644, 0.0109], [0.1440, 0.0297], [0.1241, 0.0578], [0.0913, 0.1327],
  [0.0454, 0.2950], [0.0082, 0.5384], [0.0139, 0.7502], [0.0743, 0.8338], [0.1547, 0.8059],
  [0.2296, 0.7543], [0.3016, 0.6923], [0.3731, 0.6245], [0.4441, 0.5547], [0.5125, 0.4866],
  [0.5752, 0.4242], [0.6270, 0.3725], [0.6658, 0.3340], [0.6915, 0.3083], [0.7079, 0.2920],
  [0.7245, 0.2755], [0.7347, 0.2653],
];
const REC709 = { r: [0.640, 0.330] as const, g: [0.300, 0.600] as const, b: [0.150, 0.060] as const, w: [0.3127, 0.3290] as const };
const srgb2lin = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function drawCIE(cv: HTMLCanvasElement, pts: number[], view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height;
  resetView(c); fade(c, W, H, 0.16); applyView(c, view);
  const pad = 18, XMAX = 0.75, YMAX = 0.85;
  const px = (x: number): number => pad + (x / XMAX) * (W - 2 * pad);
  const py = (y: number): number => H - pad - (y / YMAX) * (H - 2 * pad);
  c.strokeStyle = 'rgba(80,110,150,.13)'; c.lineWidth = 1;
  for (let g = 0.1; g <= 0.7; g += 0.1) { c.beginPath(); c.moveTo(px(g), py(0)); c.lineTo(px(g), py(YMAX)); c.stroke(); }
  for (let g = 0.1; g <= 0.8; g += 0.1) { c.beginPath(); c.moveTo(px(0), py(g)); c.lineTo(px(XMAX), py(g)); c.stroke(); }
  c.strokeStyle = 'rgba(200,220,255,.55)'; c.lineWidth = 1.3; c.beginPath();
  CIE_LOCUS.forEach(([x, y], i) => { i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y)); });
  c.closePath(); c.stroke();   // closePath = the "line of purples"
  c.strokeStyle = 'rgba(180,180,190,.4)'; c.beginPath();
  c.moveTo(px(REC709.r[0]), py(REC709.r[1])); c.lineTo(px(REC709.g[0]), py(REC709.g[1])); c.lineTo(px(REC709.b[0]), py(REC709.b[1])); c.closePath(); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(px(REC709.w[0]), py(REC709.w[1]), 2, 0, 7); c.fill();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < pts.length; i += 5) {
    const R = pts[i + 2] ?? 0, G = pts[i + 3] ?? 0, B = pts[i + 4] ?? 0;
    const lr = srgb2lin(R / 255), lg = srgb2lin(G / 255), lb = srgb2lin(B / 255);
    const X = 0.4124 * lr + 0.3576 * lg + 0.1805 * lb, Y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb, Z = 0.0193 * lr + 0.1192 * lg + 0.9505 * lb;
    const sum = X + Y + Z; if (sum < 1e-6) continue;
    c.fillStyle = `rgba(${R | 0},${G | 0},${B | 0},0.5)`;
    c.fillRect(px(X / sum), py(Y / sum), 1, 1);
  }
  c.globalCompositeOperation = 'source-over';
  resetView(c);
}

// RGB Diamond gamut scope (Tektronix-style): two stacked diamonds. Upper plots
// G↔R, lower plots G↔B; the vertical centre line is luminance (black centre →
// white at the outer tips). Trace bleeding past the dashed limit = out-of-gamut.
export function drawDiamond(cv: HTMLCanvasElement, pts: number[], view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height, cx = W / 2, mid = H / 2;
  resetView(c); fade(c, W, H, 0.20); applyView(c, view);
  const top = 14, bot = H - 14, hw = Math.min(W * 0.36, H / 2 - 14), uh = mid - top, lh = bot - mid;
  const dia = (ty: number, my: number, by: number, halfW: number, dash: boolean): void => {
    c.setLineDash(dash ? [5, 4] : []);
    c.beginPath(); c.moveTo(cx, ty); c.lineTo(cx + halfW, my); c.lineTo(cx, by); c.lineTo(cx - halfW, my); c.closePath(); c.stroke();
    c.setLineDash([]);
  };
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(150,170,200,.45)'; dia(top, (top + mid) / 2, mid, hw, false); dia(mid, (mid + bot) / 2, bot, hw, false);
  c.strokeStyle = 'rgba(150,170,200,.28)'; dia(top - 4, (top + mid) / 2, mid, hw + 5, true); dia(mid, (mid + bot) / 2, bot + 4, hw + 5, true);
  c.fillStyle = 'rgba(170,190,215,.85)'; c.font = '9px Arial';
  c.textAlign = 'right'; c.fillText('G', cx - hw - 4, (top + mid) / 2 + 3); c.fillText('G', cx - hw - 4, (mid + bot) / 2 + 3);
  c.textAlign = 'left'; c.fillText('R', cx + hw + 4, (top + mid) / 2 + 3); c.fillText('B', cx + hw + 4, (mid + bot) / 2 + 3);
  c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(215,235,255,.45)';
  for (let i = 0; i < pts.length; i += 5) {
    const r = (pts[i + 2] ?? 0) / 255, g = (pts[i + 3] ?? 0) / 255, b = (pts[i + 4] ?? 0) / 255;
    c.fillRect(cx + (r - g) * hw, mid - ((r + g) / 2) * uh, 1, 1);   // upper: G↔R, luma up
    c.fillRect(cx + (b - g) * hw, mid + ((b + g) / 2) * lh, 1, 1);   // lower: G↔B, luma down
  }
  c.globalCompositeOperation = 'source-over'; resetView(c);
}

// Lightness / Saturation triangle (HSL): x = Lightness (0 black → 1 white), y =
// chroma (max−min). Black & white can't hold chroma, so the valid region tapers
// to the base corners and peaks at the apex — a triangle.
export function drawHSL(cv: HTMLCanvasElement, pts: number[], view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height;
  resetView(c); fade(c, W, H, 0.20); applyView(c, view);
  const padX = 30, padTop = 14, padBot = 22;
  const BLx = padX, BRx = W - padX, apexX = W / 2, baseY = H - padBot, apexY = padTop;
  const bx = (l: number): number => padX + l * (W - 2 * padX);
  const by = (chr: number): number => baseY - chr * (baseY - apexY);
  c.lineWidth = 1; c.font = '8px Arial';
  c.setLineDash([5, 4]); c.strokeStyle = 'rgba(160,170,190,.5)';
  c.beginPath(); c.moveTo(BLx, baseY); c.lineTo(apexX, apexY); c.lineTo(BRx, baseY); c.closePath(); c.stroke();
  for (const t of [0.25, 0.5, 0.75]) {
    const y = by(t), xl = BLx + t * (apexX - BLx), xr = BRx - t * (BRx - apexX);
    c.beginPath(); c.moveTo(xl, y); c.lineTo(xr, y); c.stroke();
    c.setLineDash([]); c.fillStyle = 'rgba(180,190,210,.8)';
    c.textAlign = 'right'; c.fillText(`${t * 100}% Val`, xl - 3, y + 3);
    c.textAlign = 'left'; c.fillText(`${t * 100}% Sat`, xr + 3, y + 3);
    c.setLineDash([5, 4]);
  }
  c.setLineDash([]); c.textAlign = 'center'; c.fillStyle = 'rgba(180,190,210,.85)'; c.fillText('Lightness', W / 2, H - 5);
  c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(220,235,255,.5)';
  for (let i = 0; i < pts.length; i += 5) {
    const r = (pts[i + 2] ?? 0) / 255, g = (pts[i + 3] ?? 0) / 255, b = (pts[i + 4] ?? 0) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    c.fillRect(bx((mx + mn) / 2), by(mx - mn), 1, 1);
  }
  c.globalCompositeOperation = 'source-over'; resetView(c);
}

// Audio goniometer / Lissajous — plots real L (x) vs R (y) sample pairs rotated
// 45° (mono = vertical), additive with persistence. Zoomable.
export function drawGonio(cv: HTMLCanvasElement, L: Uint8Array | null, R: Uint8Array | null, view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R0 = Math.min(W, H) / 2 - 8;
  if (R0 < 4) return;   // hidden / collapsed card
  resetView(c); fade(c, W, H, 0.20); applyView(c, view);
  c.strokeStyle = '#0e2436'; c.beginPath(); c.arc(cx, cy, R0, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(cx, cy - R0); c.lineTo(cx, cy + R0); c.moveTo(cx - R0, cy); c.lineTo(cx + R0, cy); c.stroke();
  c.fillStyle = '#5a6f88'; c.font = '9px "Courier New",monospace'; c.textAlign = 'center';
  c.fillText('M', cx, cy - R0 + 10); c.fillText('L', cx - R0 * 0.62, cy - R0 * 0.55); c.fillText('R', cx + R0 * 0.62, cy - R0 * 0.55);
  if (L && R) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(120,235,150,0.5)';
    const n = Math.min(L.length, R.length), k = R0 / Math.SQRT2;
    for (let i = 0; i < n; i++) {
      const l = (L[i] ?? 128) / 128 - 1, r = (R[i] ?? 128) / 128 - 1;
      c.fillRect(cx + (l - r) * k, cy - (l + r) * k, 1, 1);
    }
    c.globalCompositeOperation = 'source-over';
  }
  resetView(c);
}

export function drawWaveReal(cv: HTMLCanvasElement, hist: Uint32Array, AW: number, BINS: number, rgb = '130,255,140', view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height;
  resetView(c); fade(c, W, H, 0.28); applyView(c, view);
  drawIRE(c, 0, W, H);
  drawDensity(c, hist, AW, BINS, 0, W, H, rgb);
  resetView(c);
}

// Chroma waveform — per-column saturation (max−min of RGB) density, the colour
// counterpart of the luma waveform. Vertical axis reads 0…100 % saturation; a
// magenta trace so it never gets confused with the green luma waveform.
export function drawChromaReal(cv: HTMLCanvasElement, hist: Uint32Array, AW: number, BINS: number, view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height;
  resetView(c); fade(c, W, H, 0.28); applyView(c, view);
  drawIRE(c, 0, W, H);   // 0…100 graticule reads as % saturation here
  drawDensity(c, hist, AW, BINS, 0, W, H, '224,120,255');
  resetView(c);
}

// RGB(A) Overlay waveform — R, G, B and Alpha densities on ONE set of axes,
// additive (where channels coincide → white), like DaVinci's RGB overlay.
export function drawRGBOverlay(cv: HTMLCanvasElement, d: FrameData, view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height;
  resetView(c); fade(c, W, H, 0.28); applyView(c, view);
  drawIRE(c, 0, W, H);
  drawDensity(c, d.aH, d.AW, d.BINS, 0, W, H, '150,150,160');   // alpha (pale, drawn first)
  drawDensity(c, d.rH, d.AW, d.BINS, 0, W, H, '255,64,64');
  drawDensity(c, d.gH, d.AW, d.BINS, 0, W, H, '64,255,96');
  drawDensity(c, d.bH, d.AW, d.BINS, 0, W, H, '96,150,255');
  resetView(c);
}

export function drawVectorReal(cv: HTMLCanvasElement, pts: number[], view: View = IDENTITY_VIEW): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 6;
  if (R < 4) return;   // hidden / collapsed card
  resetView(c); fade(c, W, H, 0.18); applyView(c, view);
  c.strokeStyle = '#0e2436'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
  c.strokeStyle = '#24401f'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R * Math.cos(-2.15), cy + R * Math.sin(-2.15)); c.stroke();
  const sc = R / 140;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < pts.length; i += 5) {
    c.fillStyle = `rgba(${(pts[i + 2] ?? 0) | 0},${(pts[i + 3] ?? 0) | 0},${(pts[i + 4] ?? 0) | 0},0.5)`;
    c.fillRect(cx + (pts[i] ?? 0) * sc, cy - (pts[i + 1] ?? 0) * sc, 1, 1);
  }
  c.globalCompositeOperation = 'source-over';
  resetView(c);
}

// Three stacked lanes: Left (top), Right (middle), and their sum L+R (bottom).
export function drawScope3(cv: HTMLCanvasElement, L: Uint8Array | null, R: Uint8Array | null, S: Uint8Array | null): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const lanes: Array<[Uint8Array | null, string, string]> = [[L, 'L', '90,255,122'], [R, 'R', '90,157,255'], [S, 'L+R', '255,212,0']];
  const lh = H / 3;
  c.font = 'bold 9px "Courier New",monospace';
  lanes.forEach(([data, label, rgb], li) => {
    const y0 = li * lh, mid = y0 + lh / 2;
    c.strokeStyle = '#0e2436'; c.beginPath(); c.moveTo(0, mid); c.lineTo(W, mid); c.stroke();
    c.fillStyle = '#5a6f88'; c.fillText(label, 5, y0 + 12);
    if (!data) return;
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${rgb},0.5)`; c.lineWidth = 1; c.beginPath();
    for (let x = 0; x < W; x++) {
      const v = (data[(x / W * data.length) | 0] ?? 128) / 128 - 1;
      const y = mid - v * (lh / 2) * 0.82;
      x ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
    c.globalCompositeOperation = 'source-over';
  });
}

// Slow "chart recorder": L/R level (dBFS) scrolling over a long window (minutes),
// so you read the audio like a strip-chart / audiogram rather than a fast scope.
export function drawRecorder(cv: HTMLCanvasElement, histL: number[], histR: number[], span: number): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const lo = -60, hi = 0, y = (db: number): number => H - ((db - lo) / (hi - lo)) * H;
  c.font = '8px "Courier New",monospace'; c.textAlign = 'left';
  for (const db of [0, -6, -12, -20, -40, -60]) {
    const yy = y(db);
    c.strokeStyle = db === -20 ? 'rgba(57,211,83,.35)' : 'rgba(80,110,150,.16)';
    c.beginPath(); c.moveTo(22, yy); c.lineTo(W, yy); c.stroke();
    c.fillStyle = 'rgba(120,150,190,.65)'; c.fillText(String(db), 1, yy + 3);
  }
  const line = (hist: number[], color: string): void => {
    if (!hist.length) return;
    c.strokeStyle = color; c.lineWidth = 1.4; c.beginPath();
    hist.forEach((db, i) => { const x = 22 + (i / span) * (W - 22), yy = y(Math.max(lo, db)); i ? c.lineTo(x, yy) : c.moveTo(x, yy); });
    c.stroke();
  };
  line(histL, '#39d353'); line(histR, '#5a9dff');
  c.fillStyle = '#5a6f88'; c.textAlign = 'right'; c.fillText('L', W - 12, 11); c.fillStyle = '#5a9dff'; c.fillText('R', W - 4, 11);
}

// Analog VU meters (L + R), inspired by OPEN-AIR libControl/metering NeedleMeter:
// a cream face, arced -20…+3 VU scale with a red over-0 zone, and a ballistic
// needle. Caller passes already-ballistic-smoothed dBFS (0 VU ≙ -18 dBFS).
const VU_LO = -20, VU_HI = 3;
const VU_MARKS: Array<[number, string]> = [[-20, '20'], [-10, '10'], [-7, '7'], [-5, '5'], [-3, '3'], [0, '0'], [3, '+3']];
function drawOneVU(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, db: number, label: string): void {
  c.save();
  c.beginPath(); c.roundRect(x + 2, y + 2, w - 4, h - 4, 8); c.fillStyle = '#efe7d0'; c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke();
  const cx = x + w / 2, cy = y + h * 0.9, R = Math.min(w, h) * 0.7;
  const A0 = -Math.PI / 2 - 0.92, A1 = -Math.PI / 2 + 0.92;
  const ang = (vu: number): number => A0 + (A1 - A0) * ((vu - VU_LO) / (VU_HI - VU_LO));
  c.strokeStyle = '#3a3428'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, R, A0, A1); c.stroke();
  c.strokeStyle = '#c02020'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, ang(0), A1); c.stroke();
  const fs = Math.max(6, h * 0.085);
  c.textAlign = 'center'; c.font = `bold ${fs}px Arial`;
  VU_MARKS.forEach(([vu, txt]) => {
    const a = ang(vu), red = vu >= 0;
    c.strokeStyle = red ? '#c02020' : '#2a2418'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.lineTo(cx + Math.cos(a) * (R - 7), cy + Math.sin(a) * (R - 7)); c.stroke();
    c.fillStyle = red ? '#c02020' : '#2a2418'; c.fillText(txt, cx + Math.cos(a) * (R - 15), cy + Math.sin(a) * (R - 15) + 3);
  });
  c.fillStyle = '#8a7530'; c.font = `bold ${Math.max(8, h * 0.1)}px Arial`; c.fillText('VU', cx, cy - R * 0.5);
  c.fillStyle = '#2a2418'; c.font = `bold ${fs}px Arial`; c.fillText(label, cx, cy - 5);
  const a = ang(Math.max(VU_LO, Math.min(VU_HI, db + 18)));
  c.strokeStyle = '#141414'; c.lineWidth = Math.max(1.5, h * 0.018); c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); c.stroke();
  c.fillStyle = '#141414'; c.beginPath(); c.arc(cx, cy, Math.max(3, h * 0.035), 0, 7); c.fill();
  c.restore();
}
export function drawVUpair(cv: HTMLCanvasElement, dbL: number, dbR: number): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height;
  if (W < 24 || H < 16) return;   // hidden / collapsed card
  c.clearRect(0, 0, W, H);
  drawOneVU(c, 0, 0, W / 2, H, dbL, 'L');
  drawOneVU(c, W / 2, 0, W / 2, H, dbR, 'R');
}

export interface PeakState { l: number; r: number; }
export function drawMetersReal(cv: HTMLCanvasElement, dbL: number, dbR: number, peak: PeakState): void {
  const c = ctx2d(cv); if (!c) return; const W = cv.width, H = cv.height;
  if (W < 8 || H < 8) return;   // hidden / collapsed card
  c.clearRect(0, 0, W, H);
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
