// src/editors/graphics-engine/templates — the DESIGN/TEMPLATE layer (audit §1 L1).
//
// A template = a reusable scene + a schema of named, empty fields (design is
// separated from data so one template serves thousands of on-air instances).
// Each kind ships a pure `render(values, reveal)` that builds the graphic DOM;
// the preview stage drives its IN/UPDATE/NEXT/OUT lifecycle (see preview.ts).
// All text sits inside title-safe (90%) — the stage paints the SMPTE guides.

import { el } from '../../ui/dom.js';

export type TemplateKind =
  | 'lower-third' | 'name-super' | 'up-next' | 'participant'
  | 'bug' | 'ticker' | 'fullscreen' | 'score';

export interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder?: string;
  default?: string;
}

export interface GfxTemplate {
  id: string;
  /** UPPERCASE name — matched (loosely) against routed source / input labels. */
  name: string;
  kind: TemplateKind;
  /** true ⇒ supports UPDATE-in-place (score/ticker) rather than a re-take. */
  updatable: boolean;
  /** true ⇒ multi-state; NEXT reveals the next row (lists). */
  stateful: boolean;
  fields: FieldSpec[];
}

export type Values = Record<string, string>;

const lines = (v: string | undefined): string[] =>
  (v ?? '').split('\n').map((s) => s.trim()).filter(Boolean);

// ---- The starter catalog (audit §8 G1) --------------------------------------

export const TEMPLATES: GfxTemplate[] = [
  {
    id: 'lower-third', name: 'LOWER THIRD', kind: 'lower-third', updatable: false, stateful: false,
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: 'ANTHONY KUZUB' },
      { key: 'title', label: 'Role / Title', type: 'text', default: 'SYSTEMS ARCHITECT' },
    ],
  },
  {
    id: 'name-super', name: 'NAME SUPER', kind: 'name-super', updatable: false, stateful: false,
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: 'JANE DOE' },
      { key: 'title', label: 'Title', type: 'text', default: 'CORRESPONDENT' },
      { key: 'locator', label: 'Location', type: 'text', default: 'TORONTO' },
    ],
  },
  {
    id: 'up-next', name: 'UP NEXT', kind: 'up-next', updatable: false, stateful: true,
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'COMING UP' },
      { key: 'items', label: 'Segments (one per line)', type: 'textarea',
        default: 'THE HEADLINES\nMARKET REPORT\nWEATHER\nSPORTS DESK' },
    ],
  },
  {
    id: 'participant', name: 'PARTICIPANT LIST', kind: 'participant', updatable: false, stateful: true,
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'ON THE PANEL' },
      { key: 'people', label: 'People — NAME | ROLE (one per line)', type: 'textarea',
        default: 'ANTHONY KUZUB | HOST\nJANE DOE | ANALYST\nSAM LEE | GUEST' },
    ],
  },
  {
    id: 'bug', name: 'BUG / DOG', kind: 'bug', updatable: false, stateful: false,
    fields: [
      { key: 'text', label: 'Channel / Brand', type: 'text', default: 'TWIST' },
      { key: 'sub', label: 'Sub-label', type: 'text', default: 'LIVE' },
    ],
  },
  {
    id: 'ticker', name: 'TICKER', kind: 'ticker', updatable: true, stateful: false,
    fields: [
      { key: 'tag', label: 'Tag', type: 'text', default: 'BREAKING' },
      { key: 'text', label: 'Crawl text', type: 'textarea',
        default: 'ROUTING MATRIX ONLINE  •  ALL STAGEBOXES LOCKED  •  PGM CLEAN  •  STANDBY FOR TAKE' },
    ],
  },
  {
    id: 'fullscreen', name: 'FULL-SCREEN TITLE', kind: 'fullscreen', updatable: false, stateful: false,
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'THE MORNING SHOW' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'WITH ANTHONY KUZUB' },
    ],
  },
  {
    id: 'score', name: 'SCORE BUG', kind: 'score', updatable: true, stateful: false,
    fields: [
      { key: 'home', label: 'Home', type: 'text', default: 'HOME' },
      { key: 'homeScore', label: 'Home score', type: 'text', default: '2' },
      { key: 'away', label: 'Away', type: 'text', default: 'AWAY' },
      { key: 'awayScore', label: 'Away score', type: 'text', default: '1' },
      { key: 'clock', label: 'Clock', type: 'text', default: "12'" },
    ],
  },
];

/** Presets = saved graphic instances (audit §6): a template + pre-filled values. */
export interface Preset { name: string; templateId: string; values: Values; }

export const PRESETS: Preset[] = [
  { name: 'MORNING SHOW OPEN', templateId: 'fullscreen',
    values: { title: 'THE MORNING SHOW', subtitle: 'WITH ANTHONY KUZUB' } },
  { name: 'EVENING NEWS OPEN', templateId: 'fullscreen',
    values: { title: 'EVENING NEWS', subtitle: 'THE STORIES THAT MATTER' } },
  { name: 'SPORTS OPEN', templateId: 'score',
    values: { home: 'LIONS', homeScore: '0', away: 'BEARS', awayScore: '0', clock: "0'" } },
  { name: 'BREAKING NEWS', templateId: 'ticker',
    values: { tag: 'BREAKING', text: 'DEVELOPING STORY  •  MORE TO FOLLOW  •  STAY WITH US' } },
  { name: 'ELECTION NIGHT', templateId: 'participant',
    values: { heading: 'THE PANEL', people: 'ANALYST ONE | POLLSTER\nANALYST TWO | STRATEGIST' } },
  { name: 'WEATHER PACKAGE', templateId: 'lower-third',
    values: { name: 'THE FORECAST', title: 'NEXT 24 HOURS' } },
  { name: 'LOWER-THIRD KIT', templateId: 'lower-third',
    values: { name: 'GUEST NAME', title: 'GUEST TITLE' } },
  { name: 'CREDITS ROLL', templateId: 'up-next',
    values: { heading: 'CREDITS', items: 'DIRECTOR\nPRODUCER\nGRAPHICS\nAUDIO' } },
];

