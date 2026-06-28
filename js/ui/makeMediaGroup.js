// js/ui/makeMediaGroup.js — a collapsible "folder" group inside a super-pool.
// Returns the content element that its children should be appended into.
// Extracted from app.js so pools/sources can import it without an app cycle.
export function makeMediaGroup(container, title, color, depth) {
    const group = document.createElement('div');
    group.className = 'input-group media-group';

    const header = document.createElement('div');
    header.className = 'foldable-header media-group-header';
    header.style.cssText = `--lcars-color:${color}; background-color:${color}; font-size:11px; margin-bottom:6px; font-weight:bold; cursor:pointer; margin-left:${depth * 10}px;`;
    header.innerHTML = `<span>${title}</span><span class="fold-icon" style="transform:rotate(-90deg);display:inline-block;transition:transform .2s;">▼</span>`;

    const content = document.createElement('div');
    content.className = 'media-group-content';
    // A vertical bar in the group's colour runs down the left of the children
    // (which are pushed to the right), showing they belong to this group and
    // extending downward for the whole length of the expanded children.
    content.style.cssText = `display:none; margin:4px 0 12px ${depth * 12 + 12}px; padding:6px 0 6px 16px; border-left:4px solid ${color}; box-shadow:-1px 0 8px ${color}66; border-radius:0 0 0 8px;`;

    // Self-contained toggle (not the pool accordion) so nested folders fold
    // independently of the stage-box pools inside them.
    header.addEventListener('click', () => {
        const opening = content.style.display === 'none';
        content.style.display = opening ? '' : 'none';
        const icon = header.querySelector('.fold-icon');
        if (icon) icon.style.transform = opening ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    group.appendChild(header);
    group.appendChild(content);
    container.appendChild(group);
    return content;
}
