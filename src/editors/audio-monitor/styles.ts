// src/editors/audio-monitor/styles — verbatim port of the legacy
// addStyles('am2-styles', …) CSS block so the confidence monitor matches 1:1.

import { addStyles } from '../../ui/dom.js';

const CSS = `
.am2{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;height:100%;}
.am2-bridge{overflow:auto;display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start;padding:2px;}
.am2-block{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:12px;}
.am2-bh{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;}
.am2-bh b{color:#6FC8F0;font-size:12px;letter-spacing:2px;}
.am2-fmt{font:bold 10px 'Courier New',monospace;color:#cfe6ff;background:#13233c;border:1px solid #2c3e5e;border-radius:6px;padding:4px 8px;cursor:pointer;letter-spacing:1px;}
.am2-fmt:hover{background:#1b2f4f;}
.am2-meters{display:flex;gap:10px;}
.am2-ch{display:flex;flex-direction:column;align-items:center;gap:6px;width:46px;}
.am2-meter{position:relative;width:24px;height:210px;border-radius:5px;overflow:hidden;box-shadow:inset 0 0 0 1px #1d2942;
    background:linear-gradient(to top,#0f7a39 0%,#39d353 55%,#ffd400 80%,#ff5a3b 92%,#ff2b2b 100%);}
.am2-meter .mask{position:absolute;left:0;right:0;top:0;background:#070f1f;}
.am2-meter .pk{position:absolute;left:0;right:0;height:2px;background:#dfeaff;}
.am2-meter.tp{box-shadow:inset 0 0 0 1px #1d2942, 0 0 9px #ff2b2b;}
.am2-meter .scale{position:absolute;right:1px;top:0;bottom:0;width:1px;}
.am2-lab{font:bold 10px 'Courier New',monospace;color:#bcd3ee;text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46px;}
.am2-cue{width:40px;padding:5px 0;border-radius:6px;border:1px solid #2c3e5e;background:#0c1730;color:#9fb6cc;font:bold 9px sans-serif;letter-spacing:1px;cursor:pointer;text-align:center;}
.am2-cue.on{background:#ffd400;color:#1a1206;border-color:#ffd400;box-shadow:0 0 8px rgba(255,212,0,.6);}
.am2-mute{width:40px;padding:4px 0;border-radius:6px;border:1px solid #2c3e5e;background:#0c1730;color:#7e93b5;font:bold 9px sans-serif;cursor:pointer;text-align:center;}
.am2-mute.on{background:#ff3b3b;color:#fff;border-color:#ff3b3b;}
.am2-phase{margin-top:10px;display:flex;gap:10px;align-items:center;}
.am2-liss{width:74px;height:74px;border-radius:8px;background:radial-gradient(circle,#060d1a,#03060f);border:1px solid #1d2942;}
.am2-corr{flex:1;}
.am2-corr .bar{position:relative;height:12px;border-radius:6px;background:linear-gradient(to right,#ff3b3b,#3a4straight 18%,#16243d 50%,#2c466e 82%,#39d353);box-shadow:inset 0 0 0 1px #1d2942;}
.am2-corr .bar{background:linear-gradient(to right,#ff3b3b 0%,#7a3b1f 22%,#16243d 50%,#1f5a3a 78%,#39d353 100%);}
.am2-corr .ind{position:absolute;top:-3px;width:4px;height:18px;border-radius:2px;background:#fff;box-shadow:0 0 5px #fff;}
.am2-corr .cl{display:flex;justify-content:space-between;font:9px 'Courier New',monospace;color:#6b82a3;margin-top:3px;}

.am2-master{display:flex;flex-direction:column;gap:14px;overflow:auto;}
.am2-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.am2-card h4{margin:0 0 12px;color:#6FC8F0;font-size:13px;letter-spacing:2px;text-transform:uppercase;}
.am2-lufs{font:bold 38px 'Courier New',monospace;color:#cfe6ff;text-align:center;line-height:1;}
.am2-lufs small{display:block;font-size:12px;color:#6b82a3;letter-spacing:2px;margin-top:6px;}
.am2-lhist{display:block;width:100%;height:96px;background:#070f1f;border:1px solid #1d2942;border-radius:8px;margin-top:12px;}
.am2-tp{margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;font:bold 11px sans-serif;letter-spacing:1px;color:#7e93b5;}
.am2-tp .led{width:12px;height:12px;border-radius:50%;background:#1f5a3a;}
.am2-tp.hot{color:#ff6a6a;} .am2-tp.hot .led{background:#ff2b2b;box-shadow:0 0 9px #ff2b2b;}
.am2-vol{display:flex;align-items:center;gap:12px;}
.am2-vol input{flex:1;-webkit-appearance:none;appearance:none;height:18px;border-radius:10px;background:#16243d;box-shadow:inset 0 0 0 1px #2c3e5e;outline:none;cursor:pointer;}
.am2-vol input::-webkit-slider-thumb{-webkit-appearance:none;width:40px;height:28px;border-radius:9px;background:radial-gradient(circle at 40% 35%,#9fdcff,#3f86b6);border:2px solid #001019;cursor:pointer;}
.am2-vol b{font:bold 14px 'Courier New',monospace;color:#fff;width:54px;text-align:right;}
.am2-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.am2-key{padding:16px 6px;border-radius:10px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;font:bold 12px sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-align:center;}
.am2-key:hover{background:#16243d;}
.am2-key.on{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.am2-key.warn.on{background:#ff3b3b;color:#fff;border-color:#ff3b3b;}
.am2-key.dim.on{background:#ffd400;color:#1a1206;border-color:#ffd400;}
`;

export function injectAudioMonitorStyles(): void {
  addStyles('am2-styles', CSS);
}
