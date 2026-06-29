// src/editors/encoder/styles — verbatim port of the legacy addStyles('enc-styles', …)
// block from js/editors/encoder.js. Kept byte-for-byte so the visuals match.

import { addStyles } from '../../ui/dom.js';

const CSS = `
.enc{display:grid;grid-template-columns:280px minmax(0,1fr) 300px;gap:16px;height:100%;}
.enc-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:14px;}
.enc-card h4{margin:0 0 12px;color:#6FC8F0;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.enc-col{display:flex;flex-direction:column;gap:14px;overflow:auto;}
/* input mezzanine */
.enc-mez{position:relative;aspect-ratio:1/1;border-radius:8px;overflow:hidden;border:1px solid #1d2942;background:#03060f;}
.enc-mez .pic{position:absolute;inset:0;background:linear-gradient(135deg,#23406b,#0a1322);animation:encPan 9s ease-in-out infinite alternate;}
@keyframes encPan{from{filter:hue-rotate(0)}to{filter:hue-rotate(40deg)}}
.enc-mez .tag{position:absolute;left:6px;top:5px;font:bold 10px 'Courier New',monospace;color:#9effc0;letter-spacing:1px;}
.enc-mez .gold{position:absolute;right:6px;top:5px;font:bold 10px 'Courier New',monospace;color:#ffd400;}
.enc-streams{display:flex;flex-direction:column;gap:8px;}
.enc-strm{display:flex;gap:8px;align-items:center;background:#03060f;border:1px solid #1d2942;border-radius:8px;padding:6px;}
.enc-strm .pic{width:40px;height:40px;border-radius:5px;flex:0 0 auto;background:linear-gradient(135deg,#23406b,#0a1322);animation:encPan 9s ease-in-out infinite alternate;}
.enc-strm .nm{font:bold 11px sans-serif;color:#cfe6ff;letter-spacing:1px;} .enc-strm .nm small{display:block;color:#7e93b5;font-size:9px;letter-spacing:1px;font-weight:normal;}
.enc-shead{grid-column:1 / -1;font:bold 10px 'Courier New',monospace;color:#6FC8F0;letter-spacing:1px;margin-top:8px;padding-top:6px;border-top:1px solid #1d2942;}
.enc-aud{display:flex;flex-direction:column;gap:7px;margin-top:10px;}
.enc-arow{display:flex;align-items:center;gap:8px;}
.enc-arow .lab{width:96px;font:11px sans-serif;color:#cfe6ff;} .enc-arow .lab small{color:#7e93b5;}
.enc-arow .m{flex:1;height:8px;border-radius:5px;background:#16243d;overflow:hidden;box-shadow:inset 0 0 0 1px #2c3e5e;}
.enc-arow .m i{display:block;height:100%;background:linear-gradient(90deg,#39d353,#ffd400);}
.enc-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.enc-badge{font:bold 9px 'Courier New',monospace;letter-spacing:1px;color:#9fb6cc;border:1px solid #2c3e5e;border-radius:5px;padding:4px 7px;background:#0c1730;}
.enc-badge.on{color:#39d353;border-color:#1f5a3a;}
/* output map */
.enc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
.enc-tile{position:relative;background:#0c1730;border:1px solid #2c3e5e;border-radius:10px;padding:12px;cursor:pointer;overflow:hidden;}
.enc-tile .ar{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.enc-tile .arbox{border:2px solid #6FC8F0;border-radius:2px;flex:0 0 auto;}
.enc-tile b{font:bold 15px 'Courier New',monospace;color:#fff;} .enc-tile .codec{font:10px sans-serif;color:#7e93b5;}
.enc-tile .br{font:11px 'Courier New',monospace;color:#aec6e4;margin-top:4px;}
.enc-tile .led{position:absolute;right:10px;top:10px;width:11px;height:11px;border-radius:50%;background:#39d353;box-shadow:0 0 7px #39d353;}
.enc-tile.off{opacity:.4;} .enc-tile.off .led{background:#33415f;box-shadow:none;}
.enc-tile.err{border-color:#ff3b3b;} .enc-tile.err .led{background:#ff2b2b;box-shadow:0 0 9px #ff2b2b;}
.enc-tile .dest{font:9px 'Courier New',monospace;color:#6FC8F0;margin-top:6px;letter-spacing:.5px;}
/* destinations vault */
.enc-dest{display:flex;flex-direction:column;gap:8px;}
.enc-d{display:flex;align-items:center;gap:8px;padding:10px;border-radius:8px;border:1px solid #2c3e5e;background:#0c1730;cursor:pointer;}
.enc-d.sel{border-color:#6FC8F0;background:#13233c;}
.enc-d .lk{width:22px;text-align:center;color:#39d353;} .enc-d .nm{flex:1;font:bold 12px sans-serif;color:#cfe6ff;}
.enc-d .pr{font:bold 9px 'Courier New',monospace;color:#7e93b5;border:1px solid #2c3e5e;border-radius:4px;padding:2px 5px;}
.enc-fo{display:flex;gap:8px;margin-top:6px;}
.enc-fo .pill{flex:1;text-align:center;padding:9px;border-radius:8px;font:bold 11px sans-serif;letter-spacing:1px;border:1px solid #2c3e5e;background:#0c1730;color:#7e93b5;}
.enc-fo .pill.on{background:#1f5a3a;color:#9effc0;border-color:#39d353;}
.enc-key{padding:12px;border-radius:8px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;font:bold 11px sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-align:center;margin-top:8px;}
.enc-key.on{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.enc-health{font:11px 'Courier New',monospace;line-height:1.9;color:#9fb6cc;}
.enc-health .ok{color:#39d353;} .enc-health .bad{color:#ff6a6a;}
.enc-scte{margin-top:12px;padding:14px;border-radius:9px;border:1px solid #ff6a6a;background:#1a0c0c;color:#ff9a9a;font:900 13px sans-serif;letter-spacing:2px;text-transform:uppercase;cursor:pointer;text-align:center;}
.enc-scte:hover{background:#2a1212;}
.enc-scte.on{background:#ff3b3b;color:#fff;border-color:#ff3b3b;box-shadow:0 0 16px rgba(255,59,59,.7);}
.enc-toast{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:rgba(255,59,59,.92);color:#fff;font:bold 11px 'Courier New',monospace;padding:7px 13px;border-radius:7px;z-index:5;white-space:nowrap;animation:encToast 1.8s ease forwards;}
@keyframes encToast{0%{opacity:0;transform:translate(-50%,12px)}15%{opacity:1;transform:translate(-50%,0)}85%{opacity:1}100%{opacity:0}}
`;

export function injectEncoderStyles(): void {
  addStyles('enc-styles', CSS);
}
