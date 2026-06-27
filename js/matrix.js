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
            
            // Append while enforcing an optional per-twist video cap
            // (e.g. encoders accept only 1 video source — a new one replaces it).
            function appendWithLimit(child) {
                if (config && config.maxVideo && child.classList.contains('video')) {
                    const existingVideo = dropZone.querySelectorAll('.signal-node.video');
                    const removeCount = existingVideo.length - (config.maxVideo - 1);
                    for (let k = 0; k < removeCount; k++) existingVideo[k].remove();
                }
                if (config && config.maxAudio && child.classList.contains('audio')) {
                    const existingAudio = dropZone.querySelectorAll('.signal-node.audio');
                    const removeCount = existingAudio.length - (config.maxAudio - 1);
                    for (let k = 0; k < removeCount; k++) existingAudio[k].remove();
                }
                dropZone.appendChild(child);
            }

            ids.forEach(id => {
                const node = document.getElementById(id);
                if (node) {
                    if (sourceType === 'pool') {
                        if (node.classList.contains('multiplex')) {
                            // A dropped group shows as ONE compact chip in the group's
                            // colour; the individual feeds live inside it (click to expand).
                            const accepts = config && config.accepts;
                            const accepted = Array.from(node.querySelectorAll('.sub-stream')).filter(sub => {
                                if (accepts === 'video' && !sub.classList.contains('video')) return false;
                                if (accepts === 'audio' && !sub.classList.contains('audio')) return false;
                                return true;
                            });
                            if (accepted.length) {
                                const headerEl = node.querySelector('.multiplex-header');
                                const groupName = headerEl ? headerEl.innerText : node.id;
                                const groupColor = window.getComputedStyle(node).color;
                                const group = document.createElement('div');
                                group.className = 'signal-node dropped-group';
                                group.style.borderColor = groupColor;
                                group.style.color = groupColor;
                                group.id = node.id + '-grp-' + Math.random().toString(36).substr(2, 6);

                                const head = document.createElement('div');
                                head.className = 'dropped-group-header';
                                head.innerText = `${groupName} ×${accepted.length}`;

                                const kids = document.createElement('div');
                                kids.className = 'dropped-group-children';
                                kids.style.display = 'none';
                                accepted.forEach(sub => {
                                    const c = sub.cloneNode(true);
                                    c.id = sub.id + '-' + Math.random().toString(36).substr(2, 6);
                                    c.classList.remove('sub-stream');
                                    c.classList.remove('selected');
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
                                dropZone.appendChild(group);
                            }
                        } else {
                            if (config && config.accepts) {
                                if (config.accepts === 'video' && !node.classList.contains('video')) return;
                                if (config.accepts === 'audio' && !node.classList.contains('audio')) return;
                            }
                            const clone = node.cloneNode(true);
                            clone.id = id + '-' + Math.random().toString(36).substr(2, 6);
                            clone.classList.remove('selected');
                            clone.style.opacity = '1';
                            clone.draggable = false;
                            appendWithLimit(clone);
                        }
                    } else {
                        if (config && config.accepts) {
                            if (config.accepts === 'video' && !node.classList.contains('video')) return;
                            if (config.accepts === 'audio' && !node.classList.contains('audio')) return;
                        }
                        appendWithLimit(node);
                    }
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
