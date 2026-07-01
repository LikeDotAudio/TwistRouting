// Build the entire SOURCES ingress panel by READING the filesystem — nothing is
// hardcoded. Sources/index.json lists the categories; each category folder is
// rendered into its own super-pool, and every *.json leaf is dispatched to the
// right pool renderer based on the SHAPE of its own data (not its folder name),
// so dropping a new category/folder/file in makes it appear with zero code edits.
import { listDirectory, fetchJSON, toggleSuperPool, isFaultStatus } from './globals.js';
import { AUDIO_POOL_COLORS, SOURCE_POOL_COLORS } from './util/palette.js';
import { makeMediaGroup } from './ui/makeMediaGroup.js';
import { monoEmoji } from './util/mono-emoji.js';
import { stripOrder, slugId } from './util/dom.js';
import { styleSignalNode } from './util/color.js';
import { initializeDraggables } from './dragDrop.js';
import { renderPlayoutPool } from './poolPlayout.js';
import { renderStreamsPool } from './poolStreams.js';
import { renderProductionInputs } from './productions.js';
import { renderAudioPool } from './poolAudio.js';
import { renderVideoPool, fillVideoCameras } from './poolVideo.js';

// Decide how a leaf renders purely from what's in the JSON:
//   players[]              -> playout  (players → videos → video+4-audio stacks)
//   outputs{}              -> productions (video/audio/intercom output feeds)
//   items[] / extraClass~audio -> audio pool
//   otherwise              -> video pool (multiplex stage box)
export function inferPoolKind(data) {
    if (!data || typeof data !== 'object') return 'video';
    if (Array.isArray(data.players)) return 'playout';
    if ((data.outputs && typeof data.outputs === 'object') || Array.isArray(data.boxes)) return 'productions';
    if (Array.isArray(data.streams)) return 'streams';
    const ec = (data.extraClass || '').toLowerCase();
    if (ec.includes('audio') || Array.isArray(data.items)) return 'audio';
    return 'video';
}

