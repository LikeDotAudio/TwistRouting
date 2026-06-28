// js/core/state.js — the app's shared mutable state, centralized.
// ES modules forbid reassigning an imported binding, so the values that get
// reassigned across files (currentTwist, drag-source refs, lastClickedNode) live
// as properties of a single mutable `state` object. `selectedPoolNodes` is a Set
// whose *contents* mutate (never reassigned), so it stays a plain exported const.

export const selectedPoolNodes = new Set();

export const state = {
    lastClickedNode: null,   // pool multi-select anchor (dragDrop.js)
    currentTwist: null,      // twist whose modal is open (matrix.js)
    matrixDragSrcEl: null,   // row being reordered in the switcher modal
    inputDragSrcEl: null,    // switcher-input label being reassigned
};
