import { isFaultStatus } from './globals.js';
import { slugId, faultTag } from './util/dom.js';
import { initializeTwists, initRoomDrops } from './matrix.js';
import { monoEmoji } from './util/mono-emoji.js';
// Render each production as its own collapsible pool ("super group"), exactly
// like the VIDEO/AUDIO stage-box pools. The pool's foldable header is made
// draggable by initializeDraggables(), so dragging the whole program carries all
// its output feeds at once — drop it on a single twist, or on a floor room to
// auto-populate that room's monitors / IEMs / foldback.
export function renderProductionInputs(programs, container) {
    if (!container) return;

    // A production's outputs are defined in its OWN JSON (outputs.video / .audio /
    // .intercom). These defaults apply only if a file omits them.
    const DEFAULT_OUTPUTS = {
        video: ['AUX 1', 'AUX 2', 'MV 1', 'PROGRAM'],
        audio: ['MAIN MIX', 'MIX MINUS 1', 'MIX MINUS 2', 'MIX MINUS 3', 'MIX MINUS 4'],
        intercom: ['IFB OUT 1', 'IFB OUT 2', 'IFB OUT 3', 'IFB OUT 4'],
    };
    const slug = slugId;   // shared id-slug helper (js/util/dom.js)

    programs.forEach(pgm => {
        const color = pgm.color || '#7CFC00';
        const outs = pgm.outputs || {};
        const videoOuts = outs.video || DEFAULT_OUTPUTS.video;
        const audioOuts = outs.audio || DEFAULT_OUTPUTS.audio;
        const intercomOuts = outs.intercom || DEFAULT_OUTPUTS.intercom;
        const group = document.createElement('div');
        group.className = 'input-group';

        let items = '', gridClass = 'input-grid-audio';
        if (Array.isArray(pgm.boxes)) {
            // Bundled outputs: each box is a multiplex (video feed + embedded audio)
            // — e.g. PROGRAM (V + 4 audio), AUX 1 (the mix-minuses), AUX 2 (the IFBs),
            // and the ISO record outputs (V + audio).
            gridClass = 'input-grid-video';
            pgm.boxes.forEach(box => {
                const bid = `prodsrc-${pgm.id}-${slug(box.name)}`, orig = `${pgm.name} — ${box.name}`;
                let subs = '';
                if (box.video !== false) subs += `<div class="signal-node video video-main sub-stream" draggable="true" data-origin="${orig}" id="${bid}-v" style="border-color:${color};color:${color};">${box.name} V</div>`;
                (box.audio || []).forEach(a => { subs += `<div class="signal-node audio audio-studio sub-stream" draggable="true" data-origin="${orig}" id="${bid}-${slug(a)}">${box.name} ${a}</div>`; });
                items += `<div class="signal-node video multiplex video-main" draggable="true" data-origin="${orig}" id="${bid}" style="border-color:${color};color:${color};"><div class="multiplex-header">${box.name}</div><div class="multiplex-children" style="display:none;">${subs}</div></div>`;
            });
        } else {
            videoOuts.forEach(o => {
                items += `<div class="signal-node video video-main" draggable="true" data-origin="${pgm.name}" id="prodsrc-${pgm.id}-${slug(o)}" style="border-color:${color}; color:${color};">${pgm.name} ${o}</div>`;
            });
            audioOuts.forEach(o => {
                items += `<div class="signal-node audio audio-studio" draggable="true" data-origin="${pgm.name}" id="prodsrc-${pgm.id}-${slug(o)}">${pgm.name} ${o}</div>`;
            });
            intercomOuts.forEach(o => {
                items += `<div class="signal-node audio audio-comms" draggable="true" data-origin="${pgm.name}" id="prodsrc-${pgm.id}-${slug(o)}">${pgm.name} ${o}</div>`;
            });
        }

        group.innerHTML = `
            <div class="foldable-header" style="--lcars-color: ${color}; background-color: ${color}; font-size: 11px; margin-bottom: 8px;" onclick="togglePool(this)">
                <span>${pgm.name}</span>
                <span class="fold-icon" style="transform: rotate(-90deg); display: inline-block; transition: transform 0.2s;">▼</span>
            </div>
            <div class="${gridClass} pool-content" style="display: none;">
                ${items}
            </div>
        `;
        container.appendChild(group);
    });
}

export function renderPrograms(programs) {
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

        let html = `
            <div class="program-row${faulted ? ' fault' : ''}" style="--prod-color: ${pgm.color || '#ffaa00'}; position: relative; overflow: hidden; padding: 0; margin-bottom: 10px; flex: 1 1 auto;">
                <div class="program-title" style="background: ${pgm.color || '#ffaa00'};">${monoEmoji(titleText)}${titleText}${faulted ? ' ' : ''}${faultTag(pgm.status)}</div>
                <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start; padding-right: 60px;">
        `;
        
        // Small twists (monitors, ISO recorders) are gathered into their own rows,
        // each member ~1/4 width. rowKey groups them (monitors row, iso row, ...).
        const rows = {};
        const rowOrder = [];
        let bigHtml = '';
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
                if (twistObj.accepts === 'camera') lcarsColor = '#6FC8F0';
                rowKey = twistObj.row || (twistObj.monitor ? 'monitors' : null);
            }

            const isSmall = !!rowKey;
            const sizing = isSmall ? 'flex: 1 1 0; min-width: 0;' : 'flex: 0 0 auto; min-width: 200px;';
            const recordHtml = rowKey === 'iso' ? `
                        <div class="record-controls">
                            <button class="record-btn" onclick="toggleRecord(event, this)">RECORD</button>
                            <span class="recording-indicator">RECORDING...</span>
                        </div>` : '';
            const prodAttrs = `data-prod-id="${pgm.id}" data-prod-name="${(titleText || '').replace(/"/g, '&quot;')}"`;
            const twistHtml = `
                    <div class="twist-container${isSmall ? ' monitor-twist' : ''}" ${twistConfig} ${prodAttrs} style="--lcars-color: ${lcarsColor}; ${sizing}">
                        <div class="twist-title">${monoEmoji(twistName)}${twistName}</div>
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
                bigHtml += twistHtml;
            }
        });

        // Camera inputs render ABOVE the big twists (the Video Mixer etc.); the
        // other small-twist rows (monitors, ISOs) stay below.
        if (rows['cameras']) html += `<div class="monitor-row camera-row">${rows['cameras']}</div>`;
        html += bigHtml;
        rowOrder.forEach(k => {
            if (k === 'cameras') return;
            html += `<div class="monitor-row">${rows[k]}</div>`;
        });

        html += `
                </div>
            </div>
        `;
        container.innerHTML = html;
    });
    
    initializeTwists();
    initRoomDrops();
}
