// src/ui/console/matrix — the crosspoint: routing a dragged source into a twist's
// drop-zone. Port of the drop half of js/matrix.js (initializeTwists +
// enforceTwistLimits + buildDroppedGroup). A source node carries a comma id-list
// (set by ui/sources/interact.ts); dropping expands multiplex boxes to their
// accepted sub-feeds, groups same-origin feeds into a collapsible chip, and
// enforces the twist's video/audio/input caps (newest replaces oldest).
import type { TwistConfig } from '../../model/index.js';
import { updateTwistVisuals, toggleHelix } from './helix.js';
import { addStyles } from '../dom.js';
import { getBus } from '../../platform/mqtt/index.js';
import { twistTopic } from '../../platform/mqtt/topics.js';

/** Project a twist's current routed set onto its retained crosspoints topic (audit §4). */
export function publishCrosspoints(twist: HTMLElement): void {
  const bus = getBus();
  if (!bus.status().enabled) return;
  const prod = twist.dataset.prodName ?? '';
  const name = (twist.querySelector('.twist-title')?.textContent ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (!prod || !name) return;
  const dz = twist.querySelector('.drop-zone');
  const sources = dz
    ? [...dz.querySelectorAll<HTMLElement>(':scope > .signal-node')].map((n) => (n.textContent ?? '').trim().split('\n')[0] ?? '').filter(Boolean)
    : [];
  bus.publishValue(`${twistTopic(prod, name)}/crosspoints`, sources);
}

/** Open-editor callback so a twist click dispatches to the ported editor layer. */
export type OpenEditor = (twist: HTMLElement) => void;

// ---- crosspoints: number each routed feed 1..N (add order) + drag-to-reorder ---
const XP_CSS = `
.drop-zone{position:relative;}
.drop-zone > .signal-node{position:relative;}
.drop-zone > .signal-node::before{content:attr(data-xp);position:absolute;top:-7px;left:-7px;min-width:15px;height:15px;
    box-sizing:border-box;border-radius:8px;background:#6FC8F0;color:#04121f;font:bold 9px sans-serif;
    display:flex;align-items:center;justify-content:center;padding:0 3px;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.55);pointer-events:none;}
.drop-zone > .signal-node[draggable=true]{cursor:grab;}
.drop-zone > .signal-node.xp-drag{opacity:.5;}
`;
let draggingXp: HTMLElement | null = null;

/** Number every crosspoint (drop-zone child) 1..N in add (DOM) order. */
export function renumberCrosspoints(dz: HTMLElement): void {
  dz.querySelectorAll<HTMLElement>(':scope > .signal-node').forEach((n, i) => { n.dataset.xp = String(i + 1); });
}

/** Which sibling the dragged crosspoint should be inserted before (flex-wrap aware). */
function xpInsertBefore(dz: HTMLElement, x: number, y: number): HTMLElement | null {
  const els = [...dz.querySelectorAll<HTMLElement>(':scope > .signal-node')].filter((e) => e !== draggingXp);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (y < r.top + r.height / 2) return el;                       // pointer above this row
    if (y < r.bottom && x < r.left + r.width / 2) return el;       // same row, left of centre
  }
  return null;
}

