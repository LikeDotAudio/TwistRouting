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
        /* Full-width LCARS header rail: solid colour bar spanning the whole width,
           title at the left elbow, the X embedded as the right end-cap. */
        .ed-topbar{flex:0 0 auto;display:flex;align-items:stretch;height:48px;cursor:pointer;
            background:var(--ed-color,#646DCC);border-radius:0 0 16px 44px;overflow:hidden;}
        .ed-topbar:hover{filter:brightness(1.06);}
        .ed-back{display:flex;align-items:center;font-size:32px;font-weight:bold;color:#000;padding:0 4px 0 26px;line-height:1;}
        .ed-title{flex:1;display:flex;align-items:center;font-weight:900;letter-spacing:3px;
            font-size:17px;text-transform:uppercase;color:#000;padding-left:8px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ed-close{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:66px;
            cursor:pointer;font-size:30px;font-weight:bold;line-height:1;color:#000;
            box-shadow:inset 2px 0 0 rgba(0,0,0,.25);}
        .ed-close:hover{background:rgba(0,0,0,.18);}
        .ed-body{flex:1;min-height:0;overflow:auto;padding:12px 14px 14px;}
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
            <div class="ed-topbar" title="Click anywhere (or press Esc) to go back">
                <span class="ed-back">‹</span>
                <span class="ed-title"></span>
                <span class="ed-close" title="Close">&times;</span>
            </div>
            <div class="ed-body"></div>`;
        document.body.appendChild(overlay);
        // The ENTIRE top bar is an "escape bar" — clicking anywhere on it (not just
        // the X) closes the editor, same as pressing Esc, returning to where you were.
        overlay.querySelector('.ed-topbar').addEventListener('click', close);
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
        // Progressive disclosure — hide controls the current role can't operate.
        if (window.Auth && window.Auth.applyScope) window.Auth.applyScope(body);
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

    // Which production this twist belongs to (data attr, else the LCARS title
    // rail of its enclosing program row).
    function prodNameOf(twist) {
        if (twist.dataset.prodName) return twist.dataset.prodName;
        const row = twist.closest('.program-row');
        const t = row && row.querySelector('.program-title');
        return t ? t.innerText.trim() : '';
    }

    // Returns true if this twist has a dedicated editor (and opens it).
    function openForTwist(twist) {
        const name = (twist.querySelector('.twist-title') || {}).innerText || '';
        const config = parseConfig(twist);
        const kind = KINDS.find(k => k.test(name));
        if (!kind) return false;
        const color = twist.style.getPropertyValue('--lcars-color') || '#646DCC';
        const prodName = prodNameOf(twist);
        const title = prodName ? `${prodName} · ${kind.title}` : kind.title;
        setHash(prodName, name);
        open(title, color, (body) => kind.render(body, twist, config));
        return true;
    }

    // Deep link: open the editor named by the URL hash (#/<prod-slug>/<twist-slug>).
    // With lazy-loaded productions the target twist may not exist yet, so the
    // request is "armed" — resolvePending() retries each time a production renders
    // (see notifyRendered), and we best-effort click the matching tab to load it.
    let pending = null;
    function openFromHash() {
        const m = (location.hash || '').match(/^#\/([^/]+)\/([^/]+)/);
        if (!m) { pending = null; return false; }
        pending = { prodSlug: m[1], twistSlug: m[2] };
        return resolvePending();
    }
    function resolvePending() {
        if (!pending) return false;
        const { prodSlug, twistSlug } = pending;
        const twist = [...document.querySelectorAll('.twist-container')].find(t => {
            const name = (t.querySelector('.twist-title') || {}).innerText || '';
            return slug(name) === twistSlug && slug(prodNameOf(t)) === prodSlug;
        });
        if (twist) { pending = null; return openForTwist(twist); }
        // Not rendered yet — try to open the matching tab to trigger its lazy load.
        const tab = [...document.querySelectorAll('.lcars-tab')].find(tb => {
            const s = slug(tb.innerText);
            return s && (s === prodSlug || prodSlug.indexOf(s) === 0 || s.indexOf(prodSlug) === 0);
        });
        if (tab && !tab.dataset.deeplinkTried) {
            tab.dataset.deeplinkTried = '1';
            for (let g = tab.closest('.lcars-group'); g; g = g.parentElement && g.parentElement.closest('.lcars-group')) {
                g.classList.remove('collapsed');
            }
            tab.click();    // programmatic activation → lazy load → notifyRendered
            return false;
        }
        // No tab matched by label (URL uses the display name, tabs are filenamed):
        // load the destination productions once so the armed link can resolve.
        if (!resolvePending._loadedAll && typeof window.loadAllDestinations === 'function') {
            resolvePending._loadedAll = true;
            window.loadAllDestinations();
        }
        return false;
    }
    // Called by app code after a lazily-loaded production renders its twists.
    function notifyRendered() { resolvePending(); }

    window.Editors = {
        register, addStyles, open, close,
        // shared helpers used by the editor modules:
        gatherSources, parseConfig, channelsFor, knob, meterBar,
        pushTimer: (t) => timers.push(t),
        openForTwist, openFromHash, notifyRendered,
    };

    // Open from the URL on load (once twists exist) and on manual hash changes.
    window.addEventListener('hashchange', openFromHash);
})();

// ES-module exports — re-exposed from the window.Editors registry the IIFE built,
// so editor modules and matrix/app can import them directly.
export const register = window.Editors.register;
export const addStyles = window.Editors.addStyles;
export const open = window.Editors.open;
export const close = window.Editors.close;
export const gatherSources = window.Editors.gatherSources;
export const parseConfig = window.Editors.parseConfig;
export const channelsFor = window.Editors.channelsFor;
export const knob = window.Editors.knob;
export const meterBar = window.Editors.meterBar;
export const pushTimer = window.Editors.pushTimer;
export const openForTwist = window.Editors.openForTwist;
export const openFromHash = window.Editors.openFromHash;
export const notifyRendered = window.Editors.notifyRendered;
