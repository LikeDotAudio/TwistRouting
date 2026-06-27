const selectedPoolNodes = new Set();
let lastClickedNode = null;
let currentTwist = null;
let matrixDragSrcEl = null;
let inputDragSrcEl = null;

async function fetchJSON(url) {
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

// List an HTTP directory by parsing the autoindex HTML most dev servers return
// (python -m http.server, nginx autoindex, etc.). Returns
// { dirs: [{name, href}], files: [{name, href}] }, sorted naturally. Returns
// empty arrays if the server exposes no listing — callers should treat that as
// "nothing here" rather than an error.
async function listDirectory(url) {
    const out = { dirs: [], files: [] };
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return out;
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
            if (!name || name === '.') return;
            if (isDir) out.dirs.push({ name, href });
            else if (name.toLowerCase().endsWith('.json')) out.files.push({ name, href });
        });
    } catch (e) {
        console.warn('listDirectory failed for', url, e);
    }
    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
    out.dirs.sort(byName);
    out.files.sort(byName);
    return out;
}

function toggleSuperPool(event, container) {
    if (event.target === container || event.target.closest('.super-pool-title')) {
        const content = container.querySelector('.super-pool-content');
        const icon = container.querySelector('.super-pool-title .fold-icon');
        const isOpening = content.style.display === 'none';
        
        if (isOpening) {
            content.style.display = '';
            if (icon) icon.style.transform = 'rotate(0deg)';
        } else {
            content.style.display = 'none';
            if (icon) icon.style.transform = 'rotate(-90deg)';
        }
    }
}

function togglePool(headerEl) {
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

function switchTab(tabId, event) {
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
function toggleRecord(event, btn) {
    event.stopPropagation();
    const recording = btn.classList.toggle('recording');
    btn.innerText = recording ? 'STOP' : 'RECORD';
    const indicator = btn.parentElement.querySelector('.recording-indicator');
    if (indicator) indicator.style.display = recording ? 'inline' : 'none';
}
