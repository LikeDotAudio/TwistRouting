import { register, addStyles, channelsFor, gatherSources, knob, meterBar, pushTimer } from './core.js';
// js/editors/iso-recorder.js
(function () {
    'use strict';
    // helpers imported at module top from ./core.js

    addStyles('twist-editor-iso-recorder', `
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
    `);

    // ======================= ISO RECORDER + INSTANT REPLAY ==================
    function renderIsoRecorder(body, twist, config) {
        const chans = channelsFor(twist, config, 'CAM', 4);
        const fps = 100;   // 100 frames/second — frames field runs 00..99
        const fmt = (f) => [Math.floor(f / fps / 3600), Math.floor(f / fps / 60) % 60,
            Math.floor(f / fps) % 60, f % fps].map(x => String(x).padStart(2, '0')).join(':');

        // ---- ISO recorders ----
        const sec1 = document.createElement('div');
        sec1.className = 'iso-sec';
        sec1.innerHTML = `<p class="ed-h">ISO RECORDERS — CLEAN PER-SOURCE FEEDS</p>`;
        const bar = document.createElement('div');
        bar.className = 'iso-bar';
        const allBtn = document.createElement('div');
        allBtn.className = 'rp-btn'; allBtn.textContent = '● RECORD ALL';
        const disk = document.createElement('div');
        disk.className = 'iso-disk'; disk.innerHTML = '<i style="width:38%"></i>';
        const diskLbl = document.createElement('div');
        diskLbl.style.cssText = 'font-size:11px;color:#7e93b5;white-space:nowrap;';
        diskLbl.textContent = 'DISK 38% · 14:22:10 REMAINING';
        bar.append(allBtn, disk, diskLbl);
        sec1.appendChild(bar);

        const cards = document.createElement('div');
        cards.className = 'iso-cards';
        const recs = [];
        chans.forEach((c) => {
            const card = document.createElement('div');
            card.className = 'iso-card';
            card.innerHTML = `
                <div class="iso-screen"><span class="rec-dot"></span>▣ ${c.label}</div>
                <div class="iso-name" style="color:${c.color}">${c.label}</div>
                <div class="iso-tc">00:00:00:00</div>
                <button class="iso-recbtn">RECORD</button>
                <div class="iso-file">ISO_${c.label.replace(/\s+/g, '')}_001.mov</div>`;
            const tc = card.querySelector('.iso-tc');
            const btn = card.querySelector('.iso-recbtn');
            const rec = { frames: 0, on: false };
            rec.setOn = (on) => { rec.on = on; card.classList.toggle('rec', on); btn.textContent = on ? 'STOP' : 'RECORD'; };
            rec.tick = () => { if (rec.on) { rec.frames++; tc.textContent = fmt(rec.frames); } };
            btn.addEventListener('click', () => rec.setOn(!rec.on));
            recs.push(rec);
            cards.appendChild(card);
        });
        sec1.appendChild(cards);
        body.appendChild(sec1);
        allBtn.addEventListener('click', () => {
            const any = recs.some(r => !r.on);
            recs.forEach(r => r.setOn(any));
            allBtn.textContent = any ? '■ STOP ALL' : '● RECORD ALL';
        });
        pushTimer(setInterval(() => recs.forEach(r => r.tick()), 1000 / fps));

        // ---- Instant replay engine ----
        const sec2 = document.createElement('div');
        sec2.className = 'iso-sec';
        sec2.innerHTML = `<p class="ed-h">INSTANT REPLAY ENGINE — ROLLING BUFFER</p>`;
        const rp = document.createElement('div');
        rp.className = 'rp-wrap';
        const pois = [20, 55, 78];
        rp.innerHTML = `
            <div class="rp-timeline"><div class="rp-buffer"></div>
                ${pois.map(p => `<div class="rp-poi" style="left:${p}%"></div>`).join('')}
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
        const ang = rp.querySelector('.rp-angles');
        chans.forEach((c, i) => {
            const a = document.createElement('div');
            a.className = 'rp-btn' + (i === 0 ? ' sel' : '');
            a.textContent = c.label;
            a.addEventListener('click', () => ang.querySelectorAll('.rp-btn').forEach(x => x.classList.toggle('sel', x === a)));
            ang.appendChild(a);
        });
        const jog = rp.querySelector('.rp-jog input');
        const tc = rp.querySelector('.rp-tc');
        const play = rp.querySelector('.rp-play');
        const upd = () => { play.style.left = jog.value + '%'; tc.textContent = fmt(Math.round(jog.value * 90)); };
        jog.addEventListener('input', upd); upd();
        rp.querySelectorAll('.rp-speeds .rp-btn').forEach(b => b.addEventListener('click',
            () => rp.querySelectorAll('.rp-speeds .rp-btn').forEach(x => x.classList.toggle('sel', x === b))));
        const list = rp.querySelector('.rp-list');
        rp.querySelector('[data-mark]').addEventListener('click', () => {
            const clip = document.createElement('div');
            clip.className = 'rp-clip'; clip.textContent = '◆ ' + tc.textContent;
            list.appendChild(clip);
        });
        rp.querySelector('[data-air]').addEventListener('click', (e) => {
            e.target.textContent = '● ON AIR';
            setTimeout(() => { e.target.textContent = 'TO AIR'; }, 1300);
        });
        sec2.appendChild(rp);
        body.appendChild(sec2);
    }


    register(n => /\biso\b|replay/i.test(n), 'ISO RECORDER · INSTANT REPLAY', renderIsoRecorder);
})();
