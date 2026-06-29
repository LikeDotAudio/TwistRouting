// src/editors/ifb/styles — verbatim port of the legacy addStyles('ifb-styles', …)
// CSS block from js/editors/ifb.js so the IFB visuals match 1:1.

import { addStyles } from '../../ui/dom.js';

export function injectIfbStyles(): void {
  addStyles(
    'ifb-styles',
    `
.ifb{display:grid;grid-template-columns:200px minmax(0,1fr) 320px;gap:16px;height:100%;}
.ifb-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.ifb-card h4{margin:0 0 12px;color:#6FC8F0;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.ifb-ins{display:flex;flex-direction:column;gap:16px;}
.ifb-strip{display:flex;gap:12px;align-items:flex-end;}
.ifb-meter{position:relative;width:26px;height:150px;border-radius:5px;overflow:hidden;box-shadow:inset 0 0 0 1px #1d2942;
    background:linear-gradient(to top,#0f7a39,#39d353 55%,#ffd400 80%,#ff2b2b 100%);}
.ifb-meter .mask{position:absolute;left:0;right:0;top:0;background:#070f1f;}
.ifb-stripinfo b{display:block;font:bold 12px sans-serif;color:#cfe6ff;letter-spacing:1px;}
.ifb-stripinfo span{font:10px 'Courier New',monospace;color:#7e93b5;}

/* confidence feed (centre) */
.ifb-conf{position:relative;flex:1;display:flex;flex-direction:column;}
.ifb-feed{flex:1;position:relative;background:#03060f;border:1px solid #1d2942;border-radius:10px;overflow:hidden;min-height:200px;}
.ifb-feed canvas{position:absolute;inset:0;width:100%;height:100%;}
.ifb-status{position:absolute;left:50%;top:14px;transform:translateX(-50%);font:900 16px sans-serif;letter-spacing:3px;z-index:2;
    color:#39d353;text-shadow:0 0 8px rgba(0,0,0,.7);}
.ifb-status.talk{color:#ff6a6a;animation:ifbB 1s steps(2) infinite;}
@keyframes ifbB{50%{opacity:.35;}}
.ifb-duckwrap{margin-top:12px;}
.ifb-duck{position:relative;height:64px;background:#070f1f;border:1px solid #1d2942;border-radius:8px;overflow:hidden;}
.ifb-duck canvas{position:absolute;inset:0;width:100%;height:100%;}
.ifb-cap{font:bold 10px 'Courier New',monospace;color:#6FC8F0;letter-spacing:1px;margin:4px 2px;}

/* right: encoders + talk hierarchy */
.ifb-right{display:flex;flex-direction:column;gap:14px;overflow:auto;}
.ifb-knobs{display:flex;justify-content:space-around;}
.ifb-kn{display:flex;flex-direction:column;align-items:center;gap:7px;}
.ifb-dial{width:84px;height:84px;border-radius:50%;position:relative;cursor:ns-resize;touch-action:none;
    background:repeating-conic-gradient(from -136deg,#33486a 0 1.5deg,transparent 1.5deg 14deg),#070f1f;box-shadow:0 5px 13px rgba(0,0,0,.55);}
.ifb-dial::before{content:'';position:absolute;inset:9%;border-radius:50%;background:conic-gradient(from 225deg,var(--c,#6FC8F0) calc(var(--p,50%) * 0.75),#15233c 0);
    -webkit-mask:radial-gradient(circle,transparent 53%,#000 55%);mask:radial-gradient(circle,transparent 53%,#000 55%);filter:drop-shadow(0 0 5px var(--c,#6FC8F0));}
.ifb-dial::after{content:'';position:absolute;inset:24%;border-radius:50%;background:radial-gradient(circle at 42% 32%,#41618a,#13233c 72%);box-shadow:inset 0 2px 5px rgba(255,255,255,.2),0 2px 5px rgba(0,0,0,.5);}
.ifb-dial i{position:absolute;left:50%;top:50%;width:4px;height:36%;border-radius:3px;background:var(--c,#6FC8F0);box-shadow:0 0 6px var(--c,#6FC8F0);transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(var(--rot,0deg));}
.ifb-kn b{font:bold 13px 'Courier New',monospace;color:#cfe6ff;} .ifb-kn span{font-size:11px;color:#9fb6cc;}
.ifb-talks{display:flex;flex-direction:column;gap:10px;}
.ifb-talk{display:flex;align-items:center;gap:12px;padding:14px;border-radius:10px;border:1px solid #2c3e5e;background:#0c1730;cursor:pointer;user-select:none;}
.ifb-talk .pr{width:34px;height:34px;border-radius:8px;background:#13233c;color:#9fb6cc;font:900 14px sans-serif;display:flex;align-items:center;justify-content:center;}
.ifb-talk .nm{flex:1;font:bold 13px sans-serif;color:#cfe6ff;letter-spacing:1px;} .ifb-talk .nm small{display:block;color:#7e93b5;font-weight:normal;letter-spacing:0;}
.ifb-talk.on{background:#ff3b3b;border-color:#ff3b3b;} .ifb-talk.on .pr{background:#000;color:#ff9a9a;} .ifb-talk.on .nm{color:#fff;}
.ifb-talk.p1.on{box-shadow:0 0 14px rgba(255,59,59,.7);}
`,
  );
}
