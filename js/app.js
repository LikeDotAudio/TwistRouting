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
    // (which are pushed to the right), showing they belong to this group.
    content.style.cssText = `display:none; margin-left:${depth * 10 + 6}px; padding-left:12px; border-left:3px solid ${color}; border-radius:0 0 0 6px;`;

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
async function renderMediaTree(baseUrl, container, kind, depth, inheritColor) {
    const { dirs, files } = await listDirectory(baseUrl);

    // Loose files at this level render as standalone pools.
    for (let fi = 0; fi < files.length; fi++) {
        const data = await fetchJSON(baseUrl + files[fi].href);
        if (!data) continue;
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
        await renderMediaTree(baseUrl + dirs[d].href, content, kind, depth + 1, groupColor);
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

async function initApp() {
    const tabsContainer = document.getElementById('production-tabs');
    const contentContainer = document.getElementById('production-content');
    TopBar.init(tabsContainer, contentContainer);

    // ===== DESTINATIONS — consume signals via twists (matrix landing spots) =====
    // Top-level categories (no outer wrapper); only Floors nests one level deeper.

    // Control Rooms (formerly "productions"): they take inputs only — their
    // program outputs live on the Sources side, not here.
    const controlRooms = await loadProgramFolder('Destinations/Control%20Rooms/');
    const crGroup = TopBar.addGroup('CONTROL ROOMS', { color: '100,109,204' });
    controlRooms.forEach((pgm, index) => {
        TopBar.addTab(pgm, { group: crGroup, active: index === 0 });
    });
    renderPrograms(controlRooms);

    // Floors — a FLOORS group holding one nested group per floor, whose rooms
    // (one *.json each) are the tabs. Each room gets a distinct colour used for
    // both its tab and its content L-bar, and remembers its floor as parentName
    // so the title reads e.g. "1ST FLOOR — ROOM 1".
    const ROOM_COLORS = ['#9C6B9C', '#3786FF', '#5CB8C4', '#D45F10', '#C2B74B', '#97587B', '#46A06E', '#C19880'];
    const floorsParent = TopBar.addGroup('FLOORS', { color: '63,193,201', collapsed: true });
    const floorsDir = await listDirectory('Destinations/Floors/');
    for (const floorDir of floorsDir.dirs) {
        const rooms = await loadProgramFolder('Destinations/Floors/' + floorDir.href);
        if (!rooms.length) continue;
        const group = TopBar.addGroup(floorDir.name.toUpperCase(), { parent: floorsParent, color: '63,193,201', collapsed: true });
        rooms.forEach((rm, ri) => {
            rm.parentName = floorDir.name;
            rm.color = ROOM_COLORS[ri % ROOM_COLORS.length];
            TopBar.addTab(rm, { group, active: false, color: rm.color });
        });
        renderPrograms(rooms);
    }

    // Encoders.
    const encoders = await loadProgramFolder('Destinations/Encoders/');
    encoders.forEach((pgm) => { pgm.color = '#ff3366'; });
    const encGroup = TopBar.addGroup('ENCODERS', { color: '255,51,102', collapsed: true });
    encoders.forEach((pgm) => {
        TopBar.addTab(pgm, { group: encGroup, active: false });
    });
    renderPrograms(encoders);

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

    initializeDraggables();
    initializeTwists();
    initSidebarResizer();
}

window.addEventListener('DOMContentLoaded', initApp);
