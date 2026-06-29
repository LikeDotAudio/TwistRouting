// src/editors/iso-recorder — ISO recorders + instant-replay engine.
//
// Faithful TS port of js/editors/iso-recorder.js, driven entirely from the typed
// EditorContext (M3: data-in, no DOM scraping). The legacy channelsFor() walk is
// replaced by ctx.sources, falling back to ctx.twist.config?.inputs, then a
// CAM N default — mirroring the legacy channelsFor(twist, config, 'CAM', 4).

import type { EditorPlugin } from '../types.js';
import type { EditorContext } from '../types.js';
import { qs } from '../../ui/dom.js';
import { injectIsoRecorderStyles } from './styles.js';

/** A drawable channel: the data each ISO/angle control is built from. */
interface Chan {
  label: string;
  color: string;
}

/** Resolve channels the data-in way (ctx.sources → config.inputs → CAM N). */
function channelsFor(ctx: EditorContext, fallbackPrefix: string, fallbackCount: number): Chan[] {
  if (ctx.sources.length) {
    return ctx.sources.map((f) => ({ label: f.label, color: f.color }));
  }
  const inputs = ctx.twist.config?.inputs;
  if (inputs && inputs.length) {
    return inputs.map((i) => ({ label: i, color: '#4d94ff' }));
  }
  return Array.from({ length: fallbackCount }, (_unused, i) => ({
    label: `${fallbackPrefix} ${i + 1}`,
    color: '#4d94ff',
  }));
}

/** One ISO recorder lane's mutable state + behaviour. */
interface Rec {
  frames: number;
  on: boolean;
  setOn(on: boolean): void;
  tick(): void;
}