// ---- Matching routed labels → templates -------------------------------------

const norm = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

export function templateById(id: string): GfxTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Best-effort map an input/source label (e.g. "NAME SUPER") to a template. */
export function templateForLabel(label: string): GfxTemplate | undefined {
  const n = norm(label);
  return TEMPLATES.find((t) => norm(t.name) === n)
    ?? TEMPLATES.find((t) => n.includes(norm(t.name)) || norm(t.name).includes(n));
}

export function presetForLabel(label: string): Preset | undefined {
  const n = norm(label);
  return PRESETS.find((p) => norm(p.name) === n)
    ?? PRESETS.find((p) => n.includes(norm(p.name)) || norm(p.name).includes(n));
}

/** Seed a values bag from a template's field defaults. */
export function defaults(tpl: GfxTemplate): Values {
  const v: Values = {};
  for (const f of tpl.fields) v[f.key] = f.default ?? '';
  return v;
}

// ---- The renderer (Layer 4, DOM form) ---------------------------------------
// Pure: (kind, values, reveal) → an .gfx-graphic element. The stage adds `.on`
// to trigger the CSS animate-IN; only transform/opacity animate (GPU-friendly).

export function renderGraphic(tpl: GfxTemplate, values: Values, reveal: number): HTMLElement {
  const g = el('div', { class: `gfx-graphic gfx-${tpl.kind}` });
  switch (tpl.kind) {
    case 'lower-third': {
      g.append(
        el('div', { class: 'gfx-l3-plate' }, [
          el('div', { class: 'gfx-l3-name' }, [values.name || '']),
          el('div', { class: 'gfx-l3-title' }, [values.title || '']),
        ]),
      );
      break;
    }
    case 'name-super': {
      g.append(
        el('div', { class: 'gfx-l3-plate gfx-l3-3tier' }, [
          el('div', { class: 'gfx-l3-name' }, [values.name || '']),
          el('div', { class: 'gfx-l3-title' }, [values.title || '']),
          el('div', { class: 'gfx-l3-loc' }, [values.locator || '']),
        ]),
      );
      break;
    }
    case 'up-next': {
      const panel = el('div', { class: 'gfx-list-panel' }, [
        el('div', { class: 'gfx-list-head' }, [values.heading || 'COMING UP']),
      ]);
      lines(values.items).slice(0, reveal).forEach((txt, i) => {
        panel.append(el('div', { class: 'gfx-list-row', style: `--i:${i}` }, [
          el('span', { class: 'gfx-list-dot' }), el('span', {}, [txt]),
        ]));
      });
      g.append(panel);
      break;
    }
    case 'participant': {
      const panel = el('div', { class: 'gfx-list-panel gfx-people' }, [
        el('div', { class: 'gfx-list-head' }, [values.heading || 'PARTICIPANTS']),
      ]);
      lines(values.people).slice(0, reveal).forEach((line, i) => {
        const [name, role] = line.split('|').map((s) => s.trim());
        panel.append(el('div', { class: 'gfx-person-row', style: `--i:${i}` }, [
          el('div', { class: 'gfx-headshot' }, [(name || '?').charAt(0)]),
          el('div', { class: 'gfx-person-txt' }, [
            el('b', {}, [name || '']), el('span', {}, [role || '']),
          ]),
        ]));
      });
      g.append(panel);
      break;
    }
    case 'bug': {
      g.append(el('div', { class: 'gfx-bug-box' }, [
        el('b', {}, [values.text || 'BUG']),
        el('span', { class: 'gfx-bug-sub' }, [values.sub || '']),
      ]));
      break;
    }
    case 'ticker': {
      const crawl = el('div', { class: 'gfx-ticker-crawl' }, [values.text || '']);
      g.append(
        el('div', { class: 'gfx-ticker-bar' }, [
          el('div', { class: 'gfx-ticker-tag' }, [values.tag || 'NEWS']),
          el('div', { class: 'gfx-ticker-track' }, [crawl]),
        ]),
      );
      break;
    }
    case 'fullscreen': {
      g.append(el('div', { class: 'gfx-fs' }, [
        el('div', { class: 'gfx-fs-title' }, [values.title || '']),
        el('div', { class: 'gfx-fs-sub' }, [values.subtitle || '']),
      ]));
      break;
    }
    case 'score': {
      g.append(el('div', { class: 'gfx-score' }, [
        el('div', { class: 'gfx-score-team' }, [
          el('span', { class: 'gfx-score-name' }, [values.home || 'HOME']),
          el('span', { class: 'gfx-score-pts' }, [values.homeScore || '0']),
        ]),
        el('div', { class: 'gfx-score-clock' }, [values.clock || '']),
        el('div', { class: 'gfx-score-team' }, [
          el('span', { class: 'gfx-score-pts' }, [values.awayScore || '0']),
          el('span', { class: 'gfx-score-name' }, [values.away || 'AWAY']),
        ]),
      ]));
      break;
    }
  }
  return g;
}

/** How many reveal-states a template has (for NEXT). Lists = row count; else 1. */
export function stateCount(tpl: GfxTemplate, values: Values): number {
  if (tpl.kind === 'up-next') return Math.max(1, lines(values.items).length);
  if (tpl.kind === 'participant') return Math.max(1, lines(values.people).length);
  return 1;
}
