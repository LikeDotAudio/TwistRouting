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
    content.style.cssText = `display:none; margin-left:${depth * 10}px;`;

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

async function initApp() {
    // Load Productions
    const prodFiles = ['Production 1.json', 'Production 2.json', 'Production 3.json', 'Production 4.json', 'Production 5.json',
                       'Production 6.json', 'Production 7.json', 'Production 8.json', 'Production 9.json', 'Production 10.json'];
    const programs = [];
    for (let file of prodFiles) {
        const data = await fetchJSON('Productions/' + file);
        if (data) programs.push(data);
    }
    
    const tabsContainer = document.getElementById('production-tabs');
    const contentContainer = document.getElementById('production-content');
    TopBar.init(tabsContainer, contentContainer);

    const prodGroup = TopBar.addGroup('PRODUCTIONS', { color: '100,109,204' });
    programs.forEach((pgm, index) => {
        TopBar.addTab(pgm, { group: prodGroup, active: index === 0 });
    });
    
    renderPrograms(programs);

    // Expose productions as draggable inputs (so encoders can take program outputs)
    const productionsSuper = document.getElementById('productions-super-pool-content');
    if (typeof renderProductionInputs === 'function') {
        renderProductionInputs(programs, productionsSuper);
    }

    // Load Floors (between Productions and Master) — each with monitors, IEMs and foldback
    const floorFiles = ['1st Floor.json', '2nd Floor.json', '3rd Floor.json', '4th Floor.json', '5th Floor.json'];
    const floorPrograms = [];
    for (let file of floorFiles) {
        const data = await fetchJSON('Floors/' + file);
        if (data) floorPrograms.push(data);
    }
    const floorGroup = TopBar.addGroup('FLOORS', { color: '63,193,201', collapsed: true });
    floorPrograms.forEach((pgm) => {
        TopBar.addTab(pgm, { group: floorGroup, active: false });
    });
    renderPrograms(floorPrograms);

    // Load Video Pools
    const videoFiles = ['Studio 1.json', 'Studio 2.json', 'Studio 3.json', 'Studio 4.json', 'Remotes.json', 'Sats.json'];
    const videoSuper = document.getElementById('video-super-pool-content');
    for (let file of videoFiles) {
        try {
            const data = await fetchJSON('Video/' + file);
            if (data && typeof renderVideoPool === 'function') {
                renderVideoPool(data, videoSuper);
            }
        } catch (e) {
            console.error('Error loading video pool:', e);
        }
    }
    
    // Load Audio Stage Boxes — organized into floor folders (100/200/300/400/500
    // level), 10 boxes each (#01..#10). Static hosting can't list directories, so
    // the folder/box layout is enumerated here.
    const audioSuper = document.getElementById('audio-super-pool-content');
    const audioFloors = ['1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor'];
    const BOXES_PER_FLOOR = 10;
    for (let f = 0; f < audioFloors.length; f++) {
        const floor = audioFloors[f];
        const floorColor = AUDIO_POOL_COLORS[f % AUDIO_POOL_COLORS.length];
        let floorHasBoxes = false;
        for (let b = 1; b <= BOXES_PER_FLOOR; b++) {
            const box = '#' + b.toString().padStart(2, '0');
            // '#' is a URL fragment delimiter, so encode it for fetch().
            const url = `Audio/${floor}/${box}.json`.replace(/#/g, '%23');
            try {
                const data = await fetchJSON(url);
                if (data && typeof renderAudioPool === 'function') {
                    if (!floorHasBoxes) {
                        const label = document.createElement('div');
                        label.className = 'audio-floor-label';
                        label.textContent = `${floor} — ${(f + 1) * 100} Level`;
                        label.style.cssText = `color:${floorColor}; font-size:11px; font-weight:bold; margin:10px 0 4px; letter-spacing:1px;`;
                        audioSuper.appendChild(label);
                        floorHasBoxes = true;
                    }
                    renderAudioPool(data, audioSuper, floorColor);
                }
            } catch (e) {
                console.error('Error loading audio stage box:', url, e);
            }
        }
    }

    // Load Masters
    const masterFiles = ['Encoder 1.json', 'Encoder 2.json', 'Encoder 4.json'];
    const masterPrograms = [];
    for (let file of masterFiles) {
        const data = await fetchJSON('Master/' + file);
        if (data) {
            data.color = '#ff3366';
            masterPrograms.push(data);
        }
    }
    const masterGroup = TopBar.addGroup('MASTER', { color: '255,51,102', collapsed: true });
    masterPrograms.forEach((pgm) => {
        TopBar.addTab(pgm, { group: masterGroup, active: false });
    });
    renderPrograms(masterPrograms);

    initializeDraggables();
    initializeTwists();
}

window.addEventListener('DOMContentLoaded', initApp);
