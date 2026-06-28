// js/router-view.js — the "1990s VIEW": an old-school router crosspoint grid.
//
// Reads every routing currently in the DOM (sources dropped into production
// twists) and lays them out as a matrix-of-matrices: rows are SENDERS grouped by
// their source box, columns are RECEIVERS grouped by production, and a lit
// crosspoint marks each connection. Filter boxes narrow by sender or receiver.
// Self-mounting ES module; adds a bottom-right button and exposes window.RouterView.
(function () {
    'use strict';

    const STYLE_ID = 'router-view-styles';
    const SEP = '␟';                         // unlikely-to-collide key separator
    let overlay = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        .rv-btn{position:fixed;right:14px;bottom:76px;z-index:1000;background:#003b22;color:#33ff66;
            border:1px solid #0f5;font-family:'Courier New',monospace;font-weight:bold;letter-spacing:1px;
            padding:8px 14px;border-radius:4px;cursor:pointer;box-shadow:0 0 10px rgba(0,255,100,.3);}
        .rv-btn:hover{background:#0a5;color:#000;}
        .rv-overlay{position:fixed;inset:0;z-index:2500;display:none;flex-direction:column;
            background:#000a05;color:#33ff66;font-family:'Courier New',Courier,monospace;}
        .rv-overlay.open{display:flex;}
        .rv-top{display:flex;align-items:center;gap:14px;padding:10px 14px;background:#001a0d;
            border-bottom:2px solid #0f5;flex-wrap:wrap;}
        .rv-title{font-weight:bold;letter-spacing:3px;font-size:16px;color:#7CFC00;text-shadow:0 0 6px #0f5;}
        .rv-filters{display:flex;gap:10px;flex:1;flex-wrap:wrap;}
        .rv-filters input{background:#001208;border:1px solid #0a5;color:#7CFC00;padding:6px 10px;
            font-family:inherit;font-size:12px;border-radius:3px;min-width:160px;}
        .rv-filters input::placeholder{color:#2a7a4a;}
        .rv-count{font-size:12px;color:#2a7a4a;letter-spacing:1px;}
        .rv-close{cursor:pointer;background:#0a5;color:#000;font-weight:bold;border:none;
            padding:7px 16px;border-radius:3px;letter-spacing:1px;}
        .rv-close:hover{filter:brightness(1.15);}
        .rv-body{flex:1;overflow:auto;padding:10px;}
        .rv-empty-msg{padding:40px;text-align:center;color:#2a7a4a;letter-spacing:2px;}
        table.rv-grid{border-collapse:separate;border-spacing:0;font-size:11px;}
        .rv-grid th,.rv-grid td{border:1px solid #0a4030;padding:4px 7px;text-align:center;white-space:nowrap;}
        .rv-grid thead th{position:sticky;top:0;z-index:3;background:#001a0d;color:#9f9;}
        .rv-prodhead{background:#06301f;color:#7CFC00;letter-spacing:2px;font-weight:bold;}
        .rv-twisthead{background:#001a0d;color:#9f9;font-weight:normal;}
        .rv-corner{position:sticky;left:0;top:0;z-index:4;background:#001a0d;}
        .rv-originhead{position:sticky;left:0;z-index:2;background:#001208;color:#7CFC00;text-align:left;
            letter-spacing:1px;font-weight:bold;}
        .rv-feedhead{position:sticky;left:120px;z-index:2;background:#000f08;color:#9f9;text-align:left;}
        .rv-cell{color:#0a4030;}
        .rv-cell.on{color:#000;background:#33ff66;font-weight:bold;box-shadow:0 0 8px #33ff66 inset;}
        .rv-cell.on::after{content:'\\25CF';}
        `;
        document.head.appendChild(s);
    }

    // Walk every twist's drop-zone and collect (sender → receiver) links.
    function gatherLinks() {
        const links = [];
        document.querySelectorAll('.twist-container').forEach(tw => {
            const dz = tw.querySelector('.drop-zone');
            if (!dz) return;
            const row = tw.closest('.program-row');
            const prodName = tw.dataset.prodName
                || (row && row.querySelector('.program-title') ? row.querySelector('.program-title').innerText.trim() : 'UNKNOWN');
            const twistName = (tw.querySelector('.twist-title') || {}).innerText
                ? tw.querySelector('.twist-title').innerText.trim() : 'TWIST';
            dz.querySelectorAll(':scope > .signal-node').forEach(node => {
                const feeds = node.classList.contains('dropped-group')
                    ? [...node.querySelectorAll('.dropped-group-children .signal-node')]
                    : [node];
                feeds.forEach(f => {
                    const label = (f.innerText || '').trim().split('\n')[0];
                    if (!label) return;
                    const origin = f.dataset.origin || node.dataset.origin || label;
                    links.push({ origin, label, prodName, twistName });
                });
            });
        });
        return links;
    }

    // Build ordered, grouped sender/receiver axes + a crosspoint Set from links,
    // honouring the sender/receiver text filters.
    function model(links, fSender, fReceiver) {
        const sf = fSender.trim().toLowerCase(), rf = fReceiver.trim().toLowerCase();
        const sMatch = (o, l) => !sf || o.toLowerCase().includes(sf) || l.toLowerCase().includes(sf);
        const rMatch = (p, t) => !rf || p.toLowerCase().includes(rf) || t.toLowerCase().includes(rf);

        const senders = new Map();    // origin -> ordered Set(label)
        const receivers = new Map();  // prod   -> ordered Set(twist)
        const cross = new Set();      // origin¦label¦prod¦twist
        links.forEach(({ origin, label, prodName, twistName }) => {
            if (!sMatch(origin, label) || !rMatch(prodName, twistName)) return;
            if (!senders.has(origin)) senders.set(origin, new Set());
            senders.get(origin).add(label);
            if (!receivers.has(prodName)) receivers.set(prodName, new Set());
            receivers.get(prodName).add(twistName);
            cross.add([origin, label, prodName, twistName].join(SEP));
        });
        return { senders, receivers, cross };
    }

    function buildGrid(body, fSender, fReceiver) {
        const links = gatherLinks();
        const { senders, receivers, cross } = model(links, fSender, fReceiver);

        const count = overlay.querySelector('.rv-count');
        if (count) count.textContent = `${cross.size} CROSSPOINT(S)`;

        body.innerHTML = '';
        if (!cross.size) {
            body.innerHTML = `<div class="rv-empty-msg">${links.length
                ? 'NO ROUTES MATCH THE FILTER'
                : 'NO ROUTES YET — DRAG SOURCES INTO A PRODUCTION, THEN REOPEN.'}</div>`;
            return;
        }

        // Flatten receivers into ordered [prod, twist] columns.
        const cols = [];
        receivers.forEach((twists, prod) => twists.forEach(t => cols.push([prod, t])));

        const table = document.createElement('table');
        table.className = 'rv-grid';

        // Header row 1: production group spans; row 2: twist names.
        let h1 = `<tr><th class="rv-corner" rowspan="2">SENDER \\ RECEIVER</th><th class="rv-corner" rowspan="2"></th>`;
        receivers.forEach((twists, prod) => { h1 += `<th class="rv-prodhead" colspan="${twists.size}">${prod}</th>`; });
        h1 += '</tr>';
        let h2 = '<tr>';
        cols.forEach(([, t]) => { h2 += `<th class="rv-twisthead">${t}</th>`; });
        h2 += '</tr>';
        const thead = document.createElement('thead');
        thead.innerHTML = h1 + h2;
        table.appendChild(thead);

        // Body: origin row-groups, one row per feed, crosspoint per receiver column.
        const tbody = document.createElement('tbody');
        let rows = '';
        senders.forEach((feeds, origin) => {
            const feedList = [...feeds];
            feedList.forEach((label, i) => {
                rows += '<tr>';
                if (i === 0) rows += `<td class="rv-originhead" rowspan="${feedList.length}">${origin}</td>`;
                rows += `<td class="rv-feedhead">${label}</td>`;
                cols.forEach(([prod, t]) => {
                    const on = cross.has([origin, label, prod, t].join(SEP));
                    rows += `<td class="rv-cell${on ? ' on' : ''}"></td>`;
                });
                rows += '</tr>';
            });
        });
        tbody.innerHTML = rows;
        table.appendChild(tbody);
        body.appendChild(table);
    }

    function build() {
        injectStyles();
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'rv-overlay';
        overlay.innerHTML = `
            <div class="rv-top">
                <span class="rv-title">▘ 1990s VIEW · ROUTER MATRIX</span>
                <div class="rv-filters">
                    <input data-fsender placeholder="filter sender…">
                    <input data-freceiver placeholder="filter receiver…">
                </div>
                <span class="rv-count"></span>
                <button class="rv-close">CLOSE</button>
            </div>
            <div class="rv-body"></div>`;
        document.body.appendChild(overlay);

        const body = overlay.querySelector('.rv-body');
        const fs = overlay.querySelector('[data-fsender]');
        const fr = overlay.querySelector('[data-freceiver]');
        const redraw = () => buildGrid(body, fs.value, fr.value);
        fs.addEventListener('input', redraw);
        fr.addEventListener('input', redraw);
        overlay.querySelector('.rv-close').addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close();
        });
        return overlay;
    }

    function open() {
        const ov = build();
        ov.classList.add('open');
        buildGrid(ov.querySelector('.rv-body'),
            ov.querySelector('[data-fsender]').value, ov.querySelector('[data-freceiver]').value);
    }
    function close() { if (overlay) overlay.classList.remove('open'); }

    function addButton() {
        if (document.querySelector('.rv-btn')) return;
        const b = document.createElement('button');
        b.className = 'rv-btn';
        b.textContent = '1990s VIEW';
        b.title = 'Router crosspoint matrix';
        b.addEventListener('click', open);
        document.body.appendChild(b);
    }

    function init() { injectStyles(); addButton(); }

    window.RouterView = { open, close };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
