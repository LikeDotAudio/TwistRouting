// Enforce a twist's hard input limits so a newly added source REPLACES the
// oldest rather than stacking past the limit. Caps applied: maxVideo (video
// sources), maxAudio (audio sources), and a total cap equal to the number of
// defined inputs (config.inputs.length).
function enforceTwistLimits(dropZone, config, child) {
    if (!config) return;
    const isVideo = child.classList.contains('video');
    const isAudio = child.classList.contains('audio');
    if (config.maxVideo && isVideo) {
        const ex = dropZone.querySelectorAll('.signal-node.video');
        for (let k = 0; k < ex.length - (config.maxVideo - 1); k++) ex[k].remove();
    }
    if (config.maxAudio && isAudio) {
        const ex = dropZone.querySelectorAll('.signal-node.audio');
        for (let k = 0; k < ex.length - (config.maxAudio - 1); k++) ex[k].remove();
    }
    if (Array.isArray(config.inputs) && config.inputs.length) {
        const cap = config.inputs.length;
        const ex = dropZone.querySelectorAll(':scope > .signal-node');
        for (let k = 0; k < ex.length - (cap - 1); k++) ex[k].remove();
    }
}

// Build one collapsible "where it came from" chip from a set of source nodes:
// shows "<origin> ×N" and expands to the individual feeds. Used for multiplex
// boxes and for same-origin plain sources (e.g. STAGEBOX 202's CH 1-12).
function buildDroppedGroup(groupName, groupColor, sourceNodes) {
    const group = document.createElement('div');
    group.className = 'signal-node dropped-group';
    group.style.borderColor = groupColor;
    group.style.color = groupColor;
    group.id = 'grp-' + Math.random().toString(36).substr(2, 6);

    const head = document.createElement('div');
    head.className = 'dropped-group-header';
    head.innerText = `${groupName} ×${sourceNodes.length}`;

    const kids = document.createElement('div');
    kids.className = 'dropped-group-children';
    kids.style.display = 'none';
    sourceNodes.forEach(src => {
        const c = src.cloneNode(true);
        c.id = src.id + '-' + Math.random().toString(36).substr(2, 6);
        c.classList.remove('sub-stream', 'selected');
        c.style.opacity = '1';
        c.draggable = false;
        kids.appendChild(c);
    });

    group.appendChild(head);
    group.appendChild(kids);
    group.addEventListener('click', (e) => {
        e.stopPropagation();
        kids.style.display = kids.style.display === 'none' ? 'flex' : 'none';
    });
    return group;
}

