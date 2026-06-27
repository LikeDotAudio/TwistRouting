const selectedPoolNodes = new Set();
let lastClickedNode = null;
let currentTwist = null;
let matrixDragSrcEl = null;
let inputDragSrcEl = null;

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        return await res.json();
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
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active');
    });
    
    event.currentTarget.classList.add('active');
    const targetTab = document.getElementById('tab-' + tabId);
    targetTab.style.display = 'block';
    targetTab.classList.add('active');
}
