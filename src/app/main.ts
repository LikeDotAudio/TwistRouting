// src/app/main.ts — boot + composition root of the A.8 side build.
//
// Builds the LCARS routing console: the SOURCES ingress panel (left), the
// destination program content (centre), and the destinations tab FOOTER (bottom).
// Sources drag into destination twists (the crosspoint); clicking a twist opens
// its dispatched editor with a fully-resolved, typed EditorContext (data-in, M3).
// Composition root — the only layer allowed to wire ui + editors + platform.

import { pluginFor } from '../editors/registry.js';
import { openOverlay, slug } from '../platform/overlay.js';
import { buildContext } from './context.js';
import type { EditorServices } from '../editors/types.js';
import type { Production, TwistConfig, Hex } from '../model/index.js';
import { el } from '../ui/dom.js';
import { renderSourcesPanel } from '../ui/sources/panel.js';
import { wireSourceNodes } from '../ui/sources/interact.js';
import { Footer, loadAllDestinations } from '../ui/console/footer.js';
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
import { getBus, advertiseAll, startLogBridge } from '../platform/mqtt/index.js';
import { initMqttTree } from '../ui/console/mqtt-tree.js';
import { twistTopic, slug as topicSlug } from '../platform/mqtt/topics.js';
import { onRoleChange } from '../platform/auth.js';

// Release tag shown beside the credit byline (bottom-right footer chrome).
// TODO: package.json has no `version` field yet — track real releases here (or
// wire a JSON import / build-time define) once a release scheme is in place.
const APP_VERSION = 'v1.0.0';

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

/** Services scoped to one twist: the base services + a MQTT param bridge (audit §4.5)
 *  bound to THIS twist's topic (rooms/<prod>/twists/<twist>/params/<param>). */
function twistServices(prodDisplayName: string, twistName: string): EditorServices {
  const base = twistTopic(prodDisplayName, twistName);   // rooms/<prod>/twists/<twist>
  const bus = getBus();
  const paramTopic = (p: string): string => `${base}/params/${topicSlug(p)}`;
  return {
    ...services,
    advertiseParams(params) { bus.publishConfig(`${base}/config`, { kind: 'twist', name: twistName, params }); },
    publishParam(pname, value, opts) { bus.publishValue(paramTopic(pname), value, { throttle: opts?.throttle ?? true }); },
    onParam(pname, cb) { return bus.subscribe(paramTopic(pname), (_t, p) => cb((p as { value?: unknown } | null)?.value ?? p)); },
  };
}

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
  const twistSvc = twistServices(prodName, name);
  openOverlay(
    { title: prodName ? `${prodName} · ${plugin.title}` : plugin.title, color, prodName, twistName: name },
    (body, dispose) => {
      const ctx = buildContext(prod, twist, dispose, twistSvc);
      const blocked = (plugin.requiredCaps ?? []).find((c) => !ctx.can(c));
      if (blocked) { body.innerHTML = `<div class="ed-h">ACCESS DENIED — requires "${blocked}"</div>`; return; }
      plugin.render(body, ctx);
      applyScope(body);   // progressive disclosure: hide [data-cap] the role lacks
    },
  );
}

/** The clean twist name a twist element resolves to (matches overlay's deep-link hash). */
function twistCleanName(twistEl: HTMLElement): string {
  let name = (twistEl.querySelector('.twist-title')?.textContent ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (twistEl.dataset.config) {
    try { const c = JSON.parse(twistEl.dataset.config) as TwistConfig; if (c.name) name = c.name; } catch { /* keep title-derived */ }
  }
  return name;
}

/** Open the editor named by a #/<prod>/<twist> deep link (lazy-loads destinations if needed). */
function openFromHash(): void {
  if (document.querySelector('.ed-overlay.open')) return;   // already open
  const m = (location.hash || '').match(/^#\/([^/]+)\/([^/]+)$/);
  const prodSlug = m?.[1], twistSlug = m?.[2];
  if (!prodSlug || !twistSlug) return;
  const tryOpen = (): boolean => {
    const tw = [...document.querySelectorAll<HTMLElement>('.twist-container')].find(
      (t) => slug(t.dataset.prodName ?? '') === prodSlug && slug(twistCleanName(t)) === twistSlug);
    if (tw) { openEditorForTwist(tw); return true; }
    return false;
  };
  if (tryOpen()) return;
  loadAllDestinations();               // twists are lazy — render every tab, then retry
  setTimeout(tryOpen, 700);
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
    target: '_blank', rel: 'noopener',
  }, [
    'CREATED BY ANTHONY PETER KUZUB  -  WWW.LIKE.AUDIO',
    el('span', { class: 'app-version' }, [APP_VERSION]),
  ]));

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

  // MQTT projection (audit: docs/Audit /TWIST-MQTT-Advertising-Audit.md). No-op
  // unless a broker is configured via ?mqtt=<host> — the console runs unchanged
  // without one. Advertise the whole catalogue, bridge the Captain's Log, and
  // mirror the operator role; publish a final presence on unload.
  const bus = getBus();
  initMqttTree(bus);   // bottom-right chip (above the clock) → live topic tree + broker config
  startLogBridge(bus);
  onRoleChange((r) => bus.publishValue('system/role', { id: r.id, name: r.name, tier: r.tier }));
  void advertiseAll(bus);
  window.addEventListener('beforeunload', () => bus.dispose());
}

buildConsole().then(() => openFromHash()).catch((e: unknown) => {
  document.body.innerHTML = `<pre style="color:#ff6a6a">console boot failed: ${String(e)}</pre>`;
});
window.addEventListener('hashchange', openFromHash);