function initializeTwists() {
    document.querySelectorAll('.twist-container').forEach(twist => {
        if (twist.dataset.initialized) return;
        twist.dataset.initialized = 'true';
        
        updateTwistVisuals(twist);
        
        twist.style.cursor = 'pointer';
        twist.addEventListener('click', (e) => {
            if (e.target.closest('.signal-node')) return;
            openTwistModal(twist);
        });
        twist.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'copy';
            twist.style.borderColor = 'var(--magenta)';
            twist.style.boxShadow = 'var(--glow-magenta)';
        });
        
        twist.addEventListener('dragleave', () => {
            twist.style.borderColor = ''; 
            twist.style.boxShadow = '';
        });
        
        twist.addEventListener('drop', (e) => {
            e.preventDefault();
            twist.style.borderColor = '';
            twist.style.boxShadow = '';
            
            const idsStr = e.dataTransfer.getData('text/plain');
            const sourceType = e.dataTransfer.getData('source-type');
            if (!idsStr) return;
            
            const ids = idsStr.split(',');
            
            let config = null;
            if (twist.dataset.config) {
                try { config = JSON.parse(twist.dataset.config); } catch (e) {}
            }
            
            let dropZone = twist.querySelector('.drop-zone');
            if (!dropZone) {
                dropZone = document.createElement('div');
                dropZone.className = 'drop-zone';
                dropZone.style.display = 'flex';
                dropZone.style.flexWrap = 'wrap';
                dropZone.style.gap = '5px';
                dropZone.style.width = '100%';
                dropZone.style.justifyContent = 'center';
                twist.appendChild(dropZone);
            }
            
            // Append while enforcing this twist's hard limits (e.g. a monitor
            // takes 1 video, a defined-input twist takes inputs.length total) —
            // when full, the oldest is dropped so the new source REPLACES rather
            // than stacks beyond the limit.
            function appendWithLimit(child) {
                enforceTwistLimits(dropZone, config, child);
                dropZone.appendChild(child);
            }

            const acceptsType = (el) => {
                if (!config || !config.accepts) return true;
                if (config.accepts === 'video') return el.classList.contains('video');
                if (config.accepts === 'audio') return el.classList.contains('audio');
                return true;
            };

            const plain = [];  // non-multiplex pool nodes, grouped by origin below
            ids.forEach(id => {
                const node = document.getElementById(id);
                if (!node) return;
                if (sourceType !== 'pool') {
                    if (acceptsType(node)) appendWithLimit(node);
                    return;
                }
                if (node.classList.contains('multiplex')) {
                    // A multiplex box drops as one collapsible chip of its feeds.
                    const accepted = Array.from(node.querySelectorAll('.sub-stream')).filter(acceptsType);
                    if (accepted.length) {
                        const headerEl = node.querySelector('.multiplex-header');
                        const groupName = headerEl ? headerEl.innerText : (node.dataset.origin || node.id);
                        dropZone.appendChild(buildDroppedGroup(groupName, window.getComputedStyle(node).color, accepted));
                    }
                } else if (acceptsType(node)) {
                    plain.push(node);
                }
            });

            // Group same-origin plain sources under one labeled container so you
            // can see where they came from (e.g. "1st Floor — STAGEBOX 202")
            // instead of a wall of bare CH 1-12 chips.
            const byOrigin = new Map();
            plain.forEach(n => {
                const key = n.dataset.origin || '';
                if (!byOrigin.has(key)) byOrigin.set(key, []);
                byOrigin.get(key).push(n);
            });
            byOrigin.forEach((nodes, origin) => {
                if (origin && nodes.length >= 2) {
                    dropZone.appendChild(buildDroppedGroup(origin, window.getComputedStyle(nodes[0]).color, nodes));
                } else {
                    nodes.forEach(n => {
                        const clone = n.cloneNode(true);
                        clone.id = n.id + '-' + Math.random().toString(36).substr(2, 6);
                        clone.classList.remove('selected');
                        clone.style.opacity = '1';
                        clone.draggable = false;
                        appendWithLimit(clone);
                    });
                }
            });
            
            updateTwistVisuals(twist);
            
            // Visual feedback
            const originalBg = twist.style.backgroundColor;
            twist.style.backgroundColor = 'rgba(255, 0, 255, 0.2)';
            setTimeout(() => {
                twist.style.backgroundColor = originalBg;
            }, 300);
        });
    });
}

