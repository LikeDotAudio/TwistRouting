// js/router-view.js — the "1990s VIEW": an interactive router crosspoint grid,
// styled after classic Minesweeper.
//
// Rows = SENDERS (sources) grouped by their box; columns = RECEIVERS
// (destination twists) grouped by production. A sunken/flagged cell is a live
// route. Hovering a cell lights its whole row + column (crosshair).
//
// • "ALL SOURCES" / "ALL DESTINATIONS" toggles — lazy-load the full source /
//   destination trees so unconnected senders and receivers also appear.
// • CLICK A CROSSPOINT to make or break that route (it really drops/removes the
//   source on the twist, via the app's own routing functions).
// • Click a production header (column group) or source-box header (row group) to
//   FOLD that block to a summary line; folded cells are read-only aggregates.
// • Real URL route at #/1990s (?src/&dst/&s/&r) — navigable & shareable.
//
// ES module (imported by main.js); exposes window.RouterView.
import { placeSourceInTwist } from './matrix.js';
import { updateTwistVisuals } from './visuals.js';

(function () {
    'use strict';

    const STYLE_ID = 'router-view-styles';
    const ROUTE = '#/1990s';
    const SEP = '␟';
    let overlay = null, fs = null, fr = null, body = null;
    let tgSrc = null, tgDst = null;
    let showAllSrc = false, showAllDst = false, prevHash = null, syncing = false;
    const collapsedProds = new Set(), collapsedOrigins = new Set();
    let rowLeaves = [], colLeaves = [], crossSet = new Set(), hlNodes = [];

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        .rv-btn{position:fixed;right:14px;bottom:76px;z-index:1000;background:#c0c0c0;color:#000;
            border:2px solid;border-color:#fff #808080 #808080 #fff;font-family:'MS Sans Serif',Tahoma,sans-serif;
            font-weight:bold;letter-spacing:1px;padding:7px 14px;cursor:pointer;}
        .rv-btn:active{border-color:#808080 #fff #fff #808080;}
        .rv-overlay{position:fixed;inset:0;z-index:2500;display:none;flex-direction:column;
            background:#008080;color:#000;font-family:'MS Sans Serif',Tahoma,Geneva,sans-serif;font-size:12px;}
        .rv-overlay.open{display:flex;}
        .rv-win{margin:18px;display:flex;flex-direction:column;flex:1;min-height:0;
            background:#c0c0c0;border:3px solid;border-color:#fff #808080 #808080 #fff;}
        .rv-titlebar{background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-weight:bold;
            letter-spacing:1px;padding:5px 8px;display:flex;align-items:center;gap:12px;}
        .rv-titlebar .rv-x{margin-left:auto;background:#c0c0c0;color:#000;border:2px solid;
            border-color:#fff #808080 #808080 #fff;width:22px;height:20px;line-height:14px;text-align:center;
            font-weight:bold;cursor:pointer;}
        .rv-x:active{border-color:#808080 #fff #fff #808080;}
        .rv-bar{display:flex;align-items:center;gap:10px;padding:8px;flex-wrap:wrap;
            border-bottom:2px solid #808080;}
        .rv-bar input{font-family:inherit;font-size:12px;padding:3px 6px;min-width:140px;
            border:2px solid;border-color:#808080 #fff #fff #808080;background:#fff;}
        .rv-tg{font-family:inherit;font-weight:bold;font-size:11px;padding:5px 10px;cursor:pointer;
            background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;white-space:nowrap;}
        .rv-tg.on{border-color:#808080 #fff #fff #808080;background:#9a9a9a;}
        .rv-count{font-size:11px;color:#000080;font-weight:bold;}
        .rv-help{margin-left:auto;font-size:11px;color:#404040;}
        .rv-body{flex:1;overflow:auto;padding:10px;background:#c0c0c0;}
        .rv-msg{padding:40px;text-align:center;color:#404040;}
        table.rv-grid{border-collapse:separate;border-spacing:0;}
        .rv-grid th,.rv-grid td{padding:0;text-align:center;white-space:nowrap;}
        /* Group + leaf headers as raised grey buttons */
        .rv-prodhead,.rv-twisthead,.rv-originhead,.rv-feedhead,.rv-corner{
            background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;
            font-weight:bold;padding:3px 8px;}
        .rv-prodhead,.rv-originhead{cursor:pointer;color:#000080;letter-spacing:1px;position:sticky;}
        .rv-prodhead:active,.rv-originhead:active{border-color:#808080 #fff #fff #808080;}
        .rv-twisthead{font-weight:normal;color:#000;}
        .rv-twisthead.grp,.rv-feedhead.grp{font-style:italic;color:#000080;}
        .rv-grid thead th{position:sticky;top:0;z-index:3;}
        .rv-corner{position:sticky;left:0;top:0;z-index:4;}
        .rv-originhead{left:0;z-index:2;text-align:left;}
        .rv-feedhead{position:sticky;left:0;z-index:2;text-align:left;font-weight:normal;}
        .rv-row-off .rv-feedhead{color:#606060;}
        /* Crosspoint cells: raised = open, sunken = routed (a "mine") */
        .rv-cell{width:24px;height:22px;background:#c0c0c0;border:2px solid;
            border-color:#fff #808080 #808080 #fff;cursor:pointer;font-weight:bold;color:#000080;}
        .rv-cell.grp{cursor:default;}
        .rv-cell.on{border-color:#808080 #fff #fff #808080;background:#bdbdbd;color:#c00000;}
        .rv-cell.on::after{content:'\\2737';}            /* flagged crosspoint */
        .rv-cell.grp.on::after{content:'\\25A0';color:#000080;}
        .rv-cell.bad{background:#ff8080;}
        /* Minesweeper crosshair highlight on hover */
        .rv-hl{background:#ffff80 !important;}
        .rv-cell.on.rv-hl{background:#ffd0d0 !important;}
        `;
        document.head.appendChild(s);
    }

    // ----- data ---------------------------------------------------------------
    // origin -> Map(label -> sourceNode)   (pool feeds, with refs for routing)
    function gatherSenderNodes() {
        const m = new Map();
        const push = (origin, label, node) => {
            if (!label) return;
            if (!m.has(origin)) m.set(origin, new Map());
            if (!m.get(origin).has(label)) m.get(origin).set(label, node);
        };
        document.querySelectorAll('.ingress-panel .signal-node').forEach(n => {
            if (n.classList.contains('multiplex')) {
                const head = n.querySelector('.multiplex-header');
                const bo = n.dataset.origin || (head ? head.innerText.trim() : '');
                n.querySelectorAll('.multiplex-children .signal-node').forEach(sub =>
                    push(sub.dataset.origin || bo, (sub.innerText || '').trim().split('\n')[0], sub));
            } else if (!n.classList.contains('sub-stream') && !n.classList.contains('dropped-group')) {
                const label = (n.innerText || '').trim().split('\n')[0];
                push(n.dataset.origin || label, label, n);
            }
        });
        return m;
    }
    // prod -> Map(twist -> twistEl)
    function gatherReceivers() {
        const m = new Map();
        document.querySelectorAll('.twist-container').forEach(tw => {
            const row = tw.closest('.program-row');
            const prod = tw.dataset.prodName
                || (row && row.querySelector('.program-title') ? row.querySelector('.program-title').innerText.trim() : 'UNKNOWN');
            const titleEl = tw.querySelector('.twist-title');
            const tname = titleEl ? titleEl.innerText.trim() : 'TWIST';
            if (!m.has(prod)) m.set(prod, new Map());
            m.get(prod).set(tname, tw);
        });
        return m;
    }
    function gatherLinks() {
        const cross = new Set(), cS = new Set(), cR = new Set();
        document.querySelectorAll('.twist-container').forEach(tw => {
            const dz = tw.querySelector('.drop-zone'); if (!dz) return;
            const row = tw.closest('.program-row');
            const prod = tw.dataset.prodName
                || (row && row.querySelector('.program-title') ? row.querySelector('.program-title').innerText.trim() : 'UNKNOWN');
            const titleEl = tw.querySelector('.twist-title');
            const tname = titleEl ? titleEl.innerText.trim() : 'TWIST';
            dz.querySelectorAll(':scope > .signal-node').forEach(node => {
                const feeds = node.classList.contains('dropped-group')
                    ? [...node.querySelectorAll('.dropped-group-children .signal-node')] : [node];
                feeds.forEach(f => {
                    const label = (f.innerText || '').trim().split('\n')[0]; if (!label) return;
                    const origin = f.dataset.origin || node.dataset.origin || label;
                    cross.add([origin, label, prod, tname].join(SEP));
                    cS.add(origin + SEP + label); cR.add(prod + SEP + tname);
                });
            });
        });
        return { cross, cS, cR };
    }

    async function loadAllSources() {
        for (let p = 0; p < 4; p++) {
            let clicked = 0;
            document.querySelectorAll('.media-group-header').forEach(h => {
                const c = h.nextElementSibling;
                if (c && !c.querySelector('.signal-node')) { h.click(); clicked++; }
            });
            if (!clicked) break;
            await new Promise(r => setTimeout(r, 220));
        }
    }
    async function loadAllDestinations() {
        if (typeof window.loadAllDestinations === 'function') window.loadAllDestinations();
        await new Promise(r => setTimeout(r, 600));
    }

    // ----- grid build ---------------------------------------------------------
    function buildGrid() {
        const sf = fs.value.trim().toLowerCase(), rf = fr.value.trim().toLowerCase();
        const sMatch = (o, l) => !sf || o.toLowerCase().includes(sf) || l.toLowerCase().includes(sf);
        const rMatch = (p, t) => !rf || p.toLowerCase().includes(rf) || t.toLowerCase().includes(rf);

        const senderMap = gatherSenderNodes();
        const recvMap = gatherReceivers();
        const { cross, cS, cR } = gatherLinks();
        crossSet = cross;

        // connected senders missing from loaded pools still get a row (node=null)
        cS.forEach(k => { const [o, l] = k.split(SEP); if (!senderMap.has(o)) senderMap.set(o, new Map()); if (!senderMap.get(o).has(l)) senderMap.get(o).set(l, null); });

        // Build receiver columns (leaves), grouped by production, foldable.
        colLeaves = [];
        const colGroups = [];        // {prod, span}
        recvMap.forEach((twists, prod) => {
            const keep = [...twists].filter(([t]) => (showAllDst || cR.has(prod + SEP + t)) && rMatch(prod, t));
            if (!keep.length) return;
            if (collapsedProds.has(prod)) {
                colLeaves.push({ prod, group: true, twists: keep.map(([t]) => t), els: keep.map(([, e]) => e) });
                colGroups.push({ prod, span: 1 });
            } else {
                keep.forEach(([t, e]) => colLeaves.push({ prod, twist: t, twists: [t], el: e }));
                colGroups.push({ prod, span: keep.length });
            }
        });

        // Build sender rows (leaves), grouped by origin box, foldable.
        rowLeaves = [];
        const rowGroups = [];        // {origin, rows:[leafIdx...]}
        senderMap.forEach((labels, origin) => {
            const keep = [...labels].filter(([l]) => (showAllSrc || cS.has(origin + SEP + l)) && sMatch(origin, l));
            if (!keep.length) return;
            const idxStart = rowLeaves.length;
            if (collapsedOrigins.has(origin)) {
                rowLeaves.push({ origin, group: true, labels: keep.map(([l]) => l), nodes: keep.map(([, n]) => n) });
            } else {
                keep.forEach(([l, n]) => rowLeaves.push({ origin, label: l, labels: [l], node: n }));
            }
            rowGroups.push({ origin, start: idxStart, end: rowLeaves.length, connected: keep.some(([l]) => cS.has(origin + SEP + l)) });
        });

        const litAt = (ri, ci) => {
            const r = rowLeaves[ri], c = colLeaves[ci];
            for (const l of (r.group ? r.labels : [r.label])) for (const t of c.twists)
                if (crossSet.has([r.origin, l, c.prod, t].join(SEP))) return true;
            return false;
        };

        body.innerHTML = '';
        if (!rowLeaves.length || !colLeaves.length) {
            body.innerHTML = `<div class="rv-msg">${(!rowLeaves.length && !colLeaves.length)
                ? 'NOTHING TO SHOW — enable ALL SOURCES / ALL DESTINATIONS, or make some routes.'
                : !rowLeaves.length ? 'NO SENDERS — enable “ALL SOURCES”.' : 'NO RECEIVERS — enable “ALL DESTINATIONS”.'}</div>`;
            return;
        }

        const tbl = document.createElement('table');
        tbl.className = 'rv-grid';
        // header
        let h1 = `<tr><th class="rv-corner" rowspan="2">SRC \\ DST</th><th class="rv-corner" rowspan="2"></th>`;
        colGroups.forEach(g => { h1 += `<th class="rv-prodhead" colspan="${g.span}" data-prod="${encodeURIComponent(g.prod)}">${collapsedProds.has(g.prod) ? '▸' : '▾'} ${g.prod}</th>`; });
        h1 += '</tr><tr>';
        colLeaves.forEach(c => { h1 += c.group ? `<th class="rv-twisthead grp">ALL ${c.twists.length}</th>` : `<th class="rv-twisthead">${c.twist}</th>`; });
        h1 += '</tr>';
        const thead = document.createElement('thead'); thead.innerHTML = h1; tbl.appendChild(thead);
        // body
        let html = '';
        rowGroups.forEach(g => {
            for (let ri = g.start; ri < g.end; ri++) {
                const r = rowLeaves[ri];
                const off = !r.group && !cS.has(g.origin + SEP + r.label);
                html += `<tr class="${off ? 'rv-row-off' : ''}">`;
                if (ri === g.start) html += `<td class="rv-originhead" rowspan="${g.end - g.start}" data-origin="${encodeURIComponent(g.origin)}">${collapsedOrigins.has(g.origin) ? '▸' : '▾'} ${g.origin}</td>`;
                html += r.group ? `<td class="rv-feedhead grp">ALL ${r.labels.length} FEEDS</td>` : `<td class="rv-feedhead">${r.label}</td>`;
                colLeaves.forEach((c, ci) => {
                    const lit = litAt(ri, ci), grp = r.group || c.group;
                    html += `<td class="rv-cell${lit ? ' on' : ''}${grp ? ' grp' : ''}" data-r="${ri}" data-c="${ci}"></td>`;
                });
                html += '</tr>';
            }
        });
        const tbody = document.createElement('tbody'); tbody.innerHTML = html; tbl.appendChild(tbody);
        body.appendChild(tbl);

        const xpt = crossSet.size;
        overlay.querySelector('.rv-count').textContent =
            `${xpt} ROUTES · ${rowLeaves.length}×${colLeaves.length}`;
    }

    // ----- interaction --------------------------------------------------------
    function findDropped(twistEl, origin, label) {
        const dz = twistEl.querySelector('.drop-zone'); if (!dz) return null;
        return [...dz.querySelectorAll('.signal-node')].find(n => {
            if (n.classList.contains('dropped-group')) return false;
            const lbl = (n.innerText || '').trim().split('\n')[0];
            if (lbl !== label) return false;
            const orig = n.dataset.origin || lbl;     // same fallback as gatherLinks
            return orig === origin || !origin;
        });
    }
    function makeRoute(s, r) {
        if (!s.node || !r.el) return false;
        return placeSourceInTwist(r.el, s.node);   // honours accepts / limits
    }
    function breakRoute(s, r) {
        console.error("BRK "+JSON.stringify({o:s.origin,l:s.label,el:!!r.el}));
        const node = findDropped(r.el, s.origin, s.label);
        console.error("FOUND "+!!node+" dzlabels="+JSON.stringify([...(r.el?r.el.querySelectorAll(".drop-zone .signal-node:not(.dropped-group)"):[])].map(n=>(n.innerText||"").trim().split("\n")[0]+"|"+(n.dataset.origin||""))));
        if (!node) return false;
        const kids = node.closest('.dropped-group-children');
        node.remove();
        if (kids && !kids.querySelector('.signal-node')) { const g = kids.closest('.dropped-group'); if (g) g.remove(); }
        return true;
    }

    function onBodyClick(e) {
        const ph = e.target.closest('.rv-prodhead');
        if (ph) { const p = decodeURIComponent(ph.dataset.prod); collapsedProds.has(p) ? collapsedProds.delete(p) : collapsedProds.add(p); buildGrid(); return; }
        const oh = e.target.closest('.rv-originhead');
        if (oh) { const o = decodeURIComponent(oh.dataset.origin); collapsedOrigins.has(o) ? collapsedOrigins.delete(o) : collapsedOrigins.add(o); buildGrid(); return; }
        const cell = e.target.closest('.rv-cell');
        if (!cell || cell.classList.contains('grp')) return;
        const s = rowLeaves[+cell.dataset.r], r = colLeaves[+cell.dataset.c];
        const ok = cell.classList.contains('on') ? breakRoute(s, r)
            : (makeRoute(s, r) || (cell.classList.add('bad'), setTimeout(() => cell.classList.remove('bad'), 250), false));
        if (ok) { if (r.el) updateTwistVisuals(r.el); buildGrid(); }
    }

    // Minesweeper crosshair: light the hovered cell's row + column.
    function clearHl() { hlNodes.forEach(n => n.classList.remove('rv-hl')); hlNodes = []; }
    function onBodyOver(e) {
        const cell = e.target.closest('.rv-cell');
        if (!cell) { clearHl(); return; }
        const r = cell.dataset.r, c = cell.dataset.c;
        clearHl();
        body.querySelectorAll(`.rv-cell[data-r="${r}"], .rv-cell[data-c="${c}"]`).forEach(n => { n.classList.add('rv-hl'); hlNodes.push(n); });
    }

    // ----- URL ---------------------------------------------------------------
    function buildHash() {
        const p = [];
        if (showAllSrc) p.push('src=1'); if (showAllDst) p.push('dst=1');
        if (fs.value.trim()) p.push('s=' + encodeURIComponent(fs.value.trim()));
        if (fr.value.trim()) p.push('r=' + encodeURIComponent(fr.value.trim()));
        return ROUTE + (p.length ? '?' + p.join('&') : '');
    }
    function parseHash() {
        const h = location.hash || '';
        if (h !== ROUTE && h.indexOf(ROUTE + '?') !== 0) return null;
        const q = new URLSearchParams(h.indexOf('?') >= 0 ? h.slice(h.indexOf('?') + 1) : '');
        return { src: q.get('src') === '1', dst: q.get('dst') === '1', s: q.get('s') || '', r: q.get('r') || '' };
    }
    function writeHash() { syncing = true; history.replaceState(null, '', buildHash()); syncing = false; }

    async function applyToggles(src, dst) {
        showAllSrc = src; showAllDst = dst;
        tgSrc.classList.toggle('on', src); tgSrc.textContent = src ? '✓ ALL SOURCES' : 'ALL SOURCES';
        tgDst.classList.toggle('on', dst); tgDst.textContent = dst ? '✓ ALL DESTINATIONS' : 'ALL DESTINATIONS';
        if (src) await loadAllSources();
        if (dst) await loadAllDestinations();
        // Showing "everything" would be a million-cell wall, so default to a FOLDED
        // group-of-groups matrix (box × production). Drill in by clicking a header;
        // expanded leaf crosspoints are where you actually make/break routes.
        collapsedOrigins.clear();
        if (src) [...gatherSenderNodes().keys()].forEach(o => collapsedOrigins.add(o));
        collapsedProds.clear();
        if (dst) [...gatherReceivers().keys()].forEach(p => collapsedProds.add(p));
    }

    function build() {
        injectStyles();
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'rv-overlay';
        overlay.innerHTML = `
            <div class="rv-win">
                <div class="rv-titlebar">▣ 1990s VIEW — Router.exe<span class="rv-x" title="Close">×</span></div>
                <div class="rv-bar">
                    <input data-fsender placeholder="find sender…">
                    <input data-freceiver placeholder="find receiver…">
                    <button class="rv-tg" data-tgsrc>ALL SOURCES</button>
                    <button class="rv-tg" data-tgdst>ALL DESTINATIONS</button>
                    <span class="rv-count"></span>
                    <span class="rv-help">click a crosspoint to make/break a route · click a group header to fold</span>
                </div>
                <div class="rv-body"></div>
            </div>`;
        document.body.appendChild(overlay);
        fs = overlay.querySelector('[data-fsender]');
        fr = overlay.querySelector('[data-freceiver]');
        body = overlay.querySelector('.rv-body');
        tgSrc = overlay.querySelector('[data-tgsrc]');
        tgDst = overlay.querySelector('[data-tgdst]');
        const onFilter = () => { buildGrid(); writeHash(); };
        fs.addEventListener('input', onFilter);
        fr.addEventListener('input', onFilter);
        tgSrc.addEventListener('click', async () => { await applyToggles(!showAllSrc, showAllDst); buildGrid(); writeHash(); });
        tgDst.addEventListener('click', async () => { await applyToggles(showAllSrc, !showAllDst); buildGrid(); writeHash(); });
        body.addEventListener('click', onBodyClick);
        body.addEventListener('mouseover', onBodyOver);
        body.addEventListener('mouseleave', clearHl);
        overlay.querySelector('.rv-x').addEventListener('click', close);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
        return overlay;
    }

    function open() {
        if (!(location.hash === ROUTE || location.hash.indexOf(ROUTE + '?') === 0)) {
            prevHash = location.hash; location.hash = ROUTE;
        } else show(parseHash());
    }
    function close() {
        const ov = build(); ov.classList.remove('open');
        syncing = true; history.replaceState(null, '', prevHash || (location.pathname + location.search)); syncing = false;
        prevHash = null;
    }
    async function show(state) {
        const ov = build();
        if (state) { fs.value = state.s; fr.value = state.r; await applyToggles(state.src, state.dst); }
        buildGrid();
        ov.classList.add('open');
    }
    function onHashChange() {
        if (syncing) return;
        const st = parseHash();
        if (st) show(st);
        else if (overlay && overlay.classList.contains('open')) overlay.classList.remove('open');
    }

    function addButton() {
        if (document.querySelector('.rv-btn')) return;
        const b = document.createElement('button');
        b.className = 'rv-btn'; b.textContent = '1990s VIEW';
        b.title = 'Router crosspoint matrix (opens #/1990s)';
        b.addEventListener('click', open);
        document.body.appendChild(b);
    }
    function init() {
        injectStyles(); addButton();
        window.addEventListener('hashchange', onHashChange);
        if (parseHash()) { build(); show(parseHash()); }
    }

    window.RouterView = { open, close };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
