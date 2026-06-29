// src/editors/ifb — Audio IFB (Interruptible Foldback) editor. Tied to the
// intercom: the talent's earpiece receives a MIX-MINUS (program minus their own
// mic) and an IFB INTERRUPT (the director's talk). A Ducker drops the program by
// the Interrupt Depth while a Talk key is held. Talk keys follow the interrupt
// hierarchy P1 Director · P2 Technical Director · P3 Production Assistant.
//
// Legacy renderGridOfSiblings → ui/grid `gridCells` + EditorContext.siblings,
// one full IFB strip per same-kind sibling twist (no DOM scraping).

import type { EditorPlugin } from '../types.js';
import { gridCells } from '../../ui/grid.js';
import { injectIfbStyles } from './styles.js';
import { buildOne } from './view.js';

const plugin: EditorPlugin = {
  id: 'ifb',
  title: 'IFB · INTERRUPTIBLE FOLDBACK',
  order: 8,
  match: (n) => /\bifb\b|foldback/i.test(n),
  requiredCaps: ['comms'],
  render(host, ctx) {
    injectIfbStyles();
    const cells = gridCells(host, ctx.siblings.length);
    ctx.siblings.forEach((sib, i) => {
      const cell = cells[i];
      if (cell) buildOne(cell, sib, ctx.dispose);
    });
  },
};

export default plugin;
