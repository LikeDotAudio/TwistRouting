// Build the entire SOURCES ingress panel by READING the filesystem — nothing is
// hardcoded. Sources/index.json lists the categories; each category folder is
// rendered into its own super-pool, and every *.json leaf is dispatched to the
// right pool renderer based on the SHAPE of its own data (not its folder name),
// so dropping a new category/folder/file in makes it appear with zero code edits.
import { listDirectory, fetchJSON, toggleSuperPool, isFaultStatus } from './globals.js';
import { AUDIO_POOL_COLORS, SOURCE_POOL_COLORS } from './util/palette.js';
import { makeMediaGroup } from './ui/makeMediaGroup.js';
import { stripOrder, slugId } from './util/dom.js';
import { styleSignalNode } from './util/color.js';
import { initializeDraggables } from './dragDrop.js';
import { renderPlayoutPool } from './poolPlayout.js';
import { renderProductionInputs } from './productions.js';
import { renderAudioPool } from './poolAudio.js';
import { renderVideoPool } from './poolVideo.js';

// Decide how a leaf renders purely from what's in the JSON:
//   players[]              -> playout  (players → videos → video+4-audio stacks)
//   outputs{}              -> productions (video/audio/intercom output feeds)
//   items[] / extraClass~audio -> audio pool
//   otherwise              -> video pool (multiplex stage box)
export function inferPoolKind(data) {
    if (!data || typeof data !== 'object') return 'video';
    if (Array.isArray(data.players)) return 'playout';
    if (data.outputs && typeof data.outputs === 'object') return 'productions';
    const ec = (data.extraClass || '').toLowerCase();
    if (ec.includes('audio') || Array.isArray(data.items)) return 'audio';
    return 'video';
}

export function renderSourceLeaf(data, container, kind, color) {
    if (kind === 'playout') return renderPlayoutPool(data, container);
    if (kind === 'productions') return renderProductionInputs([data], container);
    if (kind === 'audio') return renderAudioPool(data, container, color);
    return renderVideoPool(data, container);
}

