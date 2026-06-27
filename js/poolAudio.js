// Distinct LCARS shades mixing the ST:VIII(FC) and ST:X(NEM) palettes so each
// audio pool is strongly differentiated from the next.
const AUDIO_POOL_COLORS = [
    '#FF9C00', // amber
    '#3786FF', // azure
    '#87EEFF', // cyan
    '#D45F10', // deep orange
    '#A89B35', // olive
    '#97587B', // plum
    '#46616E', // slate
    '#C19880', // mauve
    '#C2B74B', // gold
    '#0A46EE'  // deep blue
];

function styleAudioNode(node, color) {
    node.style.borderColor = color;
    node.style.color = color;
    node.style.boxShadow = `0 0 5px ${color}55`;
}

function populateAudioPool(poolId, prefix, count, extraClass, items, color) {
    const poolGrid = document.getElementById(poolId);
    if (!poolGrid) return;
    poolGrid.innerHTML = '';

    if (items && items.length > 0) {
        items.forEach((item) => {
            const node = document.createElement('div');
            node.className = `signal-node audio ${extraClass}`;
            node.innerText = item;
            node.id = 'pool-' + item.replace(/[^a-zA-Z0-9]/g, '-');
            node.style.animationDelay = `${Math.random() * 2}s`;
            if (color) styleAudioNode(node, color);
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
            if (color) styleAudioNode(node, color);
            poolGrid.appendChild(node);
        }
    }
}

function renderAudioPool(data, container, color) {
    const poolColor = color || data.color || '#00ffff';
    const group = document.createElement('div');
    group.className = 'input-group';
    group.innerHTML = `
        <div class="foldable-header" style="--lcars-color: ${poolColor}; background-color: ${poolColor}; font-size: 11px; margin-bottom: 8px;" onclick="togglePool(this)">
            <span>${data.name}</span>
            <span class="fold-icon" style="transform: rotate(-90deg); display: inline-block; transition: transform 0.2s;">▼</span>
        </div>
        <div class="input-grid-audio pool-content" id="${data.id}" style="display: none;">
        </div>
    `;
    container.appendChild(group);
    populateAudioPool(data.id, data.prefix, data.count, data.extraClass, data.items, poolColor);
}
