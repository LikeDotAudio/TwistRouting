// src/editors/registry — auto-registration (M2).
//
// Every `src/editors/<name>/index.ts` default-exports one EditorPlugin. The glob
// collects them at build time — so adding an editor is "drop a folder", with ZERO
// edits here or in app boot (contrast: the legacy main.js hand-listed 14 imports).
//
// Dispatch is first-match-wins. Order is `plugin.order` (lower wins, default 100)
// then path — so overlapping regexes (signal vs signaling, light vs on-air,
// comm vs intercom) resolve deterministically and faithfully to the legacy
// import order, with no central list. The dispatch test locks this down.

import type { EditorPlugin } from './types.js';

const modules = import.meta.glob<{ default: EditorPlugin }>('./*/index.ts', { eager: true });

const ORDER_DEFAULT = 100;

export const PLUGINS: EditorPlugin[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k]!.default)
  .filter((p): p is EditorPlugin => !!p && typeof p.match === 'function')
  .sort((a, b) => (a.order ?? ORDER_DEFAULT) - (b.order ?? ORDER_DEFAULT));

/** The editor that handles a twist name, or null for the generic matrix fallback. */
export function pluginFor(twistName: string): EditorPlugin | null {
  return PLUGINS.find((p) => p.match(twistName)) ?? null;
}
