// src/editors/stagebox-input/state — the mic library, stand table, per-panel
// state shape, and the data-in channel resolution (ctx.sources → config.inputs →
// fallback prefix+N) that replaces the legacy DOM-scraping gatherSources/channelsFor.

import type { Feed } from '../../domain/routing-core/index.js';
import type { TwistConfig } from '../../model/index.js';

export interface Mic {
  name: string;
  type: string;
  gain: readonly [number, number];
  imp: number;
  ribbon: boolean;
  hpf: number;
  sens: number;
}

export const MICS: readonly Mic[] = [
  { name: 'Sennheiser MKH 416', type: 'Shotgun', gain: [30, 60], imp: 25, ribbon: false, hpf: 80, sens: -32 },
  { name: 'Shure SM7B', type: 'Dynamic', gain: [50, 70], imp: 150, ribbon: false, hpf: 50, sens: -59 },
  { name: 'Royer R-121', type: 'Ribbon', gain: [45, 70], imp: 300, ribbon: true, hpf: 40, sens: -50 },
  { name: 'DPA 4061', type: 'Lavalier', gain: [25, 55], imp: 30, ribbon: false, hpf: 100, sens: -44 },
  { name: 'Neumann U87', type: 'Condenser', gain: [15, 50], imp: 200, ribbon: false, hpf: 60, sens: -38 },
];

export const STANDS: Record<string, number> = { 'Boom Arm': 70, 'Floor Tripod': 110, 'Desk Mount': 90, 'Hand-Held': 60 };

/** Per-channel preamp/meter state — the legacy `s` object, one per panel. */
export interface PanelState {
  gain: number;
  hpf: number;
  pan: number;
  phantom: boolean;
  conf: boolean;
  mic: number;
  stand: string;
  cable: number;
  level: number;
  target: number;
  peak: number;
}

export function initState(): PanelState {
  return { gain: 0.5, hpf: 0.3, pan: 0.5, phantom: false, conf: false, mic: 0, stand: 'Boom Arm', cable: 15, level: 0.3, target: 0.4, peak: 0.3 };
}

/** A resolved input channel for the stage box (label is what the panel renders). */
export interface Channel {
  label: string;
  color: string;
}

/**
 * Data-in channel list (M3): routed feeds first, then the twist config's declared
 * inputs, then a synthetic prefix+N fallback — mirroring the legacy channelsFor.
 */
export function resolveChannels(sources: ReadonlyArray<Feed>, config: TwistConfig | null): Channel[] {
  if (sources.length) return sources.map((f) => ({ label: f.label, color: f.color }));
  if (config && Array.isArray(config.inputs) && config.inputs.length) {
    return config.inputs.map((i) => ({ label: i, color: '#4d94ff' }));
  }
  return Array.from({ length: 8 }, (_, i) => ({ label: `CH ${i + 1}`, color: '#4d94ff' }));
}
