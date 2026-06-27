// js/editors.js
// Full-screen, role-specific editors for the four "production" twists:
//   Video Mixer  -> vision mixer (M/E buses, T-bar, keyers, transitions, tally)
//   Multi Viewer -> multiviewer (tally borders, UMD labels, layout presets, VU)
//   Audio Mixer  -> mixing console (channel strips: EQ, pan, fader, meters, master)
//   Intercom     -> key-panel matrix (talk/listen, volume, IFB, beltpacks)
// matrix.js's openTwistModal() calls Editors.openForTwist(twist); anything that
// isn't one of the four falls through to the generic switcher-matrix modal.
(function () {
    'use strict';

    // ---- shared helpers -----------------------------------------------------
    const STYLE_ID = 'twist-editor-styles';
    let overlay = null;
    let timers = [];          // meter/VU intervals to clear on close

    function clearTimers() { timers.forEach(t => clearInterval(t)); timers = []; }

    // Collect the source feeds routed into a twist (expanding dropped groups).
    function gatherSources(twist) {
        const dz = twist && twist.querySelector('.drop-zone');
        const out = [];
        const push = (n) => {
            const label = (n.innerText || '').trim().split('\n')[0];
            if (!label) return;
            out.push({ label, color: window.getComputedStyle(n).color || '#4d94ff' });
        };
        if (dz) {
            dz.querySelectorAll(':scope > .signal-node').forEach(n => {
                if (n.classList.contains('dropped-group')) {
                    const kids = n.querySelectorAll('.dropped-group-children .signal-node');
                    if (kids.length) kids.forEach(push); else push(n);
                } else push(n);
            });
        }
        return out;
    }

    function parseConfig(twist) {
        if (twist && twist.dataset.config) {
            try { return JSON.parse(twist.dataset.config); } catch (e) {}
        }
        return null;
    }

    // Channels for an editor: real routed sources, else the twist's input slots,
    // else a sensible default count.
    function channelsFor(twist, config, fallbackPrefix, fallbackCount) {
        const src = gatherSources(twist);
        if (src.length) return src;
        if (config && Array.isArray(config.inputs) && config.inputs.length) {
            return config.inputs.map(i => ({ label: i, color: '#4d94ff', empty: true }));
        }
        return Array.from({ length: fallbackCount }, (_, i) => ({
            label: `${fallbackPrefix} ${i + 1}`, color: '#4d94ff', empty: true
        }));
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        .ed-overlay{position:fixed;inset:0;z-index:2000;display:none;flex-direction:column;
            background:radial-gradient(circle at 50% 30%,#0d1730 0%,#03060f 85%);
            font-family:Arial,Helvetica,sans-serif;color:#e0f0ff;}
        .ed-overlay.open{display:flex;}
        .ed-topbar{flex:0 0 auto;display:flex;align-items:center;gap:18px;height:54px;padding:0 10px 0 0;}
        .ed-topbar::before{content:'';width:160px;height:100%;
            border-left:64px solid var(--ed-color,#646DCC);border-top:22px solid var(--ed-color,#646DCC);
            border-top-left-radius:46px;border-bottom-left-radius:46px;box-sizing:border-box;}
        .ed-title{flex:1;font-weight:900;letter-spacing:3px;font-size:18px;text-transform:uppercase;
            margin-left:-150px;color:#fff;text-shadow:0 0 10px rgba(0,0,0,.6);}
        .ed-close{cursor:pointer;font-size:30px;font-weight:bold;line-height:1;color:#000;
            background:var(--ed-color,#646DCC);border-radius:14px;padding:2px 16px 5px;}
        .ed-close:hover{filter:brightness(1.15);box-shadow:0 0 14px rgba(255,255,255,.4);}
        .ed-body{flex:1;min-height:0;overflow:auto;padding:16px 22px 22px;}
        .ed-h{color:var(--cyan,#00ffff);font-size:11px;font-weight:bold;letter-spacing:2px;
            text-transform:uppercase;margin:0 0 8px;}

        /* ===== Vision mixer ===== */
        .vm-mons{display:flex;gap:16px;margin-bottom:16px;}
        .vm-mon{flex:1;min-height:120px;background:#000;border-radius:8px;border:3px solid #394a63;
            display:flex;flex-direction:column;justify-content:space-between;
            padding:8px 10px;position:relative;overflow:hidden;}
        .vm-mon.pgm{border-color:#ff3344;box-shadow:0 0 18px rgba(255,51,68,.55);}
        .vm-mon.pvw{border-color:#33dd66;box-shadow:0 0 18px rgba(51,221,102,.45);}
        .vm-mon .vm-tag{font-weight:900;letter-spacing:2px;font-size:12px;}
        .vm-mon.pgm .vm-tag{color:#ff6677;} .vm-mon.pvw .vm-tag{color:#5bea86;}
        .vm-mon .vm-feed{flex:1;display:flex;align-items:center;justify-content:center;
            font-size:20px;font-weight:bold;color:#fff;text-align:center;}
        .vm-mon .vm-dsk{position:absolute;bottom:8px;left:10px;display:flex;gap:6px;}
        .vm-mon .vm-dsk span{background:rgba(160,92,255,.85);color:#000;font-size:10px;font-weight:bold;
            padding:2px 8px;border-radius:3px;letter-spacing:1px;}
        .vm-busrow{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
        .vm-buslabel{width:64px;font-weight:900;letter-spacing:1px;font-size:12px;}
        .vm-buslabel.pgm{color:#ff6677;} .vm-buslabel.pvw{color:#5bea86;}
        .vm-bus{display:flex;flex-wrap:wrap;gap:6px;flex:1;}
        .vm-btn{padding:12px 14px;min-width:74px;text-align:center;border-radius:5px;background:#16223c;
            border:1px solid #2c3a5a;color:#cfe0ff;cursor:pointer;font-weight:bold;font-size:12px;
            white-space:nowrap;transition:all .1s;user-select:none;}
        .vm-btn:hover{background:#1f2d4d;}
        .vm-bus.pgm .vm-btn.sel{background:#ff3344;color:#fff;border-color:#ff9aa6;box-shadow:0 0 14px rgba(255,51,68,.85);}
        .vm-bus.pvw .vm-btn.sel{background:#1ba23f;color:#fff;border-color:#86f5a4;box-shadow:0 0 14px rgba(51,221,102,.7);}
        .vm-ctl{display:flex;gap:26px;align-items:flex-end;margin-top:18px;flex-wrap:wrap;}
        .vm-tbar-box{display:flex;flex-direction:column;align-items:center;gap:8px;}
        .vm-tbar{-webkit-appearance:slider-vertical;writing-mode:vertical-lr;direction:rtl;
            width:34px;height:150px;accent-color:var(--cyan,#00ffff);cursor:grab;}
        .vm-tbar-box .vm-h{margin:0;}
        .vm-trans{display:flex;flex-direction:column;gap:8px;}
        .vm-tbtn{padding:10px 18px;border-radius:5px;background:#202c46;border:1px solid #38476a;
            color:#cfe0ff;cursor:pointer;font-weight:900;letter-spacing:1px;font-size:12px;text-align:center;}
        .vm-tbtn.sel{background:var(--cyan,#00ffff);color:#000;border-color:#fff;}
        .vm-tbtn.take{background:#ff3344;color:#fff;border-color:#ff9aa6;}
        .vm-keys{display:flex;flex-direction:column;gap:8px;}
        .vm-key{padding:10px 18px;border-radius:5px;background:#2a2440;border:1px solid #4a3a6e;
            color:#d8c8ff;cursor:pointer;font-weight:bold;text-align:center;letter-spacing:1px;}
        .vm-key.on{background:#a05cff;color:#000;border-color:#d3bcff;box-shadow:0 0 14px rgba(160,92,255,.7);}

        /* ===== Multi viewer ===== */
        .mv-presets{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
        .mv-pbtn{padding:9px 16px;border-radius:5px;background:#16223c;border:1px solid #2c3a5a;
            color:#cfe0ff;cursor:pointer;font-weight:bold;letter-spacing:1px;font-size:12px;}
        .mv-pbtn.sel{background:var(--cyan,#00ffff);color:#000;border-color:#fff;}
        .mv-grid{display:grid;gap:10px;}
        .mv-win{background:#05080f;border:3px solid #2a3550;border-radius:6px;min-height:120px;
            display:flex;flex-direction:column;overflow:hidden;cursor:grab;position:relative;}
        .mv-win.pgm{border-color:#ff3344;box-shadow:0 0 0 1px #ff3344, 0 0 16px rgba(255,51,68,.5);}
        .mv-win.pvw{border-color:#33dd66;box-shadow:0 0 0 1px #33dd66, 0 0 16px rgba(51,221,102,.45);}
        .mv-win.dragging{opacity:.4;}
        .mv-screen{flex:1;display:flex;align-items:center;justify-content:center;color:#56708f;
            font-size:13px;letter-spacing:1px;background:repeating-linear-gradient(45deg,#070b14 0 10px,#0a0f1c 10px 20px);}
        .mv-meter{position:absolute;right:5px;top:8px;bottom:26px;width:7px;border-radius:3px;
            background:#0c1322;overflow:hidden;display:flex;flex-direction:column-reverse;}
        .mv-meter > i{display:block;background:linear-gradient(#19c54b,#e6e23a 70%,#ff3b3b);width:100%;height:0%;}
        .mv-umd{flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:24px;
            font-weight:bold;font-size:12px;letter-spacing:1px;color:#000;background:var(--umd,#9fb6cc);}
        .mv-umd[contenteditable]:focus{outline:2px solid var(--cyan);}
        .mv-tally{position:absolute;top:6px;left:6px;font-size:9px;font-weight:900;letter-spacing:1px;
            padding:1px 6px;border-radius:3px;background:#33405e;color:#cfe0ff;}
        .mv-win.pgm .mv-tally{background:#ff3344;color:#fff;}
        .mv-win.pvw .mv-tally{background:#33dd66;color:#000;}

        /* ===== Audio mixer ===== */
        .am-wrap{display:flex;gap:18px;align-items:flex-start;}
        .am-layers{display:flex;gap:8px;margin-bottom:12px;}
        .am-strips{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;}
        .am-strip{flex:0 0 auto;width:84px;background:#0d1424;border:1px solid #233150;
            border-radius:8px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:8px;}
        .am-strip.master{background:#1a1430;border-color:#4a3a6e;}
        .am-name{font-size:10px;font-weight:bold;letter-spacing:.5px;text-align:center;width:100%;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#cfe0ff;}
        .am-knob{width:42px;height:42px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#37456a,#10182b);
            border:2px solid #475a86;position:relative;cursor:ns-resize;}
        .am-knob::after{content:'';position:absolute;left:50%;top:4px;width:2px;height:13px;background:var(--cyan,#00ffff);
            transform-origin:50% 17px;transform:translateX(-50%) rotate(var(--rot,0deg));border-radius:2px;}
        .am-klabel{font-size:8px;letter-spacing:1px;color:#7e93b5;margin-top:-4px;}
        .am-eq{display:flex;gap:4px;}
        .am-eq .am-kw{display:flex;flex-direction:column;align-items:center;}
        .am-eq .am-knob{width:26px;height:26px;}
        .am-eq .am-knob::after{height:8px;top:3px;transform-origin:50% 10px;}
        .am-ms{display:flex;gap:4px;}
        .am-ms button{font-size:9px;font-weight:900;letter-spacing:1px;border:none;border-radius:3px;
            padding:3px 7px;cursor:pointer;background:#26324d;color:#cfe0ff;}
        .am-ms button.mute.on{background:#ff3344;color:#fff;}
        .am-ms button.solo.on{background:#f5c542;color:#000;}
        .am-fadarea{display:flex;gap:6px;align-items:flex-end;height:170px;}
        .am-fader{-webkit-appearance:slider-vertical;writing-mode:vertical-lr;direction:rtl;width:26px;height:160px;accent-color:#cfe0ff;cursor:grab;}
        .am-vu{width:10px;height:160px;border-radius:3px;background:#0c1322;overflow:hidden;display:flex;flex-direction:column-reverse;}
        .am-vu > i{display:block;width:100%;height:0%;background:linear-gradient(#19c54b,#e6e23a 70%,#ff3b3b);}
        .am-db{font-size:9px;color:#7e93b5;}

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
        `;
        document.head.appendChild(s);
    }

    function ensureOverlay() {
        injectStyles();
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'ed-overlay';
        overlay.innerHTML = `
            <div class="ed-topbar">
                <span class="ed-title"></span>
                <span class="ed-close" title="Close">&times;</span>
            </div>
            <div class="ed-body"></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.ed-close').addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close();
        });
        return overlay;
    }

    function close() {
        clearTimers();
        if (overlay) overlay.classList.remove('open');
    }

    function open(title, color, build) {
        const ov = ensureOverlay();
        clearTimers();
        ov.style.setProperty('--ed-color', color || '#646DCC');
        ov.querySelector('.ed-title').textContent = title;
        const body = ov.querySelector('.ed-body');
        body.innerHTML = '';
        build(body);
        ov.classList.add('open');
    }

    // A reusable rotary knob (vertical drag changes value 0..1 -> -135..+135deg).
    function knob(label, value, color) {
        const wrap = document.createElement('div');
        wrap.className = 'am-kw';
        const k = document.createElement('div');
        k.className = 'am-knob';
        k.style.setProperty('--cyan', color || '#00ffff');
        let v = value == null ? 0.5 : value;
        const apply = () => k.style.setProperty('--rot', (v * 270 - 135) + 'deg');
        apply();
        let startY = 0, startV = 0, dragging = false;
        k.addEventListener('mousedown', (e) => { dragging = true; startY = e.clientY; startV = v; e.preventDefault(); });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            v = Math.max(0, Math.min(1, startV + (startY - e.clientY) / 120));
            apply();
        });
        window.addEventListener('mouseup', () => { dragging = false; });
        wrap.appendChild(k);
        if (label) { const l = document.createElement('div'); l.className = 'am-klabel'; l.textContent = label; wrap.appendChild(l); }
        return wrap;
    }

    // Animated meter: returns the bar element; caller registers the interval.
    function meterBar(cls) {
        const m = document.createElement('div');
        m.className = cls;
        const fill = document.createElement('i');
        m.appendChild(fill);
        let lvl = 0.3;
        timers.push(setInterval(() => {
            lvl = Math.max(0.05, Math.min(1, lvl + (Math.random() - 0.5) * 0.4));
            fill.style.height = (lvl * 100) + '%';
        }, 120));
        return m;
    }

    // ======================= VISION MIXER ===================================
    function renderVisionMixer(body, twist, config) {
        const srcs = channelsFor(twist, config, 'IN', 6);
        const state = { pgm: 0, pvw: Math.min(1, srcs.length - 1), trans: 'MIX', keys: [false, false] };
        const labelOf = i => (srcs[i] ? srcs[i].label : '—');

        const mons = document.createElement('div');
        mons.className = 'vm-mons';
        mons.innerHTML = `
            <div class="vm-mon pgm"><span class="vm-tag">● PROGRAM</span><div class="vm-feed" data-pgm></div><div class="vm-dsk" data-dsk></div></div>
            <div class="vm-mon pvw"><span class="vm-tag">● PREVIEW</span><div class="vm-feed" data-pvw></div></div>`;
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
        ctl.className = 'vm-ctl';
        ctl.innerHTML = `
            <div class="vm-tbar-box"><p class="ed-h vm-h">T-BAR</p>
                <input type="range" class="vm-tbar" min="0" max="100" value="0"></div>
            <div><p class="ed-h">TRANSITION</p><div class="vm-trans">
                <div class="vm-tbtn" data-t="CUT">CUT</div>
                <div class="vm-tbtn sel" data-t="MIX">MIX</div>
                <div class="vm-tbtn" data-t="WIPE">WIPE</div>
                <div class="vm-tbtn take" data-take>TAKE / AUTO</div>
            </div></div>
            <div><p class="ed-h">DOWNSTREAM KEYERS</p><div class="vm-keys">
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
        const tbar = ctl.querySelector('.vm-tbar');
        tbar.addEventListener('input', () => {
            if (+tbar.value >= 100) { take(); tbar.value = 0; }
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

    // ======================= MULTI VIEWER ===================================
    function renderMultiViewer(body, twist, config) {
        const wins = channelsFor(twist, config, 'MV', 9).map((s, i) => ({
            label: s.label, color: s.color, tally: i === 0 ? 'pgm' : (i === 1 ? 'pvw' : 'off')
        }));
        const PRESETS = { '2×2': 2, '3×3': 3, '4×4': 4, 'PIP': 0 };
        let preset = '3×3';

        const pbar = document.createElement('div');
        pbar.className = 'mv-presets';
        Object.keys(PRESETS).forEach(name => {
            const b = document.createElement('div');
            b.className = 'mv-pbtn' + (name === preset ? ' sel' : '');
            b.textContent = name;
            b.addEventListener('click', () => { preset = name; draw(); });
            pbar.appendChild(b);
        });
        body.appendChild(pbar);

        const grid = document.createElement('div');
        grid.className = 'mv-grid';
        body.appendChild(grid);

        let dragIdx = null;
        function draw() {
            pbar.querySelectorAll('.mv-pbtn').forEach(b => b.classList.toggle('sel', b.textContent === preset));
            const cols = PRESETS[preset] || 3;
            grid.style.gridTemplateColumns = preset === 'PIP' ? '3fr 1fr' : `repeat(${cols},1fr)`;
            grid.innerHTML = '';
            wins.forEach((w, i) => {
                const el = document.createElement('div');
                el.className = 'mv-win ' + (w.tally === 'pgm' ? 'pgm' : w.tally === 'pvw' ? 'pvw' : '');
                if (preset === 'PIP' && i === 0) el.style.gridRow = `span ${Math.max(2, wins.length - 1)}`;
                el.draggable = true;
                el.innerHTML = `
                    <span class="mv-tally">${w.tally === 'pgm' ? 'PGM' : w.tally === 'pvw' ? 'PVW' : 'IN ' + (i + 1)}</span>
                    <div class="mv-screen">▣ ${w.label}</div>
                    <div class="mv-umd" style="--umd:${w.color}" contenteditable="true">${w.label}</div>`;
                el.appendChild(meterBar('mv-meter'));
                // Click the screen to cycle tally OFF -> PGM -> PVW
                el.querySelector('.mv-screen').addEventListener('click', () => {
                    w.tally = w.tally === 'off' ? 'pgm' : w.tally === 'pgm' ? 'pvw' : 'off';
                    draw();
                });
                el.querySelector('.mv-umd').addEventListener('input', e => { w.label = e.target.textContent; });
                el.addEventListener('dragstart', () => { dragIdx = i; el.classList.add('dragging'); });
                el.addEventListener('dragend', () => el.classList.remove('dragging'));
                el.addEventListener('dragover', e => e.preventDefault());
                el.addEventListener('drop', e => {
                    e.preventDefault();
                    if (dragIdx === null || dragIdx === i) return;
                    const [m] = wins.splice(dragIdx, 1); wins.splice(i, 0, m); dragIdx = null; draw();
                });
                grid.appendChild(el);
            });
        }
        draw();
    }

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

    // ======================= INTERCOM =======================================
    function renderIntercom(body, twist, config) {
        let keys = gatherSources(twist).map(s => s.label);
        if (!keys.length) keys = ['DIRECTOR', 'TD / SWITCH', 'A1 AUDIO', 'FLOOR MGR', 'CAM 1', 'CAM 2', 'CAM 3', 'VTR / REPLAY', 'GRAPHICS', 'LIGHTING', 'PRODUCER', 'TECH'];

        const grid = document.createElement('div');
        grid.className = 'ic-grid';
        body.appendChild(grid);

        keys.forEach((label, i) => {
            const k = document.createElement('div');
            k.className = 'ic-key' + (i === 4 ? ' live' : '');   // CAM 1 shown on-air (tally)
            k.innerHTML = `
                <div class="ic-name">${label}</div>
                <div class="ic-tl"><button class="talk">TALK</button><button class="listen">LISTEN</button></div>
                <input class="ic-vol" type="range" min="0" max="100" value="${60 + (i * 7) % 35}">`;
            const talkBtn = k.querySelector('.talk');
            const listenBtn = k.querySelector('.listen');
            const latch = () => { k.classList.toggle('talk'); talkBtn.classList.toggle('on', k.classList.contains('talk')); };
            k.querySelector('.ic-name').addEventListener('click', latch);
            talkBtn.addEventListener('click', latch);
            listenBtn.addEventListener('click', () => { k.classList.toggle('listen'); listenBtn.classList.toggle('on', k.classList.contains('listen')); });
            grid.appendChild(k);
        });

        // Random "incoming" listen flicker so the panel feels live.
        timers.push(setInterval(() => {
            const all = grid.querySelectorAll('.ic-key');
            if (!all.length) return;
            all.forEach(k => k.classList.remove('listen'));
            const pick = all[Math.floor(Math.random() * all.length)];
            if (Math.random() > 0.3) pick.classList.add('listen');
        }, 1400));

        const sub = document.createElement('div');
        sub.className = 'ic-sub';
        sub.innerHTML = `
            <div class="ic-card"><p class="ed-h">IFB — INTERRUPTIBLE FOLDBACK</p>
                <div class="ic-row"><span>TALENT 1 EARPIECE</span><span class="ic-pill on">PROGRAM</span></div>
                <div class="ic-row"><span>TALENT 2 EARPIECE</span><span class="ic-pill">PROGRAM</span></div>
                <div class="ic-row"><span>STAGE MANAGER</span><span class="ic-pill">PROGRAM</span></div></div>
            <div class="ic-card"><p class="ed-h">BELTPACKS</p>
                <div class="ic-row"><span>CAM 1 · PARTY-LINE A</span><span class="ic-pill on">ONLINE</span></div>
                <div class="ic-row"><span>CAM 2 · PARTY-LINE A</span><span class="ic-pill on">ONLINE</span></div>
                <div class="ic-row"><span>FLOOR · PARTY-LINE B</span><span class="ic-pill on">ONLINE</span></div></div>
            <div class="ic-card"><p class="ed-h">MATRIX</p>
                <div class="ic-row"><span>TALLY-LINKED DUCKING</span><span class="ic-pill on">ENABLED</span></div>
                <div class="ic-row"><span>PRIVATE LINE — DIR↔FLOOR</span><span class="ic-pill on">OPEN</span></div>
                <div class="ic-row"><span>ROUTER</span><span class="ic-pill on">ONLINE</span></div></div>`;
        sub.querySelectorAll('.ic-pill').forEach(p => p.addEventListener('click', () => p.classList.toggle('on')));
        body.appendChild(sub);
    }

    // ======================= ISO RECORDER + INSTANT REPLAY ==================
    function renderIsoRecorder(body, twist, config) {
        const chans = channelsFor(twist, config, 'CAM', 4);
        const fps = 25;
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
        timers.push(setInterval(() => recs.forEach(r => r.tick()), 1000 / fps));

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

    // ---- dispatch -----------------------------------------------------------
    const KINDS = [
        { test: n => /\biso\b|replay/i.test(n), title: 'ISO RECORDER · INSTANT REPLAY', render: renderIsoRecorder },
        { test: n => /multi\s*view/i.test(n), title: 'MULTI VIEWER · LAYOUT MAKER', render: renderMultiViewer },
        { test: n => /video\s*mix|vision|switch/i.test(n), title: 'VISION MIXER', render: renderVisionMixer },
        { test: n => /audio\s*mix/i.test(n), title: 'AUDIO MIXER · CONSOLE', render: renderAudioMixer },
        { test: n => /intercom|comm/i.test(n), title: 'INTERCOM · KEY PANEL', render: renderIntercom },
    ];

    window.Editors = {
        // Returns true if this twist has a dedicated editor (and opens it).
        openForTwist(twist) {
            const name = (twist.querySelector('.twist-title') || {}).innerText || '';
            const config = parseConfig(twist);
            const kind = KINDS.find(k => k.test(name));
            if (!kind) return false;
            const color = twist.style.getPropertyValue('--lcars-color') || '#646DCC';
            open(kind.title, color, (body) => kind.render(body, twist, config));
            return true;
        },
        close,
    };
})();
