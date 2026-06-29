// src/editors/signaling/styles — verbatim port of the legacy
// addStyles('sg-styles', CSS) block from js/editors/signaling.js.
import { addStyles } from '../../ui/dom.js';

const CSS = `
.sg{display:grid;grid-template-columns:240px minmax(0,1fr) 300px;gap:16px;height:100%;}
.sg-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.sg-card h4{margin:0 0 12px;color:#6FC8F0;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.sg-col{display:flex;flex-direction:column;gap:14px;overflow:auto;}
/* On-Air */
.sg-onair{border-radius:14px;padding:26px 10px;text-align:center;font:900 30px sans-serif;letter-spacing:4px;
    background:#16110a;color:#5a4a2a;border:2px solid #2a3a55;transition:.2s;}
.sg-onair.live{background:#3a0808;color:#fff;border-color:#ff2b2b;box-shadow:0 0 26px rgba(255,43,43,.6);animation:sgPulse 1.4s ease-in-out infinite;}
.sg-onair.reh{background:#3a2c08;color:#ffd76b;border-color:#ffd400;box-shadow:0 0 18px rgba(255,212,0,.4);}
@keyframes sgPulse{50%{filter:brightness(1.25)}}
.sg-mode{display:flex;gap:8px;margin-top:14px;}
.sg-mode .b{flex:1;padding:12px;border-radius:9px;border:1px solid #2c3e5e;background:#0c1730;color:#9fb6cc;font:900 12px sans-serif;letter-spacing:1px;cursor:pointer;text-align:center;}
.sg-mode .b.sel{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
/* tally bus */
.sg-bus{display:flex;flex-direction:column;gap:12px;}
.sg-take{align-self:flex-start;padding:12px 26px;border-radius:10px;border:none;background:#ff3b3b;color:#fff;font:900 14px sans-serif;letter-spacing:2px;cursor:pointer;box-shadow:0 0 14px rgba(255,59,59,.5);}
.sg-take:hover{filter:brightness(1.1);}
.sg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.sg-cam{position:relative;border-radius:10px;border:2px solid #33415f;background:#0a1326;padding:14px 8px 10px;text-align:center;}
.sg-cam .nm{font:900 14px sans-serif;color:#cfe6ff;letter-spacing:1px;}
.sg-cam .st{font:bold 9px 'Courier New',monospace;letter-spacing:1px;color:#7e93b5;margin-top:4px;min-height:11px;}
.sg-cam.pgm{border-color:#ff2b2b;box-shadow:0 0 12px rgba(255,43,43,.6);} .sg-cam.pgm .nm{color:#ff6a6a;} .sg-cam.pgm .st{color:#ff6a6a;}
.sg-cam.pvw{border-color:#39d353;} .sg-cam.pvw .nm{color:#7ef29a;} .sg-cam.pvw .st{color:#7ef29a;}
.sg-cam.iso{border-color:#ffd400;} .sg-cam.iso .st{color:#ffd76b;}
.sg-cam .row{display:flex;gap:4px;margin-top:8px;}
.sg-cam .row button{flex:1;padding:5px 0;border-radius:5px;border:1px solid #2c3e5e;background:#0c1730;color:#9fb6cc;font:bold 9px sans-serif;cursor:pointer;}
.sg-cam .row .pgmb:hover{background:#3a0808;color:#ff9a9a;} .sg-cam .row .pvwb:hover{background:#0c3a18;color:#9effb0;} .sg-cam .row .isob:hover{background:#3a2c08;color:#ffd76b;}
/* trigger panel maker */
.sg-trigs{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
.sg-trig{padding:16px 8px;border-radius:10px;border:1px solid #2c3e5e;background:#0c1730;color:#cfe6ff;font:900 11px sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-align:center;}
.sg-trig:hover{background:#16243d;} .sg-trig.fire{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.sg-trig.scte{border-color:#ff6a6a;color:#ff9a9a;} .sg-trig.scte.fire{background:#ff3b3b;color:#fff;border-color:#ff3b3b;}
.sg-add{grid-column:1 / -1;padding:12px;border-radius:10px;border:1px dashed #2c3e5e;background:transparent;color:#6b82a3;font:bold 11px sans-serif;letter-spacing:1px;cursor:pointer;}
.sg-log{margin-top:12px;font:11px 'Courier New',monospace;color:#7e93b5;line-height:1.7;max-height:120px;overflow:auto;}
.sg-log b{color:#cfe6ff;}
`;

export function injectSignalingStyles(): void {
  addStyles('sg-styles', CSS);
}
