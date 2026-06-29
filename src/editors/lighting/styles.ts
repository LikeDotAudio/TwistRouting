// src/editors/lighting/styles — the DMX console CSS, ported verbatim from
// js/editors/lighting.js so the rebuilt pane matches the legacy visuals 1:1.

export const CSS = `
.lt{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;height:100%;}
.lt-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.lt-card h4{margin:0 0 12px;color:#6FC8F0;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
/* the rig diagram */
.lt-stage{position:relative;flex:1;border-radius:12px;overflow:hidden;min-height:340px;
    background:radial-gradient(circle at 50% 42%, #20304a 0%, #0a1322 70%);}
.lt-subj{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:70px;height:104px;border-radius:32px 32px 14px 14px;
    background:linear-gradient(#e7b48a,#b67a52);box-shadow:0 10px 26px rgba(0,0,0,.5);}
.lt-subj::after{content:'';position:absolute;left:50%;top:-34px;transform:translateX(-50%);width:44px;height:44px;border-radius:50%;background:#e7b48a;}
.lt-fix{position:absolute;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:8px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;font:900 10px sans-serif;color:#001019;border:2px solid #001019;box-shadow:0 0 14px currentColor;}
.lt-fix .lbl{position:absolute;top:48px;white-space:nowrap;font:bold 9px 'Courier New',monospace;color:#9fb6cc;letter-spacing:1px;}
.lt-fix.sel{outline:2px solid #fff;}
.lt-beam{position:absolute;inset:0;pointer-events:none;}
/* fixture strips */
.lt-strips{display:flex;flex-direction:column;gap:10px;overflow:auto;}
.lt-strip{display:flex;align-items:center;gap:12px;background:#0c1730;border:1px solid #2c3e5e;border-radius:10px;padding:10px;}
.lt-strip.sel{border-color:#6FC8F0;}
.lt-strip .nm{width:84px;font:bold 12px sans-serif;color:#cfe6ff;} .lt-strip .nm small{display:block;color:#7e93b5;font-weight:normal;font-size:9px;}
.lt-strip .int{flex:1;-webkit-appearance:none;appearance:none;height:14px;border-radius:8px;background:#16243d;box-shadow:inset 0 0 0 1px #2c3e5e;outline:none;cursor:pointer;}
.lt-strip .int::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#cfa);border:2px solid #001019;cursor:pointer;}
.lt-strip .pc{width:40px;text-align:right;font:bold 12px 'Courier New',monospace;color:#fff;}
.lt-strip .ct{width:84px;-webkit-appearance:none;appearance:none;height:14px;border-radius:8px;outline:none;cursor:pointer;
    background:linear-gradient(90deg,#ffd9a0,#fff,#bcd8ff);box-shadow:inset 0 0 0 1px #2c3e5e;}
.lt-strip .ct::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:22px;border-radius:5px;background:#13233c;border:2px solid #fff;cursor:pointer;}
.lt-strip .kv{width:48px;font:11px 'Courier New',monospace;color:#aec6e4;}
.lt-dmx{margin-top:10px;font:11px 'Courier New',monospace;color:#6b82a3;letter-spacing:1px;}
.lt-rcol{display:flex;flex-direction:column;gap:16px;overflow:auto;min-height:0;}
.lt-scenes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.lt-scene{padding:13px 4px;border-radius:8px;border:1px solid #2c3e5e;background:#0c1730;color:#cfe6ff;font:900 10px sans-serif;letter-spacing:1px;cursor:pointer;}
.lt-scene:hover{background:#16243d;} .lt-scene.on{background:#F2B74B;color:#1a1206;border-color:#F2B74B;}
.lt-cues{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px;}
.lt-cue{padding:12px 4px;border-radius:8px;border:1px solid #2c3e5e;background:#0c1730;color:#9fb6cc;font:bold 10px sans-serif;letter-spacing:1px;cursor:pointer;}
.lt-cue:hover{background:#16243d;} .lt-cue.fire{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
`;
