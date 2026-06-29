import { describe, it, expect } from 'vitest';
import {
  isFaultStatus, emptyGraph, take, clear, feedsInto, destFaulted, diff,
  salvo, computeTally, mixMinus,
  type Feed,
} from './index.js';

describe('isFaultStatus', () => {
  it('treats undefined / OK as healthy (case-insensitive)', () => {
    expect(isFaultStatus(undefined)).toBe(false);
    expect(isFaultStatus('OK')).toBe(false);
    expect(isFaultStatus('ok')).toBe(false);
  });
  it('treats any other status as a fault', () => {
    expect(isFaultStatus('LOST CLOCK')).toBe(true);
    expect(isFaultStatus('NO CONNECTION')).toBe(true);
  });
});

const feed = (id: string, faulted = false): Feed => ({ id, label: id, color: '#fff', faulted });

describe('route graph', () => {
  it('take() is idempotent and immutable', () => {
    const g0 = emptyGraph();
    const g1 = take(g0, 'cam1', 'prod1');
    const g2 = take(g1, 'cam1', 'prod1');
    expect(g1.crosspoints).toHaveLength(1);
    expect(g2).toBe(g1);          // no-op returns same ref
    expect(g0.crosspoints).toHaveLength(0); // original untouched
  });

  it('feedsInto() returns routed feeds in connection order', () => {
    let g = emptyGraph();
    g = { ...g, sources: new Map([['a', feed('a')], ['b', feed('b')]]) };
    g = take(take(g, 'a', 'd'), 'b', 'd');
    expect(feedsInto(g, 'd').map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('destFaulted() propagates a faulted feed to its destination', () => {
    let g = emptyGraph();
    g = { ...g, sources: new Map([['bad', feed('bad', true)]]) };
    g = take(g, 'bad', 'prod1');
    expect(destFaulted(g, 'prod1')).toBe(true);
    expect(destFaulted(g, 'prod2')).toBe(false);
  });

  it('diff() reports added and removed crosspoints', () => {
    const a = take(emptyGraph(), 'x', 'd');
    const b = take(emptyGraph(), 'y', 'd');
    const d = diff(a, b);
    expect(d.added).toEqual([{ source: 'y', dest: 'd' }]);
    expect(d.removed).toEqual([{ source: 'x', dest: 'd' }]);
  });

  it('clear() removes a crosspoint', () => {
    const g = clear(take(emptyGraph(), 'x', 'd'), 'x', 'd');
    expect(g.crosspoints).toHaveLength(0);
  });
});

describe('salvo', () => {
  it('applies a batch of takes atomically and is re-fireable', () => {
    const g = salvo(emptyGraph(), { name: 'open', takes: [
      { source: 'a', dest: 'd1' }, { source: 'b', dest: 'd2' },
    ] });
    expect(g.crosspoints).toHaveLength(2);
    expect(salvo(g, { name: 'open', takes: [{ source: 'a', dest: 'd1' }] }).crosspoints).toHaveLength(2);
  });
});

describe('computeTally', () => {
  it('marks pgm/pvw/off per source from the bus assignments', () => {
    let g = emptyGraph();
    g = { ...g, sources: new Map([['a', feed('a')], ['b', feed('b')], ['c', feed('c')]]) };
    g = take(take(take(g, 'a', 'PGM'), 'b', 'PVW'), 'a', 'PVW');
    const tally = computeTally(g, { program: 'PGM', preview: 'PVW' });
    expect(tally.get('a')).toBe('pgm');   // program wins over preview
    expect(tally.get('b')).toBe('pvw');
    expect(tally.get('c')).toBe('off');
  });
});

describe('mixMinus', () => {
  it('returns every feed into a dest except the excluded return', () => {
    let g = emptyGraph();
    g = { ...g, sources: new Map([['host', feed('host')], ['gst', feed('gst')]]) };
    g = take(take(g, 'host', 'bus'), 'gst', 'bus');
    expect(mixMinus(g, 'bus', 'host').map((f) => f.id)).toEqual(['gst']);
  });
});