function openTwistModal(twistElement) {
    currentTwist = twistElement;
    const title = twistElement.querySelector('.twist-title').innerText;
    document.getElementById('modal-title').innerText = title + " // SWITCHER MATRIX";
    
    const twistColor = twistElement.style.getPropertyValue('--lcars-color') || '#ffaa00';
    document.querySelector('.modal-content').style.setProperty('--lcars-color', twistColor);
    
    const matrixContainer = document.getElementById('matrix-container');
    matrixContainer.innerHTML = '';
    
    const dropZone = twistElement.querySelector('.drop-zone');
    if (dropZone && dropZone.children.length > 0) {
        let config = null;
        if (twistElement.dataset.config) {
            try { config = JSON.parse(twistElement.dataset.config); } catch (e) {}
        }
        
        const swimmers = Array.from(dropZone.children);
        let maxVideo = 0;
        let maxAudio = 0;
        let customInputIndex = 0;
        
        swimmers.forEach(s => {
            if (s.dataset.switcherInput) {
                const num = parseInt(s.dataset.switcherInput.replace(/[^0-9]/g, '')) || 0;
                if (s.classList.contains('video')) {
                    if (num > maxVideo) maxVideo = num;
                } else {
                    if (num > maxAudio) maxAudio = num;
                }
            }
        });
        
        swimmers.forEach((swimmer, index) => {
            const isVideo = swimmer.classList.contains('video');
            let label = swimmer.dataset.switcherInput;
            
            if (!label) {
                if (config && config.inputs && config.inputs.length > customInputIndex) {
                    label = config.inputs[customInputIndex];
                    customInputIndex++;
                } else {
                    if (isVideo) {
                        maxVideo++;
                        label = `SW IN ${maxVideo.toString().padStart(2, '0')}`;
                    } else {
                        maxAudio++;
                        label = `AUD IN ${maxAudio.toString().padStart(2, '0')}`;
                    }
                }
                swimmer.dataset.switcherInput = label;
            }
            
            const row = document.createElement('div');
            row.className = 'matrix-row';
            row.draggable = true;
            row.dataset.swimmerId = swimmer.id;
            
            row.innerHTML = `
                <div class="swimmer-slot"></div>
                <svg class="twist-svg" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M0,10 Q25,20 50,10 T100,10" fill="none" stroke="${window.getComputedStyle(swimmer).color}" stroke-width="2" stroke-dasharray="5 5" style="animation: flow 40s linear infinite;"/>
                </svg>
                <div class="switcher-input ${isVideo ? 'video-input' : 'audio-input'}" draggable="true" title="Drag to swap input assignment" style="cursor: grab;">${label}</div>
                <div class="remove-btn" onclick="removeSwimmer(this, '${swimmer.id}')">&times;</div>
            `;
            
            const swimmerClone = swimmer.cloneNode(true);
            swimmerClone.draggable = false; 
            swimmerClone.style.margin = '0';
            swimmerClone.style.animation = 'none'; 
            row.querySelector('.swimmer-slot').appendChild(swimmerClone);
            
            row.addEventListener('dragstart', handleMatrixDragStart);
            row.addEventListener('dragover', handleMatrixDragOver);
            row.addEventListener('drop', handleMatrixDrop);
            row.addEventListener('dragend', handleMatrixDragEnd);
            
            const inputEl = row.querySelector('.switcher-input');
            inputEl.addEventListener('dragstart', handleInputDragStart);
            inputEl.addEventListener('dragover', handleInputDragOver);
            inputEl.addEventListener('drop', handleInputDrop);
            inputEl.addEventListener('dragend', handleInputDragEnd);
            
            matrixContainer.appendChild(row);
        });
    } else {
        matrixContainer.innerHTML = `
            <div style="color: var(--cyan); text-align: center; margin-bottom: 20px; font-weight: bold; letter-spacing: 2px;">TEST POOL (NO SOURCES ASSIGNED)</div>
            <div class="matrix-row">
                <div class="swimmer-slot">
                    <div class="signal-node video" style="margin: 0px; animation: none;">TEST BARS</div>
                </div>
                <svg class="twist-svg" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M0,10 Q25,20 50,10 T100,10" fill="none" stroke="var(--magenta)" stroke-width="2" stroke-dasharray="5 5" style="animation: flow 40s linear infinite;"/>
                </svg>
                <div class="switcher-input video-input">SW IN 01</div>
            </div>
            <div class="matrix-row">
                <div class="swimmer-slot">
                    <div class="signal-node audio" style="margin: 0px; animation: none;">TEST TONE</div>
                </div>
                <svg class="twist-svg" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M0,10 Q25,20 50,10 T100,10" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-dasharray="5 5" style="animation: flow 40s linear infinite;"/>
                </svg>
                <div class="switcher-input audio-input">AUD IN 01</div>
            </div>
        `;
    }
    
    document.getElementById('twist-modal').style.display = 'flex';
}

function handleMatrixDragStart(e) {
    matrixDragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleMatrixDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleMatrixDrop(e) {
    e.preventDefault();
    if (matrixDragSrcEl !== this) {
        const matrixContainer = document.getElementById('matrix-container');
        const allRows = Array.from(matrixContainer.querySelectorAll('.matrix-row'));
        const srcIndex = allRows.indexOf(matrixDragSrcEl);
        const tgtIndex = allRows.indexOf(this);
        
        if (srcIndex < tgtIndex) {
            this.after(matrixDragSrcEl);
        } else {
            this.before(matrixDragSrcEl);
        }
        
        syncTwistOrder();
    }
    return false;
}

function handleMatrixDragEnd(e) {
    this.classList.remove('dragging');
}

function handleInputDragStart(e) {
    e.stopPropagation();
    inputDragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.innerText);
    this.style.opacity = '0.5';
}

function handleInputDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleInputDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (inputDragSrcEl !== this) {
        const srcIsVideo = inputDragSrcEl.classList.contains('video-input');
        const tgtIsVideo = this.classList.contains('video-input');
        
        if (srcIsVideo !== tgtIsVideo) {
            this.style.backgroundColor = 'red';
            setTimeout(() => { this.style.backgroundColor = ''; }, 300);
            return false;
        }
        
        const temp = this.innerText;
        this.innerText = inputDragSrcEl.innerText;
        inputDragSrcEl.innerText = temp;
        
        const srcRow = inputDragSrcEl.closest('.matrix-row');
        const tgtRow = this.closest('.matrix-row');
        const srcSwimmer = document.getElementById(srcRow.dataset.swimmerId);
        const tgtSwimmer = document.getElementById(tgtRow.dataset.swimmerId);
        
        if (srcSwimmer) srcSwimmer.dataset.switcherInput = inputDragSrcEl.innerText;
        if (tgtSwimmer) tgtSwimmer.dataset.switcherInput = this.innerText;
    }
    return false;
}

function handleInputDragEnd(e) {
    e.stopPropagation();
    this.style.opacity = '1';
}

