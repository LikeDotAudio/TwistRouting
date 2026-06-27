function populateAudioPool(poolId, prefix, count, extraClass, items) {
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
            poolGrid.appendChild(node);
        }
    }
}

function renderAudioPool(data, container) {
    const group = document.createElement('div');
    group.className = 'input-group';
    group.innerHTML = `
        <div class="foldable-header" style="font-size: 11px; margin-bottom: 8px; color: #00ffff; text-shadow: 0 0 5px rgba(0,255,255,0.3);" onclick="togglePool(this)">
            <span>${data.name}</span>
            <span class="fold-icon" style="transform: rotate(-90deg); display: inline-block; transition: transform 0.2s;">▼</span>
        </div>
        <div class="input-grid-audio pool-content" id="${data.id}" style="display: none;">
        </div>
    `;
    container.appendChild(group);
    populateAudioPool(data.id, data.prefix, data.count, data.extraClass, data.items);
}
