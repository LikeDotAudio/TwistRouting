// js/editors/audio-mixer.js
(function () {
    'use strict';
    const { register, addStyles, channelsFor, gatherSources, knob, meterBar, pushTimer } = window.Editors;

    addStyles('twist-editor-audio-mixer', `
        /* ===== Audio mixer — chunky, finger-friendly console ===== */
        /* LCARS layout: rounded left rail (layer switch + deco elbows) | strips */
        .am-console{display:flex;gap:14px;align-items:stretch;min-height:430px;}
        .am-rail{flex:0 0 158px;display:flex;flex-direction:column;gap:8px;padding:12px 10px;
            background:#0a0f1c;border:2px solid #2c3a5a;border-radius:44px 10px 10px 44px;}
        .am-rail-h{color:var(--cyan,#00ffff);font-size:10px;letter-spacing:2px;font-weight:bold;
            text-align:center;text-transform:uppercase;margin-bottom:2px;}
        .am-layerbtn{padding:16px 10px;border-radius:24px 6px 6px 24px;background:#26324d;color:#cfe0ff;
            font-weight:900;letter-spacing:1px;font-size:14px;text-align:center;cursor:pointer;
            white-space:nowrap;transition:filter .12s,box-shadow .12s,background .12s;}
        .am-layerbtn:hover{filter:brightness(1.12);}
        .am-layerbtn.sel{background:var(--ed-color,#FF9C63);color:#000;box-shadow:0 0 14px rgba(255,156,99,.55);}
        .am-layerbtn.static{cursor:default;}
        /* Decorative LCARS elbow blocks down the rail */
        .am-elbow{flex:0 0 auto;height:30px;border-radius:24px 6px 6px 24px;}
        .am-elbow.a{background:#C67825;} .am-elbow.b{background:#646DCC;} .am-elbow.c{background:#9C6B9C;}
        .am-rail-foot{flex:1 1 auto;min-height:36px;border-radius:6px 6px 44px 6px;background:#16223c;}
        .am-strips{flex:1 1 auto;min-width:0;display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;}
        .am-strip{flex:0 0 auto;width:128px;background:#0d1424;border:1px solid #233150;
            border-radius:12px;padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:12px;}
        .am-strip.master{background:#1a1430;border-color:#4a3a6e;}
        .am-strip.group{border-width:2px;border-style:solid;}
        .am-name{font-size:12px;font-weight:bold;letter-spacing:.5px;text-align:center;width:100%;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#cfe0ff;}
        .am-spill{font-size:11px;font-weight:900;letter-spacing:1px;border:none;border-radius:8px;
            padding:6px 12px;cursor:pointer;background:#2a3a5e;color:#cfe0ff;}
        .am-spill:hover{filter:brightness(1.15);}
        .am-spill.on{background:var(--cyan,#00ffff);color:#000;box-shadow:0 0 10px rgba(0,255,255,.5);}
        .am-knob{width:62px;height:62px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#37456a,#10182b);
            border:3px solid #475a86;position:relative;cursor:ns-resize;box-shadow:0 2px 6px rgba(0,0,0,.5);}
        .am-knob::after{content:'';position:absolute;left:50%;top:6px;width:3px;height:18px;background:var(--cyan,#00ffff);
            transform-origin:50% 25px;transform:translateX(-50%) rotate(var(--rot,0deg));border-radius:2px;}
        .am-klabel{font-size:9px;letter-spacing:1px;color:#7e93b5;margin-top:-6px;}
        .am-eq{display:flex;gap:8px;}
        .am-eq .am-kw{display:flex;flex-direction:column;align-items:center;}
        .am-eq .am-knob{width:40px;height:40px;}
        .am-eq .am-knob::after{height:12px;top:4px;transform-origin:50% 16px;}
        .am-ms{display:flex;gap:8px;}
        .am-ms button{font-size:13px;font-weight:900;letter-spacing:1px;border:none;border-radius:8px;
            padding:8px 16px;cursor:pointer;background:#26324d;color:#cfe0ff;}
        .am-ms button.mute.on{background:#ff3344;color:#fff;box-shadow:0 0 12px rgba(255,51,68,.6);}
        .am-ms button.solo.on{background:#f5c542;color:#000;box-shadow:0 0 12px rgba(245,197,66,.6);}
        .am-fadarea{display:flex;gap:10px;align-items:flex-end;height:240px;}
        .am-fader{-webkit-appearance:none;appearance:none;writing-mode:vertical-lr;direction:rtl;
            width:46px;height:230px;border-radius:24px;border:2px solid #34507a;cursor:grab;
            background:linear-gradient(#0c1830,#16223c);box-shadow:inset 0 0 14px rgba(0,0,0,.6);}
        .am-fader:active{cursor:grabbing;}
        .am-fader::-webkit-slider-thumb{-webkit-appearance:none;width:60px;height:34px;border-radius:9px;
            background:linear-gradient(#eef4ff,#b9c8e6);border:2px solid #fff;cursor:grab;
            box-shadow:0 3px 6px rgba(0,0,0,.55),0 0 8px rgba(207,224,255,.5);}
        .am-fader::-moz-range-thumb{width:60px;height:34px;border-radius:9px;background:#cfe0ff;border:2px solid #fff;cursor:grab;}
        .am-strip.master .am-fader::-webkit-slider-thumb{background:linear-gradient(#e8d8ff,#c3a8ff);}
        .am-vu{width:16px;height:230px;border-radius:5px;background:#0c1322;overflow:hidden;display:flex;flex-direction:column-reverse;}
        .am-vu > i{display:block;width:100%;height:0%;background:linear-gradient(#19c54b,#e6e23a 70%,#ff3b3b);}
        .am-db{font-size:11px;font-weight:bold;color:#9fb6cc;}
        /* Sub-mix breakout (a spilled group's individual channels) */
        .am-submix{margin-top:16px;background:#0a1120;border:1px solid #2c3a5a;border-left:5px solid var(--cyan,#00ffff);
            border-radius:6px 14px 14px 6px;padding:12px 14px;}
        .am-submix-h{display:flex;justify-content:space-between;align-items:center;color:var(--cyan,#00ffff);
            font-size:12px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;text-transform:uppercase;}
        .am-submix-close{cursor:pointer;color:#9fb6cc;font-size:11px;font-weight:900;}
        .am-submix-close:hover{color:#fff;}
        .am-substrips .am-strip{background:#0e1730;}
    `);

    // Gather routed audio PRESERVING groups: a dropped group of channels becomes a
    // single bus entry {group:true, children:[...]}; loose nodes stay individual.
    function gatherGrouped(twist) {
        const dz = twist && twist.querySelector('.drop-zone');
        if (!dz) return [];
        const out = [];
        const info = (n) => ({ label: (n.innerText || '').trim().split('\n')[0], color: window.getComputedStyle(n).color || '#FF9C63' });
        dz.querySelectorAll(':scope > .signal-node').forEach(n => {
            if (n.classList.contains('dropped-group')) {
                const head = n.querySelector('.dropped-group-header');
                const label = ((head ? head.innerText : n.innerText) || '').trim().split('\n')[0].replace(/\s*×\s*\d+\s*$/, '');
                const children = [...n.querySelectorAll('.dropped-group-children .signal-node')].map(info);
                out.push({ label, color: window.getComputedStyle(n).color || '#FF9C63', group: true, children });
            } else {
                out.push(info(n));
            }
        });
        return out;
    }

    // ======================= AUDIO MIXER ====================================
    function renderAudioMixer(body, twist, config) {
        // Routed groups collapse to one fader; fall back to input slots when empty.
        let chans = gatherGrouped(twist);
        if (!chans.length) chans = channelsFor(twist, config, 'CH', 8);

        const LAYER = 8;
        let layer = 0;
        const layers = Math.ceil(chans.length / LAYER);
        let spilledLabel = null;

        const console_ = document.createElement('div');
        console_.className = 'am-console';

        // ----- LEFT LCARS RAIL: layer switch (vertical) + decorative elbows -----
        const rail = document.createElement('div');
        rail.className = 'am-rail';
        rail.innerHTML = `<div class="am-rail-h">Layers</div>`;
        const layerBtns = [];
        if (layers > 1) {
            for (let i = 0; i < layers; i++) {
                const b = document.createElement('div');
                b.className = 'am-layerbtn' + (i === 0 ? ' sel' : '');
                b.textContent = `CH ${i * LAYER + 1}–${Math.min((i + 1) * LAYER, chans.length)}`;
                b.addEventListener('click', () => {
                    layer = i;
                    layerBtns.forEach((x, j) => x.classList.toggle('sel', j === i));
                    draw();
                });
                rail.appendChild(b);
                layerBtns.push(b);
            }
        } else {
            const b = document.createElement('div');
            b.className = 'am-layerbtn sel static';
            b.textContent = 'MAIN';
            rail.appendChild(b);
        }
        rail.insertAdjacentHTML('beforeend',
            `<div class="am-elbow a"></div><div class="am-elbow b"></div><div class="am-elbow c"></div><div class="am-rail-foot"></div>`);
        console_.appendChild(rail);

        const strips = document.createElement('div');
        strips.className = 'am-strips';
        console_.appendChild(strips);
        body.appendChild(console_);

        const submix = document.createElement('div');
        submix.className = 'am-submix';
        submix.style.display = 'none';
        body.appendChild(submix);

        function renderSubmix(group) {
            submix.innerHTML = '';
            const h = document.createElement('div');
            h.className = 'am-submix-h';
            h.innerHTML = `<span>Sub-mix · ${group.label} · ${group.children.length} ch</span><span class="am-submix-close">▲ Collapse</span>`;
            h.querySelector('.am-submix-close').addEventListener('click', () => toggleSpill(group));
            submix.appendChild(h);
            const row = document.createElement('div');
            row.className = 'am-strips am-substrips';
            group.children.forEach(ch => row.appendChild(stripEl(ch, {})));
            submix.appendChild(row);
            submix.style.display = '';
        }

        function toggleSpill(group) {
            spilledLabel = (spilledLabel === group.label) ? null : group.label;
            if (spilledLabel) renderSubmix(group);
            else { submix.style.display = 'none'; submix.innerHTML = ''; }
            strips.querySelectorAll('.am-spill').forEach(b => {
                const on = b.dataset.g === spilledLabel;
                b.classList.toggle('on', on);
                b.textContent = on ? '▲ UNSPILL' : '⤋ SPILL';
            });
        }

        function stripEl(c, opts) {
            opts = opts || {};
            const master = !!opts.master;
            const el = document.createElement('div');
            el.className = 'am-strip' + (master ? ' master' : '') + (c.group ? ' group' : '');
            if (c.group && c.color) el.style.borderColor = c.color;

            const name = document.createElement('div');
            name.className = 'am-name';
            name.textContent = master ? 'MASTER' : (c.group ? `${c.label} ×${c.children.length}` : c.label);
            name.style.color = master ? '#d8c8ff' : (c.color || '#cfe0ff');
            el.appendChild(name);

            // A group bus carries a SPILL toggle to break its channels out below.
            if (c.group) {
                const sp = document.createElement('button');
                sp.className = 'am-spill' + (spilledLabel === c.label ? ' on' : '');
                sp.dataset.g = c.label;
                sp.textContent = (spilledLabel === c.label) ? '▲ UNSPILL' : '⤋ SPILL';
                sp.addEventListener('click', () => toggleSpill(c));
                el.appendChild(sp);
            }

            if (!master) {
                const eq = document.createElement('div');
                eq.className = 'am-eq';
                ['HI', 'MID', 'LO'].forEach(l => eq.appendChild(knob(l, 0.5, c.color)));
                el.appendChild(eq);
                el.appendChild(knob('PAN', 0.5, '#9fb6cc'));
                const ms = document.createElement('div');
                ms.className = 'am-ms';
                ms.innerHTML = `<button class="mute">M</button><button class="solo">S</button>`;
                ms.querySelector('.mute').addEventListener('click', e => e.target.classList.toggle('on'));
                ms.querySelector('.solo').addEventListener('click', e => e.target.classList.toggle('on'));
                el.appendChild(ms);
            } else {
                el.appendChild(knob('BAL', 0.5, '#d8c8ff'));
            }

            const fa = document.createElement('div');
            fa.className = 'am-fadarea';
            const f = document.createElement('input');
            f.type = 'range'; f.className = 'am-fader'; f.min = 0; f.max = 100; f.value = master ? 80 : 70;
            fa.appendChild(f);
            fa.appendChild(meterBar('am-vu'));
            if (master) fa.appendChild(meterBar('am-vu'));
            el.appendChild(fa);
            const db = document.createElement('div');
            db.className = 'am-db'; db.textContent = '0 dB';
            f.addEventListener('input', () => { db.textContent = (Math.round((f.value - 70) / 7 * 10) / 10) + ' dB'; });
            el.appendChild(db);
            return el;
        }

        function draw() {
            strips.innerHTML = '';
            chans.slice(layer * LAYER, layer * LAYER + LAYER).forEach(c => strips.appendChild(stripEl(c, {})));
            strips.appendChild(stripEl({ label: 'MASTER' }, { master: true }));
        }
        draw();
    }

    register(n => /audio\s*mix/i.test(n), 'AUDIO MIXER · CONSOLE', renderAudioMixer);
})();
