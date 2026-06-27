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
        c.style.display = 'none';
        c.classList.remove('active');
    });
    
    event.currentTarget.classList.add('active');
    const targetTab = document.getElementById('tab-' + tabId);
    targetTab.style.display = 'block';
    targetTab.classList.add('active');

    // Show PROGRAM OUTPUTS only while a master/encoder tab is selected.
    const prodPool = document.querySelector('.productions-super-pool');
    if (prodPool) {
        const isMaster = window.masterTabIds && window.masterTabIds.has(tabId);
        prodPool.style.display = isMaster ? '' : 'none';
    }
}
