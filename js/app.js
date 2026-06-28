// js/app.js — application bootstrap / composition root.
import { TopBar } from './topbar.js';
import { fetchJSON, listDirectory, initSidebarResizer } from './globals.js';
import { renderPrograms } from './productions.js';
import { initializeTwists } from './matrix.js';
import { initializeDraggables } from './dragDrop.js';
import { renderSourcesPanel } from './sources.js';
import { DEST_TAB_COLORS, DEST_GROUP_COLORS } from './util/palette.js';
import { openFromHash, notifyRendered } from './editors/core.js';
// makeMediaGroup moved to js/ui/makeMediaGroup.js.

// Populate a destination category (CONTROL ROOMS, FLOORS, …) from a folder:
// subfolders become nested collapsible groups, *.json files become tabs. Each
// tab gets a distinct colour and remembers its immediate folder as parentName,
// so the title reads e.g. "MAIN — PROD 1" or "1ST FLOOR — ROOM 1".
export async function addDestinationTree(baseUrl, parentGroup, groupColorRgb, parentName) {
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
                    initializeTwists();
                    notifyRendered();
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

export async function initApp() {
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
    openFromHash();
}

// Force every (lazy) destination tab to load its content. Only used to resolve a
// deep link whose production isn't open yet — normal browsing stays lazy.
window.loadAllDestinations = function loadAllDestinations() {
    document.querySelectorAll('.lcars-tab').forEach(t => { try { t.click(); } catch (e) {} });
};

window.addEventListener('DOMContentLoaded', initApp);
