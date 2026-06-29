// src/editors/intercom/state — the talk-group model the legacy render() kept as
// closure locals (`groups`, `selecting`, `picked`). Pure data; the view owns DOM.

/** A talk group gangs several key panels under one big TALK button. */
export interface TalkGroup {
  name: string;
  /** Indices into the key list. */
  members: number[];
  on: boolean;
}

export interface IntercomState {
  /** Key-panel labels (resolved from ctx.sources / config / defaults). */
  keys: string[];
  groups: TalkGroup[];
  selecting: boolean;
  picked: Set<number>;
}

/** Legacy fallback key set when no sources are routed (verbatim). */
export const DEFAULT_KEYS: readonly string[] = [
  'DIRECTOR',
  'TD / SWITCH',
  'A1 AUDIO',
  'FLOOR MGR',
  'CAM 1',
  'CAM 2',
  'CAM 3',
  'VTR / REPLAY',
  'GRAPHICS',
  'LIGHTING',
  'PRODUCER',
  'TECH',
];

export function createIntercomState(keys: string[]): IntercomState {
  return { keys, groups: [], selecting: false, picked: new Set<number>() };
}
