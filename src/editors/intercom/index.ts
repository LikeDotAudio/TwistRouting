// src/editors/intercom — INTERCOM · KEY PANEL editor package (legacy
// js/editors/intercom.js). Single default export: the EditorPlugin manifest.

import type { EditorPlugin } from '../types.js';
import { renderIntercom } from './view.js';

const plugin: EditorPlugin = {
  id: 'intercom',
  title: 'INTERCOM · KEY PANEL',
  order: 5,
  match: (n) => /intercom|comm/i.test(n),
  requiredCaps: ['comms'],
  render(host, ctx) {
    renderIntercom(host, ctx);
  },
};

export default plugin;
