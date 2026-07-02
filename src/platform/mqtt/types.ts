// src/platform/mqtt/types — the TwistBus contract + payload schemas (audit §4.1).
//
// The bus is a RETAINED PROJECTION of the routing state onto an MQTT topic tree,
// modelled on OPEN-AIR comMQTT (MqttProvider.jsx). Two message classes per node:
//   • …/config  — retained "who am I / what params do I carry" (rarely changes)
//   • …/<param> — retained live value (changes as the operator drives it)
// Every payload carries `full_id` so a subscriber (incl. this console echoed back
// by a backend) can drop its own reflections — comMQTT's self-echo suppression.

import type { Capability } from '../../model/index.js';

/** One advertised parameter a resource exposes. */
export interface ParamSpec {
  name: string;                 // "gain", "iris", "tally", "loudness", …
  type: 'number' | 'bool' | 'string' | 'enum';
  unit?: string;
  min?: number;
  max?: number;
  values?: string[];            // for enum
  writable?: boolean;           // false ⇒ read-only telemetry
  cap?: Capability;             // capability required to drive a writable param
}

/** A retained advertisement: identity + the parameter schema of a node. */
export interface ConfigMsg {
  kind: 'source' | 'destination' | 'twist' | 'room';
  name: string;
  color?: string;
  params?: ParamSpec[];
  status?: string;              // 'OK' | fault text
  full_id: string;
}

/** A retained live value on a `…/params/<name>` (or any value) topic. */
export interface ValueMsg<T = unknown> {
  value: T;
  ts: number;
  full_id: string;
}

/** One Captain's Log narrative entry, retained on `Twist/log/**`. */
export interface LogMsg {
  voyage: number;
  entry: number;
  ts: number;
  dest: string;
  prod: string;
  added: string[];
  removed: string[];
  text: string;
  reversed: boolean;
  full_id: string;
}

/** The single surface the rest of the app depends on. */
export interface TwistBus {
  /** Resolves once the bus has settled (connected, or degraded to no-op). Never rejects. */
  readonly ready: Promise<void>;
  /** This console's stable identity, stamped into every payload as `full_id`. */
  readonly sessionId: string;
  status(): { enabled: boolean; connected: boolean };
  /** Publish a retained `…/config` advertisement under the Twist root. */
  publishConfig(topicSuffix: string, msg: Omit<ConfigMsg, 'full_id'>): void;
  /** Publish a retained live value; opts.throttle coalesces rapid drags (~45 Hz). */
  publishValue<T>(topicSuffix: string, value: T, opts?: { throttle?: boolean }): void;
  /** Publish an already-shaped retained payload (log entries, presence, …). */
  publishRaw(topicSuffix: string, payload: unknown, opts?: { retain?: boolean }): void;
  /** Subscribe to a topic filter (relative to the Twist root). Returns an unsubscribe. */
  subscribe(topicFilter: string, cb: (topic: string, payload: unknown) => void): () => void;
  dispose(): void;
}
