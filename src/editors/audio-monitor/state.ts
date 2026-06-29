// src/editors/audio-monitor/state — channel/master models + the channelsFor
// fallback (port of core.js channelsFor), now data-in from ctx.sources.

import type { TwistConfig } from '../../model/index.js';
import type { Feed } from '../../domain/routing-core/index.js';

/** Block format cycle shown on the per-group QUAD button. */
export const FORMATS = ['QUAD', '2× STEREO', '3.1 GROUP', '4× MONO'] as const;

/** A resolved channel descriptor (label + colour) before it becomes meter state. */
export interface Chan {
  label: string;
  color: string;
}

/** Per-channel ballistic-meter state. */
export interface ChState {
  label: string;
  color: string;
  level: number;
  target: number;
  peak: number;
  cue: boolean;
  mute: boolean;
  fmtPair: number;
}

/** Master/monitor-section state. */
export interface MasterState {
  master: number;
  mute: boolean;
  dim: boolean;
  downmix: boolean;
  lufs: number;
  tp: boolean;
}

/**
 * Channels for the monitor: real routed sources, else the twist's input slots,
 * else a sensible default count. Mirrors the legacy core.js channelsFor, but
 * driven by the resolved ctx data instead of scraping the DOM.
 */
export function channelsFor(
  sources: ReadonlyArray<Feed>,
  config: TwistConfig | null,
  fallbackPrefix: string,
  fallbackCount: number,
): Chan[] {
  if (sources.length) {
    return sources.map((s) => ({ label: s.label, color: s.color || '#39d353' }));
  }
  if (config && Array.isArray(config.inputs) && config.inputs.length) {
    return config.inputs.map((i) => ({ label: i, color: '#4d94ff' }));
  }
  return Array.from({ length: fallbackCount }, (_, i) => ({
    label: `${fallbackPrefix} ${i + 1}`,
    color: '#4d94ff',
  }));
}
