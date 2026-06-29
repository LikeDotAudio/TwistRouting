// src/app/main.ts — boot + composition root of the A.8 side build.
//
// Discovers the SHARED Routes/ data, lists every production's twists, and opens
// the dispatched editor in the LCARS overlay with a fully-resolved EditorContext
// (data-in, M3). No DOM scraping, no window globals — everything flows through
// typed modules: discovery → registry → context → overlay → plugin.render.

import { listDirectory, fetchJSON } from '../platform/discovery.js';
import { pluginFor, PLUGINS } from '../editors/registry.js';
import { isFaultStatus } from '../domain/routing-core/index.js';
import { openOverlay } from '../platform/overlay.js';
import { buildContext } from './context.js';
import type { EditorServices } from '../editors/types.js';
import type { Production, TwistConfig, Hex } from '../model/index.js';
import { el } from '../ui/dom.js';

const ROOT = 'Routes/Destinations/';

const twistName = (t: string | TwistConfig): string => (typeof t === 'string' ? t : t.name);

async function loadProductions(): Promise<Production[]> {
  const groups = await listDirectory(ROOT);
  const prods: Production[] = [];
  for (const group of groups.dirs) {
    const groupUrl = ROOT + group.href;
    const inner = await listDirectory(groupUrl);
    // Productions can be one level deep (Edit Suites/Encoders) or two (Control Rooms/Floors).
    const fileDirs = inner.files.length ? [{ url: groupUrl, files: inner.files }] : [];
    for (const sub of inner.dirs) {
      const subUrl = groupUrl + sub.href;
      fileDirs.push({ url: subUrl, files: (await listDirectory(subUrl)).files });
    }
    for (const fd of fileDirs) {
      for (const f of fd.files) {
        const p = await fetchJSON<Production>(fd.url + f.href);
        if (p) prods.push(p);
      }
    }
  }
  return prods;
}

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

/** Open the editor that handles a twist, resolving its context first. */
function openTwist(prod: Production, twist: string | TwistConfig): void {
  const name = twistName(twist);
  const plugin = pluginFor(name);
  if (!plugin) return;
  const color = (prod.color ?? '#646DCC') as Hex;
  openOverlay(
    { title: `${prod.name} · ${plugin.title}`, color, prodName: prod.name, twistName: name },
    (body, dispose) => {
      // Editor-level gating (M6): refuse to render if the role lacks a required cap.
      const ctx = buildContext(prod, twist, dispose, services);
      const blocked = (plugin.requiredCaps ?? []).find((c) => !ctx.can(c));
      if (blocked) {
        body.innerHTML = `<div class="ed-h">ACCESS DENIED — requires "${blocked}"</div>`;
        return;
      }
      plugin.render(body, ctx);
    },
  );
}

function render(prods: Production[]): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <header><h1>TwistRouting · <small>A.8 side build</small></h1>
      <p>${prods.length} productions · ${countDispatched(prods)} twists routed to a dedicated editor
      · ${PLUGINS.length}/13 editors ported · click a twist to open it</p>
    </header>`;
  for (const p of prods) {
    const section = el('section', { class: 'prod', style: `--c:${p.color ?? '#646DCC'}` });
    section.append(el('h2', { textContent: p.name + (isFaultStatus(p.status) ? ' ⚠' : '') }));
    const list = el('ul');
    for (const t of p.twists ?? []) {
      const name = twistName(t);
      const plugin = pluginFor(name);
      const li = el('li');
      if (plugin) {
        const link = el('a', {
          href: '#',
          class: 'ed',
          textContent: `${name} → ${plugin.title}`,
          style: 'cursor:pointer;text-decoration:none',
        });
        link.addEventListener('click', (e) => {
          e.preventDefault();
          openTwist(p, t);
        });
        li.append(link);
      } else {
        li.append(el('span', { textContent: name }), el('span', { class: 'fallback', textContent: ' → matrix fallback' }));
      }
      list.append(li);
    }
    section.append(list);
    app.append(section);
  }
}

function countDispatched(prods: Production[]): number {
  let n = 0;
  for (const p of prods) for (const t of p.twists ?? []) if (pluginFor(twistName(t))) n++;
  return n;
}

loadProductions().then(render).catch((e: unknown) => {
  const app = document.getElementById('app');
  if (app) app.innerHTML = `<pre style="color:#ff6a6a">boot failed: ${String(e)}</pre>`;
});
