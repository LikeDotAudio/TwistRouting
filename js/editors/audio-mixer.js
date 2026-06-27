// js/editors/audio-mixer.js
(function () {
    'use strict';
    const { register, addStyles, channelsFor, gatherSources, knob, meterBar, pushTimer } = window.Editors;

    addStyles('twist-editor-audio-mixer', `
        /* ===== Audio mixer — chunky, finger-friendly console ===== */
        .am-wrap{display:flex;gap:18px;align-items:flex-start;}
        .am-layers{display:flex;gap:8px;margin-bottom:14px;}
        .am-strips{display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;}
        .am-strip{flex:0 0 auto;width:128px;background:#0d1424;border:1px solid #233150;
            border-radius:12px;padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:12px;}
        .am-strip.master{background:#1a1430;border-color:#4a3a6e;}
        .am-name{font-size:12px;font-weight:bold;letter-spacing:.5px;text-align:center;width:100%;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#cfe0ff;}
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
    `);

    // ======================= AUDIO MIXER ====================================
    function renderAudioMixer(body, twist, config) {
        const chans = channelsFor(twist, config, 'CH', 8);
        const LAYER = 8;
        let layer = 0;
        const layers = Math.ceil(chans.length / LAYER);

        if (layers > 1) {
            const lr = document.createElement('div');
            lr.className = 'am-layers';
            for (let i = 0; i < layers; i++) {
                const b = document.createElement('div');
                b.className = 'mv-pbtn' + (i === 0 ? ' sel' : '');
                b.textContent = `CH ${i * LAYER + 1}–${Math.min((i + 1) * LAYER, chans.length)}`;
                b.addEventListener('click', () => { layer = i; lr.querySelectorAll('.mv-pbtn').forEach((x, j) => x.classList.toggle('sel', j === i)); draw(); });
                lr.appendChild(b);
            }
            body.appendChild(lr);
        }

        const strips = document.createElement('div');
        strips.className = 'am-strips';
        body.appendChild(strips);

        function strip(c, master) {
            const el = document.createElement('div');
            el.className = 'am-strip' + (master ? ' master' : '');
            const name = document.createElement('div');
            name.className = 'am-name'; name.textContent = master ? 'MASTER' : c.label;
            name.style.color = master ? '#d8c8ff' : c.color;
            el.appendChild(name);
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
            const db = document.createElement('div'); db.className = 'am-db'; db.textContent = '0 dB';
            f.addEventListener('input', () => { db.textContent = (Math.round((f.value - 70) / 7 * 10) / 10) + ' dB'; });
            el.appendChild(db);
            return el;
        }

        function draw() {
            strips.innerHTML = '';
            chans.slice(layer * LAYER, layer * LAYER + LAYER).forEach(c => strips.appendChild(strip(c, false)));
            strips.appendChild(strip({ label: 'MASTER' }, true));
        }
        draw();
    }


    register(n => /audio\s*mix/i.test(n), 'AUDIO MIXER · CONSOLE', renderAudioMixer);
})();
