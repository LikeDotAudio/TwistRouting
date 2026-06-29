// js/editors/camera/styles.js — all CSS for the CCU/RCP console.
export const CSS = `
.cc-wrap{display:grid;grid-template-columns:minmax(0,1fr) 470px;grid-template-rows:minmax(0,1fr) auto;gap:16px;height:100%;}

/* ---- the glass (everything overlaid) ---- */
.cc-glass{grid-column:1;grid-row:1;position:relative;background:#03060f;border:1px solid #1d2942;border-radius:12px;overflow:hidden;min-height:320px;}
/* the "video" is a true 1:1 square, centred, with the scopes/maps overlaid on it */
.cc-video{position:absolute;top:0;bottom:130px;left:50%;transform:translateX(-50%);aspect-ratio:1/1;overflow:hidden;background:#03060f;box-shadow:0 0 0 1px #11203a;}
.cc-scene{position:absolute;inset:0;transition:filter .12s;}
.cc-scene::before{content:'';position:absolute;inset:0;
    background:
      radial-gradient(120px 120px at var(--sx,50%) 40%, #ffe9b0 0%, #caa15a 30%, transparent 70%),
      linear-gradient(180deg,#23406b 0%,#16263f 55%,#0a1322 100%);}
.cc-subject{position:absolute;left:var(--subx,50%);top:54%;transform:translate(-50%,-50%);
    width:64px;height:96px;border-radius:30px 30px 12px 12px;background:linear-gradient(#e7b48a,#b67a52);
    box-shadow:0 8px 24px rgba(0,0,0,.5);transition:left .1s linear;}
.cc-subject::after{content:'';position:absolute;left:50%;top:-30px;transform:translateX(-50%);width:40px;height:40px;border-radius:50%;background:#e7b48a;}
.cc-smpte{position:absolute;inset:0;display:none;} .cc-smpte.on{display:block;}
/* the bouncing DVD-style lineage logo (parent › child › grandchild) */
.cc-dvd{position:absolute;left:0;top:0;display:none;padding:6px 12px;border:2px solid currentColor;border-radius:7px;
    font:900 13px 'Courier New',monospace;letter-spacing:1px;color:#fff;white-space:nowrap;z-index:6;pointer-events:none;
    background:rgba(0,0,0,.35);text-shadow:0 0 6px rgba(0,0,0,.8);box-shadow:0 0 12px currentColor;}
.cc-dvd.on{display:block;}

.cc-osd{position:absolute;left:50%;transform:translateX(-50%);top:8px;font:bold 12px 'Courier New',monospace;color:#caffd6;letter-spacing:1px;text-shadow:0 0 4px #000;z-index:5;}
.cc-rec{position:absolute;right:14px;top:8px;color:#ff5b5b;font:bold 12px 'Courier New',monospace;z-index:5;display:none;}
.cc-rec.on{display:block;animation:ccBlink 1s steps(2) infinite;}
@keyframes ccBlink{50%{opacity:.2;}}

/* RGB PARADE waveform monitor — overlaid at the bottom */
.cc-wf{position:absolute;left:0;right:0;bottom:0;height:130px;background:rgba(0,6,12,.66);border-top:1px solid #1d3354;z-index:3;}
.cc-wf-tag{position:absolute;left:30px;bottom:110px;z-index:4;font:bold 10px 'Courier New',monospace;letter-spacing:2px;color:#6FC8F0;}
.cc-vec{position:absolute;right:10px;top:26px;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle,rgba(0,0,0,.6),rgba(0,0,0,.85));border:1px solid #2c3e5e;z-index:4;}
.cc-vec .dot{position:absolute;width:8px;height:8px;border-radius:50%;background:#ffe14d;box-shadow:0 0 6px #ffe14d;left:50%;top:50%;transition:transform .12s;}
.cc-vec .cross{position:absolute;inset:0;}
.cc-vec .cross::before,.cc-vec .cross::after{content:'';position:absolute;background:#2c3e5e;}
.cc-vec .cross::before{left:50%;top:6%;bottom:6%;width:1px;} .cc-vec .cross::after{top:50%;left:6%;right:6%;height:1px;}

/* robotics maps — translucent overlays */
.cc-map{position:absolute;left:10px;z-index:4;border:1px solid rgba(111,200,240,.32);border-radius:8px;overflow:hidden;background:rgba(3,9,18,.5);}
.cc-map.top{top:30px;width:216px;height:150px;} .cc-map.side{top:190px;width:216px;height:118px;}
.cc-map .lbl{position:absolute;left:7px;top:4px;z-index:2;font:bold 8px 'Courier New',monospace;letter-spacing:1px;color:#6FC8F0;}
.cc-map svg{width:100%;height:100%;}

/* ---- right rail ---- */
.cc-rail{grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:14px;overflow:auto;padding-right:4px;}
.cc-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.cc-card h4{margin:0 0 12px;color:#6FC8F0;font-size:13px;letter-spacing:2px;text-transform:uppercase;}
.cc-knobs{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
.cc-kn{display:flex;flex-direction:column;align-items:center;gap:6px;}

/* motorized rotary encoder: notched bezel, glowing value arc, metallic cap, lit pointer */
.cc-dial{width:80px;height:80px;border-radius:50%;position:relative;cursor:ns-resize;touch-action:none;
    background:repeating-conic-gradient(from -136deg,#33486a 0 1.5deg,transparent 1.5deg 14deg), #070f1f;box-shadow:0 5px 13px rgba(0,0,0,.55);}
.cc-dial::before{content:'';position:absolute;inset:9%;border-radius:50%;
    background:conic-gradient(from 225deg,var(--c,#6FC8F0) calc(var(--p,50%) * 0.75),#15233c 0);
    -webkit-mask:radial-gradient(circle,transparent 53%,#000 55%);mask:radial-gradient(circle,transparent 53%,#000 55%);filter:drop-shadow(0 0 5px var(--c,#6FC8F0));}
.cc-dial::after{content:'';position:absolute;inset:24%;border-radius:50%;background:radial-gradient(circle at 42% 32%,#41618a,#13233c 72%);
    box-shadow:inset 0 2px 5px rgba(255,255,255,.2),inset 0 -3px 6px rgba(0,0,0,.55),0 2px 5px rgba(0,0,0,.5);}
.cc-dial .ptr{position:absolute;left:50%;top:50%;width:4px;height:36%;border-radius:3px;background:var(--c,#6FC8F0);box-shadow:0 0 6px var(--c,#6FC8F0);
    transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(var(--rot,0deg));z-index:2;}
.cc-kn span{font-size:11px;color:#9fb6cc;letter-spacing:.5px;text-align:center;} .cc-kn b{font:bold 13px 'Courier New',monospace;color:#cfe6ff;}

/* RGB Venn: spread gains form the outer triangle, blacks cluster in the middle */
.cc-venn{position:relative;width:380px;height:350px;margin:16px auto 4px;}
.cc-venn-bg{position:absolute;inset:0;pointer-events:none;}
.cc-venn-bg span{position:absolute;width:210px;height:210px;border-radius:50%;mix-blend-mode:screen;opacity:.4;filter:blur(4px);}
.cc-venn-bg .r{background:#ff2d2d;left:-5px;top:5px;} .cc-venn-bg .g{background:#1fd83a;left:175px;top:5px;} .cc-venn-bg .b{background:#2d6bff;left:85px;top:150px;}
.cc-venn .slot{position:absolute;transform:translate(-50%,-50%);}
.cc-venn .slot .cc-dial{width:74px;height:74px;}
.cc-venn .slot.blk .cc-dial{width:46px;height:46px;}
.cc-venn .slot .cc-kn{gap:3px;} .cc-venn .slot.blk .cc-kn b,.cc-venn .slot.blk .cc-kn span{font-size:10px;}

/* joystick + sliders */
.cc-stick{position:relative;width:230px;height:230px;margin:6px auto;border-radius:50%;background:radial-gradient(circle,#16243d,#0a1326);border:3px solid #2c3e5e;touch-action:none;cursor:grab;}
.cc-stick .puck{position:absolute;left:50%;top:50%;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#9fdcff,#3f86b6);box-shadow:0 8px 18px rgba(0,0,0,.6);transform:translate(-50%,-50%);}
.cc-stick .puck::after{content:'';position:absolute;inset:30%;border-radius:50%;border:2px solid rgba(255,255,255,.35);}
.cc-stick .ring{position:absolute;inset:20px;border-radius:50%;border:2px dashed #2c3e5e;}
/* Ped (left) + joystick + Zoom (right) on a row; Dolly is the full-width rail below */
.cc-jsgrid{display:grid;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;gap:14px 12px;align-items:center;justify-items:center;}
.cc-vside{display:flex;flex-direction:column;align-items:center;gap:8px;}
.cc-vside label{font-size:13px;font-weight:900;color:#9fb6cc;letter-spacing:2px;}
.cc-vbar{-webkit-appearance:none;appearance:none;writing-mode:vertical-lr;direction:rtl;width:30px;height:210px;border-radius:16px;background:#16243d;box-shadow:inset 0 0 0 1px #2c3e5e;outline:none;cursor:pointer;}
.cc-vbar::-webkit-slider-thumb{-webkit-appearance:none;width:42px;height:34px;border-radius:9px;background:radial-gradient(circle at 40% 35%,#9fdcff,#3f86b6);border:2px solid #001019;cursor:pointer;box-shadow:0 3px 8px rgba(0,0,0,.5);}
.cc-vbar::-moz-range-thumb{width:42px;height:34px;border-radius:9px;background:radial-gradient(circle at 40% 35%,#9fdcff,#3f86b6);border:2px solid #001019;cursor:pointer;}
.cc-dollybar{grid-column:1 / -1;width:100%;display:flex;align-items:center;gap:12px;}
.cc-dollybar label{font-size:13px;font-weight:900;color:#9fb6cc;letter-spacing:2px;width:60px;}
.cc-dollybar input{flex:1;-webkit-appearance:none;appearance:none;height:22px;border-radius:13px;background:#16243d;box-shadow:inset 0 0 0 1px #2c3e5e;outline:none;cursor:pointer;}
.cc-dollybar input::-webkit-slider-thumb{-webkit-appearance:none;width:48px;height:34px;border-radius:11px;background:radial-gradient(circle at 40% 35%,#9fdcff,#3f86b6);border:2px solid #001019;cursor:pointer;box-shadow:0 3px 8px rgba(0,0,0,.5);}
.cc-dollybar input::-moz-range-thumb{width:48px;height:34px;border-radius:11px;background:radial-gradient(circle at 40% 35%,#9fdcff,#3f86b6);border:2px solid #001019;cursor:pointer;}
.cc-hint{font-size:11px;color:#6b82a3;margin-top:6px;letter-spacing:.5px;text-align:center;}

.cc-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.cc-key{padding:16px 6px;border-radius:10px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-align:center;}
.cc-key:hover{background:#16243d;} .cc-key.on{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.cc-tel{font:14px 'Courier New',monospace;color:#aee0ff;line-height:1.9;} .cc-tel b{color:#fff;}

/* ---- footer ---- */
.cc-foot{grid-column:1 / -1;grid-row:2;display:flex;gap:16px;align-items:stretch;}
.cc-foot .cc-card{flex:1;min-width:0;}
.cc-tallies{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;}
.cc-tally{flex:1;min-width:64px;height:58px;border-radius:9px;border:2px solid #33415f;background:#0a1326;color:#9fb6cc;font-weight:900;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;}
.cc-tally .st{position:absolute;top:5px;right:6px;width:10px;height:10px;border-radius:50%;background:#33415f;}
.cc-tally.sel{outline:2px solid #6FC8F0;color:#fff;}
.cc-tally.live{border-color:#ff3b3b;color:#ff6a6a;} .cc-tally.live .st{background:#ff3b3b;box-shadow:0 0 8px #ff3b3b;}
.cc-tally.pvw{border-color:#39d353;color:#7ef29a;} .cc-tally.pvw .st{background:#39d353;}
.cc-foot .cc-pre{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;}
.cc-foot .cc-pre .cc-key{padding:18px 6px;font-size:15px;} .cc-foot .cc-pre .cc-key.set{border-color:#39d353;color:#7ef29a;}
.cc-foot .cc-keys{margin-top:10px;max-width:460px;}
`;
