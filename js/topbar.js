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

    const STYLE_ID = 'lcars-topbar-styles';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .lcars-topbar {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-start;
                gap: 18px;
                padding: 8px;
                margin-bottom: 16px;
                border: none;
            }
            /* An LCARS group: coloured label spine + its tabs */
            .lcars-group {
                --group-lcars: 255,170,0;
                display: flex;
                align-items: center;
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
            .lcars-group:not(.collapsed) .lcars-group-caret {
                transform: rotate(90deg);
            }
            .lcars-group.collapsed .lcars-group-tabs {
                display: none;
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

    // Expand one group and roll up (collapse) all the others — an accordion.
    function expandGroup(target) {
        groups.forEach(g => g.group.classList.toggle('collapsed', g !== target));
        // If the newly-expanded group has no active tab, select its first one.
        if (!target.tabsEl.querySelector('.lcars-tab.active')) {
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
        },

        // Create an LCARS group container with a coloured label.
        // opts.color is an "r,g,b" string. opts.collapsed folds it by default.
        // The label toggles the accordion. Returns a group handle for addTab().
        addGroup(label, opts = {}) {
            if (!tabsContainer) return null;
            const color = opts.color || '255,170,0';

            const group = document.createElement('div');
            group.className = 'lcars-group' + (opts.collapsed ? ' collapsed' : '');
            group.style.setProperty('--group-lcars', color);

            const labelEl = document.createElement('div');
            labelEl.className = 'lcars-group-label';
            labelEl.innerHTML = `<span>${label}</span><span class="lcars-group-caret">▸</span>`;
            group.appendChild(labelEl);

            const tabsEl = document.createElement('div');
            tabsEl.className = 'lcars-group-tabs';
            group.appendChild(tabsEl);

            const handle = { group, tabsEl, labelEl };
            labelEl.addEventListener('click', () => expandGroup(handle));
            groups.push(handle);

            tabsContainer.appendChild(group);
            return handle;
        },

        // Add a tab for a program/encoder. Creates the matching tab-content
        // pane so renderPrograms() can fill it. opts.group places it inside an
        // LCARS group (falls back to the bar root); opts.active marks selected.
        addTab(pgm, opts = {}) {
            if (!tabsContainer) return null;
            const active = !!opts.active;
            const host = (opts.group && opts.group.tabsEl) || tabsContainer;
            const color = LCARS_COLORS[tabIndex % LCARS_COLORS.length];
            tabIndex++;

            const tab = document.createElement('div');
            tab.className = 'lcars-tab' + (active ? ' active' : '');
            tab.style.setProperty('--lcars', color);
            tab.innerText = pgm.name;
            tab.onclick = (e) => switchTab(pgm.id, e);
            host.appendChild(tab);

            const cont = document.createElement('div');
            cont.id = 'tab-' + pgm.id;
            cont.className = 'tab-content' + (active ? ' active' : '');
            contentContainer.appendChild(cont);
            return tab;
        },
    };

    window.TopBar = TopBar;
})();
