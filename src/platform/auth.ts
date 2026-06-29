// src/platform/auth — capability gate (M1/M6), no window globals.
//
// P3 stub: a single in-memory role whose caps decide can(). The full role
// roster + login (legacy js/auth.js + schedule.js) is P5; this provides the
// typed seam editors already depend on via EditorContext.can(). Default role is
// an all-caps operator so the side build renders every editor while P5 lands.

import type { Capability, Role } from '../model/index.js';

const ALL_CAPS: Capability[] = ['admin', 'switch', 'route', 'signal', 'shade', 'gfx', 'comms', 'audio', 'book', 'view'];

const adminRole: Role = {
  id: 'admin',
  name: 'OPERATOR',
  tier: 'admin',
  color: '#F2B74B',
  task: 'Full access (P3 default until the P5 role layer lands)',
  caps: Object.fromEntries(ALL_CAPS.map((c) => [c, 1])) as Partial<Record<Capability, 1>>,
};

let current: Role = adminRole;

export function setRole(role: Role): void {
  current = role;
}

export function role(): Role {
  return current;
}

export function can(cap: Capability): boolean {
  return current.caps[cap] === 1;
}
