// src/editors/graphics-engine — the Graphics Engine editor (AR.4.7 upstream tool).
//
// Fills the L0 gap the Graphics-Engine-Audit calls out: there was a `gfx`
// capability + Tactical role but no editor. This is the ENGINE (not the renderer)
// — the four-layer authoring/data/control/preview surface (audit §1) that would
// drive a headless-Chromium fill+key renderer. One plugin serves three twists,
// adapting by name (see modeFor): GRAPHICS PRESETS · TITLE EDITOR · GRAPHIC EDITOR.
//
// Templates + starter catalog live in templates.ts; the title-safe preview stage
// with IN/UPDATE/NEXT/OUT lifecycle in preview.ts; the rail/fields/transport UI
// in view.ts. Gated to `gfx` (Tactical / admin).

import type { EditorPlugin } from '../types.js';
import { injectGraphicsStyles } from './styles.js';
import { buildEngine } from './view.js';

const plugin: EditorPlugin = {
  id: 'graphics-engine',
  title: 'GRAPHICS ENGINE · CG / TITLE',
  order: 6,
  match: (n) => /graphic|\bgfx\b|\bcg\b|title|lower.?third|name.?super|chyron|aston|preset/i.test(n),
  requiredCaps: ['gfx'],
  render(host, ctx) {
    injectGraphicsStyles();
    buildEngine(host, ctx);
  },
};

export default plugin;
