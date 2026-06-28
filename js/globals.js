// Shared mutable state (selectedPoolNodes, lastClickedNode, currentTwist, …)
// now lives in js/core/state.js.

// A signal/device is faulted when its status is set and isn't "OK". Faulted
// items pulse red, and routing one corrupts the destination's DNA strand.
export function isFaultStatus(status) {
    return !!status && String(status).toUpperCase() !== 'OK';
}

// Make the sources sidebar resizable via the drag handle ("sash") between it
// and the main panel. The width is stored on the .container as --sidebar-width
// and persisted to localStorage.
export function initSidebarResizer() {
    const sash = document.getElementById('sidebar-sash');
    const container = document.querySelector('.container');
    const panel = container && container.querySelector('.ingress-panel');
    if (!sash || !container || !panel) return;
    const MIN = 160, MAX = 700;
    let dragging = false;

    const onMove = (e) => {
        if (!dragging) return;
        let w = e.clientX - panel.getBoundingClientRect().left;
        w = Math.max(MIN, Math.min(MAX, w));
        container.style.setProperty('--sidebar-width', w + 'px');
    };
    const stop = () => {
        if (!dragging) return;
        dragging = false;
        sash.classList.remove('dragging');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        try {
            const w = container.style.getPropertyValue('--sidebar-width').trim();
            if (w) localStorage.setItem('sidebarWidth', w);
        } catch (e) { /* ignore storage errors */ }
    };

    sash.addEventListener('mousedown', (e) => {
        dragging = true;
        sash.classList.add('dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stop);

    try {
        const saved = localStorage.getItem('sidebarWidth');
        if (saved) container.style.setProperty('--sidebar-width', saved);
    } catch (e) { /* ignore storage errors */ }
}

export async function fetchJSON(url) {
    try {
        // no-store bypasses stale browser cache (e.g. an empty copy cached
        // before the file existed), which otherwise yields "Unexpected end of
        // JSON input" on an actually-valid file.
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            console.warn(`fetchJSON: HTTP ${res.status} for ${url}`);
            return null;
        }
        const text = await res.text();
        if (!text.trim()) {
            console.warn(`fetchJSON: empty response for ${url}`);
            return null;
        }
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to load:", url, e);
        return null;
    }
}

// List a directory's immediate contents, returning
// { dirs: [{name, href}], files: [{name, href}] }, sorted naturally.
//
// Prefers an explicit `index.json` manifest in the folder (an array of entry
// names, dirs marked with a trailing "/") so discovery works on ANY static host
// — no server-side directory listing required. The manifest is written by
// uploadftp.py at deploy time. Falls back to parsing the server's autoindex HTML
// (python -m http.server, nginx autoindex, etc.) when no manifest is present.
export async function listDirectory(url) {
    const out = { dirs: [], files: [] };
    const add = (name, isDir, href) => {
        if (!name || name === '.' || name.toLowerCase() === 'index.json') return;
        if (isDir) out.dirs.push({ name, href });
        else if (name.toLowerCase().endsWith('.json')) out.files.push({ name, href });
    };
    const sortAndReturn = () => {
        const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
        out.dirs.sort(byName);
        out.files.sort(byName);
        return out;
    };

    // 1) Manifest (preferred).
    try {
        const res = await fetch(url + 'index.json', { cache: 'no-store' });
        if (res.ok) {
            const manifest = JSON.parse(await res.text());
            if (Array.isArray(manifest)) {
                manifest.forEach(entry => {
                    if (typeof entry !== 'string' || !entry) return;
                    const isDir = entry.endsWith('/');
                    const name = entry.replace(/\/$/, '');
                    const href = encodeURIComponent(name) + (isDir ? '/' : '');
                    add(name, isDir, href);
                });
                return sortAndReturn();
            }
        }
    } catch (e) {
        /* No manifest / not JSON — fall back to autoindex below. */
    }

    // 2) Autoindex HTML fallback.
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return sortAndReturn();
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;
            // Skip parent links, column-sort query links, anchors and absolute/external URLs.
            if (href.startsWith('?') || href.startsWith('#') || href.startsWith('/')
                || href.startsWith('..') || /^[a-z]+:\/\//i.test(href)) return;
            const isDir = href.endsWith('/');
            const name = decodeURIComponent(href.replace(/\/$/, ''));
            add(name, isDir, href);
        });
    } catch (e) {
        console.warn('listDirectory failed for', url, e);
    }
    return sortAndReturn();
}

export function toggleSuperPool(event, container) {
    // React to a click on THIS container's own title or its spine — but not on a
    // nested child pool's title/spine, which would otherwise bubble up here too.
    const title = event.target.closest('.super-pool-title');
    const onOwnTitle = title && title.closest('.super-pool-container') === container;
    const onOwnSpine = event.target === container;
    if (!onOwnTitle && !onOwnSpine) return;
    event.stopPropagation();

    // Toggle this container's direct-child content (not a nested descendant's).
    const content = container.querySelector(':scope > .super-pool-content');
    if (!content) return;
    const icon = container.querySelector(':scope > .super-pool-title .fold-icon');
    const isOpening = content.style.display === 'none';

    if (isOpening) {
        content.style.display = '';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(-90deg)';
    }
}

export function togglePool(headerEl) {
    const content = headerEl.nextElementSibling;
    const icon = headerEl.querySelector('.fold-icon');
    const isOpening = content.style.display === 'none';
    
    // Accordion: close all other pools in this super-pool
    const parentContainer = headerEl.closest('.super-pool-content');
    if (parentContainer && isOpening) {
        parentContainer.querySelectorAll('.pool-content').forEach(c => {
            c.style.display = 'none';
            const prevIcon = c.previousElementSibling.querySelector('.fold-icon');
            if (prevIcon) prevIcon.style.transform = 'rotate(-90deg)';
        });
    }

    if (isOpening) {
        content.style.display = '';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(-90deg)';
    }
}

export function switchTab(tabId, event) {
    document.querySelectorAll('.tab, .lcars-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => {
        c.style.display = '';   // let the CSS class control visibility/layout
        c.classList.remove('active');
    });

    event.currentTarget.classList.add('active');
    const targetTab = document.getElementById('tab-' + tabId);
    targetTab.style.display = '';
    targetTab.classList.add('active');
}

// Toggle an ISO recorder's RECORD button between RECORD and STOP, showing a
// "RECORDING..." indicator while armed.
export function toggleRecord(event, btn) {
    event.stopPropagation();
    const recording = btn.classList.toggle('recording');
    btn.innerText = recording ? 'STOP' : 'RECORD';
    const indicator = btn.parentElement.querySelector('.recording-indicator');
    if (indicator) indicator.style.display = recording ? 'inline' : 'none';
}

// Inline onclick="togglePool(...)" / onclick="toggleRecord(...)" in HTML strings
// resolve against window, so keep these reachable there under ES modules.
window.togglePool = togglePool;
window.toggleRecord = toggleRecord;
