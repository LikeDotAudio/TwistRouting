// src/ui/sources/interact — source-node interactivity, ported from js/dragDrop.js
// (the expand + drag half of makeNodeDraggable). Studio multiplex/gang boxes
// spill their sub-feeds on PRESS-AND-HOLD (400ms), matching the live app; a
// dragstart carries the routed feed ids so the destination matrix can accept the
// drop (the drop side lands with the console layout in the next phase).
//
// Idempotent: lazily-rendered subtrees call wireSourceNodes() again, so already-
// wired nodes are skipped (no stacked listeners).

const HOLD_MS = 400;

/** The current multi-selection (Ctrl/Shift-click), mirrors legacy selectedPoolNodes. */
const selected = new Set<HTMLElement>();

function clearSelection(): void {
  selected.forEach((n) => n.classList.remove('selected'));
  selected.clear();
}

/** Wire ONE source node for hold-to-expand + drag (idempotent). */
export function wireSourceNode(node: HTMLElement): void {
  if (node.dataset.dragWired) return;
  node.dataset.dragWired = '1';
  node.draggable = true;

  const isProdOutput = node.classList.contains('prod-source') && node.classList.contains('multiplex');
  let holdTimer: ReturnType<typeof setTimeout> | undefined;

  // Studio-style multiplexes: hold-to-expand. Production outputs fold on click.
  if (node.classList.contains('multiplex') && !isProdOutput) {
    const ownKids = (): HTMLElement | null => node.querySelector<HTMLElement>(':scope > .multiplex-children');
    const startHold = (e: Event): void => {
      const kids = ownKids();
      // Ignore presses landing inside THIS box's own children (dragging a sub-feed
      // out, or a nested camera that handles its own hold).
      if (kids && e.target instanceof Node && kids.contains(e.target)) return;
      e.stopPropagation();
      holdTimer = setTimeout(() => {
        const children = ownKids();
        if (!children) return;
        const opening = children.style.display === 'none';
        // Gang accordion: only ONE cell open per grid — collapse the others.
        if (opening && node.classList.contains('gang-cell')) {
          const grid = node.closest('.gang-grid');
          if (grid) grid.querySelectorAll<HTMLElement>(':scope > .gang-cell.expanded').forEach((c) => {
            if (c === node) return;
            c.classList.remove('expanded');
            const ck = c.querySelector<HTMLElement>(':scope > .multiplex-children');
            if (ck) ck.style.display = 'none';
          });
        }
        children.style.display = opening ? 'flex' : 'none';
        if (node.classList.contains('gang-cell')) node.classList.toggle('expanded', opening);
      }, HOLD_MS);
    };
    const clearHold = (): void => { if (holdTimer) clearTimeout(holdTimer); };
    node.addEventListener('mousedown', startHold);
    node.addEventListener('touchstart', startHold, { passive: true });
    node.addEventListener('mouseup', clearHold);
    node.addEventListener('mouseleave', clearHold);
    node.addEventListener('touchend', clearHold);
    node.addEventListener('touchcancel', clearHold);
    node.addEventListener('touchmove', clearHold);
  }

  node.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isProdOutput) {
      const children = node.querySelector<HTMLElement>('.multiplex-children');
      if (!children) return;
      const willOpen = children.style.display === 'none';
      document.querySelectorAll<HTMLElement>('.prod-source .multiplex-children').forEach((ch) => {
        if (ch !== children) ch.style.display = 'none';
      });
      children.style.display = willOpen ? 'flex' : 'none';
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (selected.has(node)) { selected.delete(node); node.classList.remove('selected'); }
      else { selected.add(node); node.classList.add('selected'); }
    } else {
      clearSelection();
      selected.add(node);
      node.classList.add('selected');
    }
  });

  node.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    if (holdTimer) clearTimeout(holdTimer);
    if (!selected.has(node)) { clearSelection(); selected.add(node); node.classList.add('selected'); }
    const ids = Array.from(selected).map((n) => n.id).filter(Boolean).join(',');
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', ids);
      e.dataTransfer.setData('source-type', 'pool');
      e.dataTransfer.effectAllowed = 'copy';
    }
  });
}

/** Wire every source node under `root` (idempotent). Call after each render. */
export function wireSourceNodes(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.input-group .signal-node').forEach(wireSourceNode);
}
