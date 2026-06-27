// Render each production as its own collapsible pool ("super group"), exactly
// like the VIDEO/AUDIO stage-box pools. The pool's foldable header is made
// draggable by initializeDraggables(), so dragging the whole program carries all
// its output feeds at once — drop it on a single twist, or on a floor room to
// auto-populate that room's monitors / IEMs / foldback.
function renderProductionInputs(programs, container) {
    if (!container) return;

    // A production's outputs are defined in its OWN JSON (outputs.video / .audio /
    // .intercom). These defaults apply only if a file omits them.
    const DEFAULT_OUTPUTS = {
        video: ['AUX 1', 'AUX 2', 'MV 1', 'PROGRAM'],
        audio: ['MAIN MIX', 'MIX MINUS 1', 'MIX MINUS 2', 'MIX MINUS 3', 'MIX MINUS 4'],
        intercom: ['IFB OUT 1', 'IFB OUT 2', 'IFB OUT 3', 'IFB OUT 4'],
    };
    const slug = (s) => s.replace(/[^a-zA-Z0-9]/g, '-');

    programs.forEach(pgm => {
        const color = pgm.color || '#7CFC00';
        const outs = pgm.outputs || {};
        const videoOuts = outs.video || DEFAULT_OUTPUTS.video;
        const audioOuts = outs.audio || DEFAULT_OUTPUTS.audio;
        const intercomOuts = outs.intercom || DEFAULT_OUTPUTS.intercom;
        const group = document.createElement('div');
        group.className = 'input-group';

        let items = '';
        videoOuts.forEach(o => {
            items += `<div class="signal-node video video-main" draggable="true" data-origin="${pgm.name}" id="prodsrc-${pgm.id}-${slug(o)}" style="border-color:${color}; color:${color};">${pgm.name} ${o}</div>`;
        });
        audioOuts.forEach(o => {
            items += `<div class="signal-node audio audio-studio" draggable="true" data-origin="${pgm.name}" id="prodsrc-${pgm.id}-${slug(o)}">${pgm.name} ${o}</div>`;
        });
        intercomOuts.forEach(o => {
            items += `<div class="signal-node audio audio-comms" draggable="true" data-origin="${pgm.name}" id="prodsrc-${pgm.id}-${slug(o)}">${pgm.name} ${o}</div>`;
        });

        group.innerHTML = `
            <div class="foldable-header" style="--lcars-color: ${color}; background-color: ${color}; font-size: 11px; margin-bottom: 8px;" onclick="togglePool(this)">
                <span>${pgm.name}</span>
                <span class="fold-icon" style="transform: rotate(-90deg); display: inline-block; transition: transform 0.2s;">▼</span>
            </div>
            <div class="input-grid-audio pool-content" style="display: none;">
                ${items}
            </div>
        `;
        container.appendChild(group);
    });
}

function renderPrograms(programs) {
    const twists = ['Processing', 'Recording', 'Switcher', 'Audio Mixer', 'Intercom'];
    
    programs.forEach(pgm => {
        const pgmTwists = pgm.twists || ['Processing', 'Recording', 'Switcher', 'Audio Mixer', 'Intercom'];
        const container = document.getElementById('tab-' + pgm.id);
        if (!container) return;
        
        // Rooms that live under a parent (e.g. a floor) show "1ST FLOOR — ROOM 1";
        // top-level destinations just show their own name.
        const titleText = pgm.parentName
            ? `${pgm.parentName.toUpperCase()} — ${pgm.name}`
            : pgm.name;
        // An offline/faulted room pulses red and flags its status in the title.
        const faulted = isFaultStatus(pgm.status);
        const faultTag = faulted ? ` <span class="fault-tag">⚠ ${pgm.status}</span>` : '';

        let html = `
            <div class="program-row${faulted ? ' fault' : ''}" style="--prod-color: ${pgm.color || '#ffaa00'}; position: relative; overflow: hidden; padding: 0; margin-bottom: 10px; flex: 1 1 auto;">
                <div class="program-title" style="background: ${pgm.color || '#ffaa00'};">${titleText}${faultTag}</div>
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
    if (typeof initRoomDrops === 'function') {
        initRoomDrops();
    }
}
