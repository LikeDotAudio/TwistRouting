// src/editors/lighting — the studio LIGHTING (DMX) console plugin.
//
// Opens on a floor's lighting destination: a three/four-point rig plus set
// lighting, each an LED fixture with intensity + colour temperature, controlled
// live over DMX from one pane. Self-contained plugin (match + title + caps +
// render); reads only the typed EditorContext.

import type { EditorPlugin } from '../types.js';
import { renderLighting } from './view.js';

const plugin: EditorPlugin = {
  id: 'lighting',
  title: 'LIGHTING · DMX CONSOLE',
  order: 12,
  // Keep the negative on-air guard so SIGNALING handles on-air lights.
  match: (n) =>
    /\blight(ing)?\b|key light|fill light|back light|cyc|gobo|\bdmx\b|fixture/i.test(n) &&
    !/on.?air/i.test(n),
  requiredCaps: ['shade'],
  render: renderLighting,
};

export default plugin;
