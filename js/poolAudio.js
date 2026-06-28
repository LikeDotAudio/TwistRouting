import { styleSignalNode } from './util/color.js';
import { isFaultStatus } from './globals.js';
import { faultTag, slugId } from './util/dom.js';
// AUDIO_POOL_COLORS now lives in js/util/palette.js; styleSignalNode in
// js/util/color.js (both loaded first).

export function populateAudioPool(poolId, prefix, count, extraClass, items, color, status) {
    const poolGrid = document.getElementById(poolId);
    if (!poolGrid) return;
    poolGrid.innerHTML = '';
    const faulted = isFaultStatus(status);

    const tagNode = (node) => {
        node.dataset.status = status || 'OK';
        if (faulted) node.classList.add('fault');
    };

    if (items && items.length > 0) {
        items.forEach((item) => {
            const node = document.createElement('div');
            node.className = `signal-node audio ${extraClass}`;
            node.innerText = item;
            // Namespace the id by poolId so boxes sharing item labels (e.g. the
            // generic "CH 1".."CH 12" across all stage boxes) stay unique.
            node.id = 'pool-' + poolId + '-' + slugId(item);
            node.style.animationDelay = `${Math.random() * 2}s`;
            if (color) styleSignalNode(node, color);
            tagNode(node);
            poolGrid.appendChild(node);
        });
    } else {
        for (let i = 1; i <= count; i++) {
            const num = i.toString().padStart(2, '0');
            const node = document.createElement('div');
            node.className = `signal-node audio ${extraClass}`;
            node.innerText = `${prefix}${num}`;
            node.id = 'pool-' + prefix + num;
            node.style.animationDelay = `${Math.random() * 2}s`;
            if (color) styleSignalNode(node, color);
            tagNode(node);
            poolGrid.appendChild(node);
        }
    }
}

export function renderAudioPool(data, container, color) {
    const poolColor = color || data.color || '#00ffff';
    const faulted = isFaultStatus(data.status);
    const group = document.createElement('div');
    group.className = 'input-group';
    group.innerHTML = `
        <div class="foldable-header${faulted ? ' fault' : ''}" title="${data.status || 'OK'}" style="--lcars-color: ${poolColor}; background-color: ${poolColor}; font-size: 11px; margin-bottom: 8px;" onclick="togglePool(this)">
            <span>${data.name}${faultTag(data.status)}</span>
            <span class="fold-icon" style="transform: rotate(-90deg); display: inline-block; transition: transform 0.2s;">▼</span>
        </div>
        <div class="input-grid-audio pool-content" id="${data.id}" style="display: none;">
        </div>
    `;
    container.appendChild(group);
    populateAudioPool(data.id, data.prefix, data.count, data.extraClass, data.items, poolColor, data.status);
    // Tag every feed with where it came from, so a dropped batch can be grouped
    // under its origin (e.g. "1st Floor — STAGEBOX 202") instead of bare CH 1-12.
    const grid = document.getElementById(data.id);
    if (grid) grid.querySelectorAll('.signal-node').forEach(n => { n.dataset.origin = data.origin || data.name; });
}
