// src/platform/mqtt/advertise — the boot advertisement pass (audit §4.4).
//
// "Advertise all the parameters in the rooms." Eager-walks Routes/Sources/** and
// Routes/Destinations/** (the same manifests the UI reads) and publishes ONE
// retained `…/config` per room, twist, and source. Retained ⇒ a subscriber that
// connects later still receives the full catalogue — comMQTT's guarantee.
//
// This is an INDEPENDENT walk (not the UI's lazy tab loader) so the whole tree is
// advertised at boot, not just the tabs an operator has opened. It reads the same
// files, so it never forks data — it's a pure projection of what's on disk.

import { listDirectory, fetchJSON, type Entry } from '../discovery.js';
import type { Production, SourceLeaf } from '../../model/index.js';
import type { TwistBus } from './types.js';
import { roomTopic, twistTopic, sourceTopic, roomDisplayName, configForProduction, configForTwist, configForSource } from './topics.js';

/** Walk one Routes/Destinations branch, advertising each production + its twists. */
async function walkDestinations(bus: TwistBus, baseUrl: string, parentName: string | undefined): Promise<void> {
  const { dirs, files } = await listDirectory(baseUrl);
  await Promise.all([
    ...files.map(async (f: Entry) => {
      const data = await fetchJSON<Production>(baseUrl + f.href);
      if (!data) return;
      const display = roomDisplayName(data.name, parentName);
      bus.publishConfig(`${roomTopic(display)}/config`, configForProduction(data, display));
      (data.twists ?? []).forEach((t) => {
        const name = typeof t === 'string' ? t : t.name;
        bus.publishConfig(`${twistTopic(display, name)}/config`, configForTwist(t));
      });
    }),
    ...dirs.map((dir: Entry) => walkDestinations(bus, baseUrl + dir.href, stripped(dir.name))),
  ]);
}

/** Walk one Routes/Sources branch, advertising each source leaf. */
async function walkSources(bus: TwistBus, baseUrl: string, pathSegs: string[]): Promise<void> {
  const { dirs, files } = await listDirectory(baseUrl);
  await Promise.all([
    ...files.map(async (f: Entry) => {
      const data = await fetchJSON<SourceLeaf>(baseUrl + f.href);
      if (!data || typeof data !== 'object' || !data.name) return;
      bus.publishConfig(`${sourceTopic(pathSegs, data.name)}/config`, configForSource(data));
    }),
    ...dirs.map((dir: Entry) => walkSources(bus, baseUrl + dir.href, [...pathSegs, dir.name])),
  ]);
}

const stripped = (s: string): string => String(s ?? '').replace(/\/$/, '').replace(/^\d+_/, '');

/** Advertise the entire catalogue. No-op (and no fetches) when MQTT is disabled. */
export async function advertiseAll(bus: TwistBus): Promise<void> {
  if (!bus.status().enabled) return;
  await bus.ready;
  try {
    await Promise.all([
      walkDestinations(bus, 'Routes/Destinations/', undefined),
      walkSources(bus, 'Routes/Sources/', []),
    ]);
  } catch (e) {
    console.warn('TwistBus advertiseAll failed:', e);
  }
}
