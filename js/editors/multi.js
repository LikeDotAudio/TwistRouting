// js/editors/multi.js — render an editor for EVERY sibling twist of the same kind
// in a production at once (e.g. all four Audio Monitors / IFBs), tiled in a grid
// so each is 1/N of the screen.
export function renderGridOfSiblings(body, twist, re, buildOne) {
    const row = twist.closest('.program-row');
    const sibs = row
        ? [...row.querySelectorAll('.twist-container')].filter(t => re.test(((t.querySelector('.twist-title') || {}).innerText || '')))
        : [twist];
    if (sibs.length <= 1) { buildOne(body, sibs[0] || twist); return; }
    const cols = sibs.length <= 2 ? 2 : sibs.length <= 4 ? 2 : 3;
    const grid = document.createElement('div');
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:14px;height:100%;overflow:auto;`;
    body.appendChild(grid);
    sibs.forEach(t => {
        const cell = document.createElement('div');
        cell.style.cssText = 'min-width:0;min-height:0;overflow:auto;position:relative;';
        grid.appendChild(cell);
        buildOne(cell, t);
    });
}
