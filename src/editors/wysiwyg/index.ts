// src/editors/wysiwyg — the studio WYSIWYG / Pre-Viz visualizer plugin.
//
// A top-down render of the rig that mirrors the DMX console (sACN/Art-Net): beam
// cones, a foot-candle heat map on the floor, virtual talent + ray-traced shadow,
// a camera frustum, and per-fixture tally glow. Self-contained EditorPlugin: the
// render() reads only the typed context and runs its 60fps loop via ctx.dispose.

import type { EditorPlugin } from '../types.js';
import { renderWysiwyg } from './view.js';

const plugin: EditorPlugin = {
  id: 'wysiwyg',
  title: 'WYSIWYG · STUDIO PRE-VIZ',
  order: 13,
  match: (n) => /wysiwyg|pre.?viz|visuali[sz]er/i.test(n),
  requiredCaps: ['shade'],
  render(host, ctx) {
    renderWysiwyg(host, ctx);
  },
};

export default plugin;
