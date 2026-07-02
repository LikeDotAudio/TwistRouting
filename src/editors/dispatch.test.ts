// Dispatch parity test (G8). Locks twist-name → editor so a future regex tweak
// or a folder rename can't silently reroute a twist. Mirrors the legacy
// register() order via plugin.order. Covers the known overlaps the report flags:
// signal vs signaling, light vs on-air, comm vs intercom, cam vs camera.

import { describe, it, expect } from 'vitest';
import { PLUGINS, pluginFor } from './registry.js';

const EXPECT: Array<[string, string | null]> = [
  ['ISO 1', 'iso-recorder'],
  ['Replay', 'iso-recorder'],
  ['Multi View', 'multi-viewer'],
  ['Multiviewer', 'multi-viewer'],
  ['Vision Mixer', 'vision-mixer'],
  ['Video Mix', 'vision-mixer'],
  ['Switcher', 'vision-mixer'],
  ['Audio Mixer', 'audio-mixer'],
  ['Monitor Console', 'audio-mixer'],   // renamed per-production audio console
  ['Audio Positioner', 'audio-positioner'],
  ['CMDP', 'audio-positioner'],
  ['Intercom', 'intercom'],
  ['Comms', 'intercom'],
  ['CAM 1', 'camera-control'],
  ['Camera Control', 'camera-control'],
  ['Audio Monitor', 'audio-monitor'],
  ['AFV', 'audio-monitor'],
  ['Confidence', 'audio-monitor'],
  ['IFB 1', 'ifb'],
  ['Foldback', 'ifb'],
  ['Stage Box', 'stagebox-input'],
  ['Mic Input', 'stagebox-input'],
  ['Encoder', 'encoder'],
  ['Streaming Out', 'encoder'],
  ['Signaling', 'signaling'],
  ['Tally', 'signaling'],
  ['On Air', 'signaling'],        // NOT lighting — lighting's negative lookahead defers on-air
  ['Lighting', 'lighting'],
  ['DMX', 'lighting'],
  ['Key Light', 'lighting'],
  ['WYSIWYG', 'wysiwyg'],
  ['Previz', 'wysiwyg'],
  ['Meter Input', 'meter-input'], // TEST TOOLS bench: scopes + meters + loudness
  ['REMOTE 1', 'signal-conditioner'],   // per-production remote → frame-sync/delay/proc-amp
  ['Conditioner Row', 'signal-conditioner'],
  ['GRAPHIC EDITOR', 'graphics-engine'],   // graphics engine: full template catalog
  ['GRAPHICS PRESETS', 'graphics-engine'], // rundown / saved-instance recall
  ['TITLE EDITOR', 'graphics-engine'],     // name-super / lower-third authoring
  ['Lower Third', 'graphics-engine'],
  ['Name Super', 'graphics-engine'],
  ['Clock', null],                // no dedicated editor → generic matrix fallback
];

describe('editor dispatch', () => {
  it('routes every known twist name to the expected editor', () => {
    for (const [name, id] of EXPECT) {
      expect(pluginFor(name)?.id ?? null, `dispatch("${name}")`).toBe(id);
    }
  });

  it('registers all 17 editors', () => {
    expect(PLUGINS.length).toBe(17);
  });

  it('orders plugins by ascending precedence (legacy import order)', () => {
    const orders = PLUGINS.map((p) => p.order ?? 100);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
