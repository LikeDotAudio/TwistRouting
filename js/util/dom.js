// js/util/dom.js — small DOM/string helpers shared across renderers.
// Phase-1 extraction: faultTag and the id-slug regex were duplicated across
// poolVideo.js / poolAudio.js / productions.js. Globals for now; ES-module later.

// LCARS fault badge markup for a pool/program header (empty when not faulted).
function faultTag(status) {
    return isFaultStatus(status) ? `<span class="fault-tag">⚠ ${status}</span>` : '';
}

// Sanitise an arbitrary label into a DOM-id-safe slug (collapses runs of
// non-alphanumerics to a single dash).
function slugId(s) {
    return String(s == null ? '' : s).replace(/[^a-zA-Z0-9]+/g, '-');
}
