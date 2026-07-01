// src/ui/console/helix — the DNA strand a twist draws from its routed feeds.
// Port of js/visuals.js: one helix cycle per routed source (more sources → higher
// frequency, not a wider twist), coloured by each feed, going red + "corrupted"
// if any source is faulted. The right lip folds the strand away.
import { isFaultStatus } from '../../domain/routing-core/index.js';

let gradSeq = 0;

/** Build the SVG innards for a `cycles`-cycle double helix `width` px wide. */
export function getDNAHtml(cycles: number, width: number, colors: string[]): string {
  const amplitude = 35;
  const freq = (cycles * 2 * Math.PI) / (width - 20);
  const numColors = colors.length || 1;
  let gradientStops = '';
  colors.forEach((c, i) => {
    const percent = (i / (numColors > 1 ? numColors - 1 : 1)) * 100;
    gradientStops += `<stop offset="${percent}%" stop-color="${c}" />`;
  });
  const gradientId = 'dna-grad-' + (gradSeq++).toString(36);
  let svg = `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">${gradientStops}</linearGradient></defs>`;

  const numRungs = cycles * 8;
  for (let i = 0; i <= numRungs; i++) {
    const x = 10 + (i / numRungs) * (width - 20);
    const y1 = 50 + amplitude * Math.sin(freq * (x - 10));
    const y2 = 50 + amplitude * Math.sin(freq * (x - 10) + Math.PI);
    const opacity = 0.3 + (Math.sin(freq * (x - 10)) + 1) * 0.2;
    const rungColor = colors[i % numColors] ?? '#6FC8F0';
    svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${rungColor}" stroke-opacity="${opacity}" stroke-width="2.5" />`;
    svg += `<circle cx="${x}" cy="${y1}" r="2" fill="${rungColor}" opacity="0.6" />`;
    svg += `<circle cx="${x}" cy="${y2}" r="2" fill="${rungColor}" opacity="0.6" />`;
  }

  let d1 = `M 10,50 `, d2 = `M 10,50 `;
  const steps = cycles * 20;
  for (let i = 1; i <= steps; i++) {
    const x = 10 + (i / steps) * (width - 20);
    d1 += `L ${x},${50 + amplitude * Math.sin(freq * (x - 10))} `;
    d2 += `L ${x},${50 + amplitude * Math.sin(freq * (x - 10) + Math.PI)} `;
  }
  svg += `<path class="strand strand-1-glow" d="${d1}" fill="none" stroke="url(#${gradientId})" stroke-width="8" opacity="0.5" style="filter: blur(3px);" />`;
  svg += `<path class="strand strand-1" d="${d1}" fill="none" stroke="url(#${gradientId})" stroke-width="4" />`;
  svg += `<path class="strand strand-1-core" d="${d1}" fill="none" stroke="#fff" stroke-width="1.5" stroke-opacity="0.8" />`;
  svg += `<path class="strand strand-2-glow" d="${d2}" fill="none" stroke="url(#${gradientId})" stroke-width="8" opacity="0.3" style="filter: blur(3px);" />`;
  svg += `<path class="strand strand-2" d="${d2}" fill="none" stroke="url(#${gradientId})" stroke-width="4" stroke-opacity="0.8" />`;
  svg += `<path class="strand strand-2-core" d="${d2}" fill="none" stroke="#fff" stroke-width="1.5" stroke-opacity="0.6" />`;
  return svg;
}

export function updateTwistVisuals(twist: HTMLElement): void {
  const dropZone = twist.querySelector<HTMLElement>('.drop-zone');
  const svg = twist.querySelector<SVGSVGElement>('svg');
  const isMonitor = twist.classList.contains('monitor-twist');

  const swimmers = dropZone ? Array.from(dropZone.querySelectorAll<HTMLElement>('.signal-node:not(.dropped-group)')) : [];
  const totalCount = swimmers.length;
  let videoCount = 0, audioCount = 0;
  swimmers.forEach((s) => { if (s.classList.contains('video')) videoCount++; if (s.classList.contains('audio')) audioCount++; });

  let statsEl = twist.querySelector<HTMLElement>('.twist-stats');
  if (!statsEl) {
    statsEl = document.createElement('div');
    statsEl.className = 'twist-stats';
    twist.querySelector('.twist-title')?.after(statsEl);
  }
  statsEl.innerText = totalCount > 0 ? `SOURCES: ${totalCount} [V:${videoCount} | A:${audioCount}]` : '';

  const placeholderBox = twist.querySelector<HTMLElement>('.matrix-container');
  if (placeholderBox) placeholderBox.style.display = totalCount > 0 ? 'none' : '';

  if (totalCount === 0) {
    if (!isMonitor) { twist.style.minWidth = '200px'; twist.style.width = ''; }
    if (svg) { svg.innerHTML = ''; svg.style.height = '0'; svg.style.marginTop = '0'; }
    return;
  }

  const cycles = totalCount;
  let width: number;
  if (isMonitor) {
    width = Math.max(120, Math.floor(twist.clientWidth) - 40);
  } else {
    const avail = twist.parentElement?.clientWidth || 600;
    width = Math.max(320, Math.floor(avail) - 90);
    twist.style.minWidth = `${width}px`;
    twist.style.width = `${width}px`;
  }

  if (svg) {
    if (twist.classList.contains('helix-folded')) {
      svg.innerHTML = ''; svg.style.height = '0'; svg.style.marginTop = '0'; return;
    }
    svg.setAttribute('viewBox', `0 0 ${width} 100`);
    const corrupted = swimmers.some((s) => isFaultStatus(s.dataset.status));
    twist.classList.toggle('corrupted', corrupted);
    const sourceColors = swimmers.map((s) => (corrupted ? '#ff3b3b' : getComputedStyle(s).color));
    svg.innerHTML = getDNAHtml(cycles, width, sourceColors);
    svg.style.height = isMonitor ? '55px' : '100px';
    svg.style.marginTop = isMonitor ? '6px' : '10px';
  }
}

/** Fold/unfold the strand when the twist's right lip / foldbar is clicked. */
export function toggleHelix(event: Event, lip: HTMLElement): void {
  event.stopPropagation();
  const twist = lip.closest<HTMLElement>('.twist-container');
  if (!twist) return;
  twist.classList.toggle('helix-folded');
  updateTwistVisuals(twist);
}
