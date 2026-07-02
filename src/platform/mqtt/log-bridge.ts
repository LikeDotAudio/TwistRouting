// src/platform/mqtt/log-bridge — Captain's Log → MQTT (audit §4.6).
//
// TWIST's edge over comMQTT: the Captain's Log already narrates EVERY routing
// change (drag-drop, 1990s view, portals, Reverse Course) via a MutationObserver.
// This bridge is the one wire that turns that stream into retained topics — so
// "topics in every … Captain's Log" and "every create route" fall out of a single
// subscription. Each entry lands at Twist/log/<voyage>/<entry> plus Twist/log/latest.

import { onLogEntry, type LogEntryEvent } from '../../ui/console/captains-log.js';
import type { TwistBus, LogMsg } from './types.js';

/** Wire the Captain's Log to the bus. Returns an unsubscribe. No-op when disabled. */
export function startLogBridge(bus: TwistBus): () => void {
  if (!bus.status().enabled) return () => {};
  return onLogEntry((e: LogEntryEvent) => {
    const msg: Omit<LogMsg, 'full_id'> = {
      voyage: e.voyage, entry: e.entry, ts: e.ts,
      dest: e.dest, prod: e.prod, added: e.added, removed: e.removed,
      text: e.text, reversed: e.reversed,
    };
    bus.publishRaw(`log/${e.voyage}/${e.entry}`, { ...msg, full_id: bus.sessionId });
    bus.publishRaw('log/latest', { ...msg, full_id: bus.sessionId });
  });
}
