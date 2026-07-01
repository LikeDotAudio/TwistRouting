// src/ui/console/dest-selector — the radial "destination selector", a footer
// element. Port of js/dest-selector.js: a bottom-centre ◎ button opens a concentric
// self-animating LCARS dial; the destinations orbit it as nodes. Drill into groups,
// click a tab to activate it. Reads the footer TopBar DOM (#production-tabs groups/
// tabs) that ui/console/footer.ts builds, so it needs no data of its own.
import { addStyles } from '../dom.js';

const ROUTE = '#/select';

interface Item { kind: 'group' | 'tab' | 'back'; name: string; el?: HTMLElement; tab?: HTMLElement }

const DS_CSS = `
.ds-open{position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:1000;background:#e08a1e;color:#000;
    border:none;border-radius:50%;width:46px;height:46px;font-size:22px;cursor:pointer;
    box-shadow:0 0 14px rgba(224,138,30,.5),inset 0 0 0 3px #1a1206;}
.ds-open:hover{background:#ffd400;}
.ds-overlay{position:fixed;inset:0;z-index:2700;display:none;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 50%,#120c02 0%,#000 75%);}
.ds-overlay.open{display:flex;}
.ds-x{position:fixed;top:18px;right:34px;z-index:2;color:#ffd400;border:1px solid #e08a1e;
    border-radius:4px;padding:4px 12px;font-family:'Courier New',monospace;font-weight:bold;cursor:pointer;}
.ds-x:hover{background:#ffd400;color:#000;}
.ds-stage{position:relative;width:min(86vmin,720px);height:min(86vmin,720px);}
.ds-svg{position:absolute;inset:0;width:100%;height:100%;transition:transform .45s cubic-bezier(.2,.8,.2,1);}
.ds-svg circle{transform-box:fill-box;transform-origin:center;}
.ds-svg .r1{animation:dsSpin 64s linear infinite;}
.ds-svg .r2{animation:dsSpin 40s linear infinite reverse;}
.ds-svg .r3{animation:dsSpin 30s linear infinite;}
.ds-svg .r4{animation:dsSpin 22s linear infinite reverse;}
.ds-svg .r5{animation:dsSpin 15s linear infinite;}
.ds-svg .core{animation:dsPulse 2.4s ease-in-out infinite;}
@keyframes dsSpin{to{transform:rotate(360deg);}}
@keyframes dsPulse{0%,100%{opacity:.85;filter:drop-shadow(0 0 6px #ffae00);}50%{opacity:1;filter:drop-shadow(0 0 18px #ffd400);}}
.ds-overlay.thinking .ds-svg{transform:scale(1.12);}
.ds-overlay.thinking .ds-svg .r2{animation-duration:9s;}
.ds-overlay.thinking .ds-svg .r4{animation-duration:6s;}
.ds-overlay.thinking .ds-svg .r5{animation-duration:3.5s;}
@media (prefers-reduced-motion: reduce){ .ds-svg circle{animation:none !important;} .ds-svg{transition:none;} }
.ds-centre{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center;font-family:Arial,Helvetica,sans-serif;}
.ds-label{color:#fff;font-weight:900;letter-spacing:2px;font-size:clamp(14px,2.4vmin,22px);text-shadow:0 0 10px rgba(0,0,0,.8);max-width:46%;}
.ds-sub{color:#ffae00;font-size:11px;letter-spacing:3px;margin-top:6px;}
.ds-ring{position:absolute;inset:0;}
.ds-node{position:absolute;left:50%;top:50%;transform-origin:center;background:#1a1206;color:#ffd400;border:1px solid #e08a1e;border-radius:14px;
    font-family:Arial,Helvetica,sans-serif;font-weight:bold;letter-spacing:1px;font-size:11px;padding:7px 12px;white-space:nowrap;cursor:pointer;transition:transform .18s,background .18s,box-shadow .18s;}
.ds-node:hover{background:#ffd400;color:#000;box-shadow:0 0 16px rgba(255,212,0,.7);z-index:2;}
.ds-node.grp{background:#2a1d06;color:#ffe680;border-color:#ffd400;}
.ds-node.grp:hover{background:#ffe680;color:#000;}
.ds-node.back{background:#06203a;color:#7ec8ff;border-color:#3aa0ff;}
.ds-node.back:hover{background:#3aa0ff;color:#000;box-shadow:0 0 16px rgba(58,160,255,.7);}
.ds-empty{position:absolute;left:50%;top:8%;transform:translateX(-50%);color:#7a5a10;font-family:monospace;}`;

function dialSVG(): string {
  return `
  <svg class="ds-svg" viewBox="0 0 400 400" aria-hidden="true">
    <defs><radialGradient id="dsCore" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="#fff3a0"/><stop offset="55%" stop-color="#ffd400"/>
      <stop offset="100%" stop-color="#e08a1e"/></radialGradient></defs>
    <circle class="r1" cx="200" cy="200" r="186" fill="none" stroke="#f0e6d2" stroke-width="2"  stroke-dasharray="58 22 10 40 90 30"/>
    <circle class="r2" cx="200" cy="200" r="158" fill="none" stroke="#e08a1e" stroke-width="22" stroke-dasharray="150 95 70 120"/>
    <circle class="r3" cx="200" cy="200" r="128" fill="none" stroke="#f0e6d2" stroke-width="2"  stroke-dasharray="26 16"/>
    <circle class="r4" cx="200" cy="200" r="100" fill="none" stroke="#c97a16" stroke-width="26" stroke-dasharray="120 75 60 95"/>
    <circle class="r5" cx="200" cy="200" r="72"  fill="none" stroke="#ffd400" stroke-width="3"  stroke-dasharray="46 250"/>
    <circle class="core" cx="200" cy="200" r="46" fill="url(#dsCore)"/>
    <circle cx="200" cy="200" r="19" fill="#0a0a0a"/>
  </svg>`;
}

