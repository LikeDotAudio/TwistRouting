// src/ui/console/source-filter — a text field atop the SOURCES panel that filters
// every source to what you type, hiding the rest while keeping the LCARS frames
// (port of js/source-filter.js). The tree is lazy, so while a query is active we
// (1) CSS-force loaded content open, (2) click unloaded headers to render them,
// (3) re-apply as async content streams in (MutationObserver).
import { addStyles } from '../dom.js';

const SF_CSS = `
.src-filter{margin-bottom:12px;}
.src-filter-input{width:100%;box-sizing:border-box;background:#0a1020;border:2px solid #FF9C63;border-left:12px solid #FF9C63;border-radius:0 16px 16px 0;color:#e0f0ff;font-family:'Courier New',monospace;font-weight:bold;letter-spacing:2px;text-transform:uppercase;padding:9px 14px;outline:none;}
.src-filter-input::placeholder{color:#7e93b5;letter-spacing:1px;}
.src-filter-input:focus{box-shadow:0 0 10px rgba(255,156,99,.5);}
.ingress-panel.filtering .super-pool-content{display:block !important;}
.ingress-panel.filtering .media-group-content{display:block !important;}
.ingress-panel.filtering .pool-content{display:grid !important;}
.ingress-panel.filtering .filter-hidden{display:none !important;}`;

function units(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.signal-node.multiplex, .signal-node:not(.multiplex):not(.sub-stream):not(.dropped-group)')]
    .filter((u) => !u.closest('.multiplex-children'));
}

function loadAll(panel: HTMLElement): void {
  panel.querySelectorAll<HTMLElement>('.media-group-header').forEach((h) => {
    const c = h.nextElementSibling;
    if (c && c.classList.contains('media-group-content') && !c.children.length) h.click();
  });
  panel.querySelectorAll<HTMLElement>('.input-group > .foldable-header').forEach((h) => {
    const c = h.nextElementSibling;
    if (c && c.classList.contains('pool-content') && !c.children.length) h.click();
  });
}

function hide(panel: HTMLElement, q: string): void {
  panel.querySelectorAll('.filter-hidden').forEach((e) => e.classList.remove('filter-hidden'));
  units(panel).forEach((u) => {
    const hay = ((u.dataset.origin || '') + ' ' + u.textContent).toLowerCase();
    if (!hay.includes(q)) u.classList.add('filter-hidden');
  });
  [...panel.querySelectorAll<HTMLElement>('.input-group, .media-group, .gang-grid')].forEach((c) => {
    if (!units(c).some((n) => !n.classList.contains('filter-hidden'))) c.classList.add('filter-hidden');
  });
  panel.querySelectorAll<HTMLElement>('.gang-cap').forEach((cap) => {
    const grid = cap.nextElementSibling;
    if (grid && grid.classList.contains('filter-hidden')) cap.classList.add('filter-hidden');
  });
}

export function initSourceFilter(): void {
  const panel = document.querySelector<HTMLElement>('.ingress-panel');
  if (!panel || panel.querySelector(':scope > .src-filter')) return;
  addStyles('source-filter-styles', SF_CSS);
  let query = '', observer: MutationObserver | null = null, reapplyTimer: ReturnType<typeof setTimeout> | undefined;

  const apply = (q: string): void => {
    query = (q || '').trim().toLowerCase();
    if (!query) {
      panel.classList.remove('filtering');
      panel.querySelectorAll('.filter-hidden').forEach((e) => e.classList.remove('filter-hidden'));
      if (observer) { observer.disconnect(); observer = null; }
      return;
    }
    panel.classList.add('filtering');
    loadAll(panel);
    hide(panel, query);
    if (!observer) {
      observer = new MutationObserver(() => {
        if (reapplyTimer) clearTimeout(reapplyTimer);
        reapplyTimer = setTimeout(() => { if (query) { loadAll(panel); hide(panel, query); } }, 60);
      });
      observer.observe(panel, { childList: true, subtree: true });
    }
  };

  const bar = document.createElement('div');
  bar.className = 'src-filter';
  bar.innerHTML = `<input type="text" class="src-filter-input" placeholder="⌕ Filter sources…" spellcheck="false" />`;
  const cl = panel.querySelector(':scope > .cl-btn');   // sit below the Captain's Log button
  if (cl) panel.insertBefore(bar, cl.nextSibling);
  else panel.insertBefore(bar, panel.firstChild);
  const input = bar.querySelector<HTMLInputElement>('input')!;
  input.addEventListener('input', () => apply(input.value));
}
