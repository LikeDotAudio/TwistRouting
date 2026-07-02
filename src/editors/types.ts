// src/editors/types — the ONE contract every editor implements (M2 + M3 + M6).
//
// Editors are pure plugins: they receive a typed EditorContext (already-resolved
// data — NO DOM scraping, unlike the legacy render(body, twist, config)) and a
// host element to render into. They declare their own dispatch match, title, and
// required capabilities. No editor imports another; cross-editor needs (e.g.
// openStageBox) arrive as typed services on the context, never as window globals.

import type { Capability, Hex, TwistConfig } from '../model/index.js';
import type { Feed } from '../domain/routing-core/index.js';
import type { Disposer } from '../ui/timers.js';
import type { ParamSpec } from '../platform/mqtt/types.js';

/** A sibling twist of the same kind in this production (used by grid editors). */
export interface Sibling {
  name: string;
  config: TwistConfig | null;
  sources: Feed[];
}

/** Everything an editor needs, as data — resolved by the host, not scraped. */
export interface EditorContext {
  /** This twist's display name and parsed config. */
  twist: { name: string; config: TwistConfig | null };
  /** Feeds routed into this twist (groups already expanded). */
  sources: Feed[];
  production: { name: string; color: Hex };
  /** Same-kind siblings in this production (includes this twist), for grid editors. */
  siblings: ReadonlyArray<Sibling>;
  /** Role gate — true if the current operator holds the capability. */
  can(cap: Capability): boolean;
  /** Typed cross-editor service (replaces window.openStageBox). */
  services: EditorServices;
  /** Lifecycle bag — register intervals/rAF so the host disposes them on close. */
  dispose: Disposer;
}

export interface EditorServices {
  openStageBox(name: string, color: Hex, channels: string[]): void;
  // MQTT param bridge (audit §4.5). Optional: the host binds these to THIS twist's
  // topic when a bus exists; absent when MQTT is disabled, so editors call them
  // with `?.`. An editor never learns the topic — it names params, the host scopes.
  /** One-time: advertise the parameter schema this editor exposes for the twist. */
  advertiseParams?(params: ParamSpec[]): void;
  /** Publish a live parameter value (throttled by default — safe for drag/meter loops). */
  publishParam?(name: string, value: unknown, opts?: { throttle?: boolean }): void;
  /** Subscribe to a parameter (backend echoes / other consoles). Returns an unsubscribe. */
  onParam?(name: string, cb: (value: unknown) => void): () => void;
}

export type EditorRender = (host: HTMLElement, ctx: EditorContext) => void;

/** A self-contained editor package's manifest — its single export. */
export interface EditorPlugin {
  id: string;
  /** Does this editor handle a twist with the given name? */
  match(twistName: string): boolean;
  title: string;
  /**
   * Dispatch precedence for overlapping regexes (lower wins; default 100).
   * Preserves the legacy import-order semantics (G8) without a central list:
   * an editor that must beat another for a shared name declares a lower order.
   */
  order?: number;
  /** Editor-level gating; the host hides the editor if unmet. */
  requiredCaps?: Capability[];
  render: EditorRender;
}
