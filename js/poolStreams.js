import { styleSignalNode } from './util/color.js';
import { monoEmoji } from './util/mono-emoji.js';
import { slugId } from './util/dom.js';

// Render a STREAMS pool: a set of incoming YouTube video streams. Each stream is
// one URL that carries a picture plus a stereo pair, so it renders as the same
// hold-to-expand multiplex the playout/video pools use — a VIDEO feed bundled
// with its LEFT and RIGHT audio — and the matrix routes each sub-feed on its own.
//
// Data shape (Sources/…/Streams.json):
//   { id, name, color, streams:[ { id, name, url, left:"L", right:"R" } ] }

function injectStreamStyles() {
    if (document.getElementById('stream-pool-styles')) return;
    const s = document.createElement('style');
    s.id = 'stream-pool-styles';
    s.textContent = `
        .signal-node.stream-node .stream-link{display:block;font-size:9px;letter-spacing:.5px;
            color:#9fb6cc;text-decoration:none;padding:3px 4px;margin-top:2px;word-break:break-all;
            background:rgba(0,0,0,.35);border-radius:3px;}
        .signal-node.stream-node .stream-link:hover{color:#fff;text-decoration:underline;}
    `;
    document.head.appendChild(s);
}

// One stream = one draggable multiplex node (VIDEO + L + R), tagged with its URL.
export function buildStreamNode(stream, color, origin) {
    const sid = stream.id || slugId(stream.name);
    const url = stream.url || '';
    const left = stream.left || 'L';
    const right = stream.right || 'R';

    const node = document.createElement('div');
    node.className = 'signal-node video multiplex stream-node';
    node.id = 'pool-' + sid;
    node.draggable = true;
    node.dataset.origin = origin;
    node.dataset.url = url;
    node.dataset.status = 'OK';
    if (url) node.title = url;

    const subs =
        `<div class="signal-node video sub-stream" draggable="true" id="pool-${sid}-V">${stream.name} VIDEO</div>` +
        `<div class="signal-node audio audio-studio sub-stream" draggable="true" id="pool-${sid}-L">${stream.name} ${left}</div>` +
        `<div class="signal-node audio audio-studio sub-stream" draggable="true" id="pool-${sid}-R">${stream.name} ${right}</div>`;

    node.innerHTML = `
        <div class="multiplex-header">${stream.name}</div>
        <div class="multiplex-children" style="display: none;">
            ${subs}
            ${url ? `<a class="stream-link" href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">▶ ${url}</a>` : ''}
        </div>
    `;

    styleSignalNode(node, color);
    const vSub = node.querySelector(`#pool-${sid}-V`);
    if (vSub) styleSignalNode(vSub, color);
    // Every routed feed carries the stream's origin (like the video/playout pools)
    // so the router matrix and de-dup have a stable source label.
    node.querySelectorAll('.sub-stream').forEach(s => { s.dataset.origin = origin; s.dataset.url = url; });
    return node;
}

export function renderStreamsPool(data, container) {
    if (!container || !data) return;
    const color = data.color || '#C864C8';
    const streams = Array.isArray(data.streams) ? data.streams : [];

    const group = document.createElement('div');
    group.className = 'input-group';
    group.innerHTML = `
        <div class="foldable-header" style="--lcars-color: ${color}; background-color: ${color}; font-size: 11px; margin-bottom: 8px;" onclick="togglePool(this)">
            <span>${monoEmoji(data.name)}${data.name}</span>
            <span class="fold-icon" style="transform: rotate(-90deg); display: inline-block; transition: transform 0.2s;">▼</span>
        </div>
        <div class="pool-content" id="${data.id}" style="display: none;"></div>
    `;
    container.appendChild(group);

    const content = group.querySelector('.pool-content');
    const grid = document.createElement('div');
    grid.className = 'input-grid-video';
    streams.forEach(stream => {
        const origin = `${data.name} — ${stream.name}`;
        grid.appendChild(buildStreamNode(stream, color, origin));
    });
    content.appendChild(grid);

    injectStreamStyles();
}
