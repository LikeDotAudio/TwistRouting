// js/editors/shared/loudness.js — SHARED loudness metering (ITU-R BS.1770 / LUFS).
// Extracted from the Audio Monitor so both the confidence monitor and the Meter
// Input test tool derive the SAME loudness reading and draw the SAME
// volume-over-time graph from one source of truth.
//
//   const lm = createLoudnessTracker();
//   lm.update(avgLevel);          // each tick — avgLevel is mean channel level 0..1
//   lm.lufs                        // current integrated loudness (drifts with program)
//   lm.history                     // rolling samples for the graph
//   drawLoudnessPlot(canvas, lm.history);

// Integrated loudness that drifts toward the program level. Mirrors the original
// Audio Monitor ballistics exactly: target = -28 + avg*22 LUFS, slewed at 0.05,
// keeping the last `historyMax` samples for the time graph.
export function createLoudnessTracker(opts = {}) {
    const integrate = opts.integrate == null ? 0.05 : opts.integrate;
    const historyMax = opts.historyMax || 240;
    let lufs = opts.start == null ? -23 : opts.start;
    const history = [];
    return {
        get lufs() { return lufs; },
        get history() { return history; },
        update(avgLevel) {
            const target = -28 + avgLevel * 22;
            lufs += (target - lufs) * integrate;
            history.push(lufs);
            if (history.length > historyMax) history.shift();
            return lufs;
        },
    };
}

// Loudness-over-time plot, with the −23 LUFS broadcast target line highlighted.
// `span` is the sample count the X axis is scaled to (matches the tracker's
// historyMax so the trace scrolls at a constant rate).
export function drawLoudnessPlot(cv, hist, opts = {}) {
    const w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight, ctx = cv.getContext('2d');
    if (!w || !h) return;
    const span = opts.span || 240, lo = opts.lo == null ? -40 : opts.lo, hi = opts.hi == null ? -8 : opts.hi;
    ctx.clearRect(0, 0, w, h);
    const y = (v) => h - ((v - lo) / (hi - lo)) * h;
    // gridlines + labels
    ctx.font = '8px Courier New, monospace';
    [-12, -18, -23, -30].forEach(v => {
        const yy = y(v); ctx.strokeStyle = v === -23 ? 'rgba(57,211,83,.45)' : 'rgba(80,110,150,.18)';
        ctx.beginPath(); ctx.moveTo(20, yy); ctx.lineTo(w, yy); ctx.stroke();
        ctx.fillStyle = v === -23 ? 'rgba(120,235,150,.8)' : 'rgba(120,150,190,.6)'; ctx.fillText(String(v), 1, yy + 3);
    });
    ctx.beginPath();
    hist.forEach((v, i) => { const x = 20 + i / span * (w - 20), yy = y(v); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
    ctx.strokeStyle = '#6FC8F0'; ctx.lineWidth = 1.6; ctx.stroke();
}