function makeCrosspointDraggable(node: HTMLElement): void {
  node.draggable = true;
  if (node.dataset.xpWired) return;
  node.dataset.xpWired = '1';
  node.addEventListener('dragstart', (e) => {
    draggingXp = node; node.classList.add('xp-drag'); e.stopPropagation();
    if (e.dataTransfer) { e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move'; }
  });
  node.addEventListener('dragend', () => {
    node.classList.remove('xp-drag'); draggingXp = null;
    const dz = node.parentElement; if (dz) renumberCrosspoints(dz);
  });
}

/** Wire a drop-zone to reorder its own crosspoints (idempotent). External source
 *  drops (draggingXp === null) fall through untouched to the twist's drop handler. */
function wireDropZoneReorder(dz: HTMLElement): void {
  if (dz.dataset.reorderWired) return;
  dz.dataset.reorderWired = '1';
  dz.addEventListener('dragover', (e) => {
    if (!draggingXp || draggingXp.parentElement !== dz) return;
    e.preventDefault(); e.stopPropagation();
    const before = xpInsertBefore(dz, e.clientX, e.clientY);
    if (before) dz.insertBefore(draggingXp, before); else dz.appendChild(draggingXp);
  });
  dz.addEventListener('drop', (e) => {
    if (!draggingXp || draggingXp.parentElement !== dz) return;
    e.preventDefault(); e.stopPropagation();
    renumberCrosspoints(dz);
    const twist = dz.closest<HTMLElement>('.twist-container');
    if (twist) { updateTwistVisuals(twist); publishCrosspoints(twist); }
  });
}

/** Finalise a drop-zone after routing: style, number, and make crosspoints reorderable. */
export function refreshCrosspoints(dz: HTMLElement): void {
  addStyles('crosspoint-styles', XP_CSS);
  dz.querySelectorAll<HTMLElement>(':scope > .signal-node').forEach(makeCrosspointDraggable);
  wireDropZoneReorder(dz);
  renumberCrosspoints(dz);
}

function parseConfig(twist: HTMLElement): TwistConfig | null {
  if (twist.dataset.config) { try { return JSON.parse(twist.dataset.config) as TwistConfig; } catch { /* ignore */ } }
  return null;
}

export function enforceTwistLimits(dropZone: HTMLElement, config: TwistConfig | null, child: HTMLElement): void {
  if (!config) return;
  const isVideo = child.classList.contains('video');
  const isAudio = child.classList.contains('audio');
  if (config.maxVideo && isVideo) {
    const ex = dropZone.querySelectorAll<HTMLElement>('.signal-node.video');
    for (let k = 0; k < ex.length - (config.maxVideo - 1); k++) ex[k]?.remove();
  }
  if (config.maxAudio && isAudio) {
    const ex = dropZone.querySelectorAll<HTMLElement>('.signal-node.audio');
    for (let k = 0; k < ex.length - (config.maxAudio - 1); k++) ex[k]?.remove();
  }
  if (Array.isArray(config.inputs) && config.inputs.length) {
    const cap = config.inputs.length;
    const ex = dropZone.querySelectorAll<HTMLElement>(':scope > .signal-node');
    for (let k = 0; k < ex.length - (cap - 1); k++) ex[k]?.remove();
  }
}

let grpSeq = 0;
const rid = (): string => (grpSeq++).toString(36) + '-' + (Date.now() % 1e6).toString(36);

export function buildDroppedGroup(groupName: string, groupColor: string, sourceNodes: HTMLElement[], parentLabel: string): HTMLElement {
  const group = document.createElement('div');
  group.className = 'signal-node dropped-group';
  group.style.borderColor = groupColor;
  group.style.color = groupColor;
  group.id = 'grp-' + rid();
  group.draggable = true;
  const head = document.createElement('div');
  head.className = 'dropped-group-header';
  if (parentLabel) {
    const cap = document.createElement('span');
    cap.className = 'dg-parent';
    cap.textContent = parentLabel;
    head.appendChild(cap);
    head.appendChild(document.createTextNode(`${groupName} ×${sourceNodes.length}`));
  } else {
    head.innerText = `${groupName} ×${sourceNodes.length}`;
  }
  const kids = document.createElement('div');
  kids.className = 'dropped-group-children';
  kids.style.display = 'none';
  sourceNodes.forEach((src) => {
    const c = src.cloneNode(true) as HTMLElement;
    c.id = src.id + '-' + rid();
    c.classList.remove('sub-stream', 'selected');
    c.style.opacity = '1';
    c.draggable = true;
    kids.appendChild(c);
  });
  group.appendChild(head);
  group.appendChild(kids);
  group.addEventListener('click', (e) => {
    e.stopPropagation();
    kids.style.display = kids.style.display === 'none' ? 'flex' : 'none';
  });
  return group;
}

/** Place a clone of one source node into a twist's drop-zone (accepts/limits honoured).
 *  Returns true if placed. Used by the 1990s router-view to make a crosspoint. */
export function placeSourceInTwist(twist: HTMLElement, node: HTMLElement): boolean {
  if (!twist || !node) return false;
  const config = parseConfig(twist);
  const isVideo = node.classList.contains('video');
  const isAudio = node.classList.contains('audio');
  if (config && config.accepts === 'video' && !isVideo) return false;
  if (config && config.accepts === 'audio' && !isAudio) return false;
  const dropZone = ensureDropZone(twist);
  const clone = node.cloneNode(true) as HTMLElement;
  clone.id = node.id + '-' + rid();
  clone.classList.remove('selected');
  clone.style.opacity = '1';
  clone.draggable = false;
  enforceTwistLimits(dropZone, config, clone);
  dropZone.appendChild(clone);
  refreshCrosspoints(dropZone);   // number 1..N + make reorderable
  publishCrosspoints(twist);
  return true;
}

const acceptsFor = (config: TwistConfig | null) => (el: HTMLElement): boolean => {
  if (!config || !config.accepts) return true;
  if (config.accepts === 'video') return el.classList.contains('video');
  if (config.accepts === 'audio') return el.classList.contains('audio') || el.classList.contains('control');
  if (config.accepts === 'camera') return el.classList.contains('video') || el.classList.contains('camera-control');
  return true;
};

function ensureDropZone(twist: HTMLElement): HTMLElement {
  let dz = twist.querySelector<HTMLElement>('.drop-zone');
  if (!dz) {
    dz = document.createElement('div');
    dz.className = 'drop-zone';
    dz.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;width:100%;justify-content:center;';
    twist.appendChild(dz);
  }
  return dz;
}

/** Wire every twist in `root` for drag-over highlight, drop-routing, and click-to-open. */
export function initializeTwists(root: ParentNode, onOpenEditor?: OpenEditor): void {
  root.querySelectorAll<HTMLElement>('.twist-container').forEach((twist) => {
    if (twist.dataset.initialized) return;
    twist.dataset.initialized = 'true';
    twist.style.cursor = 'pointer';
    updateTwistVisuals(twist);   // collapse the empty strand to start

    // The right lip / foldbar folds the DNA strand away.
    twist.querySelectorAll<HTMLElement>('.twist-lip, .twist-foldbar').forEach((lip) => {
      lip.addEventListener('click', (e) => toggleHelix(e, lip));
    });

    twist.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.signal-node, .twist-lip, .twist-foldbar')) return;
      onOpenEditor?.(twist);
    });
    twist.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      twist.style.borderColor = 'var(--magenta)';
      twist.style.boxShadow = 'var(--glow-magenta)';
    });
    twist.addEventListener('dragleave', () => { twist.style.borderColor = ''; twist.style.boxShadow = ''; });

    twist.addEventListener('drop', (e) => {
      e.preventDefault();
      twist.style.borderColor = '';
      twist.style.boxShadow = '';
      const idsStr = e.dataTransfer?.getData('text/plain') ?? '';
      const sourceType = e.dataTransfer?.getData('source-type') ?? '';
      if (!idsStr) return;
      const ids = idsStr.split(',');
      const config = parseConfig(twist);
      const dropZone = ensureDropZone(twist);
      const accepts = acceptsFor(config);
      const appendWithLimit = (child: HTMLElement): void => { enforceTwistLimits(dropZone, config, child); dropZone.appendChild(child); };

      const plain: HTMLElement[] = [];
      ids.forEach((id) => {
        const node = document.getElementById(id);
        if (!node) return;
        if (sourceType !== 'pool') { if (accepts(node)) appendWithLimit(node); return; }
        if (node.classList.contains('multiplex')) {
          const accepted = Array.from(node.querySelectorAll<HTMLElement>('.sub-stream')).filter(accepts);
          // Split the stage box's audio CONTROL (preamp) out of the channel group so
          // it lands as its OWN visible crosspoint (not hidden inside the collapsed chip).
          const controls = accepted.filter((n) => n.classList.contains('control'));
          const feeds = accepted.filter((n) => !n.classList.contains('control'));
          if (feeds.length) {
            const headerEl = node.querySelector<HTMLElement>('.multiplex-header');
            const groupName = headerEl ? headerEl.innerText : (node.dataset.origin || node.id);
            const parentCap = (node.dataset.origin || '').split(' — ').map((s) => s.trim()).filter(Boolean).join(' · ');
            dropZone.appendChild(buildDroppedGroup(groupName, getComputedStyle(node).color, feeds, parentCap));
          }
          controls.forEach((ctrlNode) => {
            const clone = ctrlNode.cloneNode(true) as HTMLElement;
            clone.id = ctrlNode.id + '-' + rid();
            clone.classList.remove('selected'); clone.style.opacity = '1'; clone.draggable = true;
            appendWithLimit(clone);
          });
        } else if (accepts(node)) plain.push(node);
      });

      // Group same-origin plain sources under one labelled chip.
      const byOrigin = new Map<string, HTMLElement[]>();
      plain.forEach((n) => { const key = n.dataset.origin || ''; if (!byOrigin.has(key)) byOrigin.set(key, []); byOrigin.get(key)?.push(n); });
      byOrigin.forEach((nodes, origin) => {
        const parts = String(origin || '').split(' — ').map((s) => s.trim()).filter(Boolean);
        const boxName = parts[parts.length - 1] || origin;
        const parentCap = parts.slice(0, -1).join(' · ');
        const first = nodes[0];
        if (origin && nodes.length >= 2 && first) {
          dropZone.appendChild(buildDroppedGroup(boxName, getComputedStyle(first).color, nodes, parentCap));
        } else {
          nodes.forEach((n) => {
            const clone = n.cloneNode(true) as HTMLElement;
            clone.id = n.id + '-' + rid();
            clone.classList.remove('selected');
            clone.style.opacity = '1';
            clone.draggable = true;
            appendWithLimit(clone);
          });
        }
      });

      // Redraw the DNA strand for the new routed set, then a brief confirm flash.
      updateTwistVisuals(twist);
      refreshCrosspoints(dropZone);   // number 1..N + make reorderable
      publishCrosspoints(twist);
      const originalBg = twist.style.backgroundColor;
      twist.style.backgroundColor = 'rgba(255, 0, 255, 0.2)';
      setTimeout(() => { twist.style.backgroundColor = originalBg; }, 300);
    });
  });
}
