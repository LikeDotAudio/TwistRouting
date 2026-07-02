// src/editors/graphics-engine/styles — scoped CSS for the Graphics Engine editor.
// Injected once (keyed id). All classes are `gfx-`-prefixed; palette reuses the
// LCARS vars for cohesion. The stage renders broadcast-correct graphics (plates,
// drop shadows, title-safe) so the preview reads like real fill+key on air.

import { addStyles } from '../../ui/dom.js';

export function injectGraphicsStyles(): void {
  addStyles(
    'twist-editor-graphics',
    `
.gfx{display:grid;grid-template-columns:230px minmax(0,1fr) 300px;gap:14px;height:100%;min-height:0;color:#cfe6ff;}
.gfx-col{display:flex;flex-direction:column;gap:10px;min-height:0;}
.gfx-col h4{margin:0;color:#C864C8;font:700 11px 'Courier New',monospace;letter-spacing:2px;text-transform:uppercase;}

/* ---- left rail: rundown / template list ---- */
.gfx-rail{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px;}
.gfx-item{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;cursor:pointer;
  background:#0a1326;border:1px solid #1d2942;font:600 12px sans-serif;letter-spacing:.5px;color:#bcd4ef;
  transition:background .12s,border-color .12s;}
.gfx-item:hover{background:#101d38;border-color:#33486a;}
.gfx-item.sel{background:#1a1030;border-color:#C864C8;color:#f2d9ff;box-shadow:0 0 8px rgba(200,100,200,.35);}
.gfx-item .kind{margin-left:auto;font:10px 'Courier New',monospace;color:#7e93b5;letter-spacing:1px;}
.gfx-empty{color:#7e93b5;font:11px 'Courier New',monospace;padding:8px;}

/* ---- center: stage + lifecycle ---- */
.gfx-center{display:flex;flex-direction:column;gap:12px;min-width:0;}
.gfx-stage-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#03060f;border:1px solid #1d2942;border-radius:12px;
  overflow:hidden;box-shadow:inset 0 0 40px rgba(0,0,0,.6);
  /* checkerboard = the ALPHA the renderer would key over program (audit §4) */
  background-image:linear-gradient(45deg,#0a1020 25%,transparent 25%),linear-gradient(-45deg,#0a1020 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,#0a1020 75%),linear-gradient(-45deg,transparent 75%,#0a1020 75%);
  background-size:36px 36px;background-position:0 0,0 18px,18px -18px,-18px 0;}
.gfx-stage{position:absolute;inset:0;}
.gfx-layer{position:absolute;inset:0;overflow:hidden;}
.gfx-stage-badge{position:absolute;top:8px;left:10px;z-index:9;font:800 10px 'Courier New',monospace;letter-spacing:2px;
  color:#03060f;background:#C864C8;padding:2px 8px;border-radius:5px;}
/* SMPTE ST 2046-1 guides: safe title 90% (5% margins), safe action 93% (3.5%). */
.gfx-safe-action{position:absolute;inset:3.5%;border:1px dashed rgba(111,200,240,.28);pointer-events:none;z-index:8;}
.gfx-safe-title{position:absolute;inset:5%;border:1px dashed rgba(255,214,0,.30);pointer-events:none;z-index:8;}

.gfx-transport{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.gfx-btn{flex:1;min-width:64px;padding:11px 6px;border-radius:9px;border:1px solid #1d2942;background:#0a1326;color:#cfe6ff;
  font:800 12px 'Courier New',monospace;letter-spacing:1.5px;cursor:pointer;transition:filter .1s,background .1s;}
.gfx-btn:hover{filter:brightness(1.25);}
.gfx-btn:disabled{opacity:.35;cursor:not-allowed;filter:none;}
.gfx-btn.take{background:#0f7a39;border-color:#39d353;color:#eaffea;}
.gfx-btn.out{background:#5a1020;border-color:#ff6a6a;color:#ffd7d7;}
.gfx-btn.upd{background:#12324f;border-color:#6FC8F0;}
.gfx-status{display:flex;gap:12px;align-items:center;font:11px 'Courier New',monospace;color:#7e93b5;letter-spacing:1px;}
.gfx-dot{width:9px;height:9px;border-radius:50%;background:#33486a;box-shadow:0 0 0 1px #1d2942;}
.gfx-dot.live{background:#ff2b2b;box-shadow:0 0 8px #ff2b2b;animation:gfxpulse 1.1s ease-in-out infinite;}
@keyframes gfxpulse{50%{opacity:.4;}}

/* ---- right: field editor ---- */
.gfx-fields{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;}
.gfx-field{display:flex;flex-direction:column;gap:4px;}
.gfx-field label{font:10px 'Courier New',monospace;letter-spacing:1px;color:#7e93b5;text-transform:uppercase;}
.gfx-field input,.gfx-field textarea{background:#03060f;border:1px solid #1d2942;border-radius:7px;color:#eaffff;
  font:13px sans-serif;padding:8px 9px;outline:none;resize:vertical;}
.gfx-field input:focus,.gfx-field textarea:focus{border-color:#C864C8;box-shadow:0 0 6px rgba(200,100,200,.3);}
.gfx-field textarea{min-height:74px;font-family:'Courier New',monospace;font-size:12px;line-height:1.5;}
.gfx-hint{font:10px 'Courier New',monospace;color:#546a8c;letter-spacing:.5px;}

/* ================= BROADCAST GRAPHICS (rendered onto the stage) ============= */
.gfx-graphic{position:absolute;inset:0;font-family:'Helvetica Neue',Arial,sans-serif;pointer-events:none;}
/* animate-IN / OUT: transform+opacity only (GPU compositor path, audit §3C) */
.gfx-graphic>*{opacity:0;transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .4s ease;}
.gfx-graphic.on>*{opacity:1;transform:none;}
.gfx-graphic.gfx-out>*{opacity:0;transition:transform .55s ease-in,opacity .5s ease;}
.gfx-updated{animation:gfxflash .45s ease;}
@keyframes gfxflash{0%{filter:brightness(2.2);}100%{filter:brightness(1);}}

/* lower third / name super (audit §2A) */
.gfx-l3-plate{position:absolute;left:5%;bottom:11%;min-width:42%;max-width:70%;padding:12px 20px;border-radius:5px;
  background:linear-gradient(100deg,rgba(200,100,200,.94),rgba(70,40,110,.9));
  box-shadow:0 6px 20px rgba(0,0,0,.55);border-left:5px solid #ffd400;transform:translateX(-24px);}
.gfx-l3-name{font-weight:800;font-size:clamp(16px,3.4vw,30px);color:#fff;letter-spacing:1px;text-shadow:0 2px 6px rgba(0,0,0,.6);}
.gfx-l3-title{font-weight:600;font-size:clamp(10px,1.9vw,16px);color:#ffe9ff;letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
.gfx-l3-loc{font:600 clamp(9px,1.5vw,13px)/'1' 'Courier New',monospace;color:#ffd400;letter-spacing:2px;margin-top:5px;}

/* lists: up-next + participants (staggered entrance, audit §2C) */
.gfx-list-panel{position:absolute;right:6%;top:12%;width:42%;padding:16px;border-radius:10px;
  background:rgba(6,12,26,.86);box-shadow:0 8px 26px rgba(0,0,0,.5);border-top:4px solid #C864C8;}
.gfx-list-head{font-weight:800;font-size:clamp(13px,2.2vw,20px);color:#fff;letter-spacing:2px;margin-bottom:10px;
  text-transform:uppercase;border-bottom:1px solid rgba(200,100,200,.4);padding-bottom:7px;}
.gfx-list-row,.gfx-person-row{display:flex;align-items:center;gap:10px;padding:6px 0;
  font-weight:600;font-size:clamp(11px,1.8vw,16px);color:#eaf3ff;
  transform:translateX(30px);transition-delay:calc(var(--i,0)*.07s)!important;}
.gfx-graphic.on .gfx-list-row,.gfx-graphic.on .gfx-person-row{transform:none;}
.gfx-list-dot{width:8px;height:8px;border-radius:50%;background:#ffd400;flex:0 0 auto;box-shadow:0 0 6px #ffd400;}
.gfx-headshot{width:38px;height:38px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;
  font-weight:800;color:#03060f;background:linear-gradient(135deg,#C864C8,#6FC8F0);}
.gfx-person-txt{display:flex;flex-direction:column;line-height:1.2;}
.gfx-person-txt b{color:#fff;letter-spacing:.5px;}
.gfx-person-txt span{font:600 11px 'Courier New',monospace;color:#C89CE0;letter-spacing:1px;text-transform:uppercase;}

/* bug / DOG (audit §2B) — persistent corner */
.gfx-bug-box{position:absolute;top:6%;right:5%;padding:7px 12px;border-radius:6px;background:rgba(6,12,26,.7);
  backdrop-filter:blur(2px);border:1px solid rgba(200,100,200,.5);text-align:right;transform:translateY(-14px);}
.gfx-bug-box b{color:#fff;font-weight:900;letter-spacing:2px;font-size:clamp(11px,1.8vw,17px);}
.gfx-bug-sub{display:block;color:#ff5a5a;font:800 9px 'Courier New',monospace;letter-spacing:2px;}

/* ticker / crawl (audit §2B) */
.gfx-ticker-bar{position:absolute;left:0;right:0;bottom:6%;height:clamp(26px,5vw,44px);display:flex;align-items:center;
  background:linear-gradient(90deg,rgba(6,12,26,.96),rgba(6,12,26,.9));border-top:2px solid #C864C8;transform:translateY(30px);}
.gfx-ticker-tag{flex:0 0 auto;height:100%;display:flex;align-items:center;padding:0 14px;background:#ff2b2b;color:#fff;
  font-weight:900;letter-spacing:2px;font-size:clamp(10px,1.7vw,15px);}
.gfx-ticker-track{flex:1;overflow:hidden;white-space:nowrap;}
.gfx-ticker-crawl{display:inline-block;padding-left:100%;color:#eaf3ff;font-weight:700;letter-spacing:1px;
  font-size:clamp(11px,1.8vw,16px);animation:gfxcrawl 16s linear infinite;}
@keyframes gfxcrawl{to{transform:translateX(-100%);}}

/* full-screen title (audit §2A) */
.gfx-fs{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
  background:radial-gradient(120% 120% at 50% 30%,rgba(40,20,70,.55),rgba(3,6,15,.9));}
.gfx-fs-title{font-weight:900;font-size:clamp(22px,6vw,58px);color:#fff;letter-spacing:2px;text-shadow:0 4px 18px rgba(200,100,200,.6);
  transform:scale(.9);}
.gfx-fs-sub{font-weight:600;font-size:clamp(11px,2.4vw,22px);color:#ffd400;letter-spacing:4px;text-transform:uppercase;margin-top:10px;}

/* score bug (audit §2B) — update-in-place */
.gfx-score{position:absolute;top:6%;left:50%;transform:translate(-50%,-16px);display:flex;align-items:stretch;
  background:rgba(6,12,26,.92);border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.5);border:1px solid #33486a;}
.gfx-score-team{display:flex;align-items:center;gap:9px;padding:7px 13px;font-weight:800;color:#fff;letter-spacing:1px;}
.gfx-score-name{font-size:clamp(11px,1.8vw,16px);}
.gfx-score-pts{font-size:clamp(14px,2.6vw,22px);color:#ffd400;min-width:22px;text-align:center;}
.gfx-score-clock{display:flex;align-items:center;padding:0 12px;background:#C864C8;color:#03060f;font-weight:900;
  font-family:'Courier New',monospace;letter-spacing:1px;}
`,
  );
}
