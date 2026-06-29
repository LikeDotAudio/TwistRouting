// js/editors/camera/maps.js — the robotics studio maps (top-down + side
// elevation) and their per-frame update.
export function topSVG() {
    return `<svg viewBox="0 0 300 290" preserveAspectRatio="xMidYMid meet">
      <line x1="40" y1="250" x2="260" y2="250" stroke="#2c466e" stroke-dasharray="4 4"/>
      <text x="40" y="266" fill="#3f5a82" font-size="9" font-family="monospace">DOLLY TRACK</text>
      <rect x="120" y="60" width="60" height="90" rx="14" fill="#13243f" stroke="#2c466e"/>
      <text x="133" y="110" fill="#4a6a98" font-size="9" font-family="monospace">TALENT</text>
      <g id="cc-tcam"><polygon id="cc-tcone" points="0,0 -30,-120 30,-120" fill="rgba(111,200,240,.16)" stroke="rgba(111,200,240,.5)"/><circle r="10" fill="#6FC8F0" stroke="#001019" stroke-width="2"/></g>
    </svg>`;
}
export function sideSVG() {
    return `<svg viewBox="0 0 300 290" preserveAspectRatio="xMidYMid meet">
      <line x1="20" y1="250" x2="280" y2="250" stroke="#3f5a82" stroke-width="2"/>
      <text x="22" y="266" fill="#3f5a82" font-size="9" font-family="monospace">FLOOR</text>
      <line x1="40" y1="250" x2="40" y2="90" stroke="#2c466e" stroke-dasharray="4 4"/>
      <text x="46" y="86" fill="#3f5a82" font-size="9" font-family="monospace">PED COLUMN</text>
      <rect x="190" y="150" width="34" height="100" rx="8" fill="#13243f" stroke="#2c466e"/>
      <circle cx="207" cy="140" r="13" fill="#13243f" stroke="#2c466e"/>
      <text x="180" y="270" fill="#4a6a98" font-size="9" font-family="monospace">TALENT</text>
      <g id="cc-scam"><polygon id="cc-scone" points="0,0 150,-26 150,26" fill="rgba(111,200,240,.16)" stroke="rgba(111,200,240,.5)"/><circle r="10" fill="#6FC8F0" stroke="#001019" stroke-width="2"/></g>
    </svg>`;
}
export function updateMaps(body, s) {
    const cam = body.querySelector('#cc-tcam'), cone = body.querySelector('#cc-tcone');
    if (cam) {
        const x = 40 + s.dolly * 220, y = 250 - s.ped * 30, ang = (s.pan - 0.5) * 150, half = 14 + (1 - s.zoom) * 34, len = 120 + s.zoom * 80;
        cam.setAttribute('transform', `translate(${x},${y})`); cone.setAttribute('transform', `rotate(${ang})`);
        const a = half * Math.PI / 180;
        cone.setAttribute('points', `0,0 ${Math.sin(-a) * len},${-Math.cos(-a) * len} ${Math.sin(a) * len},${-Math.cos(a) * len}`);
    }
    const scam = body.querySelector('#cc-scam'), scone = body.querySelector('#cc-scone');
    if (scam) {
        const x = 40 + s.dolly * 150, y = 250 - s.ped * 150, tilt = (s.tilt - 0.5) * 90, half = 12 + (1 - s.zoom) * 26, len = 150 + s.zoom * 90;
        scam.setAttribute('transform', `translate(${x},${y})`); scone.setAttribute('transform', `rotate(${tilt})`);
        const a = half * Math.PI / 180;
        scone.setAttribute('points', `0,0 ${Math.cos(-a) * len},${Math.sin(-a) * len} ${Math.cos(a) * len},${Math.sin(a) * len}`);
    }
}
