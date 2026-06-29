// src/editors/intercom/styles — verbatim port of the legacy intercom CSS block
// (js/editors/intercom.js addStyles('twist-editor-intercom', ...)). Injected once.

import { addStyles } from '../../ui/dom.js';

export function injectIntercomStyles(): void {
  addStyles(
    'twist-editor-intercom',
    `
        /* ===== Intercom ===== */
        .ic-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:18px;}
        .ic-key{background:#10192c;border:1px solid #27344f;border-radius:7px;
            padding:10px;display:flex;flex-direction:column;gap:8px;align-items:stretch;}
        .ic-key .ic-name{font-weight:900;letter-spacing:1px;text-align:center;font-size:13px;color:#cfe0ff;
            background:#1c2840;border-radius:4px;padding:8px 4px;cursor:pointer;transition:all .1s;}
        .ic-key.talk .ic-name{background:#ff8a00;color:#000;box-shadow:0 0 12px rgba(255,138,0,.6);}
        .ic-key.listen .ic-name{box-shadow:inset 0 0 0 2px #33dd66;color:#9fffc0;}
        .ic-key.live .ic-name{outline:2px solid #ff3344;}
        .ic-tl{display:flex;gap:6px;}
        .ic-tl button{flex:1;font-size:9px;font-weight:900;letter-spacing:1px;border:none;border-radius:3px;
            padding:4px;cursor:pointer;background:#26324d;color:#cfe0ff;}
        .ic-tl button.talk.on{background:#ff8a00;color:#000;}
        .ic-tl button.listen.on{background:#1ba23f;color:#fff;}
        .ic-vol{width:100%;accent-color:var(--cyan,#00ffff);}
        .ic-sub{display:flex;gap:16px;flex-wrap:wrap;}
        .ic-card{background:#0d1424;border:1px solid #233150;border-radius:8px;padding:12px 16px;min-width:200px;}
        .ic-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 0;font-size:12px;}
        .ic-pill{font-size:10px;font-weight:900;letter-spacing:1px;padding:3px 9px;border-radius:10px;
            background:#1c2840;color:#9fb6cc;cursor:pointer;}
        .ic-pill.on{background:#33dd66;color:#000;}

        /* ===== Intercom — TALK GROUPS ===== */
        .ic-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;}
        .ic-tool-btn{padding:11px 22px;border-radius:18px;background:var(--ed-color,#FF9C63);color:#000;
            font-weight:900;letter-spacing:1px;font-size:12px;cursor:pointer;border:none;}
        .ic-tool-btn.ghost{background:#26324d;color:#cfe0ff;}
        .ic-hint{font-size:11px;letter-spacing:1px;color:var(--cyan,#00ffff);font-weight:bold;}
        .ic-groups{display:flex;flex-direction:column;gap:10px;margin-bottom:18px;}
        .ic-group{display:flex;align-items:stretch;gap:12px;background:#0d1424;border:1px solid #233150;
            border-radius:14px;padding:10px;}
        .ic-group-talk{flex:0 0 auto;min-width:170px;border:none;border-radius:12px;cursor:pointer;
            background:linear-gradient(#2a3550,#1a2440);font-weight:900;letter-spacing:2px;font-size:18px;color:#cfe0ff;
            display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:16px 26px;
            transition:all .1s;}
        .ic-group-talk small{font-size:9px;opacity:.7;font-weight:bold;letter-spacing:1px;}
        .ic-group-talk:hover{filter:brightness(1.12);}
        .ic-group.on .ic-group-talk{background:#ff8a00;color:#000;box-shadow:0 0 20px rgba(255,138,0,.75);}
        .ic-group-members{flex:1;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
        .ic-chip{font-size:11px;font-weight:bold;letter-spacing:.5px;background:#1c2840;color:#cfe0ff;
            padding:6px 11px;border-radius:10px;}
        .ic-group-x{flex:0 0 auto;align-self:center;cursor:pointer;color:#7e93b5;font-weight:900;font-size:20px;padding:0 10px;}
        .ic-group-x:hover{color:#ff6677;}
        .ic-grid.selecting .ic-key{cursor:pointer;}
        .ic-key.picked{outline:3px solid var(--cyan,#00ffff);outline-offset:1px;}
    `,
  );
}
