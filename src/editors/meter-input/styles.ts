// src/editors/meter-input/styles — CSS for the (real-video) Meter Input editor.
// LCARS "okudagram" chrome: an EDIT DETECTOR title tab, colour-accented SOURCE /
// PRESETS / SENS button groups, pill buttons, and solid-colour card headers.
import { addStyles } from '../../ui/dom.js';

export function injectMeterInputStyles(): void {
  addStyles('meter-input-styles', `
.mi{display:flex;flex-direction:column;gap:12px;height:100%;}
/* ── LCARS top bar ─────────────────────────────────────────────────────── */
.mi-bar{display:flex;flex-direction:column;gap:10px;}
.mi-bar-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;}
.mi-bar-stat{justify-content:flex-end;}
.mi-title{font:900 14px sans-serif;letter-spacing:3px;text-transform:uppercase;color:#1a1206;
    background:#f2a25a;padding:9px 22px;border-radius:6px 6px 6px 18px;white-space:nowrap;}
.mi-title-line{flex:1 1 60px;min-width:40px;height:14px;border-radius:7px;background:#f2a25a;opacity:.85;}
.mi-grp{display:flex;align-items:center;gap:12px;padding:8px 14px 8px 0;border-radius:10px;
    position:relative;overflow:hidden;background:rgba(var(--acc),.07);}
.mi-grp::before{content:'';position:absolute;left:0;top:0;bottom:0;width:9px;background:rgb(var(--acc));}
.mi-grp-lbl{margin-left:24px;font:900 11px sans-serif;letter-spacing:2px;text-transform:uppercase;color:rgb(var(--acc));}
.mi-grp-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.mi-grp-src{--acc:224,150,60;} .mi-grp-pre{--acc:186,150,214;} .mi-grp-sens{--acc:224,110,90;}
.mi-pill{font:bold 11px sans-serif;letter-spacing:1px;text-transform:uppercase;padding:8px 15px;border-radius:14px;
    border:none;background:#1b2740;color:#cbd8ef;cursor:pointer;white-space:nowrap;transition:filter .15s,background .15s;}
.mi-pill:hover{filter:brightness(1.28);}
.mi-pill.on{background:rgb(var(--acc,224,150,60));color:#161006;box-shadow:0 0 10px rgba(var(--acc,224,150,60),.5);}
.mi-url{font:11px monospace;background:#0c1322;color:#cfe6ff;border:1px solid #2c3e5e;border-radius:12px;padding:8px 12px;min-width:200px;}
.mi-stat{font:11px sans-serif;color:#e6a13a;}
/* ── floating cards ────────────────────────────────────────────────────── */
.mi-vidcard,.mi-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:10px 12px 12px;
    display:flex;flex-direction:column;gap:8px;box-shadow:0 6px 18px rgba(0,0,0,.4);min-width:200px;}
.mi-vidcard{min-height:140px;} .mi-card{min-height:120px;}
.mi-vidcard h4,.mi-card h4{margin:-10px -12px 6px;padding:7px 12px;background:var(--hc,#3a5573);color:#0a1120;
    font:900 11px sans-serif;letter-spacing:2px;text-transform:uppercase;border-radius:11px 11px 0 0;
    cursor:move;user-select:none;display:flex;align-items:center;gap:7px;}
.mi-vidcard h4::before,.mi-card h4::before{content:'⠿';color:rgba(0,0,0,.4);font-size:12px;}
.mi-btnicon{cursor:pointer;color:#0a1120;background:rgba(0,0,0,.18);border-radius:6px;font-weight:900;
    font-size:12px;line-height:1;padding:3px 6px;}
.mi-btnicon:hover{background:rgba(0,0,0,.38);}
.mi-restore{margin-left:auto;}
.mi-vid{flex:1 1 auto;min-height:0;width:100%;height:100%;border-radius:8px;background:#000;display:block;object-fit:contain;}
.mi-preview{display:none;}
.mi-grid{position:relative;min-height:660px;}
.mi-scope{position:relative;background:#03060f;border:1px solid #1d2942;border-radius:8px;overflow:hidden;
    flex:1 1 auto;min-height:0;}
.mi-scope canvas{position:absolute;inset:0;width:100%;height:100%;}
.mi-tag{position:absolute;left:8px;top:6px;z-index:2;font:bold 9px 'Courier New',monospace;letter-spacing:1px;color:#6FC8F0;}
.mi-loudrow{display:flex;gap:12px;align-items:stretch;flex:1 1 auto;min-height:0;}
.mi-lufs{font:bold 28px 'Courier New',monospace;color:#cfe6ff;line-height:1;align-self:center;}
.mi-lufs small{display:block;font-size:9px;color:#6b82a3;letter-spacing:1px;margin-top:3px;}
/* ── edit detector: luminance + edit log ───────────────────────────────── */
.mi-lumin{display:flex;flex-direction:column;gap:9px;padding:4px 2px;}
.mi-luminrow{display:flex;align-items:center;gap:10px;}
.mi-lumin-lbl{font:900 11px sans-serif;letter-spacing:2px;color:#8fcdf0;}
.mi-lumin-track{flex:1;height:16px;border-radius:8px;background:#0c1730;overflow:hidden;box-shadow:inset 0 0 4px #000;}
.mi-lumin-bar{display:block;height:100%;width:0;border-radius:8px;background:linear-gradient(90deg,#2a3f66,#8fcdf0);transition:width .12s;}
.mi-lumin-val{font:bold 13px 'Courier New',monospace;color:#cfe6ff;min-width:58px;text-align:right;}
.mi-lumin-sens{display:flex;align-items:center;gap:8px;flex-wrap:wrap;--acc:224,110,90;margin-top:2px;}
.mi-lumin-count,.mi-lumin-tempo{font:11px sans-serif;color:#9fb6cc;}
.mi-lumin-count b{color:#f2955c;font:bold 12px 'Courier New',monospace;}
.mi-lumin-tempo b{color:#8fcdf0;font:bold 13px 'Courier New',monospace;}
.mi-editlog{display:flex;flex-direction:column;gap:8px;flex:1 1 auto;min-height:0;}
.mi-editlog-top{display:flex;align-items:center;gap:10px;}
.mi-editlog-count{margin-left:auto;font:11px sans-serif;color:#9fb6cc;}
.mi-clear{padding:6px 14px;--acc:224,110,90;}
.mi-editlist{flex:1 1 auto;min-height:0;overflow:auto;background:#03060f;border:1px solid #1d2942;border-radius:8px;
    padding:8px 10px;font:12px/1.5 'Courier New',monospace;color:#cfe6ff;display:flex;flex-direction:column;gap:3px;}
.mi-edit-empty{color:#5a6f88;font-style:italic;}
.mi-edit-row{display:flex;gap:8px;align-items:baseline;}
.mi-edit-row .dot{color:#f2955c;} .mi-edit-row .t{color:#f2c15c;font-weight:bold;}
.mi-edit-row .l{color:#7fa6d0;margin-left:auto;font-size:11px;}
/* ── layout inspector popup (opened by the LAYOUT pill) ────────────────── */
.mi-layout{position:fixed;right:16px;top:56px;z-index:9;display:none;max-width:60vw;max-height:64vh;overflow:auto;
    background:#0a1326;border:1px solid #2c3e5e;border-radius:8px;padding:12px 14px;color:#bcd3ee;
    font:11px/1.55 'Courier New',monospace;white-space:pre;box-shadow:0 10px 28px rgba(0,0,0,.6);}
.mi-layout.open{display:block;}
/* ── hover-help + tooltip ──────────────────────────────────────────────── */
.mi-help::after{content:'ⓘ';margin-left:6px;color:#3a2a10;font-size:10px;vertical-align:top;}
.mi-help:hover::after{color:#0a1120;}
.mi-tip{position:fixed;z-index:100000;display:none;max-width:340px;pointer-events:none;
    background:#0b1526;border:1px solid #2c4370;border-radius:9px;padding:11px 13px;
    color:#cfe0f2;font:11px/1.55 Arial,Helvetica,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.7);}
.mi-tip.open{display:block;}
.mi-tip b{color:#6FC8F0;letter-spacing:1px;text-transform:uppercase;font-size:11px;}
.mi-tip .g{color:#7fe0a0;font-weight:bold;} .mi-tip .bad{color:#ff9a9a;font-weight:bold;}
`);
}
