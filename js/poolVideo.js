function populateVideoPool(poolId, prefix, count, extraClass) {
    const pool = document.getElementById(poolId);
    if (!pool) return;
    pool.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const id = prefix + i.toString().padStart(2, '0');
        const node = document.createElement('div');
        node.className = `signal-node video multiplex ${extraClass}`;
        node.id = 'pool-' + id;
        node.draggable = true;
        node.innerHTML = `
            <div class="multiplex-header">${id}</div>
            <div class="multiplex-children" style="display: none;">
                <div class="signal-node video ${extraClass} sub-stream" draggable="true" id="pool-${id}-V">${id}-V</div>
                <div class="signal-node audio audio-studio sub-stream" draggable="true" id="pool-${id}-A1">${id}-A1</div>
                <div class="signal-node audio audio-studio sub-stream" draggable="true" id="pool-${id}-A2">${id}-A2</div>
                <div class="signal-node audio audio-studio sub-stream" draggable="true" id="pool-${id}-A3">${id}-A3</div>
                <div class="signal-node audio audio-studio sub-stream" draggable="true" id="pool-${id}-A4">${id}-A4</div>
            </div>
        `;
        pool.appendChild(node);
    }
}

function renderVideoPool(data, container) {
    const group = document.createElement('div');
    group.className = 'input-group';
    group.innerHTML = `
        <div class="foldable-header" style="--lcars-color: ${data.color || 'var(--lcars-color)'}; font-size: 11px; margin-bottom: 8px;" onclick="togglePool(this)">
            <span>${data.name}</span>
            <span class="fold-icon" style="transform: rotate(-90deg); display: inline-block; transition: transform 0.2s;">▼</span>
        </div>
        <div class="input-grid-video pool-content" id="${data.id}" style="display: none;">
        </div>
    `;
    container.appendChild(group);
    populateVideoPool(data.id, data.prefix, data.count, data.extraClass);
}
