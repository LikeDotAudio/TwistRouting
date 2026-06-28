// js/util/color.js — pure colour helpers shared across the app.
// Phase-1 extraction: these were duplicated in poolVideo.js / poolAudio.js /
// poolPlayout.js. Defined as globals for now (script-tag app); they become
// real ES-module exports in Phase 2.

// Shift a #rrggbb colour's lightness by amt (-100..100) for subtle per-node variation.
export function shadeColor(hex, amt) {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
    if (!m) return hex;
    const num = parseInt(m[1], 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    const f = amt / 100;
    const adj = (c) => Math.max(0, Math.min(255, Math.round(c + (f < 0 ? c : 255 - c) * f)));
    return '#' + ((adj(r) << 16) | (adj(g) << 8) | adj(b)).toString(16).padStart(6, '0');
}

// Apply the standard LCARS signal-node tint (border + text + soft glow).
// Replaces the byte-identical styleVideoNode / styleAudioNode and the inlined
// copy that lived in poolPlayout.js.
export function styleSignalNode(node, color) {
    node.style.borderColor = color;
    node.style.color = color;
    node.style.boxShadow = `0 0 5px ${color}55`;
}
