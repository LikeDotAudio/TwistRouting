// src/ui/console/portals — user-created "Portal" nodes (port of js/portals.js).
// A Portal is a virtual patch point that is BOTH a DESTINATION (a real
// .twist-container you route into) and a SOURCE (a .signal-node in the ingress
// panel you route onward). Because both are normal console nodes, portals appear
// in the 1990s view, get logged by the Captain's Log, and accept drops — no
// special-casing. Exposes createPortal for programmatic use.
import { addStyles } from '../dom.js';
import { monoEmoji } from '../sources/format.js';
import { toggleSuperPool } from '../sources/panel.js';
import { Footer, type GroupHandle } from './footer.js';
import { initializeTwists } from './matrix.js';
import { wireSourceNode } from '../sources/interact.js';

const COLOR = '#46A06E';
const PORTALS_CSS = `
.portals-pool{--lcars-color:${COLOR};}
.portal-new{display:block;width:100%;margin-bottom:8px;background:${COLOR};color:#000;border:none;border-radius:14px;font-weight:900;letter-spacing:1px;font-size:12px;padding:9px;cursor:pointer;}
.portal-new:hover{filter:brightness(1.1);}
.portal-srcs{display:flex;flex-direction:column;gap:6px;}
.signal-node.portal-source{border:1px solid ${COLOR};color:${COLOR};border-radius:4px 14px 14px 4px;font-weight:bold;background:rgba(70,160,110,.12);}
.twist-container.portal-twist{border-color:${COLOR};box-shadow:0 0 8px rgba(70,160,110,.4);}
.portal-twist .twist-title{color:${COLOR};}
.portal-empty{font-size:10px;color:#7e93b5;text-align:center;padding:6px;}`;

let srcWrap: HTMLElement | null = null;
let group: GroupHandle | null = null;
let seq = 0;

function ensureSourcePool(): HTMLElement | null {
  if (srcWrap) return srcWrap;
  addStyles('portals-styles', PORTALS_CSS);
  const panel = document.querySelector<HTMLElement>('.ingress-panel');
  if (!panel) return null;
  const container = document.createElement('div');
  container.className = 'super-pool-container portals-pool';
  container.innerHTML = `
    <div class="super-pool-emoji">${monoEmoji('portal').trim()}</div>
    <div class="super-pool-title foldable-header"><span>PORTALS</span><span class="fold-icon" style="transform:rotate(-90deg);display:inline-block;transition:transform .2s;">▼</span></div>
    <div class="super-pool-content" style="display:none;">
      <button class="portal-new">＋ NEW PORTAL</button>
      <div class="portal-srcs"><div class="portal-empty">no portals yet</div></div>
    </div>`;
  container.addEventListener('click', (e) => toggleSuperPool(e, container));
  container.querySelector('.portal-new')?.addEventListener('click', (e) => { e.stopPropagation(); createPortal(); });
  panel.appendChild(container);
  // Keep PORTALS as the last source pool even as other pools stream in.
  new MutationObserver(() => { if (panel.lastElementChild !== container) panel.appendChild(container); })
    .observe(panel, { childList: true });
  srcWrap = container.querySelector<HTMLElement>('.portal-srcs');
  return srcWrap;
}

function buildDestination(name: string, id: string): void {
  if (!group) group = Footer.addGroup('PORTALS', { color: '70,160,110', collapsed: false });
  Footer.addTab({ id, name: name.toUpperCase() }, { group, color: COLOR, active: false });
  const pane = document.getElementById('tab-' + id);
  if (!pane) return;
  pane.innerHTML = `
    <div class="program-row" style="--prod-color:${COLOR}; position:relative; overflow:hidden; padding:0; margin-bottom:10px; flex:1 1 auto;">
      <div class="program-title" style="background:${COLOR};">${monoEmoji('portal')}PORTAL — ${name}</div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; padding-right:60px;">
        <div class="twist-container portal-twist" data-prod-id="${id}" data-prod-name="PORTAL — ${name}" style="--lcars-color:${COLOR}; flex:0 0 auto; min-width:240px;">
          <div class="twist-title">${name}</div>
          <div class="matrix-container" id="${id}-portal"></div>
        </div>
      </div>
    </div>`;
  initializeTwists(pane);   // wire the new portal twist as a drop target
}

function buildSource(name: string, id: string): void {
  const pool = ensureSourcePool();
  if (!pool) return;
  pool.querySelector('.portal-empty')?.remove();
  const node = document.createElement('div');
  node.className = 'signal-node audio portal-source';
  node.id = 'portalsrc-' + id;
  node.dataset.origin = 'PORTAL — ' + name;
  node.textContent = 'PORTAL ' + name;
  pool.appendChild(node);
  wireSourceNode(node);
}

export function createPortal(rawName?: string): string | null {
  const name = (rawName || prompt('Name the portal:', 'PORTAL ' + (seq + 1)) || '').trim();
  if (!name) return null;
  const id = 'portal-' + (++seq);
  buildDestination(name, id);
  buildSource(name, id);
  return id;
}

export function initPortals(): void {
  ensureSourcePool();
}
