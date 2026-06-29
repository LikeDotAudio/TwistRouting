// src/editors/encoder/state — constant ladders + the data-in derivation that
// replaces the legacy DOM-scraping gatherTyped(twist).
//
// Legacy gatherTyped() walked the twist's .drop-zone for .signal-node elements,
// splitting them into .video / .audio by CSS class. The new model carries no
// per-feed media type on Feed, so we split ctx.sources by a label heuristic and
// fall back (sources → twist.config.inputs → default) exactly like the legacy
// channelsFor pattern. Videos drive STREAMS (each gets its own ABR ladder);
// audio feeds become the embedded tracks.

import type { EditorContext } from '../types.js';

export interface Rendition {
  name: string;
  ar: string;
  kbps: number;
  codec: string;
}

export const RENDITIONS: readonly Rendition[] = [
  { name: '2160p', ar: '16:9', kbps: 16000, codec: 'HEVC' },
  { name: '1080p', ar: '16:9', kbps: 6000, codec: 'H.264' },
  { name: '720p', ar: '16:9', kbps: 3000, codec: 'H.264' },
  { name: '480p', ar: '16:9', kbps: 1200, codec: 'H.264' },
  { name: '1080×1920', ar: '9:16', kbps: 4500, codec: 'H.264' },
  { name: '1080²', ar: '1:1', kbps: 3500, codec: 'H.264' },
];

export const DESTS: readonly string[] = [
  'Main-CDN-Primary',
  'YouTube Live',
  'Twitch',
  'Facebook Live',
  'Backup-CDN-SRT',
];

export interface Track {
  n: string;
  t: string;
}

export const AUDIO: readonly Track[] = [
  { n: 'Program', t: 'EN' },
  { n: 'Language 2', t: 'ES' },
  { n: 'Language 3', t: 'FR' },
  { n: 'Music & Effects', t: 'M&E' },
];

export interface Stream {
  label: string;
  color: string;
}

// Heuristic stand-in for the legacy .video/.audio class split (Feed carries no
// media type). Labels that look like audio routes become embedded tracks.
const AUDIO_RE = /\b(aud(io)?|mic|m\s*&\s*e|m&e|comms?|intercom|talkback)\b/i;

export function deriveFeeds(ctx: EditorContext): { streams: Stream[]; tracks: Track[] } {
  const sources = ctx.sources;
  let vids: Stream[] = sources
    .filter((s) => !AUDIO_RE.test(s.label))
    .map((s) => ({ label: s.label, color: s.color }));
  const auds = sources.filter((s) => AUDIO_RE.test(s.label));

  if (!vids.length) {
    const inputs = ctx.twist.config?.inputs;
    if (inputs && inputs.length) vids = inputs.map((label) => ({ label, color: '#6FC8F0' }));
  }

  const streams: Stream[] = vids.length ? vids : [{ label: '(no video routed)', color: '#7e93b5' }];
  const tracks: Track[] = auds.length
    ? auds.map((a, i) => ({ n: a.label, t: i === 0 ? 'PGM' : 'A' + (i + 1) }))
    : AUDIO.map((a) => ({ n: a.n, t: a.t }));

  return { streams, tracks };
}
