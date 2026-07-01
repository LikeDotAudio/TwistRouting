// src/editors/meter-input/styles — CSS for the (real-video) Meter Input editor.
import { addStyles } from '../../ui/dom.js';

export function injectMeterInputStyles(): void {
  addStyles('meter-input-styles', `
.mi{display:flex;flex-direction:column;gap:12px;height:100%;}
.mi-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.mi-src{font:bold 10px 'Courier New',monospace;letter-spacing:1px;padding:5px 10px;border-radius:6px;
    background:#0c1730;border:1px solid #2c3e5e;color:#cfe6ff;}
.mi-src.empty{opacity:.55;font-style:italic;}
.mi-btn{font:bold 10px sans-serif;letter-spacing:1px;text-transform:uppercase;padding:7px 12px;border-radius:7px;
    border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;cursor:pointer;}
.mi-btn:hover{filter:brightness(1.15);} .mi-btn.on{background:#ffd400;color:#1a1206;border-color:#ffd400;}
.mi-url{font:11px monospace;background:#0c1322;color:#cfe6ff;border:1px solid #2c3e5e;border-radius:6px;padding:6px 8px;min-width:240px;}
.mi-stat{margin-left:auto;font:11px sans-serif;color:#e6a13a;}
.mi-top{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.mi-vidcard{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:10px;}
.mi-vidcard h4{margin:0 0 8px;color:#6FC8F0;font-size:11px;letter-spacing:2px;text-transform:uppercase;}
.mi-yt{position:relative;padding-top:56.25%;border-radius:8px;overflow:hidden;background:#000;}
.mi-yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}
.mi-vid{width:100%;max-height:220px;border-radius:8px;background:#000;display:block;}
.mi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;align-items:start;}
.mi-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.mi-card h4{margin:0;color:#6FC8F0;font-size:11px;letter-spacing:2px;text-transform:uppercase;}
.mi-scope{position:relative;background:#03060f;border:1px solid #1d2942;border-radius:8px;overflow:hidden;}
.mi-scope canvas{position:absolute;inset:0;width:100%;height:100%;}
.mi-tag{position:absolute;left:8px;top:6px;z-index:2;font:bold 9px 'Courier New',monospace;letter-spacing:1px;color:#6FC8F0;}
.mi-h210{height:210px;} .mi-h240{height:240px;} .mi-h150{height:150px;} .mi-h110{height:110px;}
.mi-loudrow{display:flex;gap:12px;align-items:center;}
.mi-lufs{font:bold 28px 'Courier New',monospace;color:#cfe6ff;line-height:1;}
.mi-lufs small{display:block;font-size:9px;color:#6b82a3;letter-spacing:1px;margin-top:3px;}
`);
}
