import { styleSignalNode } from './util/color.js';
import { makeMediaGroup } from './ui/makeMediaGroup.js';

// Render each Playout as its own collapsible pool, mirroring the VIDEO / AUDIO
// stage-box pools. A playout holds PLAYERS; each player holds VIDEOS; each video
// is a multiplex "stack" of one video feed plus four audio feeds — exactly the
// hold-to-expand multiplex used by the studio video pools, so drag/drop and the
// matrix treat these stacks identically.
//
// Data shape (Sources/Playout/Playout N.json):
//   { id, name, color, players:[ { id, name, videos:[ { id, name,
//       stack:{ video:"V1", audio:["A1","A2","A3","A4"] } } ] } ] }

export function buildPlayoutVideoNode(video, playerName, color, origin) {
    const vid = video.id;
    const vLabel = (video.stack && video.stack.video) || 'V';
    const audio = (video.stack && Array.isArray(video.stack.audio) && video.stack.audio.length)
        ? video.stack.audio : ['A1', 'A2', 'A3', 'A4'];

    const node = document.createElement('div');
    node.className = 'signal-node video multiplex playout-video';
    node.id = 'pool-' + vid;
    node.draggable = true;
    node.dataset.origin = origin;

    let subs = `<div class="signal-node video sub-stream" draggable="true" id="pool-${vid}-V">${video.name} ${vLabel}</div>`;
    audio.forEach((a, i) => {
        subs += `<div class="signal-node audio audio-studio sub-stream" draggable="true" id="pool-${vid}-A${i + 1}">${video.name} ${a}</div>`;
    });

    node.innerHTML = `
        <div class="multiplex-header">${video.name}</div>
        <div class="multiplex-children" style="display: none;">
            ${subs}
        </div>
    `;

    // Colour the stack and its video feed by the playout's colour, matching the
    // video pools (shared helpers from js/util/color.js).
    styleSignalNode(node, color);
    const vSub = node.querySelector(`#pool-${vid}-V`);
    if (vSub) styleSignalNode(vSub, color);
    // Tag every feed with the box origin (like the video pools do) so routed
    // feeds carry a stable origin for the router matrix and de-dup.
    node.querySelectorAll('.sub-stream').forEach(s => { s.dataset.origin = origin; });
    node.dataset.status = 'OK';
    return node;
}

export function renderPlayoutPool(data, container) {
    if (!container || !data) return;
    const color = data.color || '#646DCC';
    const players = Array.isArray(data.players) ? data.players : [];

    const group = document.createElement('div');
    group.className = 'input-group';
    group.innerHTML = `
        <div class="foldable-header" style="--lcars-color: ${color}; background-color: ${color}; font-size: 11px; margin-bottom: 8px;" onclick="togglePool(this)">
            <span>${data.name}</span>
            <span class="fold-icon" style="transform: rotate(-90deg); display: inline-block; transition: transform 0.2s;">▼</span>
        </div>
        <div class="pool-content" id="${data.id}" style="display: none;"></div>
    `;
    container.appendChild(group);

    const content = group.querySelector('.pool-content');
    players.forEach(player => {
        // Each player is a nested collapsible group inside the playout pool.
        const origin = `${data.name} — ${player.name}`;
        const playerContent = makeMediaGroup(content, player.name, color, 0);
        const grid = document.createElement('div');
        grid.className = 'input-grid-video';
        (player.videos || []).forEach(video => {
            grid.appendChild(buildPlayoutVideoNode(video, player.name, color, origin));
        });
        playerContent.appendChild(grid);
    });
}
