// Fold a production output open (showing its feeds) accordion-style: opening one
// closes the others, so only one production output is expanded at a time.
function toggleProdOutput(node) {
    const children = node.querySelector('.multiplex-children');
    if (!children) return;
    const willOpen = children.style.display === 'none';
    document.querySelectorAll('.prod-source .multiplex-children').forEach(ch => {
        if (ch !== children) ch.style.display = 'none';
    });
    children.style.display = willOpen ? 'flex' : 'none';
}

function makeNodeDraggable(node) {
    node.draggable = true;
    if (!node.id) node.id = 'swimmer-' + Math.random().toString(36).substr(2, 9);
    // Idempotent: lazily-rendered pools call initializeDraggables() again, so skip
    // nodes already wired (otherwise listeners would stack and double-fire).
    if (node.dataset.dragWired) return;
    node.dataset.dragWired = '1';

    const isProdOutput = node.classList.contains('prod-source') && node.classList.contains('multiplex');
    let holdTimer;

    // Studio-style multiplexes still use hold-to-expand; production outputs fold
    // on a plain click (handled below), like the pool headers.
    if (node.classList.contains('multiplex') && !isProdOutput) {
        const startHold = (e) => {
            // Don't toggle when the press is on a child sub-stream (it bubbles up);
            // that would collapse the group while a source is being dragged out.
            if (e.target.closest('.multiplex-children')) return;
            e.stopPropagation();
            holdTimer = setTimeout(() => {
                const children = node.querySelector('.multiplex-children');
                if (children) {
                    children.style.display = children.style.display === 'none' ? 'flex' : 'none';
                }
            }, 400);
        };

        const clearHold = () => clearTimeout(holdTimer);

        node.addEventListener('mousedown', startHold);
        node.addEventListener('touchstart', startHold, {passive: true});

        node.addEventListener('mouseup', clearHold);
        node.addEventListener('mouseleave', clearHold);
        node.addEventListener('touchend', clearHold);
        node.addEventListener('touchcancel', clearHold);
        node.addEventListener('touchmove', clearHold);
    }

    node.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isProdOutput) {
            toggleProdOutput(node);
            return;
        }
        if (e.ctrlKey || e.metaKey) {
            if (selectedPoolNodes.has(node)) {
                selectedPoolNodes.delete(node);
                node.classList.remove('selected');
            } else {
                selectedPoolNodes.add(node);
                node.classList.add('selected');
            }
        } else if (e.shiftKey && lastClickedNode) {
            const allNodes = Array.from(document.querySelectorAll('.input-group .signal-node'));
            const start = allNodes.indexOf(lastClickedNode);
            const end = allNodes.indexOf(node);
            const min = Math.min(start, end);
            const max = Math.max(start, end);
            for(let i = min; i <= max; i++) {
                selectedPoolNodes.add(allNodes[i]);
                allNodes[i].classList.add('selected');
            }
        } else {
            selectedPoolNodes.forEach(n => n.classList.remove('selected'));
            selectedPoolNodes.clear();
            selectedPoolNodes.add(node);
            node.classList.add('selected');
        }
        lastClickedNode = node;
    });
    
    node.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        if (holdTimer) clearTimeout(holdTimer);
        if (!selectedPoolNodes.has(node)) {
            selectedPoolNodes.forEach(n => n.classList.remove('selected'));
            selectedPoolNodes.clear();
            selectedPoolNodes.add(node);
            node.classList.add('selected');
        }
        
        const ids = Array.from(selectedPoolNodes).map(n => n.id).join(',');
        e.dataTransfer.setData('text/plain', ids);
        e.dataTransfer.setData('source-type', 'pool');
        e.dataTransfer.effectAllowed = 'copy';
        
        selectedPoolNodes.forEach(n => {
            setTimeout(() => { n.style.opacity = '0.5'; }, 0);
        });
    });
    
    node.addEventListener('dragend', () => {
        selectedPoolNodes.forEach(n => {
            n.style.opacity = '1';
            n.classList.remove('selected');
        });
        selectedPoolNodes.clear();
    });
}

function initializeDraggables() {
    document.querySelectorAll('.input-group .signal-node').forEach(node => {
        makeNodeDraggable(node);
    });
    
    document.querySelectorAll('.foldable-header').forEach(header => {
        header.draggable = true;
        header.style.cursor = 'grab';
        if (header.dataset.dragWired) return;   // idempotent across lazy re-renders
        header.dataset.dragWired = '1';
        header.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            const content = header.nextElementSibling;
            if (!content) return;
            
            const nodes = Array.from(content.querySelectorAll('.signal-node')).filter(n => !n.classList.contains('sub-stream') && !n.classList.contains('multiplex-children'));
            const ids = nodes.map(n => n.id).filter(id => id).join(',');
            
            if (ids) {
                e.dataTransfer.setData('text/plain', ids);
                e.dataTransfer.setData('source-type', 'pool');
                e.dataTransfer.effectAllowed = 'copy';
                
                nodes.forEach(n => {
                    setTimeout(() => { n.style.opacity = '0.5'; }, 0);
                });
            } else {
                e.preventDefault();
            }
        });
        
        header.addEventListener('dragend', (e) => {
            const content = header.nextElementSibling;
            if (!content) return;
            const nodes = Array.from(content.querySelectorAll('.signal-node'));
            nodes.forEach(n => {
                n.style.opacity = '1';
                n.classList.remove('selected');
            });
        });
    });
}