// ----- ganged stage boxes (square numbered cells) -------------------------
function injectGangStyles() {
    if (document.getElementById('source-gang-styles')) return;
    const s = document.createElement('style');
    s.id = 'source-gang-styles';
    s.textContent = `
        .gang-cap{font-size:10px;font-weight:bold;letter-spacing:2px;color:#9fb6cc;margin:2px 0 4px 4px;text-transform:uppercase;}
        .gang-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:4px;margin:0 0 10px;}
        .signal-node.gang-cell{border-radius:3px;padding:0;cursor:grab;display:flex;align-items:center;
            justify-content:center;min-height:34px;background:rgba(0,0,0,.55);}
        .signal-node.gang-cell .multiplex-header{font-size:13px;font-weight:bold;letter-spacing:1px;padding:9px 2px;width:100%;text-align:center;}
        .signal-node.gang-cell .multiplex-children{display:none;flex-direction:column;gap:2px;padding:2px;}
        .signal-node.gang-cell.fault{outline:2px solid #ff3344;}
    `;
    document.head.appendChild(s);
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One square draggable cell = a whole stage box (hold to expand its channels).
function buildGangCell(data, suffix, color) {
    const node = document.createElement('div');
    node.className = 'signal-node audio multiplex gang-cell';
    node.id = 'pool-' + (data.id || slugId(data.name));
    node.draggable = true;
    node.dataset.origin = data.origin || data.name;
    node.dataset.status = data.status || 'OK';
    const labels = (data.items && data.items.length)
        ? data.items
        : Array.from({ length: data.count || 0 }, (_, i) => `${data.prefix || ''}${String(i + 1).padStart(2, '0')}`);
    let subs = '';
    labels.forEach(l => {
        subs += `<div class="signal-node audio ${data.extraClass || 'audio-studio'} sub-stream" draggable="true" id="pool-${node.id}-${slugId(l)}" data-origin="${data.origin || data.name}">${l}</div>`;
    });
    node.innerHTML = `<div class="multiplex-header">${suffix}</div><div class="multiplex-children" style="display:none;">${subs}</div>`;
    styleSignalNode(node, color);
    if (isFaultStatus(data.status)) { node.classList.add('fault'); node.querySelectorAll('.sub-stream').forEach(x => x.classList.add('fault')); }
    return node;
}

function renderGang(container, word, leaves, color) {
    injectGangStyles();
    const cap = document.createElement('div');
    cap.className = 'gang-cap'; cap.textContent = word; cap.style.color = color;
    container.appendChild(cap);
    const grid = document.createElement('div');
    grid.className = 'gang-grid';
    container.appendChild(grid);
    const re = new RegExp('^' + escapeRe(word) + '\\s*', 'i');
    leaves.forEach(d => {
        const suffix = ((d.name || '').replace(re, '').trim()) || d.name;
        grid.appendChild(buildGangCell(d, suffix, color));
    });
}

// Recursively render a category: *.json leaves become pools, subfolders become
// nested collapsible groups. Identical for every category — the leaf shape, read
// at render time, picks the renderer.
export async function renderSourceTree(baseUrl, container, depth, inheritColor, parentLabel) {
    const { dirs, files } = await listDirectory(baseUrl);

    // Fetch this folder's leaf files concurrently.
    const datas = await Promise.all(files.map(f => fetchJSON(baseUrl + f.href)));
    const valid = datas.filter(Boolean);
    valid.forEach(d => { d.origin = parentLabel ? `${parentLabel} — ${d.name}` : d.name; });

    // GANG: audio boxes that share a leading word (STAGEBOX 101, 102, …) collapse
    // to one square-cell grid (the word as a caption, the numbers as cells).
    // Everything else renders as its normal pool, preserving order.
    const order = [];
    const byWord = new Map();
    valid.forEach(d => {
        const kind = inferPoolKind(d);
        const word = (d.name || '').trim().split(/\s+/)[0] || '';
        if (kind === 'audio' && word) {
            if (!byWord.has(word)) { const g = { word, leaves: [] }; byWord.set(word, g); order.push(g); }
            byWord.get(word).leaves.push(d);
        } else order.push({ single: d, kind });
    });
    let ci = 0;
    order.forEach(g => {
        const color = inheritColor || AUDIO_POOL_COLORS[ci++ % AUDIO_POOL_COLORS.length];
        if (g.single) renderSourceLeaf(g.single, container, g.kind, color);
        else if (g.leaves.length >= 2) renderGang(container, g.word, g.leaves, color);
        else renderSourceLeaf(g.leaves[0], container, 'audio', color);
    });

    // Build the nested group headers from the manifest, but DON'T crawl into them
    // yet — each subtree (e.g. a floor's stage boxes) loads the first time its
    // group is expanded. So only the bars come from index.json; contents are
    // fetched on demand.
    dirs.forEach((d, idx) => {
        const groupColor = inheritColor || AUDIO_POOL_COLORS[idx % AUDIO_POOL_COLORS.length];
        const content = makeMediaGroup(container, stripOrder(d.name), groupColor, depth);
        const header = content.previousElementSibling;
        let loaded = false;
        const load = async () => {
            if (loaded) return;
            loaded = true;
            await renderSourceTree(baseUrl + d.href, content, depth + 1, groupColor, stripOrder(d.name));
            // Wire the freshly-rendered pool nodes for drag (mouse + touch).
            initializeDraggables();
        };
        if (header) header.addEventListener('click', load);
    });
}

// Create a super-pool shell (LCARS spine + foldable title) and return its content
// element. Mirrors the markup toggleSuperPool() expects.
export function buildSuperPool(panel, name, color) {
    const container = document.createElement('div');
    container.className = 'super-pool-container';
    container.style.setProperty('--lcars-color', color);
    container.innerHTML = `
        <div class="super-pool-title foldable-header">
            <span>${stripOrder(name).toUpperCase()}</span><span class="fold-icon">▼</span>
        </div>
        <div class="super-pool-content"></div>
    `;
    container.addEventListener('click', (e) => toggleSuperPool(e, container));
    panel.appendChild(container);
    return container.querySelector(':scope > .super-pool-content');
}

// Entry point: read Sources/index.json and build a super-pool per category, in
// manifest order. Reorder the manifest to reorder the panel — no code change.
export async function renderSourcesPanel(panel) {
    if (!panel) return;
    const { dirs } = await listDirectory('Routes/Sources/');
    // Build the super-pools in manifest order, then fill them in parallel.
    await Promise.all(dirs.map((cat, i) => {
        const color = SOURCE_POOL_COLORS[i % SOURCE_POOL_COLORS.length];
        const content = buildSuperPool(panel, cat.name, color);
        return renderSourceTree('Routes/Sources/' + cat.href, content, 0, null, null);
    }));
}
