// src/app/main.ts — boot + composition root of the A.8 side build.
//
// Builds the LCARS routing console: the SOURCES ingress panel (left), the
// destination program content (centre), and the destinations tab FOOTER (bottom).
// Sources drag into destination twists (the crosspoint); clicking a twist opens
// its dispatched editor with a fully-resolved, typed EditorContext (data-in, M3).
// Composition root — the only layer allowed to wire ui + editors + platform.

import { pluginFor } from '../editors/registry.js';
import { openOverlay } from '../platform/overlay.js';
import { buildContext } from './context.js';
import type { EditorServices } from '../editors/types.js';
import type { Production, TwistConfig, Hex } from '../model/index.js';
import { el } from '../ui/dom.js';
import { renderSourcesPanel } from '../ui/sources/panel.js';
import { wireSourceNodes } from '../ui/sources/interact.js';
import { Footer } from '../ui/console/footer.js';
import { buildDestinations } from '../ui/console/destinations.js';
import { initDestSelector } from '../ui/console/dest-selector.js';
import { initClock } from '../ui/console/clock.js';
import { showSchedule } from '../ui/console/schedule.js';
import { initAuthPanel, applyScope } from '../ui/console/auth-panel.js';
import { initRouterView } from '../ui/console/router-view.js';
import { initCaptainsLog } from '../ui/console/captains-log.js';
import { initSourceFilter } from '../ui/console/source-filter.js';
import { initPortals } from '../ui/console/portals.js';
import { initMission } from '../ui/console/mission.js';
import { initLcarsPulse } from '../ui/console/lcars-pulse.js';

/** Cross-editor services (M1): replaces the legacy window.openStageBox global. */
const services: EditorServices = {
  openStageBox(name, color, channels) {
    openOverlay({ title: name, color, prodName: name, twistName: name }, (body) => {
      body.innerHTML =
        `<div class="ed-h">STAGE BOX · ${name}</div>` +
        `<ul>${channels.map((c) => `<li>${c}</li>`).join('')}</ul>`;
    });
  },
};

/** A twist element in the console was clicked → open its dispatched editor. */
function openEditorForTwist(twistEl: HTMLElement): void {
  let name = (twistEl.querySelector('.twist-title')?.textContent ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  let twist: string | TwistConfig = name;
  if (twistEl.dataset.config) {
    try {
      const c = JSON.parse(twistEl.dataset.config) as TwistConfig;
      twist = c;
      if (c.name) name = c.name;
    } catch { /* keep the title-derived name */ }
  }
  const plugin = pluginFor(name);
  if (!plugin) return;
  const prodName = twistEl.dataset.prodName ?? '';
  const color = (twistEl.style.getPropertyValue('--lcars-color').trim() || '#646DCC') as Hex;
  const prod: Production = { id: twistEl.dataset.prodId ?? 'prod', name: prodName, color };
  openOverlay(
    { title: prodName ? `${prodName} · ${plugin.title}` : plugin.title, color, prodName, twistName: name },
    (body, dispose) => {
      const ctx = buildContext(prod, twist, dispose, services);
      const blocked = (plugin.requiredCaps ?? []).find((c) => !ctx.can(c));
      if (blocked) { body.innerHTML = `<div class="ed-h">ACCESS DENIED — requires "${blocked}"</div>`; return; }
      plugin.render(body, ctx);
      applyScope(body);   // progressive disclosure: hide [data-cap] the role lacks
    },
  );
}

/** Assemble the console shell and populate sources + destinations concurrently. */
async function buildConsole(): Promise<void> {
  document.body.innerHTML = '';
  const ingress = el('div', { class: 'panel ingress-panel', id: 'sources' });
  const sash = el('div', { class: 'sidebar-sash', id: 'sidebar-sash', title: 'Drag to resize the sources sidebar' });
  const content = el('div', { id: 'production-content', style: 'flex:1 1 auto;min-height:0;overflow-y:auto;padding:24px 6px 4px 0;' });
  const destFrame = el('div', { class: 'panel dest-frame', style: 'overflow:hidden;display:flex;flex-direction:column;border:none;border-radius:0;' }, [content]);
  const container = el('div', { class: 'container' }, [ingress, sash, destFrame]);
  // The destinations tab FOOTER runs along the bottom, below the console.
  const footer = el('footer', { class: 'app-footer' }, [el('div', { id: 'production-tabs', class: 'tabs-header' })]);
  document.body.append(container, footer);
  // Footer chrome: the by-line credit link + the radial destination selector (◎).
  document.body.append(el('a', {
    class: 'credit-button', href: 'https://like.audio/20260627/twist-like-audio/',
    target: '_blank', rel: 'noopener', textContent: 'CREATED BY ANTHONY PETER KUZUB  -  WWW.LIKE.AUDIO',
  }));

  Footer.init(footer.querySelector('#production-tabs') as HTMLElement, content);
  await Promise.all([
    renderSourcesPanel(ingress, () => wireSourceNodes(ingress)).then(() => wireSourceNodes(ingress)),
    buildDestinations(openEditorForTwist),
  ]);
  initDestSelector();
  // Bottom-right UTC clock; the seconds-dots open the production schedule.
  initClock(showSchedule);
  // User control: the role badge (top-right) + login/rights overlays. Default Captain.
  initAuthPanel();
  // The "1990s VIEW" launcher — the Minesweeper-styled router crosspoint grid.
  initRouterView();
  // Remaining LCARS chrome. Order: log button (top of sources) → filter (below it)
  // → portals pool (kept last) → mission bar + edge pulse (body-level).
  initCaptainsLog();
  initSourceFilter();
  initPortals();
  initMission();
  initLcarsPulse();
}

buildConsole().catch((e: unknown) => {
  document.body.innerHTML = `<pre style="color:#ff6a6a">console boot failed: ${String(e)}</pre>`;
});