function removeSwimmer(btnEl, swimmerId) {
    const row = btnEl.closest('.matrix-row');
    row.remove();
    
    const swimmer = document.getElementById(swimmerId);
    if (swimmer) swimmer.remove();
    
    if (currentTwist) updateTwistVisuals(currentTwist);
    
    const matrixContainer = document.getElementById('matrix-container');
    if (matrixContainer.children.length === 0) {
        matrixContainer.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; margin-top: 50px;">NO SWIMMERS ASSIGNED TO THIS GENE.</div>';
    }
}

function syncTwistOrder() {
    if (!currentTwist) return;
    const dropZone = currentTwist.querySelector('.drop-zone');
    if (!dropZone) return;
    
    const newOrderIds = Array.from(document.querySelectorAll('.matrix-row')).map(row => row.dataset.swimmerId);
    
    newOrderIds.forEach(id => {
        const swimmer = document.getElementById(id);
        if (swimmer) {
            dropZone.appendChild(swimmer);
        }
    });
}

function closeTwistModal() {
    document.getElementById('twist-modal').style.display = 'none';
    currentTwist = null;
}

// Place a clone of one pool source node into a twist's drop-zone, honoring the
// twist's accepts / maxVideo / maxAudio config. Returns true if it was placed.
function placeSourceInTwist(twist, node) {
    if (!twist || !node) return false;
    let config = null;
    if (twist.dataset.config) { try { config = JSON.parse(twist.dataset.config); } catch (e) {} }
    const isVideo = node.classList.contains('video');
    const isAudio = node.classList.contains('audio');
    if (config && config.accepts === 'video' && !isVideo) return false;
    if (config && config.accepts === 'audio' && !isAudio) return false;

    let dropZone = twist.querySelector('.drop-zone');
    if (!dropZone) {
        dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';
        dropZone.style.cssText = 'display:flex; flex-wrap:wrap; gap:5px; width:100%; justify-content:center;';
        twist.appendChild(dropZone);
    }

    const clone = node.cloneNode(true);
    clone.id = node.id + '-' + Math.random().toString(36).substr(2, 6);
    clone.classList.remove('selected');
    clone.style.opacity = '1';
    clone.draggable = false;
    enforceTwistLimits(dropZone, config, clone);   // replace, don't stack, when full
    dropZone.appendChild(clone);
    return true;
}

// Distribute a dropped program's outputs across a room's twists: video feeds fan
// out to the video twists (monitors), audio feeds to the audio twists (IEMs,
// foldback) — one feed per twist, cycling through the available feeds. Returns
// how many feeds were placed.
function autoPopulateRoom(room, ids) {
    const nodes = ids.map(id => document.getElementById(id)).filter(Boolean);
    const video = nodes.filter(n => n.classList.contains('video') && !n.classList.contains('multiplex'));
    const audio = nodes.filter(n => n.classList.contains('audio') && !n.classList.contains('multiplex'));
    if (!video.length && !audio.length) return 0;

    let vi = 0, ai = 0, placed = 0;
    room.querySelectorAll('.twist-container').forEach(twist => {
        let config = null;
        if (twist.dataset.config) { try { config = JSON.parse(twist.dataset.config); } catch (e) {} }
        const accepts = config && config.accepts;
        if ((accepts === 'video' || accepts === 'both') && video.length) {
            if (placeSourceInTwist(twist, video[vi % video.length])) { vi++; placed++; }
        }
        if ((accepts === 'audio' || accepts === 'both') && audio.length) {
            if (placeSourceInTwist(twist, audio[ai % audio.length])) { ai++; placed++; }
        }
        updateTwistVisuals(twist);
    });
    return placed;
}

// Let a whole program ("super group") be dropped onto a room (not a specific
// twist) to auto-populate all of its twists at once.
function initRoomDrops() {
    document.querySelectorAll('.program-row').forEach(room => {
        if (room.dataset.roomDrop) return;
        room.dataset.roomDrop = '1';

        room.addEventListener('dragover', (e) => {
            if (e.target.closest('.twist-container')) return; // a twist handles its own drops
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        room.addEventListener('drop', (e) => {
            if (e.target.closest('.twist-container')) return;
            const idsStr = e.dataTransfer.getData('text/plain');
            if (!idsStr) return;
            e.preventDefault();
            const placed = autoPopulateRoom(room, idsStr.split(','));
            if (placed) {
                const flash = room.style.backgroundColor;
                room.style.backgroundColor = 'rgba(255, 0, 255, 0.15)';
                setTimeout(() => { room.style.backgroundColor = flash; }, 300);
            }
        });
    });
}
