// js/editors/encoder.js — Encoder / Transcoding Engine properties panel
// (AWS-Elemental-style). Treats the encoder as a routing + formatting hub: a 1:1
// mezzanine "golden source" in, a one-to-many ABR ladder + multi-aspect renditions
// out, a destination "vault" of stored RTMP/SRT profiles, ST 2022-7 hitless
// failover, stream-health monitoring and AES-128 / DRM — a Traffic Controller's Map.
import { register, addStyles, pushTimer } from './core.js';

const RENDITIONS = [
    { name: '2160p', ar: '16:9', kbps: 16000, codec: 'HEVC' },
    { name: '1080p', ar: '16:9', kbps: 6000, codec: 'H.264' },
    { name: '720p', ar: '16:9', kbps: 3000, codec: 'H.264' },
    { name: '480p', ar: '16:9', kbps: 1200, codec: 'H.264' },
    { name: '1080×1920', ar: '9:16', kbps: 4500, codec: 'H.264' },
    { name: '1080²', ar: '1:1', kbps: 3500, codec: 'H.264' },
];
const DESTS = ['Main-CDN-Primary', 'YouTube Live', 'Twitch', 'Facebook Live', 'Backup-CDN-SRT'];
const AUDIO = [{ n: 'Program', t: 'EN' }, { n: 'Language 2', t: 'ES' }, { n: 'Language 3', t: 'FR' }, { n: 'Music & Effects', t: 'M&E' }];

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
`;

function render(body, twist) {
    addStyles('enc-styles', CSS);
    const tiles = RENDITIONS.map(r => ({ ...r, on: true, err: false, dest: 0 }));
    const ui = { dest: 0, drm: true, failPrimary: true };

    body.innerHTML = `
      <div class="enc">
        <div class="enc-col">
          <div class="enc-card"><h4>Input · 1:1 Mezzanine</h4>
            <div class="enc-mez"><div class="pic"></div><div class="tag">GOLDEN SOURCE 1:1</div><div class="gold">● LOCK</div></div>
            <div class="enc-aud"></div>
            <div class="enc-meta">
              <span class="enc-badge on">SCTE-35</span><span class="enc-badge on">CC 608/708</span><span class="enc-badge on">LTC TC</span><span class="enc-badge on">SMPTE 2110</span>
            </div>
          </div>
        </div>

        <div class="enc-card" style="display:flex;flex-direction:column;overflow:auto">
          <h4>Output Map · One-to-Many ABR Ladder</h4>
          <div class="enc-grid"></div>
        </div>

        <div class="enc-col">
          <div class="enc-card"><h4>Destination Vault</h4><div class="enc-dest"></div></div>
          <div class="enc-card"><h4>Hitless Failover · ST 2022-7</h4>
            <div class="enc-fo"><div class="pill prim on">PRIMARY</div><div class="pill sec">SECONDARY</div></div>
            <div class="enc-key drm on">AES-128 / DRM</div>
          </div>
          <div class="enc-card"><h4>Stream Health</h4><div class="enc-health"></div></div>
        </div>
      </div>`;

    const $ = (q) => body.querySelector(q);
    // audio tracks
    const aud = $('.enc-aud');
    AUDIO.forEach(a => { const r = document.createElement('div'); r.className = 'enc-arow'; r.innerHTML = `<div class="lab">${a.n} <small>[${a.t}]</small></div><div class="m"><i style="width:40%"></i></div>`; aud.appendChild(r); });

    // output tiles
    const grid = $('.enc-grid');
    tiles.forEach((t, i) => {
        const el = document.createElement('div'); el.className = 'enc-tile';
        const sq = t.ar === '1:1' ? [18, 18] : t.ar === '9:16' ? [12, 20] : [24, 14];
        el.innerHTML = `<div class="led"></div><div class="ar"><span class="arbox" style="width:${sq[0]}px;height:${sq[1]}px"></span><div><b>${t.name}</b><div class="codec">${t.ar} · ${t.codec}</div></div></div>
            <div class="br">${(t.kbps / 1000).toFixed(1)} Mbps</div><div class="dest">${DESTS[t.dest]}</div>`;
        el.addEventListener('click', () => { t.on = !t.on; el.classList.toggle('off', !t.on); });
        grid.appendChild(el); t.el = el;
    });

    // destination vault
    const dest = $('.enc-dest');
    DESTS.forEach((d, i) => {
        const el = document.createElement('div'); el.className = 'enc-d' + (i === 0 ? ' sel' : '');
        el.innerHTML = `<span class="lk">🔒</span><div class="nm">${d}</div><span class="pr">${/SRT/.test(d) ? 'SRT' : 'RTMP'}</span>`;
        el.addEventListener('click', () => { ui.dest = i; dest.querySelectorAll('.enc-d').forEach((x, j) => x.classList.toggle('sel', j === i)); });
        dest.appendChild(el);
    });
    $('.enc-fo').addEventListener('click', e => { const p = e.target.closest('.pill'); if (!p) return; ui.failPrimary = p.classList.contains('prim'); $('.enc-fo .prim').classList.toggle('on', ui.failPrimary); $('.enc-fo .sec').classList.toggle('on', !ui.failPrimary); });
    $('.enc-key.drm').addEventListener('click', e => { ui.drm = !ui.drm; e.target.classList.toggle('on', ui.drm); });

    const health = $('.enc-health');
    let f = 0;
    pushTimer(setInterval(() => {
        f++;
        aud.querySelectorAll('.m i').forEach(i => { i.style.width = (25 + Math.random() * 60) + '%'; });
        // random packet-drop on one active output → red glow, then recover
        tiles.forEach(t => { if (t.on && Math.random() < 0.01) t.err = true; else if (t.err && Math.random() < 0.25) t.err = false; t.el.classList.toggle('err', t.err && t.on); });
        const errs = tiles.filter(t => t.on && t.err);
        const totalMbps = tiles.filter(t => t.on).reduce((a, t) => a + t.kbps, 0) / 1000;
        health.innerHTML =
            `Frozen Frame &nbsp;<span class="${errs.length ? 'bad' : 'ok'}">${errs.length ? 'CHECK ' + errs[0].name : 'OK'}</span><br>` +
            `Black Video &nbsp;<span class="ok">OK</span><br>` +
            `Audio Silence &nbsp;<span class="ok">OK</span><br>` +
            `Failover &nbsp;<span class="ok">${ui.failPrimary ? 'PRIMARY' : 'SECONDARY'}</span><br>` +
            `Encryption &nbsp;<span class="${ui.drm ? 'ok' : 'bad'}">${ui.drm ? 'AES-128' : 'CLEAR'}</span><br>` +
            `Egress Total &nbsp;<b style="color:#cfe6ff">${totalMbps.toFixed(1)} Mbps</b>`;
    }, 220));
}

register(n => /\bencoder\b|transcod|stream(ing)?\s*(out|engine)|elemental/i.test(n), 'ENCODER · TRANSCODING ENGINE', render);
