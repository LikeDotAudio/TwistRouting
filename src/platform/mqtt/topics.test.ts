// Unit tests for the pure topic/payload builders (audit §4.3). No DOM, no broker.
import { describe, it, expect } from 'vitest';
import {
  slug, seg, stripOrder, roomTopic, twistTopic, sourceTopic, roomDisplayName,
  configForTwist, configForProduction, configForSource, sourceChannels,
} from './topics.js';
import type { Production, SourceLeaf } from '../../model/index.js';

describe('segment helpers', () => {
  it('strips numeric order prefixes', () => {
    expect(stripOrder('001_Sound')).toBe('Sound');
    expect(stripOrder('10_YAK')).toBe('YAK');
    expect(stripOrder('Plain')).toBe('Plain');
  });
  it('slugs to lower-kebab and drops MQTT wildcards', () => {
    expect(slug('PROD 7')).toBe('prod-7');
    expect(slug('Video # Mixer +')).toBe('video-mixer');
    expect(slug('SECONDARY — PROD 7')).toBe('secondary-prod-7');
  });
  it('seg strips order + decodes + slugs a folder name', () => {
    expect(seg('002_Secondary/')).toBe('secondary');
    expect(seg('005_Prod')).toBe('prod');
    expect(seg('Control%20Rooms')).toBe('control-rooms');
  });
});

describe('topic builders', () => {
  it('rooms/twists key on the display name so advertise + editor align', () => {
    const display = roomDisplayName('PROD 7', 'Secondary');
    expect(display).toBe('SECONDARY — PROD 7');
    expect(roomTopic(display)).toBe('rooms/secondary-prod-7');
    expect(twistTopic(display, 'Video Mixer')).toBe('rooms/secondary-prod-7/twists/video-mixer');
  });
  it('room display name with no parent is just the name', () => {
    expect(roomDisplayName('ENCODER 4')).toBe('ENCODER 4');
    expect(roomTopic('ENCODER 4')).toBe('rooms/encoder-4');
  });
  it('source topics mirror the folder path', () => {
    expect(sourceTopic(['001_Sound', '002_Stage'], 'Mic 1')).toBe('routes/sources/sound/stage/mic-1');
  });
});

describe('payload builders', () => {
  it('configForTwist maps TwistConfig fields to read-only param specs', () => {
    const c = configForTwist({ name: 'Video Mixer', accepts: 'video', maxVideo: 1, inputs: ['SW IN 1', 'SW IN 2'] });
    expect(c.kind).toBe('twist');
    expect(c.name).toBe('Video Mixer');
    expect(c.params?.map((p) => p.name)).toEqual(['accepts', 'maxVideo', 'inputs']);
    expect(c.params?.every((p) => p.writable === false)).toBe(true);
  });
  it('configForTwist on a bare string name has no params', () => {
    expect(configForTwist('Processing')).toEqual({ kind: 'twist', name: 'Processing', params: [] });
  });
  it('configForProduction exposes outputs as enum params', () => {
    const p: Production = { id: 'p1', name: 'PROD 7', color: '#5566EE', outputs: { video: ['PGM', 'CLN'], audio: ['A1'] } };
    const c = configForProduction(p, 'SECONDARY — PROD 7');
    expect(c.kind).toBe('room');
    expect(c.name).toBe('SECONDARY — PROD 7');
    expect(c.color).toBe('#5566EE');
    expect(c.params?.map((x) => x.name)).toEqual(['outputs.video', 'outputs.audio']);
  });
  it('sourceChannels gathers channels across leaf variants', () => {
    const box: SourceLeaf = { id: 's', name: 'PROD 10', boxes: [{ audio: ['A1', 'A2'] }] } as unknown as SourceLeaf;
    expect(sourceChannels(box)).toEqual(['A1', 'A2']);
    const stage: SourceLeaf = { id: 's2', name: 'Stage', prefix: 'V', count: 3 } as SourceLeaf;
    expect(sourceChannels(stage)).toEqual(['V1', 'V2', 'V3']);
    expect(configForSource(stage).params?.[0]?.values).toEqual(['V1', 'V2', 'V3']);
  });
});