const plugin: EditorPlugin = {
  id: 'iso-recorder',
  title: 'ISO RECORDER · INSTANT REPLAY',
  order: 1,
  match: (n) => /\biso\b|replay/i.test(n),
  requiredCaps: ['route'],
  render(host, ctx) {
    injectIsoRecorderStyles();

    const chans = channelsFor(ctx, 'CAM', 4);
    const fps = 100; // 100 frames/second — frames field runs 00..99
    const fmt = (f: number): string =>
      [Math.floor(f / fps / 3600), Math.floor(f / fps / 60) % 60, Math.floor(f / fps) % 60, f % fps]
        .map((x) => String(x).padStart(2, '0'))
        .join(':');

    // ---- ISO recorders ----
    const sec1 = document.createElement('div');
    sec1.className = 'iso-sec';
    sec1.innerHTML = `<p class="ed-h">ISO RECORDERS — CLEAN PER-SOURCE FEEDS</p>`;
    const bar = document.createElement('div');
    bar.className = 'iso-bar';
    const allBtn = document.createElement('div');
    allBtn.className = 'rp-btn';
    allBtn.textContent = '● RECORD ALL';
    const disk = document.createElement('div');
    disk.className = 'iso-disk';
    disk.innerHTML = '<i style="width:38%"></i>';
    const diskLbl = document.createElement('div');
    diskLbl.style.cssText = 'font-size:11px;color:#7e93b5;white-space:nowrap;';
    diskLbl.textContent = 'DISK 38% · 14:22:10 REMAINING';
    bar.append(allBtn, disk, diskLbl);
    sec1.appendChild(bar);

    const cards = document.createElement('div');
    cards.className = 'iso-cards';
    const recs: Rec[] = [];
    chans.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'iso-card';
      card.innerHTML = `
                <div class="iso-screen"><span class="rec-dot"></span>▣ ${c.label}</div>
                <div class="iso-name" style="color:${c.color}">${c.label}</div>
                <div class="iso-tc">00:00:00:00</div>
                <button class="iso-recbtn">RECORD</button>
                <div class="iso-file">ISO_${c.label.replace(/\s+/g, '')}_001.mov</div>`;
      const tc = qs(card, '.iso-tc');
      const btn = qs(card, '.iso-recbtn');
      const rec: Rec = {
        frames: 0,
        on: false,
        setOn(on: boolean): void {
          rec.on = on;
          card.classList.toggle('rec', on);
          btn.textContent = on ? 'STOP' : 'RECORD';
        },
        tick(): void {
          if (rec.on) {
            rec.frames++;
            tc.textContent = fmt(rec.frames);
          }
        },
      };
      btn.addEventListener('click', () => rec.setOn(!rec.on));
      recs.push(rec);
      cards.appendChild(card);
    });
    sec1.appendChild(cards);
    host.appendChild(sec1);
    allBtn.addEventListener('click', () => {
      const any = recs.some((r) => !r.on);
      recs.forEach((r) => r.setOn(any));
      allBtn.textContent = any ? '■ STOP ALL' : '● RECORD ALL';
    });
    ctx.dispose.interval(() => recs.forEach((r) => r.tick()), 1000 / fps);

    // ---- Instant replay engine ----
    const sec2 = document.createElement('div');
    sec2.className = 'iso-sec';
    sec2.innerHTML = `<p class="ed-h">INSTANT REPLAY ENGINE — ROLLING BUFFER</p>`;
    const rp = document.createElement('div');
    rp.className = 'rp-wrap';
    const pois = [20, 55, 78];
    rp.innerHTML = `
            <div class="rp-timeline"><div class="rp-buffer"></div>
                ${pois.map((p) => `<div class="rp-poi" style="left:${p}%"></div>`).join('')}
                <div class="rp-play" style="left:60%"></div></div>
            <div class="rp-row">
                <div class="rp-jog"><p class="ed-h">JOG / SHUTTLE</p><input type="range" min="0" max="100" value="60"></div>
                <div><p class="ed-h">POSITION</p><div class="rp-tc">--:--:--:--</div></div>
                <div><p class="ed-h">SPEED</p><div class="rp-speeds">
                    <div class="rp-btn" data-spd>×1</div><div class="rp-btn sel" data-spd>½</div><div class="rp-btn" data-spd>¼</div></div></div>
                <div><p class="ed-h">ANGLE · MULTI-CAM</p><div class="rp-angles"></div></div>
                <div><p class="ed-h">&nbsp;</p><div class="rp-btns">
                    <div class="rp-btn" data-mark>◆ MARK POI</div>
                    <div class="rp-btn" data-play>▶ PLAY</div>
                    <div class="rp-btn air" data-air>TO AIR</div></div></div>
            </div>
            <div class="rp-list"></div>`;
    const ang = qs(rp, '.rp-angles');
    chans.forEach((c, i) => {
      const a = document.createElement('div');
      a.className = 'rp-btn' + (i === 0 ? ' sel' : '');
      a.textContent = c.label;
      a.addEventListener('click', () =>
        ang.querySelectorAll<HTMLElement>('.rp-btn').forEach((x) => x.classList.toggle('sel', x === a)),
      );
      ang.appendChild(a);
    });
    const jog = qs<HTMLInputElement>(rp, '.rp-jog input');
    const tc = qs(rp, '.rp-tc');
    const play = qs<HTMLElement>(rp, '.rp-play');
    const upd = (): void => {
      play.style.left = jog.value + '%';
      tc.textContent = fmt(Math.round(Number(jog.value) * 90));
    };
    jog.addEventListener('input', upd);
    upd();
    rp.querySelectorAll<HTMLElement>('.rp-speeds .rp-btn').forEach((b) =>
      b.addEventListener('click', () =>
        rp.querySelectorAll<HTMLElement>('.rp-speeds .rp-btn').forEach((x) => x.classList.toggle('sel', x === b)),
      ),
    );
    const list = qs(rp, '.rp-list');
    qs(rp, '[data-mark]').addEventListener('click', () => {
      const clip = document.createElement('div');
      clip.className = 'rp-clip';
      clip.textContent = '◆ ' + (tc.textContent ?? '');
      list.appendChild(clip);
    });
    const airBtn = qs(rp, '[data-air]');
    airBtn.addEventListener('click', () => {
      airBtn.textContent = '● ON AIR';
      const id = setTimeout(() => {
        airBtn.textContent = 'TO AIR';
      }, 1300);
      ctx.dispose.add(() => clearTimeout(id));
    });
    sec2.appendChild(rp);
    host.appendChild(sec2);
  },
};

export default plugin;
