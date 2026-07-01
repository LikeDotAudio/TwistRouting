// js/editors/shared/audio-scope.js — SHARED audio analyzer scope: the animated
// waveform trace, extracted from the IFB confidence feed (was drawFeed() in
// js/editors/ifb.js) so the IFB monitor and the Meter Input test tool draw the
// same oscilloscope from one place.
//
//   drawAudioWave(canvas, level, { alert, color, cycles })
//     level  0..1 amplitude of the trace
//     alert  true → red "attention" trace (IFB uses it while a Talk key is held)
//     color  override the normal trace colour
//     cycles how many sine cycles span the width (default 6)
export function drawAudioWave(cv, level, opts = {}) {
    const w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight, ctx = cv.getContext('2d');
    if (!w || !h) return;
    const cycles = opts.cycles || 6;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = opts.alert ? 'rgba(255,120,120,.9)' : (opts.color || 'rgba(90,224,140,.9)');
    ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= w; x += 3) {
        const t = x / w * Math.PI * 2 * cycles;
        const y = h / 2 + Math.sin(t + performance.now() * 0.004) * level * (h * 0.42) * (0.6 + Math.random() * 0.4);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
}
