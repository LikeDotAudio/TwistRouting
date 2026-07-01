// src/ui/palette — the LCARS colour palettes, ported from js/util/palette.js.
import type { Hex } from '../model/index.js';

/** Per-audio-pool / per-group fill palette (also used for source sub-group colour). */
export const AUDIO_POOL_COLORS: Hex[] = [
  '#FF9C00', '#3786FF', '#87EEFF', '#D45F10', '#A89B35',
  '#97587B', '#46616E', '#C19880', '#C2B74B', '#0A46EE',
];

/** LCARS spine colours handed to each top-level source super-pool, by order. */
export const SOURCE_POOL_COLORS: Hex[] = ['#CC99CC', '#FF9C63', '#646DCC', '#3FC1C9', '#C67825', '#78A05A'];

/** Distinct colours for destination tabs. */
export const DEST_TAB_COLORS: Hex[] = ['#9C6B9C', '#3786FF', '#5CB8C4', '#D45F10', '#C2B74B', '#97587B', '#46A06E', '#C19880'];

/** Destination category group colours, as "r,g,b" strings (footer group spines). */
export const DEST_GROUP_COLORS: string[] = ['100,109,204', '160,110,180', '255,51,102', '63,193,201', '198,120,37', '120,160,90'];

/** Pick from a "r,g,b" string palette by index, wrapping. */
export function rgbAt(palette: string[], i: number): string {
  return palette[((i % palette.length) + palette.length) % palette.length] ?? '255,170,0';
}

/** Pick from a palette by index, wrapping, with a guaranteed non-undefined result. */
export function paletteAt(palette: Hex[], i: number): Hex {
  return palette[((i % palette.length) + palette.length) % palette.length] ?? '#646DCC';
}
