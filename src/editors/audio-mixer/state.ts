// src/editors/audio-mixer/state — channel derivation for the console.
//
// The legacy editor SCRAPED routed audio out of the DOM (gatherGrouped / channelsFor).
// In the side build everything is resolved on the context, so we derive the channel
// list from ctx.sources, mirroring the legacy channelsFor fallback chain:
//   routed sources → config.inputs → prefix + N.

import type { EditorContext } from '../types.js';

/** One console channel strip's identity. */
export interface Channel {
  label: string;
  color: string;
}

/** Channels per layer (legacy LAYER constant). */
export const LAYER = 8;

const FALLBACK_COLOR = '#4d94ff';

/** Derive the console channels from resolved context (no DOM scraping). */
export function buildChannels(ctx: EditorContext): Channel[] {
  if (ctx.sources.length) {
    return ctx.sources.map((f) => ({ label: f.label, color: f.color }));
  }
  const inputs = ctx.twist.config?.inputs;
  if (inputs && inputs.length) {
    return inputs.map((label) => ({ label, color: FALLBACK_COLOR }));
  }
  return Array.from({ length: LAYER }, (_, i) => ({
    label: `CH ${i + 1}`,
    color: FALLBACK_COLOR,
  }));
}
