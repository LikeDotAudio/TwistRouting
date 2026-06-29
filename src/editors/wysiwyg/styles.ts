// src/editors/wysiwyg/styles — verbatim port of the legacy addStyles('wy-styles') block.

import { addStyles } from '../../ui/dom.js';

export function injectWysiwygStyles(): void {
  addStyles(
    'wy-styles',
    `
.wy{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;height:100%;}
.wy-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:14px;}
.wy-card h4{margin:0 0 10px;color:#6FC8F0;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.wy-stage{position:relative;flex:1;min-height:360px;border-radius:12px;overflow:hidden;background:#05080f;}
.wy-stage canvas{position:absolute;inset:0;width:100%;height:100%;}
.wy-right{display:flex;flex-direction:column;gap:14px;overflow:auto;}
.wy-toggles{display:flex;flex-direction:column;gap:8px;}
.wy-tg{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-radius:9px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;font:bold 12px sans-serif;letter-spacing:1px;cursor:pointer;}
.wy-tg.on{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.wy-fx{display:flex;flex-direction:column;gap:8px;}
.wy-fxr{display:flex;align-items:center;gap:10px;}
.wy-fxr .nm{width:42px;font:bold 12px sans-serif;color:#cfe6ff;}
.wy-fxr input{flex:1;-webkit-appearance:none;height:12px;border-radius:7px;background:#16243d;box-shadow:inset 0 0 0 1px #2c3e5e;outline:none;cursor:pointer;}
.wy-fxr input::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#9cf);border:2px solid #001019;}
.wy-tag{font:10px 'Courier New',monospace;color:#6b82a3;letter-spacing:1px;line-height:1.7;}
.wy-leg{display:flex;align-items:center;gap:6px;font:10px 'Courier New',monospace;color:#9fb6cc;}
.wy-leg i{flex:1;height:10px;border-radius:5px;background:linear-gradient(90deg,#1f3a6e,#21d8c0,#ffe14d,#ff3b3b);}
`,
  );
}
