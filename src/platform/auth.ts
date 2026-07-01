// src/platform/auth — role-based capability gate (M1/M6), no window globals.
//
// Port of js/auth.js's state layer: the broadcast "bridge crew" role roster, the
// current operator, and can() (admin implies every capability). The login /
// rights / badge UI lives in ui/console/auth-panel.ts and drives this via
// setRole(); editors gate through EditorContext.can (→ this can()). Role changes
// notify subscribers so the UI + open scopes re-apply.

import type { Capability, Role } from '../model/index.js';

// Starfleet role · broadcast equivalent. caps use the model Capability union.
export const ROLES: Role[] = [
  { id: 'ep', name: 'Captain', sub: 'Executive Producer', tier: 'Command', color: '#F2B74B', task: 'Final authority — creative vision & mission success. Full grid.', caps: { admin: 1 } },
  { id: 'director', name: 'First Officer', sub: 'Director', tier: 'Command', color: '#ff6a6a', task: 'Execute the vision — call the shots, manage pacing.', caps: { switch: 1, signal: 1 } },
  { id: 'td', name: 'Conn · Helm', sub: 'Technical Director', tier: 'Operations', color: '#cba6ff', task: 'Pilot the switcher — frame-accurate cuts & transitions.', caps: { switch: 1, route: 1 } },
  { id: 'ops', name: 'Ops', sub: 'System Engineer', tier: 'Operations', color: '#3FC1C9', task: 'Manage the grid — system health, routing, resource booking.', caps: { route: 1, signal: 1, book: 1 } },
  { id: 'chief', name: 'Chief Engineer', sub: 'Vision Engineer / Shader', tier: 'Engineering', color: '#6FC8F0', task: 'Signal path & colour science — shade the optical nodes.', caps: { shade: 1 } },
  { id: 'tactical', name: 'Tactical', sub: 'Graphics & AR Lead', tier: 'Operations', color: '#ffd400', task: 'On-screen overlays, AR & data visualization.', caps: { gfx: 1 } },
  { id: 'comms', name: 'Comms', sub: 'Intercom Engineer', tier: 'Operations', color: '#39d353', task: 'IFB & intercom matrix — mix-minus, ducking, talkback.', caps: { comms: 1, audio: 1 } },
  { id: 'science', name: 'Science', sub: 'Metadata & Analytics', tier: 'Operations', color: '#9fd6ff', task: 'Audience data, stream health & algorithmic performance.', caps: { view: 1 } },
];

let current: Role = ROLES[0]!;
const listeners = new Set<(r: Role) => void>();

export function role(): Role {
  return current;
}

export function setRole(r: Role): void {
  current = r;
  for (const l of listeners) l(r);
}

/** Subscribe to role changes (the auth UI re-renders + re-applies scope). */
export function onRoleChange(cb: (r: Role) => void): void {
  listeners.add(cb);
}

/** True if the current operator holds `cap` — admin implies every capability. */
export function can(cap: Capability): boolean {
  return !!(current.caps.admin || current.caps[cap]);
}
