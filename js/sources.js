// Build the entire SOURCES ingress panel by READING the filesystem — nothing is
// hardcoded. Sources/index.json lists the categories; each category folder is
// rendered into its own super-pool, and every *.json leaf is dispatched to the
// right pool renderer based on the SHAPE of its own data (not its folder name),
// so dropping a new category/folder/file in makes it appear with zero code edits.

// Palettes (SOURCE_POOL_COLORS, AUDIO_POOL_COLORS) live in js/util/palette.js.

// Decide how a leaf renders purely from what's in the JSON:
//   players[]              -> playout  (players → videos → video+4-audio stacks)
//   outputs{}              -> productions (video/audio/intercom output feeds)
//   items[] / extraClass~audio -> audio pool
//   otherwise              -> video pool (multiplex stage box)
function inferPoolKind(data) {
    if (!data || typeof data !== 'object') return 'video';
    if (Array.isArray(data.players)) return 'playout';
    if (data.outputs && typeof data.outputs === 'object') return 'productions';
    const ec = (data.extraClass || '').toLowerCase();
    if (ec.includes('audio') || Array.isArray(data.items)) return 'audio';
    return 'video';
}

function renderSourceLeaf(data, container, kind, color) {
    if (kind === 'playout' && typeof renderPlayoutPool === 'function') return renderPlayoutPool(data, container);
    if (kind === 'productions' && typeof renderProductionInputs === 'function') return renderProductionInputs([data], container);
    if (kind === 'audio' && typeof renderAudioPool === 'function') return renderAudioPool(data, container, color);
    if (typeof renderVideoPool === 'function') return renderVideoPool(data, container);
}

// Recursively render a category: *.json leaves become pools, subfolders become
// nested collapsible groups. Identical for every category — the leaf shape, read
// at render time, picks the renderer.
async function renderSourceTree(baseUrl, container, depth, inheritColor, parentLabel) {
    const { dirs, files } = await listDirectory(baseUrl);

    // Fetch this folder's leaf files concurrently, then render them in order.
    const datas = await Promise.all(files.map(f => fetchJSON(baseUrl + f.href)));
    datas.forEach((data, fi) => {
        if (!data) return;
        // Origin shown when feeds are dropped: "1st Floor — STAGEBOX 202".
        data.origin = parentLabel ? `${parentLabel} — ${data.name}` : data.name;
        const color = inheritColor || AUDIO_POOL_COLORS[fi % AUDIO_POOL_COLORS.length];
        renderSourceLeaf(data, container, inferPoolKind(data), color);
    });

    // Build the nested group headers from the manifest, but DON'T crawl into them
    // yet — each subtree (e.g. a floor's stage boxes) loads the first time its
    // group is expanded. So only the bars come from index.json; contents are
    // fetched on demand.
    dirs.forEach((d, idx) => {
        const groupColor = inheritColor || AUDIO_POOL_COLORS[idx % AUDIO_POOL_COLORS.length];
        const content = makeMediaGroup(container, d.name, groupColor, depth);
        const header = content.previousElementSibling;
        let loaded = false;
        const load = async () => {
            if (loaded) return;
            loaded = true;
            await renderSourceTree(baseUrl + d.href, content, depth + 1, groupColor, d.name);
            // Wire the freshly-rendered pool nodes for drag (mouse + touch).
            if (typeof initializeDraggables === 'function') initializeDraggables();
        };
        if (header) header.addEventListener('click', load);
    });
}

// Create a super-pool shell (LCARS spine + foldable title) and return its content
// element. Mirrors the markup toggleSuperPool() expects.
function buildSuperPool(panel, name, color) {
    const container = document.createElement('div');
    container.className = 'super-pool-container';
    container.style.setProperty('--lcars-color', color);
    container.innerHTML = `
        <div class="super-pool-title foldable-header">
            <span>${name.toUpperCase()}</span><span class="fold-icon">▼</span>
        </div>
        <div class="super-pool-content"></div>
    `;
    container.addEventListener('click', (e) => toggleSuperPool(e, container));
    panel.appendChild(container);
    return container.querySelector(':scope > .super-pool-content');
}

// Entry point: read Sources/index.json and build a super-pool per category, in
// manifest order. Reorder the manifest to reorder the panel — no code change.
async function renderSourcesPanel(panel) {
    if (!panel) return;
    const { dirs } = await listDirectory('Routes/Sources/');
    // Build the super-pools in manifest order, then fill them in parallel.
    await Promise.all(dirs.map((cat, i) => {
        const color = SOURCE_POOL_COLORS[i % SOURCE_POOL_COLORS.length];
        const content = buildSuperPool(panel, cat.name, color);
        return renderSourceTree('Routes/Sources/' + cat.href, content, 0, null, null);
    }));
}