export function initDestSelector(): void {
  let overlay: HTMLElement | null = null, ring: HTMLElement, label: HTMLElement, sub: HTMLElement;
  let syncing = false, prevHash: string | null = null;
  const path: HTMLElement[] = [];

  const groupNode = (g: HTMLElement): { name: string; el: HTMLElement; tabs: HTMLElement[]; subs: HTMLElement[] } => {
    const lbl = g.querySelector<HTMLElement>(':scope > .lcars-group-label > span');
    const body = g.querySelector<HTMLElement>(':scope > .lcars-group-body');
    const tabs = body ? [...body.querySelectorAll<HTMLElement>(':scope > .lcars-group-tabs > .lcars-tab')] : [];
    const subs = body ? [...body.children].filter((c): c is HTMLElement => c.classList.contains('lcars-group')) : [];
    return { name: lbl ? lbl.innerText.trim() : 'GROUP', el: g, tabs, subs };
  };

  function currentItems(): Item[] {
    const top = path[path.length - 1];
    if (!top) {
      const bar = document.getElementById('production-tabs');
      const items: Item[] = bar ? [...bar.children].filter((c): c is HTMLElement => c.classList.contains('lcars-group'))
        .map((g) => ({ kind: 'group', name: groupNode(g).name, el: g })) : [];
      if (bar) [...bar.children].filter((c): c is HTMLElement => c.classList.contains('lcars-tab'))
        .forEach((t) => items.push({ kind: 'tab', name: t.innerText.trim(), tab: t }));
      return items;
    }
    const node = groupNode(top);
    const items: Item[] = node.subs.map((s) => ({ kind: 'group', name: groupNode(s).name, el: s }));
    node.tabs.forEach((t) => items.push({ kind: 'tab', name: t.innerText.trim(), tab: t }));
    return items;
  }
  const crumb = (): string => path.map((g) => groupNode(g).name).join(' › ');

  function think(on: boolean, name?: string): void {
    overlay?.classList.toggle('thinking', on);
    label.textContent = on ? (name ?? '') : (path.length ? crumb() : 'SELECT DESTINATION');
    sub.textContent = on ? 'click to engage' : (path.length ? 'choose, or ← back' : 'hover a group to consider');
  }

  function place(): void {
    const items = currentItems();
    const list: Item[] = path.length ? [{ kind: 'back', name: '← BACK' }, ...items] : items;
    ring.innerHTML = '';
    const n = list.length || 1;
    const stageSize = Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.86, 720);
    const orbit = Math.round(stageSize / 2 * 0.82);
    list.forEach((it, i) => {
      const ang = (i / n) * 360 - 90;
      const node = document.createElement('button');
      node.className = 'ds-node' + (it.kind === 'group' ? ' grp' : it.kind === 'back' ? ' back' : '');
      const t = it.kind === 'group' ? it.name + ' ▸' : it.name;
      node.textContent = t.length > 20 ? t.slice(0, 19) + '…' : t;
      node.style.transform = `translate(-50%,-50%) rotate(${ang}deg) translate(${orbit}px) rotate(${-ang}deg)`;
      node.addEventListener('mouseenter', () => think(true, it.name));
      node.addEventListener('mouseleave', () => think(false));
      node.addEventListener('click', () => activate(it));
      ring.appendChild(node);
    });
    think(false);
  }

  function activate(it: Item): void {
    if (it.kind === 'back') { path.pop(); place(); return; }
    if (it.kind === 'group') { if (it.el) { path.push(it.el); place(); } return; }
    close();
    if (it.tab) { try { it.tab.click(); } catch { /* ignore */ } }
  }

  function build(): HTMLElement {
    addStyles('dest-selector-styles', DS_CSS);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ds-overlay';
    overlay.innerHTML = `
      <span class="ds-x" title="Close">CLOSE ✕</span>
      <div class="ds-stage">
        ${dialSVG()}
        <div class="ds-centre"><div class="ds-label">SELECT DESTINATION</div><div class="ds-sub">hover to consider</div></div>
        <div class="ds-ring"></div>
      </div>`;
    document.body.appendChild(overlay);
    ring = overlay.querySelector('.ds-ring') as HTMLElement;
    label = overlay.querySelector('.ds-label') as HTMLElement;
    sub = overlay.querySelector('.ds-sub') as HTMLElement;
    overlay.querySelector('.ds-x')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay?.classList.contains('open')) close(); });
    return overlay;
  }

  function open(): void {
    if (location.hash !== ROUTE) { prevHash = location.hash; location.hash = ROUTE; }
    else show();
  }
  function show(): void { const ov = build(); path.length = 0; place(); ov.classList.add('open'); }
  function close(): void {
    const ov = build(); ov.classList.remove('open');
    syncing = true; history.replaceState(null, '', prevHash || (location.pathname + location.search)); syncing = false; prevHash = null;
  }
  function onHash(): void { if (syncing) return; if (location.hash === ROUTE) show(); else overlay?.classList.remove('open'); }

  if (document.querySelector('.ds-open')) return;
  addStyles('dest-selector-styles', DS_CSS);
  const b = document.createElement('button');
  b.className = 'ds-open'; b.textContent = '◎'; b.title = 'Destination selector (#/select)';
  b.addEventListener('click', open);
  document.body.appendChild(b);
  window.addEventListener('hashchange', onHash);
  if (location.hash === ROUTE) show();
}
