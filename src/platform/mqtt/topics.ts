// src/platform/mqtt/topics — PURE path→topic + payload builders (audit §4.3).
//
// Mirrors comMQTT's topicMaker.jsx: the folder/name hierarchy IS the topic tree.
// Zero DOM, zero side effects → unit-testable like domain/routing-core. Kept in
// the platform layer, so it re-implements the tiny stripOrder/slug helpers rather
// than importing them from ui/ (which sits ABOVE platform in the M7 layering).

import type { Production, TwistConfig, SourceLeaf } from '../../model/index.js';
import type { ConfigMsg, ParamSpec } from './types.js';

/** Drop a leading numeric ordering prefix ("001_Sound" → "Sound", "10_YAK" → "YAK"). */
export const stripOrder = (s: string): string => String(s ?? '').replace(/^\d+_/, '');

/** Lower-kebab a label into one safe topic segment (also strips MQTT wildcards). */
export const slug = (s: string): string =>
  String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** One discovery path segment → a clean topic segment (order-prefix stripped). */
export const seg = (s: string): string => slug(stripOrder(decodeURIComponent(String(s ?? '')).replace(/\/$/, '')));

// ---- topic builders ---------------------------------------------------------

/** A production ("room"). `displayName` must match renderPrograms' titleText so the
 *  advertise pass and the live editor land on the SAME topic. */
export const roomTopic = (displayName: string): string => `rooms/${slug(displayName)}`;

/** A twist inside a room. */
export const twistTopic = (roomDisplayName: string, twistName: string): string =>
  `${roomTopic(roomDisplayName)}/twists/${slug(twistName)}`;

/** A source leaf under Routes/Sources/**. `pathSegs` are the raw folder names. */
export const sourceTopic = (pathSegs: string[], leafName: string): string =>
  ['routes/sources', ...pathSegs.map(seg), slug(leafName)].filter(Boolean).join('/');

/** The display name a production renders under (parentName ? "PARENT — Name" : Name). */
export const roomDisplayName = (name: string, parentName?: string): string =>
  parentName ? `${parentName.toUpperCase()} — ${name}` : name;

// ---- payload builders -------------------------------------------------------

const twistName = (t: string | TwistConfig): string => (typeof t === 'string' ? t : t.name);

/** TwistConfig → the parameter schema this twist advertises (read-only descriptors). */
export function twistParams(t: TwistConfig | null): ParamSpec[] {
  if (!t) return [];
  const p: ParamSpec[] = [];
  if (t.accepts) p.push({ name: 'accepts', type: 'enum', values: ['video', 'audio', 'both', 'camera'], writable: false });
  if (t.maxVideo != null) p.push({ name: 'maxVideo', type: 'number', min: 0, max: t.maxVideo, writable: false });
  if (t.maxAudio != null) p.push({ name: 'maxAudio', type: 'number', min: 0, max: t.maxAudio, writable: false });
  if (t.inputs?.length) p.push({ name: 'inputs', type: 'enum', values: t.inputs, writable: false });
  if (t.monitor) p.push({ name: 'monitor', type: 'bool', writable: false });
  if (t.cameraInput) p.push({ name: 'cameraInput', type: 'bool', writable: false });
  return p;
}

export function configForTwist(t: string | TwistConfig): Omit<ConfigMsg, 'full_id'> {
  const cfg = typeof t === 'string' ? null : t;
  return { kind: 'twist', name: twistName(t), params: twistParams(cfg) };
}

export function configForProduction(p: Production, displayName?: string): Omit<ConfigMsg, 'full_id'> {
  const params: ParamSpec[] = [];
  const out = p.outputs ?? {};
  (['video', 'audio', 'intercom'] as const).forEach((k) => {
    const list = out[k];
    if (list?.length) params.push({ name: `outputs.${k}`, type: 'enum', values: list, writable: false });
  });
  return {
    kind: 'room',
    name: displayName ?? p.name,
    ...(p.color ? { color: p.color } : {}),
    ...(p.status ? { status: p.status } : {}),
    params,
  };
}

/** Gather a source leaf's channel labels across its permissive variants. */
export function sourceChannels(s: SourceLeaf): string[] {
  const out: string[] = [];
  if (s.items?.length) out.push(...s.items);
  if (s.prefix && s.count) for (let i = 1; i <= s.count; i++) out.push(`${s.prefix}${i}`);
  const boxes = (s as { boxes?: Array<{ audio?: string[]; control?: string[] }> }).boxes;
  boxes?.forEach((b) => { if (b.audio) out.push(...b.audio); if (b.control) out.push(...b.control); });
  const streams = (s as { streams?: Array<{ name?: string }> }).streams;
  streams?.forEach((st) => { if (st.name) out.push(st.name); });
  return out;
}

export function configForSource(s: SourceLeaf): Omit<ConfigMsg, 'full_id'> {
  const channels = sourceChannels(s);
  return {
    kind: 'source',
    name: s.name,
    ...(s.color ? { color: s.color } : {}),
    ...(s.status ? { status: s.status } : {}),
    params: channels.length ? [{ name: 'channels', type: 'enum', values: channels, writable: false }] : [],
  };
}
