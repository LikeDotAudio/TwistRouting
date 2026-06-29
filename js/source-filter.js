// js/source-filter.js — a text field at the top of the SOURCES panel that filters
// every source down to what the user types, hiding the rest while keeping the
// LCARS frames intact.
//
// The source tree is lazy (floors/pools render on first expand), so while a query
// is active we (1) CSS-override the collapse so all loaded content shows, (2) click
// any still-unloaded headers to render them, and (3) re-apply the match as the
// async content streams in (via a MutationObserver).
(function () {
    'use strict';
    const STYLE_ID = 'source-filter-styles';
    let input = null, query = '', observer = null, reapplyTimer = 0;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        .src-filter{margin-bottom:12px;}
        .src-filter-input{width:100%;box-sizing:border-box;background:#0a1020;border:2px solid #FF9C63;
            border-left:12px solid #FF9C63;border-radius:0 16px 16px 0;color:#e0f0ff;font-family:'Courier New',monospace;
            font-weight:bold;letter-spacing:2px;text-transform:uppercase;padding:9px 14px;outline:none;}
        .src-filter-input::placeholder{color:#7e93b5;letter-spacing:1px;}
        .src-filter-input:focus{box-shadow:0 0 10px rgba(255,156,99,.5);}
        /* While filtering, force every loaded container open (without touching the
           inline collapse state, so clearing restores it). */
        .ingress-panel.filtering .super-pool-content{display:block !important;}
        .ingress-panel.filtering .media-group-content{display:block !important;}
        .ingress-panel.filtering .pool-content{display:grid !important;}
        .ingress-panel.filtering .filter-hidden{display:none !important;}
        `;
        document.head.appendChild(s);
    }

    // Top-level draggable units (gang cells, stage boxes, plain pool nodes) — NOT
    // the feeds nested inside a box's expansion.
    function units(root) {
        return [...root.querySelectorAll('.signal-node.multiplex, .signal-node:not(.multiplex):not(.sub-stream):not(.dropped-group)')]
            .filter(u => !u.closest('.multiplex-children'));
    }

    // Render any not-yet-loaded sections so they become searchable.
    function loadAll(panel) {
        panel.querySelectorAll('.media-group-header').forEach(h => {
            const c = h.nextElementSibling;
            if (c && c.classList.contains('media-group-content') && !c.children.length) h.click();
        });
        panel.querySelectorAll('.input-group > .foldable-header').forEach(h => {
            const c = h.nextElementSibling;
            if (c && (c.classList.contains('pool-content')) && !c.children.length) h.click();
        });
    }

    function hide(panel, q) {
        panel.querySelectorAll('.filter-hidden').forEach(e => e.classList.remove('filter-hidden'));
        const all = units(panel);
        all.forEach(u => {
            const hay = ((u.dataset.origin || '') + ' ' + u.textContent).toLowerCase();
            if (!hay.includes(q)) u.classList.add('filter-hidden');
        });
        // Hide pools / floors / gang grids that ended up with no visible unit.
        [...panel.querySelectorAll('.input-group, .media-group, .gang-grid')].forEach(c => {
            const anyVisible = units(c).some(n => !n.classList.contains('filter-hidden'));
            if (!anyVisible) c.classList.add('filter-hidden');
        });
        // Drop a gang caption when its grid is gone.
        panel.querySelectorAll('.gang-cap').forEach(cap => {
            const grid = cap.nextElementSibling;
            if (grid && grid.classList.contains('filter-hidden')) cap.classList.add('filter-hidden');
        });
    }

    function apply(q) {
        query = (q || '').trim().toLowerCase();
        const panel = document.querySelector('.ingress-panel');
        if (!panel) return;
        if (!query) {
            panel.classList.remove('filtering');
            panel.querySelectorAll('.filter-hidden').forEach(e => e.classList.remove('filter-hidden'));
            if (observer) { observer.disconnect(); observer = null; }
            return;
        }
        panel.classList.add('filtering');
        loadAll(panel);
        hide(panel, query);
        // Re-apply as lazy content streams in.
        if (!observer) {
            observer = new MutationObserver(() => {
                clearTimeout(reapplyTimer);
                reapplyTimer = setTimeout(() => { if (query) { loadAll(panel); hide(panel, query); } }, 60);
            });
            observer.observe(panel, { childList: true, subtree: true });
        }
    }

    function build() {
        const panel = document.querySelector('.ingress-panel');
        if (!panel || panel.querySelector(':scope > .src-filter')) return;
        injectStyles();
        const bar = document.createElement('div');
        bar.className = 'src-filter';
        bar.innerHTML = `<input type="text" class="src-filter-input" placeholder="⌕ Filter sources…" spellcheck="false" />`;
        // Top of the sources panel — just under the Captain's Log, above SOUND.
        const cl = panel.querySelector(':scope > .cl-btn');
        if (cl) panel.insertBefore(bar, cl.nextSibling);
        else panel.insertBefore(bar, panel.firstChild);
        input = bar.querySelector('input');
        input.addEventListener('input', () => apply(input.value));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
})();
