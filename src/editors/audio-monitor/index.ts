// src/editors/audio-monitor — a broadcast Audio Monitor (confidence monitor).
//
// Faithful port of js/editors/audio-monitor.js. Scales from 1 to 24 channels in
// SDI Quad-Blocks (groups of 4) with PPM/VU ballistic meters + peak-hold + true-
// peak warning, CUE/MUTE local bus, per-block phase correlation + Lissajous, and
// a master section with volume, MUTE/DIM, downmix and ITU-R BS.1770 loudness.
//
// Where the legacy render() called renderGridOfSiblings to tile every sibling
// monitor, this uses ctx.siblings + ui/grid.ts gridCells — data-in, no scraping.

import type { EditorPlugin, Sibling } from '../types.js';
import { gridCells } from '../../ui/grid.js';
import { injectAudioMonitorStyles } from './styles.js';
import { buildOne } from './view.js';

const plugin: EditorPlugin = {
  id: 'audio-monitor',
  title: 'AUDIO MONITOR · CONFIDENCE',
  order: 7,
  match: (n) => /audio\s*monitor|\bmonitor\b.*audio|\bAFV\b|confidence/i.test(n),
  requiredCaps: ['audio'],
  render(host, ctx) {
    injectAudioMonitorStyles();
    // ctx.siblings includes self; fall back to this twist if the host left it empty.
    const panels: Sibling[] = ctx.siblings.length
      ? [...ctx.siblings]
      : [{ name: ctx.twist.name, config: ctx.twist.config, sources: ctx.sources }];
    const cells = gridCells(host, panels.length);
    panels.forEach((panel, i) => {
      const cell = cells[i];
      if (cell) buildOne(cell, panel, ctx.dispose);
    });
  },
};

export default plugin;
