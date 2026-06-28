import { register, addStyles, channelsFor, gatherSources, knob, meterBar, pushTimer } from './core.js';
// js/editors/vision-mixer.js
(function () {
    'use strict';
    // helpers imported at module top from ./core.js

    addStyles('twist-editor-vision-mixer', `
        /* ===== Vision mixer ===== */
        /* Stage: PROGRAM monitor | big central T-BAR | PREVIEW monitor */
        .vm-stage{display:flex;gap:14px;align-items:stretch;margin-bottom:18px;}
        .vm-mon{position:relative;flex:1;min-height:210px;background:#04070e;border-radius:18px;
            border:2px solid #394a63;padding:34px 16px 16px;overflow:hidden;
            display:flex;flex-direction:column;justify-content:center;}
        .vm-mon::before{content:'';position:absolute;top:0;left:0;right:0;height:24px;
            background:#394a63;border-radius:15px 15px 0 0;}
        .vm-mon.pgm{border-color:#ff5566;box-shadow:0 0 22px rgba(255,51,68,.4),inset 0 0 36px rgba(255,51,68,.07);}
        .vm-mon.pvw{border-color:#43d977;box-shadow:0 0 22px rgba(51,221,102,.34),inset 0 0 36px rgba(51,221,102,.07);}
        .vm-mon.pgm::before{background:#ff5566;} .vm-mon.pvw::before{background:#43d977;}
        .vm-tag{position:absolute;top:3px;left:18px;font-weight:900;letter-spacing:3px;font-size:12px;color:#000;z-index:2;}
        .vm-feed{flex:1;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;
            color:#fff;text-align:center;letter-spacing:1px;text-shadow:0 0 12px rgba(0,0,0,.7);}
        .vm-dsk{position:absolute;bottom:10px;left:16px;display:flex;gap:6px;}
        .vm-dsk span{background:rgba(160,92,255,.9);color:#000;font-size:10px;font-weight:bold;
            padding:2px 9px;border-radius:8px;letter-spacing:1px;}

        /* The T-bar — the centrepiece. Tall LCARS fader between the monitors. */
        .vm-tbar-wrap{flex:0 0 150px;display:flex;flex-direction:column;align-items:center;gap:8px;
            background:#0a0f1c;border-radius:18px;border:2px solid #2c3a5a;padding:12px 8px;}
        .vm-tbar-wrap .vm-h{margin:0;color:var(--cyan,#00ffff);}
        .vm-tbar-stage{flex:1;display:flex;align-items:stretch;gap:10px;padding:4px 0;}
        .vm-tbar-ends{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;
            font-size:11px;font-weight:900;letter-spacing:1px;padding:6px 0;}
        .vm-tbar-ends .pvw{color:#5bea86;} .vm-tbar-ends .pgm{color:#ff7a88;}
        .vm-tbar{-webkit-appearance:none;appearance:none;writing-mode:vertical-lr;direction:rtl;
            width:58px;flex:1;min-height:150px;border-radius:30px;border:2px solid #34507a;cursor:grab;
            background:linear-gradient(#1ba23f 0%, #0c1830 46%, #0c1830 54%, #ff3344 100%);
            box-shadow:inset 0 0 18px rgba(0,0,0,.7);}
        .vm-tbar:active{cursor:grabbing;}
        .vm-tbar::-webkit-slider-thumb{-webkit-appearance:none;width:78px;height:32px;border-radius:10px;
            background:linear-gradient(#bff7ff,#00e5ff);border:2px solid #fff;cursor:grab;
            box-shadow:0 0 18px var(--cyan,#00ffff),0 3px 6px rgba(0,0,0,.6);}
        .vm-tbar::-moz-range-thumb{width:78px;height:32px;border-radius:10px;background:#00e5ff;border:2px solid #fff;
            box-shadow:0 0 18px var(--cyan,#00ffff);cursor:grab;}
        .vm-pct{font-weight:900;font-size:18px;letter-spacing:1px;color:var(--cyan,#00ffff);}

        .vm-busrow{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
        .vm-buslabel{width:84px;font-weight:900;letter-spacing:1px;font-size:12px;
            padding:9px 10px;border-radius:6px 16px 16px 6px;color:#000;text-align:center;}
        .vm-buslabel.pgm{background:#ff5566;} .vm-buslabel.pvw{background:#43d977;}
        .vm-bus{display:flex;flex-wrap:wrap;gap:6px;flex:1;}
        .vm-btn{padding:10px 12px;min-width:78px;text-align:center;border-radius:4px 14px 14px 4px;background:#17233c;
            border:none;border-left:5px solid #2c3a5a;color:#cfe0ff;cursor:pointer;font-weight:bold;font-size:12px;
            white-space:nowrap;transition:all .1s;user-select:none;}
        .vm-btn:hover{background:#223252;}
        .vm-bus.pgm .vm-btn.sel{background:#ff3344;color:#fff;box-shadow:0 0 14px rgba(255,51,68,.85);}
        .vm-bus.pvw .vm-btn.sel{background:#1ba23f;color:#fff;box-shadow:0 0 14px rgba(51,221,102,.7);}
        .vm-console{display:flex;gap:16px;align-items:stretch;margin-top:18px;flex-wrap:wrap;}
        .vm-sec{background:#0a0f1c;border-radius:16px;border-left:6px solid var(--ed-color,#646DCC);padding:12px 16px;}
        .vm-sec .ed-h{margin-top:0;}
        .vm-trans,.vm-keys{display:flex;flex-direction:column;gap:8px;}
        .vm-tbtn{padding:12px 22px;border-radius:18px;background:#202c46;border:none;
            color:#cfe0ff;cursor:pointer;font-weight:900;letter-spacing:1px;font-size:12px;text-align:center;}
        .vm-tbtn.sel{background:var(--cyan,#00ffff);color:#000;}
        .vm-tbtn.take{background:#ff3344;color:#fff;}
        .vm-key{padding:12px 22px;border-radius:18px;background:#2a2440;border:none;
            color:#d8c8ff;cursor:pointer;font-weight:bold;text-align:center;letter-spacing:1px;}
        .vm-key.on{background:#a05cff;color:#000;box-shadow:0 0 14px rgba(160,92,255,.7);}
    `);

    // ======================= VISION MIXER ===================================
    function renderVisionMixer(body, twist, config) {
        const srcs = channelsFor(twist, config, 'IN', 6);
        const state = { pgm: 0, pvw: Math.min(1, srcs.length - 1), trans: 'MIX', keys: [false, false] };
        const labelOf = i => (srcs[i] ? srcs[i].label : '—');

        // Stage: PROGRAM monitor | big central T-BAR | PREVIEW monitor.
        const mons = document.createElement('div');
        mons.className = 'vm-stage';
        mons.innerHTML = `
            <div class="vm-mon pgm"><span class="vm-tag">PROGRAM</span><div class="vm-feed" data-pgm></div><div class="vm-dsk" data-dsk></div></div>
            <div class="vm-tbar-wrap">
                <p class="ed-h vm-h">T-BAR</p>
                <div class="vm-tbar-stage">
                    <div class="vm-tbar-ends"><span class="pvw">PVW ▲</span><span class="pgm">PGM ▼</span></div>
                    <input type="range" class="vm-tbar" min="0" max="100" value="0">
                </div>
                <div class="vm-pct" data-pct>0%</div>
            </div>
            <div class="vm-mon pvw"><span class="vm-tag">PREVIEW</span><div class="vm-feed" data-pvw></div></div>`;
        body.appendChild(mons);

        const busWrap = document.createElement('div');
        const mkBus = (kind) => {
            const row = document.createElement('div');
            row.className = 'vm-busrow';
            row.innerHTML = `<div class="vm-buslabel ${kind}">${kind === 'pgm' ? 'PROGRAM' : 'PREVIEW'}</div>`;
            const bus = document.createElement('div');
            bus.className = 'vm-bus ' + kind;
            srcs.forEach((s, i) => {
                const b = document.createElement('div');
                b.className = 'vm-btn';
                b.textContent = s.label;
                b.style.borderLeft = '4px solid ' + s.color;
                b.addEventListener('click', () => { state[kind] = i; sync(); });
                bus.appendChild(b);
            });
            row.appendChild(bus);
            return row;
        };
        busWrap.appendChild(mkBus('pgm'));
        busWrap.appendChild(mkBus('pvw'));
        body.appendChild(busWrap);

        const ctl = document.createElement('div');
        ctl.className = 'vm-console';
        ctl.innerHTML = `
            <div class="vm-sec"><p class="ed-h">TRANSITION</p><div class="vm-trans">
                <div class="vm-tbtn" data-t="CUT">CUT</div>
                <div class="vm-tbtn sel" data-t="MIX">MIX</div>
                <div class="vm-tbtn" data-t="WIPE">WIPE</div>
                <div class="vm-tbtn take" data-take>TAKE / AUTO</div>
            </div></div>
            <div class="vm-sec"><p class="ed-h">DOWNSTREAM KEYERS</p><div class="vm-keys">
                <div class="vm-key" data-key="0">DSK 1 · LOWER-THIRD</div>
                <div class="vm-key" data-key="1">DSK 2 · LOGO</div>
            </div></div>`;
        body.appendChild(ctl);

        function take() { const t = state.pgm; state.pgm = state.pvw; state.pvw = t; sync(); }

        ctl.querySelectorAll('.vm-tbtn[data-t]').forEach(b => b.addEventListener('click', () => {
            state.trans = b.dataset.t;
            ctl.querySelectorAll('.vm-tbtn[data-t]').forEach(x => x.classList.toggle('sel', x === b));
        }));
        ctl.querySelector('[data-take]').addEventListener('click', take);
        ctl.querySelectorAll('.vm-key').forEach(k => k.addEventListener('click', () => {
            const i = +k.dataset.key; state.keys[i] = !state.keys[i]; sync();
        }));
        const tbar = mons.querySelector('.vm-tbar');
        const pct = mons.querySelector('[data-pct]');
        tbar.addEventListener('input', () => {
            pct.textContent = tbar.value + '%';
            if (+tbar.value >= 100) { take(); tbar.value = 0; pct.textContent = '0%'; }
        });

        function sync() {
            mons.querySelector('[data-pgm]').textContent = labelOf(state.pgm);
            mons.querySelector('[data-pvw]').textContent = labelOf(state.pvw);
            const dsk = mons.querySelector('[data-dsk]');
            dsk.innerHTML = '';
            if (state.keys[0]) dsk.innerHTML += '<span>DSK 1</span>';
            if (state.keys[1]) dsk.innerHTML += '<span>DSK 2</span>';
            busWrap.querySelectorAll('.vm-bus.pgm .vm-btn').forEach((b, i) => b.classList.toggle('sel', i === state.pgm));
            busWrap.querySelectorAll('.vm-bus.pvw .vm-btn').forEach((b, i) => b.classList.toggle('sel', i === state.pvw));
            ctl.querySelectorAll('.vm-key').forEach((k, i) => k.classList.toggle('on', state.keys[i]));
        }
        sync();
    }


    register(n => /video\s*mix|vision|switch/i.test(n), 'VISION MIXER', renderVisionMixer);
})();
