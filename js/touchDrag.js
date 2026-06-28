// js/touchDrag.js
// Touch-panel drag-and-drop. Native HTML5 drag events (dragstart/dragover/drop)
// never fire on a touchscreen, so a finger gesture does nothing — which is why a
// whole stage box can't be dragged onto an Intercom/Audio Mixer on a touch panel.
//
// This bridges the gap: it watches finger gestures and SYNTHESISES the very same
// drag events the app already handles for the mouse, carrying a shared
// DataTransfer. The existing dragstart handler fills it (ids + source-type) and
// the existing drop handlers read it — so every drop target keeps working,
// untouched, now with a finger. Mouse and pen keep using native DnD as before.
(function () {
    'use strict';
    if (!('ontouchstart' in window) && !(navigator.maxTouchPoints > 0)) return;

    const THRESHOLD = 8;   // px of travel before a press becomes a drag (vs a tap)
    let src = null, dt = null, ghost = null, ghDX = 0, ghDY = 0;
    let lastTarget = null, pressed = null, startX = 0, startY = 0, dragging = false;

    // Nearest ancestor the app marked draggable (a pool node or a pool header).
    function draggableFrom(el) {
        while (el && el !== document.body) {
            if (el.getAttribute && el.getAttribute('draggable') === 'true') return el;
            el = el.parentElement;
        }
        return null;
    }

    function fire(type, x, y, target) {
        if (!target) return null;
        const ev = new DragEvent(type, {
            bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, dataTransfer: dt,
        });
        // Some engines drop dataTransfer on synthetic DragEvents — pin it back on.
        try { Object.defineProperty(ev, 'dataTransfer', { configurable: true, get: () => dt }); } catch (e) {}
        target.dispatchEvent(ev);
        return ev;
    }

    // What's under the finger (hide the ghost so it isn't picked instead).
    function under(x, y) {
        const prev = ghost && ghost.style.display;
        if (ghost) ghost.style.display = 'none';
        const el = document.elementFromPoint(x, y);
        if (ghost) ghost.style.display = prev || '';
        return el;
    }

    function onStart(e) {
        if (e.touches.length !== 1) return;
        const el = draggableFrom(e.target);
        if (!el) return;
        pressed = el;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        dragging = false;
    }

    function beginDrag(t) {
        dragging = true;
        src = pressed;
        dt = new DataTransfer();
        // The app's own dragstart handler populates dt (text/plain ids, source-type).
        fire('dragstart', t.clientX, t.clientY, src);

        const r = src.getBoundingClientRect();
        ghost = src.cloneNode(true);
        ghost.removeAttribute('id');
        Object.assign(ghost.style, {
            position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px',
            height: r.height + 'px', margin: '0', pointerEvents: 'none', opacity: '0.9',
            zIndex: '99999', transform: 'scale(1.05)', boxShadow: '0 8px 24px rgba(0,0,0,.55)',
        });
        document.body.appendChild(ghost);
        ghDX = r.left - t.clientX;
        ghDY = r.top - t.clientY;
    }

    function onMove(e) {
        if (!pressed) return;
        const t = e.touches[0];
        if (!dragging) {
            if (Math.hypot(t.clientX - startX, t.clientY - startY) < THRESHOLD) return;
            beginDrag(t);
        }
        e.preventDefault();   // a drag owns the gesture — don't scroll the panel
        const x = t.clientX, y = t.clientY;
        if (ghost) { ghost.style.left = (x + ghDX) + 'px'; ghost.style.top = (y + ghDY) + 'px'; }

        const target = under(x, y);
        if (target !== lastTarget) {
            if (lastTarget) fire('dragleave', x, y, lastTarget);
            if (target) fire('dragenter', x, y, target);
            lastTarget = target;
        }
        if (target) fire('dragover', x, y, target);
    }

    function onEnd(e) {
        if (dragging) {
            const t = (e.changedTouches && e.changedTouches[0]) || {};
            const x = t.clientX, y = t.clientY;
            const target = under(x, y);
            if (target) fire('drop', x, y, target);
            if (src) fire('dragend', x, y, src);
        }
        cleanup();
    }

    function cleanup() {
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        ghost = src = dt = lastTarget = pressed = null;
        dragging = false;
    }

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', cleanup);
})();
