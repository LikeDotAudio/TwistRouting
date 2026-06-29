// src/editors/stagebox-input/styles — verbatim port of the legacy
// addStyles('sb-styles', …) CSS block so the Stage Box Input visuals match 1:1.

import { addStyles } from '../../ui/dom.js';

const CSS = `
.sb{display:grid;grid-template-columns:300px minmax(0,1fr) 280px;gap:16px;height:100%;}
.sb-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.sb-card h4{margin:0 0 12px;color:#6FC8F0;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.sb-col{display:flex;flex-direction:column;gap:14px;overflow:auto;}
.sb-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;font-size:13px;color:#aec6e4;}
.sb-row b{color:#fff;font-family:'Courier New',monospace;}
.sb-alias{width:100%;box-sizing:border-box;background:#070f1f;border:1px solid #2c3e5e;border-radius:8px;color:#fff;font:bold 15px 'Courier New',monospace;padding:9px 12px;letter-spacing:1px;}
.sb-sel{width:100%;box-sizing:border-box;background:#070f1f;border:1px solid #2c3e5e;border-radius:8px;color:#cfe6ff;font:13px sans-serif;padding:9px;}
.sb-knrow{display:flex;justify-content:space-around;margin:6px 0;}
.sb-kn{display:flex;flex-direction:column;align-items:center;gap:7px;}
.sb-dial{width:84px;height:84px;border-radius:50%;position:relative;cursor:ns-resize;touch-action:none;
    background:repeating-conic-gradient(from -136deg,#33486a 0 1.5deg,transparent 1.5deg 14deg),#070f1f;box-shadow:0 5px 13px rgba(0,0,0,.55);}
.sb-dial::before{content:'';position:absolute;inset:9%;border-radius:50%;background:conic-gradient(from 225deg,var(--c,#6FC8F0) calc(var(--p,50%) * 0.75),#15233c 0);
    -webkit-mask:radial-gradient(circle,transparent 53%,#000 55%);mask:radial-gradient(circle,transparent 53%,#000 55%);filter:drop-shadow(0 0 5px var(--c,#6FC8F0));}
.sb-dial::after{content:'';position:absolute;inset:24%;border-radius:50%;background:radial-gradient(circle at 42% 32%,#41618a,#13233c 72%);box-shadow:inset 0 2px 5px rgba(255,255,255,.2),0 2px 5px rgba(0,0,0,.5);}
.sb-dial i{position:absolute;left:50%;top:50%;width:4px;height:36%;border-radius:3px;background:var(--c,#6FC8F0);box-shadow:0 0 6px var(--c,#6FC8F0);transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(var(--rot,0deg));}
.sb-kn b{font:bold 14px 'Courier New',monospace;color:#cfe6ff;} .sb-kn span{font-size:11px;color:#9fb6cc;}
.sb-key{display:block;width:100%;padding:14px;border-radius:10px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;font:bold 13px sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-align:center;margin-top:10px;}
.sb-key.on{background:#39d353;color:#04140a;border-color:#39d353;box-shadow:0 0 10px rgba(57,211,83,.5);}
.sb-key.conf.on{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.sb-warn{margin-top:10px;padding:10px;border-radius:8px;background:rgba(255,59,59,.12);border:1px solid #ff3b3b;color:#ff9a9a;font:bold 11px sans-serif;display:none;}
.sb-warn.on{display:block;}
/* centre: meter + history */
.sb-mid{display:flex;flex-direction:column;gap:14px;}
.sb-metwrap{display:flex;gap:16px;align-items:stretch;flex:0 0 auto;}
.sb-meter{position:relative;width:34px;height:200px;border-radius:6px;overflow:hidden;box-shadow:inset 0 0 0 1px #1d2942;
    background:linear-gradient(to top,#0f7a39,#39d353 55%,#ffd400 80%,#ff2b2b 100%);}
.sb-meter .mask{position:absolute;left:0;right:0;top:0;background:#070f1f;}
.sb-meter .pk{position:absolute;left:0;right:0;height:2px;background:#fff;}
.sb-headroom{flex:1;font:13px 'Courier New',monospace;color:#aec6e4;line-height:2;}
.sb-headroom b{color:#fff;} .sb-headroom .hot{color:#ff6a6a;}
.sb-hist{flex:1;position:relative;background:#03060f;border:1px solid #1d2942;border-radius:10px;overflow:hidden;min-height:150px;}
.sb-hist canvas{position:absolute;inset:0;width:100%;height:100%;}
.sb-hist .cap{position:absolute;left:8px;top:6px;font:bold 10px 'Courier New',monospace;color:#6FC8F0;letter-spacing:1px;z-index:2;}
/* channel jump bar */
.sb-nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:0 0 auto;}
.sb-nav .orig{font:bold 11px 'Courier New',monospace;color:#6FC8F0;letter-spacing:1px;margin-right:8px;}
.sb-tab{padding:9px 15px;border-radius:8px;border:1px solid #2c3e5e;background:#0c1730;color:#9fb6cc;font:bold 12px sans-serif;letter-spacing:1px;cursor:pointer;}
.sb-tab:hover{background:#16243d;}
.sb-tab.sel{background:#F2B74B;color:#1a1206;border-color:#F2B74B;}
.sb-bankl{font:bold 11px 'Courier New',monospace;color:#F2B74B;letter-spacing:1px;margin-right:4px;}
.sb-arrow{padding:9px 13px;border-radius:8px;border:1px solid #2c3e5e;background:#0c1730;color:#cfe6ff;font:900 13px sans-serif;cursor:pointer;}
.sb-arrow:hover{background:#16243d;}
.sb-slope{flex:1;padding:8px 4px;border-radius:6px;border:1px solid #2c3e5e;background:#0c1730;color:#9fb6cc;font:bold 10px sans-serif;letter-spacing:.5px;cursor:pointer;}
.sb-slope:hover{background:#16243d;} .sb-slope.sel{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.sb-host .sb{height:100%;}
/* bank quad — 4 channels at 1/4 screen each */
.sb-bankgrid{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:12px;overflow:auto;}
.sb-host{position:relative;min-width:0;min-height:0;overflow:auto;border:1px solid #1d2942;border-radius:10px;}
.sb-cell-tag{position:absolute;right:8px;top:6px;z-index:6;background:#F2B74B;color:#1a1206;font:900 11px sans-serif;letter-spacing:1px;border-radius:6px;padding:3px 9px;pointer-events:none;}
/* HPF response chart */
.sb-hpchart{width:100%;height:84px;margin-top:10px;background:#070f1f;border:1px solid #1d2942;border-radius:8px;display:block;}
`;

export function injectStageBoxStyles(): void {
  addStyles('sb-styles', CSS);
}
