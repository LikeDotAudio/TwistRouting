// src/ui/sources/format — small string/colour helpers for the ingress panel.
// Faithful ports of js/util/{dom,color,mono-emoji}.js so the ported pools build
// byte-identical labels, ids and tints (the LCARS CSS is shared, class-for-class).
import { isFaultStatus } from '../../domain/routing-core/index.js';

/** Sanitise a label into a DOM-id-safe slug (runs of non-alphanumerics → one dash). */
export function slugId(s: string | null | undefined): string {
  return String(s == null ? '' : s).replace(/[^a-zA-Z0-9]+/g, '-');
}

/** Strip the backend-only ordering prefix ("001_") — used for sort, never shown. */
export function stripOrder(name: string | null | undefined): string {
  return String(name == null ? '' : name).replace(/^\d{3,}_/, '');
}

/** LCARS fault badge markup for a header (empty when not faulted). */
export function faultTag(status: string | undefined): string {
  return isFaultStatus(status) ? `<span class="fault-tag">⚠ ${status}</span>` : '';
}

/** Shift a #rrggbb colour's lightness by amt (-100..100) for per-node variation. */
export function shadeColor(hex: string, amt: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m || !m[1]) return hex;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const f = amt / 100;
  const adj = (c: number): number => Math.max(0, Math.min(255, Math.round(c + (f < 0 ? c : 255 - c) * f)));
  return '#' + ((adj(r) << 16) | (adj(g) << 8) | adj(b)).toString(16).padStart(6, '0');
}

/** Apply the standard LCARS signal-node tint (border + text + soft glow). */
export function styleSignalNode(node: HTMLElement, color: string): void {
  node.style.borderColor = color;
  node.style.color = color;
  node.style.boxShadow = `0 0 5px ${color}55`;
}

const VS_TEXT = '︎'; // request monochrome/text rendering
const RULES: Array<[RegExp, string]> = [
  [/portal/i, '◎'],
  [/\bifb\b|earpiece|foldback|headphone/i, '🎧'],
  [/aud(io)?\s*monitor|monitor.*aud|\bspeaker\b/i, '🕪'],
  [/intercom|talkback|comms?/i, '☎'],
  [/multi ?view|monitor|video ?wall|\bmv\b/i, '▦'],
  [/vision|switch|video ?mix|\bcut\b|\bme\b|m\/e/i, '◈'],
  [/sound|audio|mic|\bmix(er)?\b|sfx/i, '♪'],
  [/record|iso|capture|ingest/i, '⏺'],
  [/\bplay\b|playlist|clip|vtr/i, '▶'],
  [/cam|camera|video|vid/i, '■'],
  [/floor|stage|box|room|playout|player/i, '▤'],
  [/prod|program|control|gallery|studio/i, '◆'],
];

/** Return a leading monochrome glyph + hair space for the given label. */
export function monoEmoji(label: string | null | undefined): string {
  const s = String(label || '');
  for (const [re, glyph] of RULES) if (re.test(s)) return glyph + VS_TEXT + ' ';
  return '▸' + VS_TEXT + ' ';
}
