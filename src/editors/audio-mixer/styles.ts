// src/editors/audio-mixer/styles — verbatim port of the legacy
// addStyles('twist-editor-audio-mixer', …) CSS block so the console visuals match 1:1.

import { addStyles } from '../../ui/dom.js';

export function injectAudioMixerStyles(): void {
  addStyles(
    'twist-editor-audio-mixer',
    `
        /* ===== Audio mixer — chunky, finger-friendly console ===== */
        /* LCARS layout: rounded left rail (layer switch + deco elbows) | strips */
        .am-console{display:flex;gap:14px;align-items:stretch;min-height:430px;}
        .am-rail{flex:0 0 158px;display:flex;flex-direction:column;gap:8px;padding:12px 10px;
            background:#0a0f1c;border:2px solid #2c3a5a;border-radius:44px 10px 10px 44px;}
        .am-rail-h{color:var(--cyan,#00ffff);font-size:10px;letter-spacing:2px;font-weight:bold;
            text-align:center;text-transform:uppercase;margin-bottom:2px;}
        .am-layerbtn{padding:16px 10px;border-radius:24px 6px 6px 24px;background:#26324d;color:#cfe0ff;
            font-weight:900;letter-spacing:1px;font-size:14px;text-align:center;cursor:pointer;
            white-space:nowrap;transition:filter .12s,box-shadow .12s,background .12s;}
        .am-layerbtn:hover{filter:brightness(1.12);}
        .am-layerbtn.sel{background:var(--ed-color,#FF9C63);color:#000;box-shadow:0 0 14px rgba(255,156,99,.55);}
        .am-layerbtn.static{cursor:default;}
        /* Decorative LCARS elbow blocks down the rail */
        .am-elbow{flex:0 0 auto;height:30px;border-radius:24px 6px 6px 24px;}
        .am-elbow.a{background:#C67825;} .am-elbow.b{background:#646DCC;} .am-elbow.c{background:#9C6B9C;}
        .am-rail-foot{flex:1 1 auto;min-height:36px;border-radius:6px 6px 44px 6px;background:#16223c;}
        .am-strips{flex:1 1 auto;min-width:0;display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;}
        .am-strip{flex:0 0 auto;width:128px;background:#0d1424;border:1px solid #233150;
            border-radius:12px;padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:12px;}
        .am-strip.master{background:#1a1430;border-color:#4a3a6e;}
        .am-strip.group{border-width:2px;border-style:solid;}
        .am-name{font-size:12px;font-weight:bold;letter-spacing:.5px;text-align:center;width:100%;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#cfe0ff;}
        .am-spill{font-size:11px;font-weight:900;letter-spacing:1px;border:none;border-radius:8px;
            padding:6px 12px;cursor:pointer;background:#2a3a5e;color:#cfe0ff;}
        .am-spill:hover{filter:brightness(1.15);}
        .am-spill.on{background:var(--cyan,#00ffff);color:#000;box-shadow:0 0 10px rgba(0,255,255,.5);}
        .am-knob{width:62px;height:62px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#37456a,#10182b);
            border:3px solid #475a86;position:relative;cursor:ns-resize;box-shadow:0 2px 6px rgba(0,0,0,.5);}
        .am-knob::after{content:'';position:absolute;left:50%;top:6px;width:3px;height:18px;background:var(--cyan,#00ffff);
            transform-origin:50% 25px;transform:translateX(-50%) rotate(var(--rot,0deg));border-radius:2px;}
        .am-klabel{font-size:9px;letter-spacing:1px;color:#7e93b5;margin-top:-6px;}
        /* Stage-box remote-preamp SENS control, revealed with a little magic. */
        .am-sens{position:relative;margin:4px auto 8px;padding:6px 4px 4px;border-radius:10px;
            background:rgba(242,183,75,.1);border:1px solid rgba(242,183,75,.5);display:flex;flex-direction:column;align-items:center;}
        .am-sens-badge{font:bold 8px sans-serif;letter-spacing:1px;color:#F2B74B;margin-bottom:3px;}
        .am-sens-btn{margin-top:2px;width:100%;background:#F2B74B;color:#1a1206;border:none;border-radius:6px;font:bold 9px sans-serif;letter-spacing:1px;padding:7px 6px;cursor:pointer;}
        .am-sens-btn:hover{filter:brightness(1.08);}
        .am-pregain{margin:4px auto 6px;padding:5px 4px;border-radius:9px;background:rgba(242,183,75,.1);border:1px solid rgba(242,183,75,.45);display:flex;flex-direction:column;align-items:center;gap:4px;}
        .am-pregain .am-knob{--cyan:#F2B74B;width:42px;height:42px;border-color:#8a6a26;}
        .am-pregain .am-knob::after{height:12px;top:4px;transform-origin:50% 16px;}
        .am-pre-open{width:100%;background:#13233c;color:#F2B74B;border:1px solid #8a6a26;border-radius:5px;font:bold 8px sans-serif;letter-spacing:.5px;padding:5px 4px;cursor:pointer;}
        .am-pre-open:hover{background:#1b2f4f;}
        .am-sens-reveal{animation:amSens .85s cubic-bezier(.2,1.4,.4,1) both;}
        @keyframes amSens{0%{transform:scale(.15);opacity:0;filter:brightness(3)}55%{transform:scale(1.14)}100%{transform:scale(1);opacity:1;filter:none}}
        .am-sens-reveal::before{content:'';position:absolute;inset:-5px;border-radius:12px;border:2px solid #F2B74B;
            animation:amRing .85s ease-out forwards;pointer-events:none;}
        @keyframes amRing{0%{transform:scale(.4);opacity:.95;box-shadow:0 0 18px #F2B74B}100%{transform:scale(1.9);opacity:0}}
        .am-sens-reveal::after{content:'✦';position:absolute;top:-8px;right:-4px;color:#ffe9b0;font-size:13px;animation:amSpark 1s ease-out forwards;}
        @keyframes amSpark{0%{transform:scale(0) rotate(0);opacity:0}40%{transform:scale(1.4) rotate(90deg);opacity:1}100%{transform:scale(.6) rotate(180deg);opacity:0}}
        .am-eq{display:flex;gap:8px;}
        .am-eq .am-kw{display:flex;flex-direction:column;align-items:center;}
        .am-eq .am-knob{width:40px;height:40px;}
        .am-eq .am-knob::after{height:12px;top:4px;transform-origin:50% 16px;}
        .am-ms{display:flex;gap:8px;}
        .am-ms button{font-size:13px;font-weight:900;letter-spacing:1px;border:none;border-radius:8px;
            padding:8px 16px;cursor:pointer;background:#26324d;color:#cfe0ff;}
        .am-ms button.mute.on{background:#ff3344;color:#fff;box-shadow:0 0 12px rgba(255,51,68,.6);}
        .am-ms button.solo.on{background:#f5c542;color:#000;box-shadow:0 0 12px rgba(245,197,66,.6);}
        .am-fadarea{display:flex;gap:10px;align-items:flex-end;height:240px;}
        .am-fader{-webkit-appearance:none;appearance:none;writing-mode:vertical-lr;direction:rtl;
            width:46px;height:230px;border-radius:24px;border:2px solid #34507a;cursor:grab;
            background:linear-gradient(#0c1830,#16223c);box-shadow:inset 0 0 14px rgba(0,0,0,.6);}
        .am-fader:active{cursor:grabbing;}
        .am-fader::-webkit-slider-thumb{-webkit-appearance:none;width:60px;height:34px;border-radius:9px;
            background:linear-gradient(#eef4ff,#b9c8e6);border:2px solid #fff;cursor:grab;
            box-shadow:0 3px 6px rgba(0,0,0,.55),0 0 8px rgba(207,224,255,.5);}
        .am-fader::-moz-range-thumb{width:60px;height:34px;border-radius:9px;background:#cfe0ff;border:2px solid #fff;cursor:grab;}
        .am-strip.master .am-fader::-webkit-slider-thumb{background:linear-gradient(#e8d8ff,#c3a8ff);}
        .am-vu{width:16px;height:230px;border-radius:5px;background:#0c1322;overflow:hidden;display:flex;flex-direction:column-reverse;}
        .am-vu > i{display:block;width:100%;height:0%;background:linear-gradient(#19c54b,#e6e23a 70%,#ff3b3b);}
        .am-db{font-size:11px;font-weight:bold;color:#9fb6cc;}
        /* EQ + PAN + sends bank — collapses ("tucks up") on spilled sub-strips */
        .am-rotaries{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;
            overflow:hidden;max-height:520px;opacity:1;transition:max-height .28s ease,opacity .2s ease;}
        .am-rotaries.tucked{max-height:0;opacity:0;gap:0;}
        /* Aux sends — two banks: MM (mix-minus) + MONITOR, 4 each */
        .am-aux{width:100%;}
        .am-aux-h{font-size:8px;letter-spacing:1px;color:#7e93b5;text-align:center;margin-bottom:5px;text-transform:uppercase;}
        .am-aux-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px 2px;justify-items:center;}
        .am-aux .am-knob{width:28px;height:28px;border-width:2px;}
        .am-aux .am-knob::after{height:9px;top:3px;transform-origin:50% 11px;}
        .am-aux .am-klabel{font-size:7px;margin-top:-3px;white-space:nowrap;}
        /* MASTER as its own always-visible tab pinned to the right of the console */
        .am-master-tab{flex:0 0 auto;align-self:stretch;display:flex;flex-direction:column;
            background:#160f2a;border:2px solid #4a3a6e;border-radius:10px 44px 44px 10px;padding:12px 14px;}
        .am-master-h{color:#d8c8ff;font-size:11px;letter-spacing:2px;font-weight:900;text-align:center;
            text-transform:uppercase;margin-bottom:8px;}
        .am-master-tab .am-strip.master{border:none;background:transparent;padding:0;}
        .am-master-tab .am-strip.master .am-name{display:none;}
        /* Sub-mix breakout (a spilled group's individual channels) */
        .am-submix{margin-top:16px;background:#0a1120;border:1px solid #2c3a5a;border-left:5px solid var(--cyan,#00ffff);
            border-radius:6px 14px 14px 6px;padding:12px 14px;}
        .am-submix-h{display:flex;justify-content:space-between;align-items:center;color:var(--cyan,#00ffff);
            font-size:12px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;text-transform:uppercase;}
        .am-submix-close{cursor:pointer;color:#9fb6cc;font-size:11px;font-weight:900;}
        .am-submix-close:hover{color:#fff;}
        .am-substrips .am-strip{background:#0e1730;}
    `,
  );
}
