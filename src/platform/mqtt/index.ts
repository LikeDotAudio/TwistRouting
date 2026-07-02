// src/platform/mqtt — the TwistBus: a retained MQTT projection of TWIST's routing
// state, modelled on OPEN-AIR comMQTT. See docs/Audit /TWIST-MQTT-Advertising-Audit.md.
//
// One process-wide bus (the console is a single page). `getBus()` lazily creates
// it so importers (app boot, the log bridge, per-twist editor services) all share
// one connection and one session identity.

import type { TwistBus } from './types.js';
import { createTwistBus } from './client.js';

export type { TwistBus, ConfigMsg, ValueMsg, LogMsg, ParamSpec } from './types.js';
export { TWIST_ROOT, resolveBrokerUrl, getBrokerSetting, setBrokerSetting } from './client.js';
export { advertiseAll } from './advertise.js';
export { startLogBridge } from './log-bridge.js';
export * as topics from './topics.js';

let bus: TwistBus | null = null;

/** The shared TwistBus (created on first use). */
export function getBus(): TwistBus {
  if (!bus) bus = createTwistBus();
  return bus;
}
