// js/util/mono-emoji.js — pick a MONOCHROME glyph for a title bar from its text.
// We deliberately use Unicode symbol glyphs (not colour-emoji codepoints) and add
// the text-presentation selector (U+FE0E) so nothing renders as a colour emoji.
const VS_TEXT = '︎';   // request monochrome/text rendering

const RULES = [
    [/portal/i,                         '◎'],
    [/\bifb\b|earpiece|foldback|headphone/i, '🎧'],   // talent foldback = headphones
    [/aud(io)?\s*monitor|monitor.*aud|\bspeaker\b/i, '🕪'],  // audio monitor = speaker
    [/intercom|talkback|comms?/i,       '☎'],
    [/sound|audio|mic|mix|sfx/i,        '♪'],
    [/multiview|monitor|wall|mv\b/i,    '▦'],
    [/vision|switch|cut|me\b|m\/e/i,    '◈'],
    [/record|iso|capture|ingest/i,      '⏺'],
    [/\bplay\b|playlist|clip|vtr/i,     '▶'],   // the PLAY super-pool only
    [/cam|camera|video|vid/i,           '■'],
    // Containers of feeds — floors, stageboxes AND playout/player pools — share
    // the box-grid icon so the PLAY lists read like the VIDEO lists.
    [/floor|stage|box|room|playout|player/i, '▤'],
    [/prod|program|control|gallery|studio/i, '◆'],
    [/portal/i,                         '◎'],
];

// Return a leading monochrome glyph + a hair space for the given label.
export function monoEmoji(label) {
    const s = String(label || '');
    for (const [re, glyph] of RULES) if (re.test(s)) return glyph + VS_TEXT + ' ';
    return '▸' + VS_TEXT + ' ';   // generic title-bar marker
}

// Prefix a label with its monochrome glyph (idempotent-ish: skips if already led
// by one of our glyphs).
export function withMonoEmoji(label) {
    const s = String(label || '');
    if (/^[◎☎◍♪▦◈⏺▶■▤◆▸]/.test(s.trim())) return s;
    return monoEmoji(s) + s;
}
