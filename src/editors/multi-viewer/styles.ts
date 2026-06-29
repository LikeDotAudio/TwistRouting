// src/editors/multi-viewer/styles — verbatim port of the legacy
// addStyles('twist-editor-multi-viewer', …) CSS block so visuals match 1:1.

import { addStyles } from '../../ui/dom.js';

export function injectMultiViewerStyles(): void {
  addStyles(
    'twist-editor-multi-viewer',
    `
        /* ===== Multi viewer ===== */
        /* LCARS elbow frame around the whole wall: left spine + top rail. */
        .mv-frame{position:relative;padding:62px 4px 18px 80px;margin-top:4px;}
        .mv-frame::before{content:'';position:absolute;top:0;left:0;width:150px;height:100%;
            border-left:64px solid var(--ed-color,#A06EB4);border-top:26px solid var(--ed-color,#A06EB4);
            border-top-left-radius:46px;border-bottom-left-radius:46px;box-sizing:border-box;z-index:0;}
        .mv-frame::after{content:'';position:absolute;top:0;left:160px;right:0;height:26px;
            background:var(--ed-color,#A06EB4);border-radius:0 12px 12px 0;z-index:0;}
        .mv-frame > *{position:relative;z-index:1;}
        .mv-frame-label{position:absolute;left:8px;top:34px;width:60px;text-align:center;z-index:1;
            font-size:10px;font-weight:900;letter-spacing:1px;color:#000;line-height:1.2;}
        .mv-presets{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
        .mv-pbtn{padding:9px 16px;border-radius:16px;background:#16223c;border:1px solid #2c3a5a;
            color:#cfe0ff;cursor:pointer;font-weight:bold;letter-spacing:1px;font-size:12px;}
        .mv-pbtn.sel{background:var(--cyan,#00ffff);color:#000;border-color:#fff;}
        .mv-grid{display:grid;gap:10px;}
        .mv-grid.compact{gap:4px;}
        .mv-win{background:#05080f;border:3px solid #2a3550;border-radius:6px;min-height:120px;
            display:flex;flex-direction:column;overflow:hidden;cursor:grab;position:relative;}
        .mv-grid.compact .mv-win{min-height:0;border-width:2px;border-radius:4px;aspect-ratio:16/9;}
        .mv-tile{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;
            letter-spacing:.5px;color:#7e93b5;text-align:center;padding:2px;height:100%;
            background:repeating-linear-gradient(45deg,#070b14 0 8px,#0a0f1c 8px 16px);}
        .mv-win.empty{border-color:#1a2336;opacity:.5;cursor:default;}
        .mv-win.pgm{border-color:#ff3344;box-shadow:0 0 0 1px #ff3344, 0 0 16px rgba(255,51,68,.5);}
        .mv-win.pvw{border-color:#33dd66;box-shadow:0 0 0 1px #33dd66, 0 0 16px rgba(51,221,102,.45);}
        .mv-win.dragging{opacity:.4;}
        .mv-screen{flex:1;display:flex;align-items:center;justify-content:center;color:#56708f;
            font-size:13px;letter-spacing:1px;background:repeating-linear-gradient(45deg,#070b14 0 10px,#0a0f1c 10px 20px);}
        .mv-meter{position:absolute;right:5px;top:8px;bottom:26px;width:7px;border-radius:3px;
            background:#0c1322;overflow:hidden;display:flex;flex-direction:column-reverse;}
        .mv-meter > i{display:block;background:linear-gradient(#19c54b,#e6e23a 70%,#ff3b3b);width:100%;height:0%;}
        .mv-umd{flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:24px;
            font-weight:bold;font-size:12px;letter-spacing:1px;color:#000;background:var(--umd,#9fb6cc);}
        .mv-umd[contenteditable]:focus{outline:2px solid var(--cyan);}
        .mv-tally{position:absolute;top:6px;left:6px;font-size:9px;font-weight:900;letter-spacing:1px;
            padding:1px 6px;border-radius:3px;background:#33405e;color:#cfe0ff;}
        .mv-win.pgm .mv-tally{background:#ff3344;color:#fff;}
        .mv-win.pvw .mv-tally{background:#33dd66;color:#000;}
    `,
  );
}