export function renderSourceLeaf(data, container, kind, color) {
    if (kind === 'playout') return renderPlayoutPool(data, container);
    if (kind === 'productions') return renderProductionInputs([data], container);
    if (kind === 'streams') return renderStreamsPool(data, container);
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
        .gang-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:4px;margin:0 0 10px;align-items:start;}
        .signal-node.gang-cell{border-radius:3px;padding:0;cursor:grab;display:flex;align-items:center;
            justify-content:center;min-height:34px;background:rgba(0,0,0,.55);}
        .signal-node.gang-cell .multiplex-header{font-size:13px;font-weight:bold;letter-spacing:1px;padding:9px 2px;width:100%;text-align:center;}
        .signal-node.gang-cell .multiplex-children{display:none;flex-direction:column;gap:2px;padding:2px;}
        .signal-node.gang-cell.fault{outline:2px solid #ff3344;}
        /* Expanded cell spans the WHOLE row — siblings flow above/below it — so its
           contents (channels / cameras) get the full width. */
        .signal-node.gang-cell.expanded{grid-column:1 / -1;flex-direction:column;align-items:stretch;justify-content:flex-start;}
        .signal-node.gang-cell.expanded > .multiplex-children{display:flex;flex-direction:row;flex-wrap:wrap;gap:4px;}
        .signal-node.gang-cell.expanded .gang-cam-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px;width:100%;}
        .signal-node.gang-cell.expanded > .multiplex-children > .sub-stream{flex:1 1 auto;min-width:60px;}
        /* the PREAMP control spans the whole box — it's THE box control, not a channel */
        .signal-node.gang-cell .multiplex-children > .signal-node.control{flex-basis:100%;width:100%;order:99;min-height:30px;}
        /* the cameras INSIDE an expanded cell read differently from the dark container */
        .signal-node.gang-cell.expanded{cursor:pointer;}
        .signal-node.gang-cell.expanded .gang-cam-grid > .signal-node.multiplex{
            background:rgba(46,86,128,.32);border:1px solid #4f86b8;border-radius:6px;box-shadow:0 2px 7px rgba(0,0,0,.45);}
        .signal-node.gang-cell.expanded > .multiplex-header{background:rgba(0,0,0,.35);border-radius:4px;margin-bottom:4px;}
    `;
    document.head.appendChild(s);
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One square draggable cell = a whole stage box (hold to expand its contents).
// Audio boxes expand to flat channels; video boxes expand to their camera grid —
// so SOUND and VIDEO stage-boxes share the exact same compact gang layout.
function buildGangCell(data, suffix, color, kind) {
    const node = document.createElement('div');
    const cellColor = data.color || color;
    node.className = `signal-node ${kind === 'video' ? 'video' : 'audio'} multiplex gang-cell`;
    node.id = 'pool-' + (data.id || slugId(data.name));
    node.draggable = true;
    node.dataset.origin = data.origin || data.name;
    node.dataset.status = data.status || 'OK';

    const kids = document.createElement('div');
    kids.className = 'multiplex-children';
    kids.style.display = 'none';
    if (kind === 'video') {
        // Same cameras as the normal video pool, in a grid that fills the row when
        // the cell is expanded to full width.
        const grid = document.createElement('div');
        grid.className = 'input-grid-video gang-cam-grid';
        fillVideoCameras(grid, data.prefix, data.count, data.extraClass, cellColor, data.status);
        grid.querySelectorAll('.signal-node').forEach(n => { n.dataset.origin = data.origin || data.name; });
        kids.appendChild(grid);
    } else {
        const labels = (data.items && data.items.length)
            ? data.items
            : Array.from({ length: data.count || 0 }, (_, i) => `${data.prefix || ''}${String(i + 1).padStart(2, '0')}`);
        labels.forEach(l => {
            const sub = document.createElement('div');
            sub.className = `signal-node audio ${data.extraClass || 'audio-studio'} sub-stream`;
            sub.draggable = true;
            sub.id = `pool-${node.id}-${slugId(l)}`;
            sub.dataset.origin = data.origin || data.name;
            sub.textContent = l;
            kids.appendChild(sub);
        });
        // Like a camera's Camera Control, a stage box travels with a PREAMP control
        // signal — route it to the audio console's Stage Box Control to drive the
        // remote preamp (gain/+48V/HPF/mic-library) editor.
        const ctrl = document.createElement('div');
        ctrl.className = 'signal-node control sub-stream';
        ctrl.draggable = true;
        ctrl.id = `pool-${node.id}-preamp`;
        ctrl.dataset.origin = data.origin || data.name;
        ctrl.textContent = '‹ ⌁ PREAMP CTRL ⌁ ›';
        kids.appendChild(ctrl);
    }

    const header = document.createElement('div');
    header.className = 'multiplex-header';
    header.textContent = suffix;
    // Click the cell header to fold / unfold it (accordion within the grid).
    header.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = kids.style.display === 'none';
        if (opening) {
            const grid = node.closest('.gang-grid');
            if (grid) grid.querySelectorAll(':scope > .gang-cell.expanded').forEach(c => {
                if (c === node) return;
                c.classList.remove('expanded');
                const ck = c.querySelector(':scope > .multiplex-children'); if (ck) ck.style.display = 'none';
            });
        }
        kids.style.display = opening ? 'flex' : 'none';
        node.classList.toggle('expanded', opening);
    });
    node.appendChild(header);
    node.appendChild(kids);
    styleSignalNode(node, cellColor);
    if (isFaultStatus(data.status)) { node.classList.add('fault'); node.querySelectorAll('.sub-stream').forEach(x => x.classList.add('fault')); }
    return node;
}

function renderGang(container, word, leaves, color, kind) {
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
        grid.appendChild(buildGangCell(d, suffix, color, kind));
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

    // GANG: audio OR video boxes that share a leading word (STAGEBOX 101, 102, …)
    // collapse to one square-cell grid (the word as a caption, the numbers as
    // cells) so SOUND and VIDEO stage-boxes share the same compact layout.
    // Everything else renders as its normal pool, preserving order.
    const order = [];
    const byWord = new Map();
    valid.forEach(d => {
        const kind = inferPoolKind(d);
        // The shared key is the leading NON-numeric string (everything before the
        // first number): "STAGEBOX 101"→"STAGEBOX", "MIX MINUS 1"→"MIX MINUS",
        // "CAM1"→"CAM". Anything sharing it gangs — not just stage boxes.
        const word = (d.name || '').replace(/\s*\d.*$/, '').trim();
        if ((kind === 'audio' || kind === 'video') && word) {
            if (!byWord.has(word)) { const g = { word, kind, leaves: [] }; byWord.set(word, g); order.push(g); }
            byWord.get(word).leaves.push(d);
        } else order.push({ single: d, kind });
    });
    let ci = 0;
    order.forEach(g => {
        const color = inheritColor || AUDIO_POOL_COLORS[ci++ % AUDIO_POOL_COLORS.length];
        if (g.single) renderSourceLeaf(g.single, container, g.kind, color);
        else if (g.leaves.length >= 2) renderGang(container, g.word, g.leaves, color, g.kind);
        else renderSourceLeaf(g.leaves[0], container, g.kind, color);
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
            // Chain the lineage so a deep leaf carries its full path
            // (e.g. "2nd Floor — STAGEBOX 201"), not just its immediate parent.
            const childParent = parentLabel ? `${parentLabel} — ${stripOrder(d.name)}` : stripOrder(d.name);
            await renderSourceTree(baseUrl + d.href, content, depth + 1, groupColor, childParent);
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
    // Start collapsed; the accordion (one open at a time) keeps it that way and
    // renderSourcesPanel opens just the first category.
    container.innerHTML = `
        <div class="super-pool-emoji">${monoEmoji(name).trim()}</div>
        <div class="super-pool-title foldable-header">
            <span>${stripOrder(name).toUpperCase()}</span><span class="fold-icon" style="transform:rotate(-90deg);display:inline-block;transition:transform .2s;">▼</span>
        </div>
        <div class="super-pool-content" style="display:none;"></div>
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
    const built = dirs.map((cat, i) => {
        const color = SOURCE_POOL_COLORS[i % SOURCE_POOL_COLORS.length];
        const content = buildSuperPool(panel, cat.name, color);
        return { content, url: 'Routes/Sources/' + cat.href };
    });
    // Accordion starts with just the first category open (the rest collapse).
    if (built[0]) {
        built[0].content.style.display = '';
        const ic = built[0].content.parentElement.querySelector(':scope > .super-pool-title .fold-icon');
        if (ic) ic.style.transform = 'rotate(0deg)';
    }
    await Promise.all(built.map(b => renderSourceTree(b.url, b.content, 0, null, null)));
}
