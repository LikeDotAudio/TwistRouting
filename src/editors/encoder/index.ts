// src/editors/encoder — port of js/editors/encoder.js (AWS-Elemental-style
// Encoder / Transcoding Engine). The encoder is a routing + formatting hub: a 1:1
// mezzanine "golden source" in, a one-to-many ABR ladder + multi-aspect renditions
// out, a destination "vault" of RTMP/SRT profiles, ST 2022-7 hitless failover,
// AES-128 / DRM and live stream-health monitoring.
//
// Data-in (M3): STREAMS + embedded audio tracks come from ctx.sources (with the
// twist.config.inputs / default fallback), NOT a DOM walk. Stats animate via
// ctx.dispose so the host tears the interval down on close.

import type { EditorPlugin } from '../types.js';
import { el, qs } from '../../ui/dom.js';
import { injectEncoderStyles } from './styles.js';
import { RENDITIONS, DESTS, deriveFeeds } from './state.js';

interface TileRef {
  kbps: number;
  name: string;
  on: boolean;
  err: boolean;
  el: HTMLDivElement;
}

const plugin: EditorPlugin = {
  id: 'encoder',
  title: 'ENCODER · TRANSCODING ENGINE',
  order: 10,
  match: (n) => /\bencoder\b|transcod|stream(ing)?\s*(out|engine)|elemental/i.test(n),
  requiredCaps: ['route'],
  render(host, ctx) {
    injectEncoderStyles();

    const { streams, tracks } = deriveFeeds(ctx);
    const destName = DESTS[0] ?? '';
    const ui = { dest: 0, drm: true, failPrimary: true };

    host.innerHTML = `
      <div class="enc">
        <div class="enc-col">
          <div class="enc-card"><h4>Inputs · 1:1 Mezzanine · ${streams.length} stream${streams.length > 1 ? 's' : ''}</h4>
            <div class="enc-streams"></div>
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

    // input streams — one mini 1:1 mezzanine per routed video
    const strm = qs(host, '.enc-streams');
    streams.forEach((s, si) => {
      const item = el('div', { class: 'enc-strm' });
      item.innerHTML = `<div class="pic"></div><div class="nm">STREAM ${si + 1}<small>${s.label}</small></div>`;
      strm.appendChild(item);
    });

    // embedded audio tracks (auto-populated from routed audio)
    const aud = qs(host, '.enc-aud');
    const audBars: HTMLElement[] = [];
    tracks.forEach((a) => {
      const row = el('div', { class: 'enc-arow' });
      row.innerHTML = `<div class="lab">${a.n} <small>[${a.t}]</small></div><div class="m"><i style="width:40%"></i></div>`;
      aud.appendChild(row);
      const bar = row.querySelector<HTMLElement>('i');
      if (bar) audBars.push(bar);
    });

    // output map — the ABR ladder, one bank per video stream
    const grid = qs(host, '.enc-grid');
    const tiles: TileRef[] = [];
    streams.forEach((s, si) => {
      if (streams.length > 1) {
        const h = el('div', { class: 'enc-shead', textContent: `STREAM ${si + 1} · ${s.label} → ABR LADDER` });
        grid.appendChild(h);
      }
      RENDITIONS.forEach((r) => {
        const tile = el('div', { class: 'enc-tile' });
        const sq: [number, number] = r.ar === '1:1' ? [18, 18] : r.ar === '9:16' ? [12, 20] : [24, 14];
        tile.innerHTML =
          `<div class="led"></div><div class="ar"><span class="arbox" style="width:${sq[0]}px;height:${sq[1]}px"></span><div><b>${r.name}</b><div class="codec">${r.ar} · ${r.codec}</div></div></div>` +
          `<div class="br">${(r.kbps / 1000).toFixed(1)} Mbps</div><div class="dest">${destName}</div>`;
        const ref: TileRef = { kbps: r.kbps, name: r.name, on: true, err: false, el: tile };
        tile.addEventListener('click', () => {
          ref.on = !ref.on;
          tile.classList.toggle('off', !ref.on);
        });
        grid.appendChild(tile);
        tiles.push(ref);
      });
    });

    // destination vault
    const dest = qs(host, '.enc-dest');
    DESTS.forEach((d, i) => {
      const item = el('div', { class: 'enc-d' + (i === 0 ? ' sel' : '') });
      item.innerHTML = `<span class="lk">🔒</span><div class="nm">${d}</div><span class="pr">${/SRT/.test(d) ? 'SRT' : 'RTMP'}</span>`;
      item.addEventListener('click', () => {
        ui.dest = i;
        dest.querySelectorAll('.enc-d').forEach((x, j) => x.classList.toggle('sel', j === i));
      });
      dest.appendChild(item);
    });

    // hitless failover PRIMARY / SECONDARY toggle
    const fo = qs(host, '.enc-fo');
    fo.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const p = target?.closest('.pill');
      if (!p) return;
      ui.failPrimary = p.classList.contains('prim');
      qs(host, '.enc-fo .prim').classList.toggle('on', ui.failPrimary);
      qs(host, '.enc-fo .sec').classList.toggle('on', !ui.failPrimary);
    });

    // AES-128 / DRM toggle
    const drmKey = qs(host, '.enc-key.drm');
    drmKey.addEventListener('click', () => {
      ui.drm = !ui.drm;
      drmKey.classList.toggle('on', ui.drm);
    });

    // live stream-health monitoring + random packet-drop simulation
    const health = qs(host, '.enc-health');
    ctx.dispose.interval(() => {
      for (const bar of audBars) bar.style.width = 25 + Math.random() * 60 + '%';
      for (const t of tiles) {
        if (t.on && Math.random() < 0.01) t.err = true;
        else if (t.err && Math.random() < 0.25) t.err = false;
        t.el.classList.toggle('err', t.err && t.on);
      }
      const errs = tiles.filter((t) => t.on && t.err);
      const first = errs[0];
      const totalMbps = tiles.filter((t) => t.on).reduce((a, t) => a + t.kbps, 0) / 1000;
      health.innerHTML =
        `Frozen Frame &nbsp;<span class="${errs.length ? 'bad' : 'ok'}">${first ? 'CHECK ' + first.name : 'OK'}</span><br>` +
        `Black Video &nbsp;<span class="ok">OK</span><br>` +
        `Audio Silence &nbsp;<span class="ok">OK</span><br>` +
        `Failover &nbsp;<span class="ok">${ui.failPrimary ? 'PRIMARY' : 'SECONDARY'}</span><br>` +
        `Encryption &nbsp;<span class="${ui.drm ? 'ok' : 'bad'}">${ui.drm ? 'AES-128' : 'CLEAR'}</span><br>` +
        `Egress Total &nbsp;<b style="color:#cfe6ff">${totalMbps.toFixed(1)} Mbps</b>`;
    }, 220);
  },
};

export default plugin;
