// js/util/palette.js — all LCARS colour palettes in one place.
// Phase-1 extraction: these were scattered across poolAudio.js (AUDIO_POOL_COLORS,
// reached cross-file by sources.js), sources.js (SOURCE_POOL_COLORS) and app.js
// (DEST_TAB_COLORS / DEST_GROUP_COLORS). Globals for now; ES-module exports later.

// Per-audio-pool / per-group fill palette (also used for source sub-group colour).
export const AUDIO_POOL_COLORS = [
    '#FF9C00', // amber
    '#3786FF', // azure
    '#87EEFF', // cyan
    '#D45F10', // deep orange
    '#A89B35', // olive
    '#97587B', // plum
    '#46616E', // slate
    '#C19880', // mauve
    '#C2B74B', // gold
    '#0A46EE'  // deep blue
];

// LCARS spine colours handed to each top-level source super-pool, by order.
export const SOURCE_POOL_COLORS = ['#CC99CC', '#FF9C63', '#646DCC', '#3FC1C9', '#C67825', '#78A05A'];

// Distinct colours for destination tabs (each tab's tab + content L-bar match).
export const DEST_TAB_COLORS = ['#9C6B9C', '#3786FF', '#5CB8C4', '#D45F10', '#C2B74B', '#97587B', '#46A06E', '#C19880'];

// Destination category group colours, as "r,g,b" strings (TopBar group spines).
export const DEST_GROUP_COLORS = ['100,109,204', '160,110,180', '255,51,102', '63,193,201', '198,120,37', '120,160,90'];
