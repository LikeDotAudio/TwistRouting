// js/editors/camera/bars.js — the precision SMPTE colour-bar test pattern, plus
// the bouncing "DVD-logo" lineage badge shown over the bars.
//
// SMPTE layout: top 2/3 = seven 75% bars; a thin reverse-castellation strip;
// bottom = -I / 100% white / +Q / PLUGE (super-black, black, lighter) for black-
// level line-up.
const TOP = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'];
const MID = ['#0000bf', '#131313', '#bf00bf', '#131313', '#00bfbf', '#131313', '#bfbfbf'];

export function drawSMPTE(cv) {
    const w = cv.clientWidth | 0, h = cv.clientHeight | 0; if (!w || !h) return;
    if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
    const topH = Math.round(h * 0.66), midH = Math.round(h * 0.08), botY = topH + midH, botH = h - botY, cw = w / 7;
    TOP.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(Math.round(i * cw), 0, Math.ceil(cw) + 1, topH); });
    MID.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(Math.round(i * cw), topH, Math.ceil(cw) + 1, midH); });
    let x = 0; const u = w / 7;
    const seg = (width, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), botY, Math.ceil(width) + 1, botH); x += width; };
    seg(u * 1.2, '#00214c');   // -I
    seg(u * 1.2, '#ffffff');   // 100% white
    seg(u * 1.2, '#2a0a52');   // +Q
    seg(u * 1.06, '#131313');  // black
    seg(u * 0.42, '#0a0a0a');  // PLUGE super-black (3.5 IRE)
    seg(u * 0.42, '#151515');  // PLUGE black (7.5 IRE)
    seg(u * 0.42, '#1f1f1f');  // PLUGE lighter (11.5 IRE)
    seg(w - x, '#131313');     // black
    ctx.fillStyle = 'rgba(160,190,220,.5)'; ctx.font = '8px Courier New, monospace';
    ctx.fillText('PLUGE', Math.round(u * 4.6), botY + botH - 4);
}

const DVD_COLORS = ['#ff4d4d', '#28e04a', '#4d83ff', '#ffd400', '#ff5bd1', '#5be0ff', '#ffffff'];

// Advance the bouncing badge one frame; recolour (≠ current) on each bounce.
export function stepDVD(el, vid, st) {
    const W = vid.clientWidth, H = vid.clientHeight, dw = el.offsetWidth, dh = el.offsetHeight;
    if (!W || !H) return;
    st.x += st.dx; st.y += st.dy; let bounced = false;
    if (st.x <= 0) { st.x = 0; st.dx = Math.abs(st.dx); bounced = true; }
    if (st.x + dw >= W) { st.x = W - dw; st.dx = -Math.abs(st.dx); bounced = true; }
    if (st.y <= 0) { st.y = 0; st.dy = Math.abs(st.dy); bounced = true; }
    if (st.y + dh >= H) { st.y = H - dh; st.dy = -Math.abs(st.dy); bounced = true; }
    if (bounced) { let c; do { c = DVD_COLORS[Math.floor(Math.random() * DVD_COLORS.length)]; } while (c === st.color); st.color = c; el.style.color = c; }
    el.style.left = st.x + 'px'; el.style.top = st.y + 'px';
}
