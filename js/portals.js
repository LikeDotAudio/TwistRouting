// js/portals.js — user-created "Portal" nodes.
//
// A Portal is a virtual patch point: it is BOTH
//   • a DESTINATION — a real twist you route signals into (a grouper of inputs), and
//   • a SOURCE — a pseudo-output node named after the portal, which you can route
//     onward into any real destination.
//
// Because a portal destination is a normal .twist-container (in the destinations
// content) and its output is a normal .signal-node (in the ingress panel), portals
// automatically appear in the 1990s view (as a receiver AND a sender), get logged
// by the Captain's Log, and accept drag/touch drops — no special-casing anywhere.
//
// Self-mounting ES module; exposes window.Portals.
import { makeNodeDraggable } from './dragDrop.js';
import { initializeTwists } from './matrix.js';
import { toggleSuperPool } from './globals.js';
import { monoEmoji } from './util/mono-emoji.js';

(function () {
    'use strict';
    const STYLE_ID = 'portals-styles';
    const COLOR = '#46A06E';
    let srcWrap = null, group = null, seq = 0;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        .portals-pool{--lcars-color:${COLOR};}
        .portal-new{display:block;width:100%;margin-bottom:8px;background:${COLOR};color:#000;border:none;
            border-radius:14px;font-weight:900;letter-spacing:1px;font-size:12px;padding:9px;cursor:pointer;}
        .portal-new:hover{filter:brightness(1.1);}
        .portal-srcs{display:flex;flex-direction:column;gap:6px;}
        .signal-node.portal-source{border:1px solid ${COLOR};color:${COLOR};border-radius:4px 14px 14px 4px;
            font-weight:bold;background:rgba(70,160,110,.12);}
        .twist-container.portal-twist{border-color:${COLOR};box-shadow:0 0 8px rgba(70,160,110,.4);}
        .portal-twist .twist-title{color:${COLOR};}
        .portal-empty{font-size:10px;color:#7e93b5;text-align:center;padding:6px;}
        `;
        document.head.appendChild(s);
    }

    // The PORTALS super-pool at the top of the ingress (sources) panel.
    function ensureSourcePool() {
        if (srcWrap) return srcWrap;
        injectStyles();
        const panel = document.querySelector('.ingress-panel');
        if (!panel) return null;
        const container = document.createElement('div');
        container.className = 'super-pool-container portals-pool';
        container.innerHTML = `
            <div class="super-pool-emoji">${monoEmoji('portal').trim()}</div>
            <div class="super-pool-title foldable-header"><span>PORTALS</span><span class="fold-icon" style="transform:rotate(-90deg);display:inline-block;transition:transform .2s;">▼</span></div>
            <div class="super-pool-content" style="display:none;">
                <button class="portal-new">＋ NEW PORTAL</button>
                <div class="portal-srcs"><div class="portal-empty">no portals yet</div></div>
            </div>`;
        container.addEventListener('click', (e) => toggleSuperPool(e, container));
        container.querySelector('.portal-new').addEventListener('click', (e) => { e.stopPropagation(); createPortal(); });
        panel.appendChild(container);
        // Keep PORTALS as the LAST source pool even as the other pools render in
        // later (they're appended after this on initApp).
        new MutationObserver(() => { if (panel.lastElementChild !== container) panel.appendChild(container); })
            .observe(panel, { childList: true });
        srcWrap = container.querySelector('.portal-srcs');
        return srcWrap;
    }

    // Build the portal's destination twist inside its own tab (so it routes,
    // logs and shows in the matrix like any destination).
    function buildDestination(name, id) {
        const TopBar = window.TopBar;
        if (!TopBar) return;
        if (!group) group = TopBar.addGroup('PORTALS', { color: '70,160,110', collapsed: false });
        TopBar.addTab({ id, name: name.toUpperCase() }, { group, color: COLOR, active: false });
        const pane = document.getElementById('tab-' + id);
        if (!pane) return;
        pane.innerHTML = `
            <div class="program-row" style="--prod-color:${COLOR}; position:relative; overflow:hidden; padding:0; margin-bottom:10px; flex:1 1 auto;">
                <div class="program-title" style="background:${COLOR};">${monoEmoji('portal')}PORTAL — ${name}</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px; padding-right:60px;">
                    <div class="twist-container portal-twist" data-prod-id="${id}" data-prod-name="PORTAL — ${name}"
                         style="--lcars-color:${COLOR}; flex:0 0 auto; min-width:240px;">
                        <div class="twist-title">${name}</div>
                        <div class="matrix-container" id="${id}-portal"></div>
                    </div>
                </div>
            </div>`;
        initializeTwists();   // wire the new portal twist as a drop target
    }

    // The portal's pseudo-output: a draggable source node.
    function buildSource(name, id) {
        const pool = ensureSourcePool();
        if (!pool) return;
        const empty = pool.querySelector('.portal-empty'); if (empty) empty.remove();
        const node = document.createElement('div');
        node.className = 'signal-node audio portal-source';
        node.id = 'portalsrc-' + id;
        node.dataset.origin = 'PORTAL — ' + name;
        node.textContent = 'PORTAL ' + name;
        pool.appendChild(node);
        makeNodeDraggable(node);   // wire drag (mouse + touch via the shared bridge)
    }

    function createPortal(rawName) {
        const name = (rawName || prompt('Name the portal:', 'PORTAL ' + (seq + 1)) || '').trim();
        if (!name) return null;
        const id = 'portal-' + (++seq);
        buildDestination(name, id);
        buildSource(name, id);
        return id;
    }

    function init() { ensureSourcePool(); }

    window.Portals = { create: createPortal, open: () => ensureSourcePool() };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
