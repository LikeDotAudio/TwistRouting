// js/editors/core.js
// Shared infrastructure for the role-specific twist editors. Each editor lives
// in its own file (vision-mixer.js, multi-viewer.js, audio-mixer.js,
// intercom.js, iso-recorder.js) and registers itself with window.Editors via
// register()/addStyles(). matrix.js's openTwistModal() calls
// Editors.openForTwist(twist); anything without a registered editor falls
// through to the generic switcher-matrix modal.
(function () {
    'use strict';

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

    // Base overlay chrome. Each editor injects its own CSS chunk via addStyles().
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
        `;
        document.head.appendChild(s);
    }

    // Editors register their CSS once, by a unique id.
    function addStyles(id, cssText) {
        if (document.getElementById(id)) return;
        const s = document.createElement('style');
        s.id = id;
        s.textContent = cssText;
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

    // Editor deep-link: the URL hash reflects the open production + editor, e.g.
    // #/prod-3/intercom. Saved on open, restored on close.
    let prevHash = null;
    const slug = (s) => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    function setHash(prodName, twistName) {
        prevHash = location.hash;
        const h = '#/' + [slug(prodName), slug(twistName)].filter(Boolean).join('/');
        history.replaceState(null, '', h);
    }

    function close() {
        clearTimers();
        if (overlay) overlay.classList.remove('open');
        if (prevHash !== null) { history.replaceState(null, '', prevHash || location.pathname + location.search); prevHash = null; }
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

    // ---- dispatch registry --------------------------------------------------
    const KINDS = [];
    function register(test, title, render) { KINDS.push({ test, title, render }); }

    window.Editors = {
        register, addStyles, open, close,
        // shared helpers used by the editor modules:
        gatherSources, parseConfig, channelsFor, knob, meterBar,
        pushTimer: (t) => timers.push(t),
        // Returns true if this twist has a dedicated editor (and opens it).
        openForTwist(twist) {
            const name = (twist.querySelector('.twist-title') || {}).innerText || '';
            const config = parseConfig(twist);
            const kind = KINDS.find(k => k.test(name));
            if (!kind) return false;
            const color = twist.style.getPropertyValue('--lcars-color') || '#646DCC';
            // Which production this twist belongs to (data attr, else the LCARS
            // title rail of its enclosing program row).
            const row = twist.closest('.program-row');
            const prodName = twist.dataset.prodName
                || (row && row.querySelector('.program-title') ? row.querySelector('.program-title').innerText.trim() : '');
            const title = prodName ? `${prodName} · ${kind.title}` : kind.title;
            setHash(prodName, name);
            open(title, color, (body) => kind.render(body, twist, config));
            return true;
        },
    };
})();
