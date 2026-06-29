// src/editors/iso-recorder/styles — verbatim port of the legacy addStyles block.

import { addStyles } from '../../ui/dom.js';

export function injectIsoRecorderStyles(): void {
  addStyles(
    'twist-editor-iso-recorder',
    `
        /* ===== ISO recorder + instant replay ===== */
        .iso-sec{margin-bottom:24px;}
        .iso-bar{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap;}
        .iso-disk{flex:1;min-width:160px;height:14px;border-radius:7px;background:#0c1322;overflow:hidden;}
        .iso-disk > i{display:block;height:100%;background:linear-gradient(90deg,#19c54b,#e6e23a 80%,#ff3b3b);}
        .iso-cards{display:flex;gap:10px;flex-wrap:wrap;}
        .iso-card{width:152px;background:#0d1424;border:1px solid #233150;border-radius:8px;padding:8px;
            display:flex;flex-direction:column;gap:6px;}
        .iso-screen{height:76px;border-radius:4px;display:flex;align-items:center;justify-content:center;
            color:#56708f;font-size:12px;position:relative;
            background:repeating-linear-gradient(45deg,#070b14 0 10px,#0a0f1c 10px 20px);}
        .iso-screen .rec-dot{position:absolute;top:6px;left:6px;width:10px;height:10px;border-radius:50%;background:#394a63;}
        .iso-card.rec .iso-screen .rec-dot{background:#ff3344;animation:recPulse 1s steps(1) infinite;}
        .iso-name{font-size:11px;font-weight:bold;text-align:center;}
        .iso-tc{font-family:monospace;font-size:13px;text-align:center;color:#9fffc0;}
        .iso-card.rec .iso-tc{color:#ff6b6b;}
        .iso-recbtn{border:none;border-radius:4px;padding:6px;font-weight:900;letter-spacing:1px;
            font-size:11px;cursor:pointer;background:#ff3344;color:#fff;}
        .iso-card.rec .iso-recbtn{background:#000;border:1px solid #ff3344;color:#ff3344;}
        .iso-file{font-size:9px;color:#7e93b5;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .rp-wrap{background:#0d1424;border:1px solid #233150;border-radius:8px;padding:14px;}
        .rp-timeline{position:relative;height:42px;border-radius:6px;background:#0c1322;overflow:hidden;margin-bottom:14px;}
        .rp-buffer{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,255,255,.05),rgba(0,255,255,.20));}
        .rp-poi{position:absolute;top:0;bottom:0;width:2px;background:#f5c542;}
        .rp-play{position:absolute;top:0;bottom:0;width:2px;background:#ff3344;box-shadow:0 0 8px #ff3344;}
        .rp-row{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;}
        .rp-jog{flex:1;min-width:220px;}
        .rp-jog input{width:100%;accent-color:var(--cyan,#00ffff);}
        .rp-tc{font-family:monospace;font-size:20px;color:var(--cyan,#00ffff);text-align:center;}
        .rp-btns,.rp-angles,.rp-speeds{display:flex;gap:6px;flex-wrap:wrap;}
        .rp-btn{padding:9px 14px;border-radius:5px;background:#202c46;border:1px solid #38476a;color:#cfe0ff;
            cursor:pointer;font-weight:900;letter-spacing:1px;font-size:12px;}
        .rp-btn.sel{background:var(--cyan,#00ffff);color:#000;border-color:#fff;}
        .rp-btn.air{background:#ff3344;color:#fff;border-color:#ff9aa6;}
        .rp-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
        .rp-clip{background:#16223c;border:1px solid #2c3a5a;border-radius:5px;padding:6px 10px;
            font-size:11px;font-family:monospace;color:#9fffc0;}
    `,
  );
}
