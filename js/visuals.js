import { isFaultStatus } from './globals.js';
export function getDNAHtml(cycles, width, colors) {
    let svgContent = '';
    const amplitude = 35;
    const freq = (cycles * 2 * Math.PI) / (width - 20);
    
    const numColors = colors.length;
    let gradientStops = '';
    colors.forEach((c, i) => {
        const percent = (i / (numColors > 1 ? numColors - 1 : 1)) * 100;
        gradientStops += `<stop offset="${percent}%" stop-color="${c}" />`;
    });
    const gradientId = 'dna-grad-' + Math.random().toString(36).substr(2,9);
    
    svgContent += `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">${gradientStops}</linearGradient></defs>`;
    
    // Rungs (base pairs)
    const numRungs = cycles * 8;
    for (let i = 0; i <= numRungs; i++) {
        const x = 10 + (i / numRungs) * (width - 20);
        const y1 = 50 + amplitude * Math.sin(freq * (x - 10));
        const y2 = 50 + amplitude * Math.sin(freq * (x - 10) + Math.PI);
        
        const opacity = 0.3 + (Math.sin(freq * (x - 10)) + 1) * 0.2;
        const rungColor = colors[i % numColors];
        svgContent += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${rungColor}" stroke-opacity="${opacity}" stroke-width="2.5" />`;
        svgContent += `<circle cx="${x}" cy="${y1}" r="2" fill="${rungColor}" opacity="0.6" />`;
        svgContent += `<circle cx="${x}" cy="${y2}" r="2" fill="${rungColor}" opacity="0.6" />`;
    }
    
    // Strands (backbones)
    let d1 = `M 10,50 `;
    let d2 = `M 10,50 `;
    
    const steps = cycles * 20;
    for (let i = 1; i <= steps; i++) {
        const x = 10 + (i / steps) * (width - 20);
        const y1 = 50 + amplitude * Math.sin(freq * (x - 10));
        const y2 = 50 + amplitude * Math.sin(freq * (x - 10) + Math.PI);
        d1 += `L ${x},${y1} `;
        d2 += `L ${x},${y2} `;
    }
    
    svgContent += `<path class="strand strand-1-glow" d="${d1}" fill="none" stroke="url(#${gradientId})" stroke-width="8" opacity="0.5" style="filter: blur(3px);" />`;
    svgContent += `<path class="strand strand-1" d="${d1}" fill="none" stroke="url(#${gradientId})" stroke-width="4" />`;
    svgContent += `<path class="strand strand-1-core" d="${d1}" fill="none" stroke="#fff" stroke-width="1.5" stroke-opacity="0.8" />`;
    
    svgContent += `<path class="strand strand-2-glow" d="${d2}" fill="none" stroke="url(#${gradientId})" stroke-width="8" opacity="0.3" style="filter: blur(3px);" />`;
    svgContent += `<path class="strand strand-2" d="${d2}" fill="none" stroke="url(#${gradientId})" stroke-width="4" stroke-opacity="0.8" />`;
    svgContent += `<path class="strand strand-2-core" d="${d2}" fill="none" stroke="#fff" stroke-width="1.5" stroke-opacity="0.6" />`;
    
    return svgContent;
}

export function updateTwistVisuals(twist) {
    const dropZone = twist.querySelector('.drop-zone');
    if (!dropZone) return;
    
    // Count leaf sources (incl. those tucked inside a dropped group chip), but
    // not the group wrapper itself.
    const swimmers = dropZone.querySelectorAll('.signal-node:not(.dropped-group)');
    const totalCount = swimmers.length;
    let videoCount = 0;
    let audioCount = 0;
    
    swimmers.forEach(s => {
        if (s.classList.contains('video')) videoCount++;
        if (s.classList.contains('audio')) audioCount++;
    });
    
    let statsEl = twist.querySelector('.twist-stats');
    if (!statsEl) {
        statsEl = document.createElement('div');
        statsEl.className = 'twist-stats';
        twist.querySelector('.twist-title').after(statsEl);
    }
    // Only show a summary once sources exist; styling/position come from CSS.
    statsEl.innerText = totalCount > 0 ? `SOURCES: ${totalCount} [V:${videoCount} | A:${audioCount}]` : '';

    // Hide the "NO SWIMMERS ASSIGNED" placeholder box once sources are attached.
    const placeholderBox = twist.querySelector('.matrix-container');
    if (placeholderBox) placeholderBox.style.display = totalCount > 0 ? 'none' : '';

    const svg = twist.querySelector('svg');
    const isMonitor = twist.classList.contains('monitor-twist');

    if (totalCount === 0) {
        // Empty: stay compact and collapse the helix.
        if (!isMonitor) {
            twist.style.minWidth = '200px';
            twist.style.width = '';
        }
        if (svg) {
            svg.innerHTML = '';
            svg.style.height = '0';
            svg.style.marginTop = '0';
        }
        return;
    }

    // Filled: fill the available horizontal space with a fixed-width strand and
    // pack one cycle per source, so more sources = higher frequency (doubling the
    // sources doubles the frequency) rather than ever-widening the twist.
    const cycles = totalCount;
    let width;
    if (isMonitor) {
        // Monitors keep their flex 1/3 width; size the helix to their own box.
        width = Math.max(120, Math.floor(twist.clientWidth) - 40);
    } else {
        const avail = (twist.parentElement && twist.parentElement.clientWidth) || 600;
        width = Math.max(320, Math.floor(avail) - 90); // leave room for the LCARS spine
        twist.style.minWidth = `${width}px`;
        twist.style.width = `${width}px`;
    }

    if (svg) {
        // Folded via the right lip: keep the strand collapsed even with sources.
        if (twist.classList.contains('helix-folded')) {
            svg.innerHTML = '';
            svg.style.height = '0';
            svg.style.marginTop = '0';
            return;
        }

        svg.setAttribute('viewBox', `0 0 ${width} 100`);

        // If any routed source is faulted, the strand goes red and "corrupted".
        const corrupted = Array.from(swimmers).some(s => isFaultStatus(s.dataset.status));
        twist.classList.toggle('corrupted', corrupted);

        let sourceColors = [];
        swimmers.forEach(s => {
            sourceColors.push(corrupted ? '#ff3b3b' : window.getComputedStyle(s).color);
        });

        svg.innerHTML = getDNAHtml(cycles, width, sourceColors);
        svg.style.height = isMonitor ? '55px' : '100px';
        svg.style.marginTop = isMonitor ? '6px' : '10px';
    }
}

// Toggle the DNA strand folded/unfolded when the twist's right lip is clicked.
export function toggleHelix(event, lip) {
    event.stopPropagation();
    const twist = lip.closest('.twist-container');
    if (!twist) return;
    twist.classList.toggle('helix-folded');
    updateTwistVisuals(twist);
}

// Inline onclick="toggleHelix(...)" in twist markup resolves against window.
window.toggleHelix = toggleHelix;
