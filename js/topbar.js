// js/topbar.js
// LCARS-styled top navigation bar (production + encoder tabs).
// Self-contained module: injects its own styles and renders the tab strip
// grouped into LCARS containers (e.g. "PRODUCTIONS" and "MASTER").
(function () {
    // ST:VIII(FC) LCARS colours — RGB values taken from the reference chart.
    const LCARS_COLORS = [
        '193,152,176', // mauve
        '180,103,87',  // rust
        '174,105,125', // rose
        '151,88,123',  // plum
        '198,120,37',  // orange
        '178,132,82',  // sand
        '194,183,75',  // gold
        '190,188,223', // periwinkle
    ];

    // Convert "#rrggbb" to the "r,g,b" string the LCARS CSS variables expect.
    function hexToRgb(hex) {
        const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    }

    const STYLE_ID = 'lcars-topbar-styles';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .lcars-topbar {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-end;   /* category buttons anchor to the bottom */
                gap: 18px;
                padding: 8px;
                margin-bottom: 16px;
                border: none;
            }
            /* An LCARS group: coloured label spine + its body (tabs + subgroups) */
            .lcars-group {
                --group-lcars: 255,170,0;
                display: flex;
                align-items: flex-end;   /* label sits at the bottom; body grows upward */
                gap: 6px;
                padding: 4px;
                border-radius: 20px;
                background: rgba(var(--group-lcars), 0.08);
            }
            .lcars-group-label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 900;
                letter-spacing: 2px;
                text-transform: uppercase;
                font-size: 12px;
                line-height: 1;
                color: #000;
                background: rgb(var(--group-lcars));
                padding: 11px 18px;
                /* Asymmetric LCARS pill */
                border-radius: 16px 4px 4px 16px;
                white-space: nowrap;
                cursor: pointer;
            }
            .lcars-group-caret {
                font-size: 10px;
                transition: transform 0.2s;
            }
            /* Scope to the group's OWN label so a nested group's caret tracks its
               own state, not an expanded ancestor's. */
            .lcars-group:not(.collapsed) > .lcars-group-label .lcars-group-caret {
                transform: rotate(90deg);
            }
            .lcars-group.collapsed > .lcars-group-body {
                display: none;
            }
            /* Body stacks direct tabs (a row) above any nested subgroups (a column). */
            .lcars-group-body {
                display: flex;
                flex-direction: column;
                gap: 6px;
                align-items: flex-start;
            }
            /* When expanded, a "top bracket" in the group's colour spans the width
               of its contained items, showing what belongs to the open group. */
            .lcars-group:not(.collapsed) > .lcars-group-body {
                border-top: 6px solid rgb(var(--group-lcars));
                border-radius: 6px 6px 0 0;
                padding-top: 5px;
                margin-top: 2px;
            }
            .lcars-group-tabs {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            .lcars-tab {
                --lcars: 0,0,0;
                font-weight: 900;
                letter-spacing: 2px;
                text-transform: uppercase;
                font-size: 13px;
                line-height: 1;
                color: #000;
                background: rgb(var(--lcars));
                opacity: 0.45;
                padding: 9px 24px;
                border: none;
                /* Asymmetric LCARS pill: rounded ends */
                border-radius: 16px;
                cursor: pointer;
                user-select: none;
                white-space: nowrap;
                transition: opacity 0.2s, box-shadow 0.2s, transform 0.08s;
            }
            .lcars-tab:hover:not(.active) {
                opacity: 0.8;
            }
            .lcars-tab.active {
                opacity: 1;
                box-shadow: 0 0 12px rgba(var(--lcars), 0.75);
            }
            .lcars-tab:active {
                transform: translateY(1px);
            }
        `;
        document.head.appendChild(style);
    }

    let tabsContainer = null;
    let contentContainer = null;
    let tabIndex = 0;
    let groups = [];

    // ===== Auto-fold: roll up every destination group after a spell of
    // inactivity, so the footer tidies itself when left alone. Any pointer/key/
    // scroll activity re-arms the timer. =====
    const IDLE_MS = 10000;
    let idleTimer = null;
    let idleBound = false;

    function collapseAllGroups() {
        groups.forEach(g => g.group.classList.add('collapsed'));
    }

    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(collapseAllGroups, IDLE_MS);
    }

    function bindIdleWatchers() {
        if (idleBound) return;
        idleBound = true;
        ['mousedown', 'mousemove', 'keydown', 'touchstart', 'wheel', 'scroll']
            .forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    }

    // Toggle a group open/closed. Among siblings (same parent) it acts as an
    // accordion — opening one rolls up the others at that level only.
    function toggleGroup(target) {
        const expand = target.group.classList.contains('collapsed');
        groups.filter(g => g.parent === target.parent && g !== target)
              .forEach(g => g.group.classList.add('collapsed'));
        target.group.classList.toggle('collapsed', !expand);
        // When opening a leaf group (one with direct tabs), make sure one is selected.
        if (expand && !target.tabsEl.querySelector('.lcars-tab.active')) {
            const first = target.tabsEl.querySelector('.lcars-tab');
            if (first) first.click();
        }
    }

    const TopBar = {
        // Bind the bar to its containers and reset state. Call once per render.
        init(tabsEl, contentEl) {
            injectStyles();
            tabsContainer = tabsEl;
            contentContainer = contentEl;
            tabsContainer.className = 'lcars-topbar';
            tabsContainer.innerHTML = '';
            contentContainer.innerHTML = '';
            tabIndex = 0;
            groups = [];
            bindIdleWatchers();
            resetIdleTimer();
        },

        // Create an LCARS group container with a coloured label.
        // opts.color is an "r,g,b" string. opts.collapsed folds it by default.
        // opts.parent nests this group inside another group's body (for the
        // DESTINATIONS → FLOORS → floor hierarchy). The label toggles the
        // accordion. Returns a group handle for addTab() / nested addGroup().
        addGroup(label, opts = {}) {
            if (!tabsContainer) return null;
            const color = opts.color || '255,170,0';
            const parent = opts.parent || null;

            const group = document.createElement('div');
            group.className = 'lcars-group' + (opts.collapsed ? ' collapsed' : '');
            group.style.setProperty('--group-lcars', color);

            const labelEl = document.createElement('div');
            labelEl.className = 'lcars-group-label';
            labelEl.innerHTML = `<span>${label}</span><span class="lcars-group-caret">▸</span>`;
            group.appendChild(labelEl);

            const bodyEl = document.createElement('div');
            bodyEl.className = 'lcars-group-body';
            group.appendChild(bodyEl);

            const tabsEl = document.createElement('div');
            tabsEl.className = 'lcars-group-tabs';
            bodyEl.appendChild(tabsEl);

            const handle = { group, tabsEl, bodyEl, labelEl, parent };
            labelEl.addEventListener('click', (e) => { e.stopPropagation(); toggleGroup(handle); });
            groups.push(handle);

            (parent ? parent.bodyEl : tabsContainer).appendChild(group);
            return handle;
        },

        // Add a tab for a program/encoder. Creates the matching tab-content
        // pane so renderPrograms() can fill it. opts.group places it inside an
        // LCARS group (falls back to the bar root); opts.active marks selected.
        addTab(pgm, opts = {}) {
            if (!tabsContainer) return null;
            const active = !!opts.active;
            const host = (opts.group && opts.group.tabsEl) || tabsContainer;
            // Honor an explicit (hex) colour so a tab can match its content L-bar;
            // otherwise fall back to the rotating LCARS palette.
            const color = (opts.color && hexToRgb(opts.color)) || LCARS_COLORS[tabIndex % LCARS_COLORS.length];
            tabIndex++;

            const tab = document.createElement('div');
            tab.className = 'lcars-tab' + (active ? ' active' : '');
            tab.style.setProperty('--lcars', color);
            tab.innerText = pgm.name;
            host.appendChild(tab);

            const cont = document.createElement('div');
            cont.id = 'tab-' + pgm.id;
            cont.className = 'tab-content' + (active ? ' active' : '');
            contentContainer.appendChild(cont);

            // Lazy content: opts.onActivate(pgm, cont) runs once, the first time the
            // tab is shown — so a tab's heavy program JSON / twists load on demand.
            let loaded = false;
            const activate = () => {
                if (loaded) return;
                loaded = true;
                if (typeof opts.onActivate === 'function') opts.onActivate(pgm, cont);
            };
            tab.onclick = (e) => {
                activate();
                switchTab(pgm.id, e);
                // A genuine user pick tucks the whole destination nav away. Guard on
                // isTrusted so the programmatic auto-select fired when a group is
                // first expanded (toggleGroup) doesn't collapse it right back.
                if (e.isTrusted) collapseAllGroups();
            };
            if (active) activate();
            return tab;
        },
    };

    window.TopBar = TopBar;
})();
