// src/editors/wysiwyg/state — the rig model + overlay state for the pre-viz.
//
// The legacy editor hard-coded a 6-light rig (FIX) and scraped nothing. Under the
// data-in contract (M3) we keep that canonical rig geometry but let the routed
// feeds (ctx.sources) drive each fixture's label and hue, so the pre-viz reflects
// what is actually patched without any DOM scraping.

import type { EditorContext } from '../types.js';

/** A virtual lighting fixture: normalized stage position, intensity, colour hue. */
export interface Fixture {
  k: string;
  x: number;
  y: number;
  on: number;
  hue: number;
}

/** Which overlays are drawn + the talent facing direction (0..1). */
export interface UiState {
  heat: boolean;
  beams: boolean;
  frustum: boolean;
  talentRot: number;
}

/** The canonical studio rig — KEY / FILL / BACK / BG / CYC / FX (verbatim positions). */
export const FIX: ReadonlyArray<Fixture> = [
  { k: 'KEY', x: 0.34, y: 0.3, on: 0.9, hue: 38 },
  { k: 'FILL', x: 0.66, y: 0.3, on: 0.5, hue: 210 },
  { k: 'BACK', x: 0.5, y: 0.14, on: 0.7, hue: 0 },
  { k: 'BG', x: 0.5, y: 0.86, on: 0.6, hue: 205 },
  { k: 'CYC', x: 0.14, y: 0.74, on: 0.55, hue: 195 },
  { k: 'FX', x: 0.86, y: 0.74, on: 0.5, hue: 275 },
];

/** Derive the HSL hue (0..360) from a `#rrggbb` / `#rgb` colour, or null if unparseable. */
function hueFromHex(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let s = m[1]!;
  if (s.length === 3) s = s[0]! + s[0]! + s[1]! + s[1]! + s[2]! + s[2]!;
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** A short, upper-case fixture tag from a feed label. */
function shortLabel(label: string): string {
  const t = label.trim().toUpperCase();
  return (t || '—').slice(0, 4);
}

/**
 * Build the working fixture rig: clones of the canonical FIX geometry, with the
 * first N fixtures re-labelled/re-tinted from the routed feeds. Faulted feeds are
 * dimmed. With no sources, the canonical named rig is used unchanged (the legacy
 * default look).
 */
export function buildFixtures(ctx: EditorContext): Fixture[] {
  const fx: Fixture[] = FIX.map((f) => ({ ...f }));
  const sources = ctx.sources;
  for (let i = 0; i < fx.length && i < sources.length; i++) {
    const feed = sources[i]!;
    const slot = fx[i]!;
    slot.k = shortLabel(feed.label);
    const hue = hueFromHex(feed.color);
    if (hue !== null) slot.hue = hue;
    if (feed.faulted) slot.on = Math.min(slot.on, 0.12);
  }
  return fx;
}
