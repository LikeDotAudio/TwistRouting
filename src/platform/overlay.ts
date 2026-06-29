// src/platform/overlay — the editor overlay chrome + hash deep-link.
//
// Faithful port of js/editors/core.js's overlay machinery (the full-width LCARS
// "escape bar" topbar, Esc-to-close, and the #/<prod>/<twist> deep link), minus
// every window global. open() takes a build callback and a Disposer the caller
// owns; close() runs the disposer and restores the previous hash.

import { addStyles, el } from '../ui/dom.js';
import { makeDisposer, type Disposer } from '../ui/timers.js';

const STYLE_ID = 'tr-ed-overlay';
const CSS = `
.ed-overlay{position:fixed;inset:0;z-index:2000;display:none;flex-direction:column;
  background:radial-gradient(circle at 50% 30%,#0d1730 0%,#03060f 85%);
  font-family:Arial,Helvetica,sans-serif;color:#e0f0ff;}
.ed-overlay.open{display:flex;}
.ed-topbar{flex:0 0 auto;display:flex;align-items:stretch;height:48px;cursor:pointer;
  background:var(--ed-color,#646DCC);border-radius:0 0 16px 44px;overflow:hidden;}
.ed-topbar:hover{filter:brightness(1.06);}
.ed-back{display:flex;align-items:center;font-size:32px;font-weight:bold;color:#000;padding:0 4px 0 26px;line-height:1;}
.ed-title{flex:1;display:flex;align-items:center;font-weight:900;letter-spacing:3px;
  font-size:17px;text-transform:uppercase;color:#000;padding-left:8px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ed-close{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:66px;
  cursor:pointer;font-size:30px;font-weight:bold;line-height:1;color:#000;
  box-shadow:inset 2px 0 0 rgba(0,0,0,.25);}
.ed-close:hover{background:rgba(0,0,0,.18);}
.ed-body{flex:1;min-height:0;overflow:auto;padding:12px 14px 14px;}
.ed-h{color:var(--cyan,#00ffff);font-size:11px;font-weight:bold;letter-spacing:2px;
  text-transform:uppercase;margin:0 0 8px;}
`;

export const slug = (s: string): string =>
  (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

interface OverlayHandle {
  root: HTMLDivElement;
  title: HTMLElement;
  body: HTMLElement;
}

let handle: OverlayHandle | null = null;
let activeDisposer: Disposer | null = null;
let prevHash: string | null = null;

function ensureOverlay(): OverlayHandle {
  addStyles(STYLE_ID, CSS);
  if (handle) return handle;
  const root = el('div', { class: 'ed-overlay' });
  root.innerHTML = `
    <div class="ed-topbar" title="Click anywhere (or press Esc) to go back">
      <span class="ed-back">‹</span>
      <span class="ed-title"></span>
      <span class="ed-close" title="Close">&times;</span>
    </div>
    <div class="ed-body"></div>`;
  document.body.appendChild(root);
  // The ENTIRE top bar is an escape bar — clicking it (not just the X) closes.
  root.querySelector<HTMLElement>('.ed-topbar')!.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('open')) close();
  });
  handle = {
    root,
    title: root.querySelector<HTMLElement>('.ed-title')!,
    body: root.querySelector<HTMLElement>('.ed-body')!,
  };
  return handle;
}

/**
 * Open the overlay. `build` renders into the body and may register animation on
 * the supplied Disposer; the disposer is torn down on close. Sets the deep-link
 * hash to #/<prod>/<twist> and restores the previous hash on close.
 */
export function openOverlay(
  opts: { title: string; color: string; prodName: string; twistName: string },
  build: (body: HTMLElement, dispose: Disposer) => void,
): Disposer {
  const h = ensureOverlay();
  if (activeDisposer) activeDisposer.dispose();
  const dispose = makeDisposer();
  activeDisposer = dispose;
  h.root.style.setProperty('--ed-color', opts.color || '#646DCC');
  h.title.textContent = opts.title;
  h.body.innerHTML = '';
  prevHash = location.hash;
  history.replaceState(null, '', '#/' + [slug(opts.prodName), slug(opts.twistName)].filter(Boolean).join('/'));
  build(h.body, dispose);
  h.root.classList.add('open');
  return dispose;
}

export function close(): void {
  if (activeDisposer) {
    activeDisposer.dispose();
    activeDisposer = null;
  }
  if (handle) handle.root.classList.remove('open');
  if (prevHash !== null) {
    history.replaceState(null, '', prevHash || location.pathname + location.search);
    prevHash = null;
  }
}
