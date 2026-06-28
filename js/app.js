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

// DEST_TAB_COLORS / DEST_GROUP_COLORS now live in js/util/palette.js.

// Populate a destination category (CONTROL ROOMS, FLOORS, …) from a folder:
// subfolders become nested collapsible groups, *.json files become tabs. Each
// tab gets a distinct colour and remembers its immediate folder as parentName,
// so the title reads e.g. "MAIN — PROD 1" or "1ST FLOOR — ROOM 1".
async function addDestinationTree(baseUrl, parentGroup, groupColorRgb, parentName) {
    const { dirs, files } = await listDirectory(baseUrl);

    if (files.length) {
        const ns = baseUrl.replace(/[^a-zA-Z0-9]/g, '-');  // unique per folder
        // Build the tab straight from the manifest — no program JSON is fetched
        // here. The file's contents (and its twists) load on first activation.
        files.forEach((f, i) => {
            const fileName = decodeURIComponent(f.href).replace(/\.json$/i, '');
            const id = ns + '--' + fileName.replace(/[^a-zA-Z0-9]+/g, '-');
            const color = DEST_TAB_COLORS[i % DEST_TAB_COLORS.length];
            TopBar.addTab({ id, name: fileName.toUpperCase() }, {
                group: parentGroup, active: false, color,
                onActivate: async () => {
                    const data = await fetchJSON(baseUrl + f.href);
                    if (!data) return;
                    data.id = id;                       // reuse the tab/pane id
                    if (parentName) data.parentName = parentName;
                    data.color = color;
                    renderPrograms([data]);             // fills #tab-<id>
                    if (typeof initializeTwists === 'function') initializeTwists();
                    if (window.Editors && Editors.notifyRendered) Editors.notifyRendered();
                },
            });
        });
    }

    // Build the child groups from the manifest tree (cheap — just index.json),
    // in parallel. Program content inside them stays lazy until a tab is opened.
    await Promise.all(dirs.map(dir => {
        const sub = TopBar.addGroup(dir.name.toUpperCase(), { parent: parentGroup, color: groupColorRgb, collapsed: true });
        return addDestinationTree(baseUrl + dir.href, sub, groupColorRgb, dir.name);
    }));
}

async function initApp() {
    const tabsContainer = document.getElementById('production-tabs');
    const contentContainer = document.getElementById('production-content');
    TopBar.init(tabsContainer, contentContainer);

    // ===== DESTINATIONS — consume signals via twists (matrix landing spots) =====
    // Every subfolder of Destinations/ is a category (Control Rooms, Edit Suites,
    // Encoders, Floors, …), discovered dynamically; each may nest further. Drop
    // in a new category folder and it appears — no code change needed.
    const destDir = await listDirectory('Routes/Destinations/');
    // Build every category's bar (groups + tabs from the manifests) in parallel;
    // program content stays lazy until a tab is opened.
    const destLoad = Promise.all(destDir.dirs.map((cat, di) => {
        const colorRgb = DEST_GROUP_COLORS[di % DEST_GROUP_COLORS.length];
        const catGroup = TopBar.addGroup(cat.name.toUpperCase(), { color: colorRgb, collapsed: true });
        return addDestinationTree('Routes/Destinations/' + cat.href, catGroup, colorRgb);
    }));

    // ===== SOURCES — draggable signals fed into destination twists =====
    // Categories, folders and pools are ALL discovered by reading Sources/ —
    // nothing here names Video/Audio/Productions/Playout. See js/sources.js.
    // Run the destinations bar and the sources panel concurrently.
    await Promise.all([destLoad, renderSourcesPanel(document.querySelector('.ingress-panel'))]);

    initializeDraggables();
    initializeTwists();
    initSidebarResizer();

    // Deep link: if the URL is #/<production>/<editor>, open that editor now that
    // every twist exists in the DOM (e.g. /#/primary-prod-3/intercom).
    if (window.Editors && Editors.openFromHash) Editors.openFromHash();
}

// Force every (lazy) destination tab to load its content. Only used to resolve a
// deep link whose production isn't open yet — normal browsing stays lazy.
window.loadAllDestinations = function loadAllDestinations() {
    document.querySelectorAll('.lcars-tab').forEach(t => { try { t.click(); } catch (e) {} });
};

window.addEventListener('DOMContentLoaded', initApp);
