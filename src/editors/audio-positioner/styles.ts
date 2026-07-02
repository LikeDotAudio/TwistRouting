// src/editors/audio-positioner/styles — CSS for the CMDP audio positioner.
// Ported from the CMDP prototype (Anthony Kuzub), re-scoped to live INSIDE the
// editor overlay (panels absolute to the .ap-wrap, not fixed to the viewport).
import { addStyles } from '../../ui/dom.js';

export function injectAudioPositionerStyles(): void {
  addStyles('audio-positioner-styles', `
.ap-wrap{--accent:#f4902c;position:relative;width:100%;height:78vh;min-height:520px;
  background:#181818;border-radius:12px;overflow:hidden;color:#eee;font-family:'Segoe UI',sans-serif;}
.ap-wrap canvas{display:block;position:absolute;inset:0;touch-action:none;}
.ap-hints{position:absolute;top:10px;right:10px;background:rgba(0,0,0,.72);color:#aaa;padding:8px 10px;
  border-radius:6px;font-size:10px;width:150px;pointer-events:none;z-index:25;border-left:3px solid var(--accent);line-height:1.5;}
.ap-hints b{color:#fff;}
.ap-controls{position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.7);padding:12px 14px;border-radius:6px;
  pointer-events:none;z-index:10;border-top:3px solid var(--accent);font-size:11px;line-height:1.7;transition:opacity 1s;}
.ap-controls .key{color:var(--accent);font-weight:bold;}
.ap-grouppanel{position:absolute;top:96px;right:10px;display:flex;flex-direction:column;gap:5px;z-index:20;}
.ap-group-row{display:flex;gap:5px;}
.ap-vis{background:rgba(0,0,0,.8);color:#888;border:1px solid #555;padding:6px 0;border-radius:5px;cursor:pointer;
  font-size:12px;width:26px;text-align:center;user-select:none;}
.ap-vis.active{color:#fff;border-color:#aaa;background:#444;}
.ap-sel{background:rgba(0,0,0,.8);color:#eee;border:1px solid #555;padding:7px 10px;border-radius:5px;cursor:pointer;
  font-size:12px;text-align:left;min-width:110px;transition:all .2s;font-weight:bold;user-select:none;}
.ap-sel:hover{background:#444;}
.ap-sel.selected{background:#333;box-shadow:inset 0 0 10px rgba(0,0,0,.5);border-color:#fff;}
.ap-status{position:absolute;bottom:48px;right:150px;background:rgba(0,0,0,.8);padding:10px;border-radius:10px;color:#ccc;
  font-family:monospace;font-size:10px;pointer-events:auto;z-index:10;display:grid;grid-template-columns:repeat(6,1fr);
  gap:5px;max-width:60vw;max-height:34vh;overflow:auto;transition:opacity .3s;}
.ap-status-item{display:flex;flex-direction:column;border:1px solid #444;padding:5px;border-radius:3px;cursor:crosshair;}
.ap-status-id{font-weight:bold;margin-bottom:2px;}
.ap-toggle{position:absolute;bottom:12px;right:150px;background:rgba(0,0,0,.7);color:#ccc;border:1px solid #444;
  padding:5px 15px;border-radius:5px;cursor:pointer;z-index:20;font-size:12px;}
.ap-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;text-align:center;padding:0 40px;}
`);
}
