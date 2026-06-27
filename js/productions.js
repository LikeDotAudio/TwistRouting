// Render each production as a draggable source so its program output (video + audio)
// can be fed into the encoders' destination twists.
function renderProductionInputs(programs, container) {
    if (!container) return;
    const group = document.createElement('div');
    group.className = 'input-group';

    let html = `
        <div class="foldable-header" style="--lcars-color: #7CFC00; font-size: 11px; margin-bottom: 8px; color: #7CFC00;" onclick="togglePool(this)">
            <span>PROGRAM OUTPUTS</span>
            <span class="fold-icon" style="display: inline-block; transition: transform 0.2s;">▼</span>
        </div>
        <div class="input-grid-video pool-content">
    `;

    programs.forEach(pgm => {
        const color = pgm.color || '#7CFC00';
        html += `
            <div class="signal-node video multiplex prod-source" id="prodsrc-${pgm.id}" draggable="true" style="border-color: ${color}; color: ${color};">
                <div class="multiplex-header">${pgm.name}</div>
                <div class="multiplex-children" style="display: none;">
                    <div class="signal-node video video-main sub-stream" draggable="true" id="prodsrc-${pgm.id}-V">${pgm.name} V</div>
                    <div class="signal-node audio audio-studio sub-stream" draggable="true" id="prodsrc-${pgm.id}-A1">${pgm.name} A1</div>
                    <div class="signal-node audio audio-studio sub-stream" draggable="true" id="prodsrc-${pgm.id}-A2">${pgm.name} A2</div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    group.innerHTML = html;
    container.appendChild(group);
}

function renderPrograms(programs) {
    const twists = ['Processing', 'Recording', 'Switcher', 'Audio Mixer', 'Intercom'];
    
    programs.forEach(pgm => {
        const pgmTwists = pgm.twists || ['Processing', 'Recording', 'Switcher', 'Audio Mixer', 'Intercom'];
        const container = document.getElementById('tab-' + pgm.id);
        if (!container) return;
        
        let html = `
            <div class="program-row" style="--prod-color: ${pgm.color || '#ffaa00'}; position: relative; overflow: hidden; padding: 0; margin-bottom: 10px;">
                <div class="program-title" style="background: ${pgm.color || '#ffaa00'};">${pgm.name}</div>
                <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
        `;
        
        let monitorsHtml = '';
        pgmTwists.forEach(twistObj => {
            let twistName = twistObj;
            let twistConfig = '';
            let lcarsColor = pgm.color || '#ffaa00';
            let isMonitor = false;

            if (typeof twistObj === 'object') {
                twistName = twistObj.name;
                twistConfig = `data-config='${JSON.stringify(twistObj).replace(/'/g, "&#39;")}'`;
                if (twistObj.accepts === 'video') lcarsColor = '#CC99CC';
                if (twistObj.accepts === 'audio') lcarsColor = '#FF9C63';
                if (twistObj.accepts === 'both') lcarsColor = '#CC99CC';
                isMonitor = !!twistObj.monitor;
            }

            const sizing = isMonitor ? 'flex: 1 1 0; min-width: 0;' : 'flex: 0 0 auto; min-width: 200px;';
            const twistHtml = `
                    <div class="twist-container${isMonitor ? ' monitor-twist' : ''}" ${twistConfig} style="--lcars-color: ${lcarsColor}; ${sizing}">
                        <div class="twist-title">${twistName}</div>
                        <div class="matrix-container" id="${pgm.id}-${twistName.replace(/\s+/g, '-').toLowerCase()}">
                            <div style="color: rgba(255,255,255,0.5); text-align: center;">NO SWIMMERS ASSIGNED TO THIS GENE.</div>
                        </div>
                        <svg class="dna-helix" viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 0; display: block; margin-top: 0;"></svg>
                    </div>
            `;
            if (isMonitor) monitorsHtml += twistHtml;
            else html += twistHtml;
        });

        // The small monitors sit together in one row, each ~1/3 width.
        if (monitorsHtml) {
            html += `<div class="monitor-row">${monitorsHtml}</div>`;
        }

        html += `
                </div>
            </div>
        `;
        container.innerHTML = html;
    });
    
    if (typeof initializeTwists === 'function') {
        initializeTwists();
    }
}
