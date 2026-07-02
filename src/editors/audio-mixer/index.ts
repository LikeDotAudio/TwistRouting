// src/editors/audio-mixer — the AUDIO MIXER · CONSOLE editor package.
//
// Port of js/editors/audio-mixer.js into the A.8 side build. Self-contained:
// declares its own match/title/requiredCaps and renders from the typed context
// only (no DOM scraping, no window globals — cross-editor calls go through
// ctx.services.openStageBox).

import type { EditorPlugin } from '../types.js';
import { injectAudioMixerStyles } from './styles.js';
import { renderConsole } from './view.js';

const plugin: EditorPlugin = {
  id: 'audio-mixer',
  title: 'MONITOR CONSOLE · AUDIO',
  order: 4,
  match: (n) => /audio\s*mix|monitor\s*console/i.test(n),
  requiredCaps: ['audio'],
  render(host, ctx) {
    injectAudioMixerStyles();
    renderConsole(host, ctx);
  },
};

export default plugin;
