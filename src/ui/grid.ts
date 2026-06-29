// src/ui/grid — tile N panels in a responsive grid (port of js/editors/multi.js
// renderGridOfSiblings, minus the DOM scraping). The host tells an editor how
// many siblings of its kind exist (via EditorContext.siblings); this lays them
// out and returns one cell element per item for the caller to render into.

import { el } from './dom.js';

export function gridCells(host: HTMLElement, count: number): HTMLElement[] {
  if (count <= 1) return [host];
  const cols = count <= 4 ? 2 : 3;
  const grid = el('div', {
    style: `display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:14px;height:100%;overflow:auto;`,
  });
  host.append(grid);
  return Array.from({ length: count }, () => {
    const cell = el('div', { style: 'min-width:0;min-height:0;overflow:auto;position:relative;' });
    grid.append(cell);
    return cell;
  });
}
