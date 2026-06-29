// js/editors/camera/scopes.js — the RGB PARADE waveform monitor + vectorscope.
// Three side-by-side graphs (R | G | B): X mirrors the frame horizontal axis,
// Y is intensity (0–100 IRE). With Colour Bars on, the bar test signal drives it.
import { clamp } from './state.js';

const BARS75 = [[.75, .75, .75], [.75, .75, 0], [0, .75, .75], [0, .75, 0], [.75, 0, .75], [.75, 0, 0], [0, 0, .75]];
const RGBCOL = ['255,64,64', '64,235,96', '92,128,255'];
const LBL = ['R', 'G', 'B'];

function channel(s, c, x) {
    const expoGain = 0.42 + s.iris * 1.15 + s.mgain * 0.55, floor = Math.max(0, s.mblack - 0.5) * 0.55, gammaExp = 0.55 + (1 - s.gamma) * 0.9;
    const lightX = 0.5 + (s.pan - 0.5) * 0.6, subjX = 0.5 - (s.pan - 0.5) * 0.8;
    const g = (xx, m, sg) => Math.exp(-((xx - m) * (xx - m)) / (2 * sg * sg));
    const base = 0.12 + g(x, lightX, 0.16) * 0.78 + (Math.abs(x - subjX) < 0.13 ? 0.42 : 0) + 0.12 * (1 - Math.abs(x - 0.5) * 2);
    const gains = [s.rGain, s.gGain, s.bGain], blks = [s.rBlk, s.gBlk, s.bBlk];
    let v = floor + base * expoGain; v = Math.pow(clamp(v), gammaExp); v = v * (0.62 + gains[c] * 0.82) + (blks[c] - 0.5) * 0.28;
    return clamp(v);
}

export function drawParade(cv, s, barsOn) {
    const w = cv.clientWidth | 0, h = cv.clientHeight | 0; if (!w || !h) return;
    if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
    const top = 12, bot = h - 6, span = bot - top, padL = 22, gap = 10;
    const pw = (w - padL - 4 - gap * 2) / 3;
    ctx.font = '9px Courier New, monospace';
    for (let c = 0; c < 3; c++) {
        const x0 = padL + c * (pw + gap);
        ctx.fillStyle = 'rgba(255,255,255,.02)'; ctx.fillRect(x0, top, pw, span);
        [0, 25, 50, 75, 100].forEach(p => {
            const y = bot - (p / 100) * span;
            ctx.strokeStyle = p === 100 ? 'rgba(255,90,90,.3)' : 'rgba(80,110,150,.16)';
            ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + pw, y); ctx.stroke();
            if (c === 0) { ctx.fillStyle = 'rgba(120,150,190,.7)'; ctx.fillText(String(p), 2, y + 3); }
        });
        ctx.fillStyle = `rgba(${RGBCOL[c]},.9)`; ctx.fillText(LBL[c], x0 + 5, top + 9);
        ctx.globalCompositeOperation = 'lighter';
        const N = 90;
        for (let i = 0; i < N; i++) {
            const fx = i / (N - 1), px = x0 + fx * pw;
            const val = barsOn ? BARS75[Math.min(6, Math.floor(fx * 7))][c] : channel(s, c, fx);
            const jit = barsOn ? 0.012 : (0.03 + s.mgain * 0.12);
            for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(${RGBCOL[c]},.5)`; ctx.fillRect(px, bot - clamp(val + (Math.random() - 0.5) * jit) * span, 2, 2); }
        }
        ctx.globalCompositeOperation = 'source-over';
    }
}

// Vectorscope dot offset from RGB balance.
export function vectorXY(s) { return [(s.rGain - s.bGain) * 70, (s.gGain - 0.5) * -70]; }
