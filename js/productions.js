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

    // Each production explodes into its real outputs: video (multiviewer/program/
    // preview), audio (main mix + mix-minus), and intercom (IFB) feeds.
    const videoOuts = ['MV OUT 1', 'MV OUT 2', 'PROGRAM OUT', 'PREVIEW OUT'];
    const audioOuts = ['MAIN MIX', 'MIX MINUS 1', 'MIX MINUS 2', 'MIX MINUS 3', 'MIX MINUS 4'];
    const intercomOuts = ['IFB OUT 1', 'IFB OUT 2', 'IFB OUT 3', 'IFB OUT 4'];

    programs.forEach(pgm => {
        const color = pgm.color || '#7CFC00';
        const slug = (s) => s.replace(/[^a-zA-Z0-9]/g, '-');
        let subs = '';
        videoOuts.forEach(o => {
            subs += `<div class="signal-node video video-main sub-stream" draggable="true" id="prodsrc-${pgm.id}-${slug(o)}">${pgm.name} ${o}</div>`;
        });
        audioOuts.forEach(o => {
            subs += `<div class="signal-node audio audio-studio sub-stream" draggable="true" id="prodsrc-${pgm.id}-${slug(o)}">${pgm.name} ${o}</div>`;
        });
        intercomOuts.forEach(o => {
            subs += `<div class="signal-node audio audio-comms sub-stream" draggable="true" id="prodsrc-${pgm.id}-${slug(o)}">${pgm.name} ${o}</div>`;
        });
        html += `
            <div class="signal-node video multiplex prod-source" id="prodsrc-${pgm.id}" draggable="true" style="border-color: ${color}; color: ${color};">
                <div class="multiplex-header">${pgm.name}</div>
                <div class="multiplex-children" style="display: none;">
                    ${subs}
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
            <div class="program-row" style="--prod-color: ${pgm.color || '#ffaa00'}; position: relative; overflow: hidden; padding: 0; margin-bottom: 10px; flex: 1 1 auto;">
                <div class="program-title" style="background: ${pgm.color || '#ffaa00'};">${pgm.name}</div>
                <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start; padding-right: 60px;">
        `;
        
        // Small twists (monitors, ISO recorders) are gathered into their own rows,
        // each member ~1/4 width. rowKey groups them (monitors row, iso row, ...).
        const rows = {};
        const rowOrder = [];
        pgmTwists.forEach(twistObj => {
            let twistName = twistObj;
            let twistConfig = '';
            let lcarsColor = pgm.color || '#ffaa00';
            let rowKey = null;

            if (typeof twistObj === 'object') {
                twistName = twistObj.name;
                twistConfig = `data-config='${JSON.stringify(twistObj).replace(/'/g, "&#39;")}'`;
                if (twistObj.accepts === 'video') lcarsColor = '#CC99CC';
                if (twistObj.accepts === 'audio') lcarsColor = '#FF9C63';
                if (twistObj.accepts === 'both') lcarsColor = '#CC99CC';
                rowKey = twistObj.row || (twistObj.monitor ? 'monitors' : null);
            }

            const isSmall = !!rowKey;
            const sizing = isSmall ? 'flex: 1 1 0; min-width: 0;' : 'flex: 0 0 auto; min-width: 200px;';
            const recordHtml = rowKey === 'iso' ? `
                        <div class="record-controls">
                            <button class="record-btn" onclick="toggleRecord(event, this)">RECORD</button>
                            <span class="recording-indicator">RECORDING...</span>
                        </div>` : '';
            const twistHtml = `
                    <div class="twist-container${isSmall ? ' monitor-twist' : ''}" ${twistConfig} style="--lcars-color: ${lcarsColor}; ${sizing}">
                        <div class="twist-title">${twistName}</div>
                        <div class="twist-lip" title="Fold / unfold strand" onclick="toggleHelix(event, this)"></div>
                        <div class="twist-foldbar" title="Fold / unfold strand" onclick="toggleHelix(event, this)"></div>
                        <div class="matrix-container" id="${pgm.id}-${twistName.replace(/\s+/g, '-').toLowerCase()}"></div>
                        <svg class="dna-helix" viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 0; display: block; margin-top: 0;"></svg>${recordHtml}
                    </div>
            `;
            if (isSmall) {
                if (!(rowKey in rows)) { rows[rowKey] = ''; rowOrder.push(rowKey); }
                rows[rowKey] += twistHtml;
            } else {
                html += twistHtml;
            }
        });

        rowOrder.forEach(k => {
            html += `<div class="monitor-row">${rows[k]}</div>`;
        });

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
