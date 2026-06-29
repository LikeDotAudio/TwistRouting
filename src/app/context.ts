// src/app/context — resolve a twist into a typed EditorContext (M3).
//
// This is the inversion the strategy doc calls for: instead of handing an editor
// a live DOM node to scrape, the HOST resolves the routed feeds (and siblings,
// production, services, gating) into data and passes it. Editors become pure
// functions of data → UI.

import type { Production, TwistConfig, Hex } from '../model/index.js';
import type { EditorContext, EditorServices, Sibling } from '../editors/types.js';
import type { Feed } from '../domain/routing-core/index.js';
import { pluginFor } from '../editors/registry.js';
import { can } from '../platform/auth.js';
import type { Disposer } from '../ui/timers.js';

const twistName = (t: string | TwistConfig): string => (typeof t === 'string' ? t : t.name);
const twistConfig = (t: string | TwistConfig): TwistConfig | null => (typeof t === 'string' ? null : t);

/**
 * Resolve the feeds routed into a twist. The side build has no live crosspoint
 * matrix yet (P3 of the shell), so feeds are derived from the twist's configured
 * inputs — mirroring the legacy channelsFor() fallback chain: explicit inputs,
 * else a default slot count. When the real DnD matrix lands these come from the
 * routing-core graph instead, with zero editor changes.
 */
function resolveSources(config: TwistConfig | null, color: Hex): Feed[] {
  const inputs = config?.inputs;
  if (inputs && inputs.length) {
    return inputs.map((label, i) => ({ id: `${label}-${i}`, label, color }));
  }
  return [];
}

/** The same-kind siblings of a twist (those dispatching to the same editor). */
function resolveSiblings(prod: Production, selfName: string, color: Hex): Sibling[] {
  const selfPlugin = pluginFor(selfName);
  if (!selfPlugin) return [];
  const out: Sibling[] = [];
  for (const t of prod.twists ?? []) {
    const name = twistName(t);
    if (pluginFor(name)?.id !== selfPlugin.id) continue;
    const config = twistConfig(t);
    out.push({ name, config, sources: resolveSources(config, color) });
  }
  return out;
}

export function buildContext(
  prod: Production,
  twist: string | TwistConfig,
  dispose: Disposer,
  services: EditorServices,
): EditorContext {
  const name = twistName(twist);
  const config = twistConfig(twist);
  const color = (prod.color ?? '#646DCC') as Hex;
  return {
    twist: { name, config },
    sources: resolveSources(config, color),
    production: { name: prod.name, color },
    siblings: resolveSiblings(prod, name, color),
    can,
    services,
    dispose,
  };
}
