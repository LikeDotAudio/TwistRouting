// js/captains-log.js — the Captain's Log.
//
// Narrates every routing decision and lets the operator undo it ("Reverse
// Course"). One MutationObserver watches the destinations content; whatever
// changes in a twist's drop-zone (from a drag-drop, the switcher modal, the
// 1990s view, or a room auto-populate) becomes a log entry:
//
//   "The destination of <DEST> (<PROD>) that previously contained the <OLD>
//    was replaced with the <NEW> by the user at <UTC>."
//
// Entries are grouped into NARRATIVES ("voyages"); a Reverse Course undoes the
// selected entries (or a whole voyage), restoring the exact nodes. Self-mounting
// ES module; exposes window.CaptainsLog.
import { updateTwistVisuals } from './visuals.js';

(function () {
    'use strict';

    const STYLE_ID = 'captains-log-styles';
    let panel = null, listEl = null, observer = null, paused = false;
    let narratives = [];          // [{ id, title, entries: [entry] }]
    let current = null;
    const selected = new Set();
    let nidSeq = 0, eidSeq = 0;

    const utc = (ts) => new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '') + ' UTC';
    const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function nodeLabel(n) {
        if (!n || n.nodeType !== 1) return '';
        if (n.classList.contains('dropped-group')) {
            const h = n.querySelector('.dropped-group-header');
            const k = n.querySelectorAll('.dropped-group-children .signal-node').length;
            const base = ((h ? h.innerText : n.dataset.origin) || 'group').trim().split('\n')[0];
            return k ? `${base} ×${k}` : base;
        }
        return (n.innerText || '').trim().split('\n')[0];
    }
    const labelsOf = (nodes) => nodes.map(nodeLabel).filter(Boolean).join(', ') || 'nothing';

    function destInfo(twist) {
        const t = twist.querySelector('.twist-title');
        const name = t ? t.innerText.trim() : 'destination';
        const row = twist.closest('.program-row');
        const prod = twist.dataset.prodName
            || (row && row.querySelector('.program-title') ? row.querySelector('.program-title').innerText.trim() : '');
        return { dest: name, prod };
    }
    function narrate(dest, prod, removed, added, ts) {
        const head = `The destination of ${dest}${prod ? ` (${prod})` : ''}`;
        const t = utc(ts);
        if (removed.length && added.length)
            return `${head} that previously contained the ${labelsOf(removed)} was replaced with the ${labelsOf(added)} by the user at ${t}.`;
        if (added.length)
            return `${head}, previously empty, received the ${labelsOf(added)} by the user at ${t}.`;
        return `${head} that previously contained the ${labelsOf(removed)} was cleared by the user at ${t}.`;
    }

    function ensureNarrative() {
        if (!current) { current = { id: ++nidSeq, title: `Voyage ${nidSeq}`, entries: [] }; narratives.push(current); }
        return current;
    }

    // ----- capture ------------------------------------------------------------
    function onMutations(records) {
        if (paused) return;
        const byTwist = new Map();
        records.forEach(rec => {
            const target = rec.target;
            if (!(target instanceof Element)) return;
            const inDrop = target.classList.contains('drop-zone') || target.classList.contains('dropped-group-children') || target.closest('.drop-zone');
            if (!inDrop) return;
            const twist = target.closest('.twist-container'); if (!twist) return;
            if (!byTwist.has(twist)) byTwist.set(twist, { added: [], removed: [] });
            const ch = byTwist.get(twist);
            rec.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('signal-node')) ch.added.push(n); });
            rec.removedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('signal-node')) ch.removed.push({ node: n, parent: target, next: rec.nextSibling }); });
        });
        if (!byTwist.size) return;
        const ts = Date.now();
        const nar = ensureNarrative();
        let changed = false;
        byTwist.forEach((ch, twist) => {
            if (!ch.added.length && !ch.removed.length) return;
            const { dest, prod } = destInfo(twist);
            nar.entries.push({
                id: ++eidSeq, ts, twist, dest, prod,
                added: ch.added.slice(), removed: ch.removed.slice(),
                text: narrate(dest, prod, ch.removed.map(r => r.node), ch.added, ts),
                reversed: false,
            });
            changed = true;
        });
        if (changed) render();
    }

    // ----- undo ---------------------------------------------------------------
    function reverseEntry(entry) {
        if (entry.reversed) return;
        // Remove what was added; restore what was removed (to its old spot).
        entry.added.forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
        entry.removed.forEach(({ node, parent, next }) => {
            if (parent && parent.isConnected) {
                if (next && next.parentNode === parent) parent.insertBefore(node, next);
                else parent.appendChild(node);
            } else {
                const dz = entry.twist.querySelector('.drop-zone'); if (dz) dz.appendChild(node);
            }
        });
        if (entry.twist) try { updateTwistVisuals(entry.twist); } catch (e) {}
        entry.reversed = true;
    }
    function reverseSelected() {
        const all = [];
        narratives.forEach(n => n.entries.forEach(e => { if (selected.has(e.id) && !e.reversed) all.push(e); }));
        if (!all.length) return;
        all.sort((a, b) => b.ts - a.ts || b.id - a.id);   // newest first
        paused = true;
        all.forEach(reverseEntry);
        if (observer) observer.takeRecords();              // discard our own mutations
        paused = false;
        selected.clear();
        render();
    }

    // ----- UI -----------------------------------------------------------------
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        .cl-btn{display:block;width:100%;z-index:1000;background:#C2B74B;color:#1a1206;
            border:none;font-family:'Courier New',monospace;font-weight:900;letter-spacing:2px;text-transform:uppercase;
            padding:9px 16px;margin-bottom:10px;border-radius:18px 6px 6px 18px;cursor:pointer;box-shadow:inset 6px 0 0 #8f8a35;
            text-align:left;}
        .cl-btn:hover{filter:brightness(1.1);}
        .cl-btn:hover{background:#ffcf6b;color:#000;}
        .cl-badge{display:inline-block;min-width:16px;margin-left:6px;padding:0 5px;border-radius:8px;
            background:#1a1206;color:#C2B74B;font-size:10px;}
        .cl-panel{position:fixed;top:0;right:0;width:500px;max-width:94vw;height:100%;z-index:2600;
            background:#0a0805;color:#ffcf6b;font-family:Arial,Helvetica,sans-serif;display:flex;
            flex-direction:column;transform:translateX(101%);transition:transform .25s ease;
            box-shadow:-10px 0 40px rgba(0,0,0,.7);}
        .cl-panel.open{transform:translateX(0);}
        /* LCARS header rail */
        .cl-head{display:flex;align-items:stretch;height:46px;background:#C2B74B;}
        .cl-title{flex:1;display:flex;align-items:center;padding-left:22px;color:#000;font-weight:900;
            letter-spacing:3px;font-size:15px;}
        .cl-x{flex:0 0 auto;width:62px;display:flex;align-items:center;justify-content:center;color:#000;
            font-weight:900;letter-spacing:1px;cursor:pointer;box-shadow:inset 2px 0 0 rgba(0,0,0,.25);}
        .cl-x:hover{background:rgba(0,0,0,.15);}
        .cl-tools{display:flex;gap:8px;padding:10px 12px;background:#140f06;}
        .cl-rev,.cl-new{font-family:inherit;font-weight:900;font-size:11px;letter-spacing:1px;cursor:pointer;
            padding:8px 16px;border:none;border-radius:14px;text-transform:uppercase;color:#000;}
        .cl-rev{background:#cc3a3a;} .cl-new{background:#6cdf4a;}
        .cl-rev:hover,.cl-new:hover{filter:brightness(1.12);}
        .cl-list{flex:1;overflow:auto;padding:10px 10px 10px 0;background:#0a0805;}
        .cl-empty{color:#6a5a30;padding:30px 10px;text-align:center;letter-spacing:1px;}
        /* a voyage = an LCARS labelled block; entries are data rows under it */
        .cl-nar{margin:0 0 16px 14px;}
        .cl-nar-h{display:flex;align-items:center;gap:8px;height:30px;padding:0 14px;color:#000;font-weight:900;
            letter-spacing:2px;font-size:12px;border-radius:14px 14px 3px 3px;cursor:pointer;text-transform:uppercase;}
        .cl-nar-h .cl-edit{margin-left:auto;font-size:9px;font-weight:bold;opacity:.7;text-transform:none;}
        .cl-entry{display:flex;align-items:stretch;margin-top:3px;cursor:pointer;background:#12100a;
            border-radius:3px 12px 12px 3px;overflow:hidden;}
        .cl-entry:hover{background:#1c1810;}
        .cl-cap{flex:0 0 12px;}
        .cl-mid{flex:1;min-width:0;padding:7px 11px;font-size:12px;line-height:1.42;color:#ffe9b0;}
        .cl-val{flex:0 0 auto;align-self:stretch;display:flex;flex-direction:column;align-items:flex-end;
            justify-content:center;padding:4px 13px;background:#1c1408;color:#ffcf6b;
            font-family:'Courier New',monospace;font-weight:bold;font-size:12px;min-width:78px;text-align:right;}
        .cl-val small{font-size:8px;color:#8a7430;letter-spacing:1px;}
        .cl-entry.sel{outline:2px solid #fff;outline-offset:-2px;}
        .cl-entry.sel .cl-cap{background:#fff !important;}
        .cl-entry.reversed{opacity:.4;}
        .cl-entry.reversed .cl-mid{text-decoration:line-through;}
        .cl-rb{color:#ff8a8a;font-style:italic;font-size:10px;}
        `;
        document.head.appendChild(s);
    }

    const VOY_COLORS = ['#C2B74B', '#FF9C63', '#3FC1C9', '#A06EB4', '#cc6a3a', '#6cdf4a', '#9C6B9C'];
    const hms = (ts) => new Date(ts).toISOString().slice(11, 19);   // HH:MM:SS

    function render() {
        if (!listEl) return;
        const total = narratives.reduce((a, n) => a + n.entries.length, 0);
        const badge = document.querySelector('.cl-badge');
        if (badge) badge.textContent = total;
        if (!total) { listEl.innerHTML = `<div class="cl-empty">— ship's log empty —<br>routing decisions appear here</div>`; return; }
        let html = '';
        [...narratives].reverse().forEach(n => {
            const color = VOY_COLORS[narratives.indexOf(n) % VOY_COLORS.length];
            html += `<div class="cl-nar">
                <div class="cl-nar-h" data-nar="${n.id}" style="background:${color}">${esc(n.title)}<span class="cl-edit">row=select · header=all · ✎</span></div>`;
            [...n.entries].reverse().forEach(e => {
                html += `<div class="cl-entry${selected.has(e.id) ? ' sel' : ''}${e.reversed ? ' reversed' : ''}" data-entry="${e.id}">
                    <div class="cl-cap" style="background:${color}"></div>
                    <div class="cl-mid">${esc(e.text)}${e.reversed ? ' <span class="cl-rb">[course reversed]</span>' : ''}</div>
                    <div class="cl-val">${hms(e.ts)}<small>UTC</small></div>
                </div>`;
            });
            html += `</div>`;
        });
        listEl.innerHTML = html;
    }

    function entryById(id) { for (const n of narratives) { const e = n.entries.find(x => x.id === id); if (e) return e; } return null; }
    function narById(id) { return narratives.find(n => n.id === id); }

    function build() {
        injectStyles();
        if (panel) return panel;
        panel = document.createElement('div');
        panel.className = 'cl-panel';
        panel.innerHTML = `
            <div class="cl-head"><span class="cl-title">▣ CAPTAIN'S LOG</span><span class="cl-x" title="Close">CLOSE</span></div>
            <div class="cl-tools">
                <button class="cl-rev">↩ REVERSE COURSE</button>
                <button class="cl-new">✦ NEW VOYAGE</button>
            </div>
            <div class="cl-list"></div>`;
        document.body.appendChild(panel);
        listEl = panel.querySelector('.cl-list');
        panel.querySelector('.cl-x').addEventListener('click', close);
        panel.querySelector('.cl-rev').addEventListener('click', reverseSelected);
        panel.querySelector('.cl-new').addEventListener('click', () => {
            const title = prompt('Name this voyage:', `Voyage ${nidSeq + 1}`);
            current = { id: ++nidSeq, title: (title || `Voyage ${nidSeq}`).trim(), entries: [] };
            narratives.push(current); render();
        });
        listEl.addEventListener('click', (e) => {
            const nh = e.target.closest('.cl-nar-h');
            if (nh) {
                if (e.target.classList.contains('cl-edit')) {
                    const n = narById(+nh.dataset.nar);
                    const t = prompt('Rename voyage:', n.title); if (t != null) { n.title = t.trim() || n.title; render(); }
                    return;
                }
                const n = narById(+nh.dataset.nar);
                const ids = n.entries.filter(x => !x.reversed).map(x => x.id);
                const allSel = ids.length && ids.every(id => selected.has(id));
                ids.forEach(id => allSel ? selected.delete(id) : selected.add(id));
                render(); return;
            }
            const er = e.target.closest('.cl-entry');
            if (er) {
                const id = +er.dataset.entry, en = entryById(id);
                if (en && en.reversed) return;
                selected.has(id) ? selected.delete(id) : selected.add(id);
                render();
            }
        });
        return panel;
    }

    function open() { build().classList.add('open'); render(); }
    function close() { if (panel) panel.classList.remove('open'); }

    function addButton() {
        if (document.querySelector('.cl-btn')) return;
        const b = document.createElement('button');
        b.className = 'cl-btn';
        b.innerHTML = `CAPTAIN'S LOG<span class="cl-badge">0</span>`;
        b.addEventListener('click', open);
        // The Captain's Log sits at the TOP of the sources panel, above SOUND.
        const panel = document.querySelector('.ingress-panel');
        if (panel) panel.insertBefore(b, panel.firstChild);
        else document.body.appendChild(b);
    }

    function init() {
        injectStyles();
        addButton();
        const root = document.getElementById('production-content') || document.body;
        observer = new MutationObserver(onMutations);
        observer.observe(root, { childList: true, subtree: true });
    }

    window.CaptainsLog = { open, close };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
