// Create a collapsible group (a folder) inside a super-pool, returning the
// content element that its children should be appended into.
function makeMediaGroup(container, title, color, depth) {
    const group = document.createElement('div');
    group.className = 'input-group media-group';

    const header = document.createElement('div');
    header.className = 'foldable-header media-group-header';
    header.style.cssText = `--lcars-color:${color}; background-color:${color}; font-size:11px; margin-bottom:6px; font-weight:bold; cursor:pointer; margin-left:${depth * 10}px;`;
    header.innerHTML = `<span>${title}</span><span class="fold-icon" style="transform:rotate(-90deg);display:inline-block;transition:transform .2s;">▼</span>`;

    const content = document.createElement('div');
    content.className = 'media-group-content';
    // A vertical bar in the group's colour runs down the left of the children
    // (which are pushed to the right), showing they belong to this group and
    // extending downward for the whole length of the expanded children.
    content.style.cssText = `display:none; margin:4px 0 12px ${depth * 12 + 12}px; padding:6px 0 6px 16px; border-left:4px solid ${color}; box-shadow:-1px 0 8px ${color}66; border-radius:0 0 0 8px;`;

    // Self-contained toggle (not the pool accordion) so nested folders fold
    // independently of the stage-box pools inside them.
    header.addEventListener('click', () => {
        const opening = content.style.display === 'none';
        content.style.display = opening ? '' : 'none';
        const icon = header.querySelector('.fold-icon');
        if (icon) icon.style.transform = opening ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    group.appendChild(header);
    group.appendChild(content);
    container.appendChild(group);
    return content;
}

// Recursively render a media tree (e.g. Audio/ or Video/) into a super-pool:
// every *.json becomes a pool, every subfolder becomes a nested collapsible
// group. Discovery is dynamic — drop in a new folder or file and it appears,
// provided the static server exposes directory listings.
async function renderMediaTree(baseUrl, container, kind, depth, inheritColor, parentLabel) {
    const { dirs, files } = await listDirectory(baseUrl);

    // Loose files at this level render as standalone pools.
    for (let fi = 0; fi < files.length; fi++) {
        const data = await fetchJSON(baseUrl + files[fi].href);
        if (!data) continue;
        // Origin shown when this box's feeds are dropped: "1st Floor — STAGEBOX 202".
        data.origin = parentLabel ? `${parentLabel} — ${data.name}` : data.name;
        if (kind === 'audio') {
            const color = inheritColor || AUDIO_POOL_COLORS[fi % AUDIO_POOL_COLORS.length];
            if (typeof renderAudioPool === 'function') renderAudioPool(data, container, color);
        } else if (typeof renderVideoPool === 'function') {
            renderVideoPool(data, container);
        }
    }

    // Subfolders become nested groups; top-level folders pick a distinct colour
    // from the palette, and that colour is inherited by everything inside them.
    for (let d = 0; d < dirs.length; d++) {
        const groupColor = depth === 0
            ? AUDIO_POOL_COLORS[d % AUDIO_POOL_COLORS.length]
            : (inheritColor || AUDIO_POOL_COLORS[d % AUDIO_POOL_COLORS.length]);
        const content = makeMediaGroup(container, dirs[d].name, groupColor, depth);
        await renderMediaTree(baseUrl + dirs[d].href, content, kind, depth + 1, groupColor, dirs[d].name);
    }
}

// Load every *.json in a (dynamically discovered) folder as an array of program
// objects, in natural filename order.
async function loadProgramFolder(baseUrl) {
    const { files } = await listDirectory(baseUrl);
    const out = [];
    for (const f of files) {
        const data = await fetchJSON(baseUrl + f.href);
        if (data) out.push(data);
    }
    return out;
}

// Distinct colours for destination tabs (each tab's tab + content L-bar match).
const DEST_TAB_COLORS = ['#9C6B9C', '#3786FF', '#5CB8C4', '#D45F10', '#C2B74B', '#97587B', '#46A06E', '#C19880'];

// Populate a destination category (CONTROL ROOMS, FLOORS, …) from a folder:
// subfolders become nested collapsible groups, *.json files become tabs. Each
// tab gets a distinct colour and remembers its immediate folder as parentName,
// so the title reads e.g. "MAIN — PROD 1" or "1ST FLOOR — ROOM 1".
async function addDestinationTree(baseUrl, parentGroup, groupColorRgb, parentName) {
    const { dirs, files } = await listDirectory(baseUrl);

    if (files.length) {
        const ns = baseUrl.replace(/[^a-zA-Z0-9]/g, '-');  // unique per folder
        const programs = [];
        for (const f of files) {
            const data = await fetchJSON(baseUrl + f.href);
            if (data) programs.push(data);
        }
        programs.forEach((pgm, i) => {
            // Namespace the id by folder so copies in different categories (e.g.
            // Edit Suites duplicated from Encoders) don't collide on tab ids.
            pgm.id = ns + '--' + pgm.id;
            if (parentName) pgm.parentName = parentName;
            pgm.color = DEST_TAB_COLORS[i % DEST_TAB_COLORS.length];
            TopBar.addTab(pgm, { group: parentGroup, active: false, color: pgm.color });
        });
        renderPrograms(programs);
    }

    for (const dir of dirs) {
        const sub = TopBar.addGroup(dir.name.toUpperCase(), { parent: parentGroup, color: groupColorRgb, collapsed: true });
        await addDestinationTree(baseUrl + dir.href, sub, groupColorRgb, dir.name);
    }
}

async function initApp() {
    const tabsContainer = document.getElementById('production-tabs');
    const contentContainer = document.getElementById('production-content');
    TopBar.init(tabsContainer, contentContainer);

    // ===== DESTINATIONS — consume signals via twists (matrix landing spots) =====
    // Every subfolder of Destinations/ is a category (Control Rooms, Edit Suites,
    // Encoders, Floors, …), discovered dynamically; each may nest further. Drop
    // in a new category folder and it appears — no code change needed.
    const DEST_GROUP_COLORS = ['100,109,204', '160,110,180', '255,51,102', '63,193,201', '198,120,37', '120,160,90'];
    const destDir = await listDirectory('Destinations/');
    for (let di = 0; di < destDir.dirs.length; di++) {
        const cat = destDir.dirs[di];
        const colorRgb = DEST_GROUP_COLORS[di % DEST_GROUP_COLORS.length];
        const catGroup = TopBar.addGroup(cat.name.toUpperCase(), { color: colorRgb, collapsed: di !== 0 });
        await addDestinationTree('Destinations/' + cat.href, catGroup, colorRgb);
    }

    // ===== SOURCES — draggable signals fed into destination twists =====

    // Productions as sources: their program outputs are exposed as draggables;
    // they have no input twists here (those belong to Control Rooms).
    const productions = await loadProgramFolder('Sources/Productions/');
    const productionsSuper = document.getElementById('productions-super-pool-content');
    if (typeof renderProductionInputs === 'function') {
        renderProductionInputs(productions, productionsSuper);
    }

    // Video + Audio stage boxes (floors → boxes), as nested collapsible groups.
    const videoSuper = document.getElementById('video-super-pool-content');
    await renderMediaTree('Sources/Video/', videoSuper, 'video', 0, null);

    const audioSuper = document.getElementById('audio-super-pool-content');
    await renderMediaTree('Sources/Audio/', audioSuper, 'audio', 0, null);

    // Playouts: each file is a playout of 4 players × 4 videos, every video a
    // stack of one video + four audio feeds. Discovered from Playout/index.json.
    const playouts = await loadProgramFolder('Sources/Playout/');
    const playoutSuper = document.getElementById('playout-super-pool-content');
    if (typeof renderPlayoutPool === 'function') {
        playouts.forEach(p => renderPlayoutPool(p, playoutSuper));
    }

    initializeDraggables();
    initializeTwists();
    initSidebarResizer();
}

window.addEventListener('DOMContentLoaded', initApp);
