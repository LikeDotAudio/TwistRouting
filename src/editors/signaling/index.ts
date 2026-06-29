// src/editors/signaling — the control-room SIGNALING panel (port of
// js/editors/signaling.js). The vision mixer knows what's on Program; this
// surface distributes that as TALLY (red = PGM/on-air, green = PVW/next,
// amber = ISO/standby), drives the studio On-Air light, switches Live/Rehearsal,
// and is a "panel maker" of GPI/SCTE production triggers.
//
// M3: data-in only. The tally grid is driven from ctx.sources (the feeds routed
// into this twist) — never from DOM scraping — with the legacy channelsFor
// fallback chain preserved in state.camsFor.

import type { EditorPlugin } from '../types.js';
import { injectSignalingStyles } from './styles.js';
import { renderSignaling } from './view.js';

const plugin: EditorPlugin = {
  id: 'signaling',
  title: 'SIGNALING · TALLY & TRIGGERS',
  order: 11,
  match: (n) => /signal|\btally\b|on.?air/i.test(n),
  requiredCaps: ['signal'],
  render(host, ctx) {
    injectSignalingStyles();
    renderSignaling(host, ctx);
  },
};

export default plugin;
