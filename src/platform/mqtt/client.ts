// src/platform/mqtt/client — the TwistBus connection (audit §4.2).
//
// Faithful TS port of comMQTT's MqttProvider.jsx connection layer: mqtt.js over
// WebSockets, a per-session identity stamped into every payload, birth + last-will
// + 1 Hz heartbeat on a presence topic, reconnect, and self-echo suppression.
//
// Graceful degradation is a HARD requirement (TWIST is a static, zero-backend
// site): with no broker configured the bus becomes a no-op whose `ready` still
// resolves, so the console boots and runs identically with or without MQTT.

import type { TwistBus, ConfigMsg, ValueMsg } from './types.js';
import { createThrottler, type Throttler } from './throttle.js';

export const TWIST_ROOT = 'Twist';
const DEFAULT_PORT = 9001;
// Compiled default host. EMPTY ⇒ MQTT disabled out of the box; enable per-session
// with `?mqtt=<host[:port]>` (matches comMQTT's `?mqtt=` convention) or by setting
// localStorage.twistMqtt. A backend deployment can bake a host in here.
const DEFAULT_HOST = '';

// ---- minimal mqtt.js typings (no @types/mqtt dependency) --------------------
interface MqttClient {
  on(ev: 'connect' | 'reconnect' | 'close' | 'offline' | 'error', cb: (arg?: unknown) => void): void;
  on(ev: 'message', cb: (topic: string, payload: Uint8Array) => void): void;
  subscribe(topic: string, opts?: { qos?: 0 | 1 | 2 }): void;
  publish(topic: string, payload: string, opts?: { retain?: boolean; qos?: 0 | 1 | 2 }): void;
  end(force?: boolean, opts?: unknown, cb?: () => void): void;
}
interface MqttModule {
  connect(url: string, opts?: Record<string, unknown>): MqttClient;
}
declare global {
  interface Window { mqtt?: MqttModule; OA_MQTT_DEBUG?: boolean; }
}

const LS_KEY = 'twistMqtt';
/** The persisted broker setting (host[:port] or ws(s):// url), '' if unset. */
export function getBrokerSetting(): string {
  try { return localStorage.getItem(LS_KEY) ?? ''; } catch { return ''; }
}
/** Persist the broker setting (empty string clears it → MQTT disabled next boot). */
export function setBrokerSetting(host: string): void {
  try { const v = (host || '').trim(); if (v) localStorage.setItem(LS_KEY, v); else localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

/** Resolve the broker WS url from `?mqtt=`, localStorage, or the compiled default. */
export function resolveBrokerUrl(): string | null {
  let raw = '';
  try {
    raw = new URLSearchParams(location.search).get('mqtt')
      ?? localStorage.getItem('twistMqtt')
      ?? DEFAULT_HOST;
  } catch { raw = DEFAULT_HOST; }
  raw = (raw || '').trim();
  if (!raw || raw === 'off' || raw === '0') return null;
  if (/^wss?:\/\//i.test(raw)) return raw;
  const proto = (typeof location !== 'undefined' && location.protocol === 'https:') ? 'wss' : 'ws';
  return raw.includes(':') ? `${proto}://${raw}` : `${proto}://${raw}:${DEFAULT_PORT}`;
}

/** Load mqtt.js: use an already-present global, else inject the unpkg script. */
function loadMqtt(): Promise<MqttModule | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.mqtt) return Promise.resolve(window.mqtt);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/mqtt/dist/mqtt.min.js';
    s.async = true;
    s.onload = () => resolve(window.mqtt ?? null);
    s.onerror = () => { console.warn('TwistBus: failed to load mqtt.js from CDN — MQTT disabled'); resolve(null); };
    document.head.appendChild(s);
  });
}

function makeSessionId(): string {
  let hex = '';
  try {
    const b = new Uint8Array(4);
    crypto.getRandomValues(b);
    hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  } catch { hex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0'); }
  return `${hex}:TWIST:${Date.now()}`;
}

const dbg = (...a: unknown[]): void => { if (typeof window !== 'undefined' && window.OA_MQTT_DEBUG) console.log('[TwistBus]', ...a); };

/** A bus that does nothing but keeps the app happy when no broker is configured. */
function noopBus(sessionId: string): TwistBus {
  return {
    ready: Promise.resolve(),
    sessionId,
    status: () => ({ enabled: false, connected: false }),
    publishConfig: () => {},
    publishValue: () => {},
    publishRaw: () => {},
    subscribe: () => () => {},
    dispose: () => {},
  };
}

/**
 * Create the TwistBus. Returns immediately; `ready` resolves once connected or
 * once we've settled into the no-op/degraded path. Never throws, never blocks boot.
 */
export function createTwistBus(): TwistBus {
  const sessionId = makeSessionId();
  const url = resolveBrokerUrl();
  if (!url) { dbg('no broker configured — no-op bus'); return noopBus(sessionId); }

  const presenceTopic = `${TWIST_ROOT}/system/presence/${sessionId.split(':')[0]}`;
  const subs = new Set<{ filter: string; cb: (t: string, p: unknown) => void }>();
  const throttlers = new Map<string, Throttler<{ topic: string; payload: string }>>();
  let client: MqttClient | null = null;
  let connected = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  const full = (suffix: string): string => `${TWIST_ROOT}/${suffix.replace(/^\/+/, '')}`;

  const send = (topic: string, payload: string, retain = true): void => {
    if (!client) return;                       // mqtt.js buffers pre-connect and flushes on connect
    try { client.publish(topic, payload, { retain, qos: 0 }); } catch (e) { dbg('publish failed', topic, e); }
  };

  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => { resolveReady = r; });
  // Never let boot hang on a dead broker: settle `ready` after connectTimeout.
  const readyTimer = setTimeout(() => { dbg('ready timeout — degraded'); resolveReady(); }, 30_000);

  void loadMqtt().then((mod) => {
    if (disposed) return;
    if (!mod) { clearTimeout(readyTimer); resolveReady(); return; }
    dbg('connecting', url);
    client = mod.connect(url, {
      username: 'guest', password: 'guest',
      keepalive: 60, reconnectPeriod: 5000, connectTimeout: 30_000,
      will: { topic: presenceTopic, payload: JSON.stringify({ active: false, full_id: sessionId }), retain: true, qos: 0 },
    });
    client.on('connect', () => {
      connected = true;
      dbg('connected', sessionId);
      client!.subscribe(`${TWIST_ROOT}/#`, { qos: 0 });
      const beat = (): void => send(presenceTopic, JSON.stringify({ active: true, full_id: sessionId, ts: Date.now() }));
      beat();
      heartbeat = setInterval(beat, 1000);
      clearTimeout(readyTimer);
      resolveReady();
    });
    client.on('reconnect', () => { connected = false; });
    client.on('close', () => { connected = false; });
    client.on('offline', () => { connected = false; });
    client.on('error', (e) => dbg('error', e));
    client.on('message', (topic: string, payload: Uint8Array) => {
      let parsed: unknown;
      try { parsed = JSON.parse(new TextDecoder().decode(payload)); } catch { parsed = null; }
      // Self-echo suppression: drop anything we published (matches comMQTT full_id check).
      if (parsed && typeof parsed === 'object' && (parsed as { full_id?: string }).full_id === sessionId) return;
      const rel = topic.startsWith(`${TWIST_ROOT}/`) ? topic.slice(TWIST_ROOT.length + 1) : topic;
      for (const s of subs) if (matches(s.filter, rel)) s.cb(rel, parsed);
    });
  });

  return {
    ready,
    sessionId,
    status: () => ({ enabled: true, connected }),

    publishConfig(suffix, msg): void {
      const full_id = sessionId;
      send(full(`${suffix}`), JSON.stringify({ ...msg, full_id } satisfies ConfigMsg));
    },

    publishValue<T>(suffix: string, value: T, opts?: { throttle?: boolean }): void {
      const topic = full(suffix);
      const payload = JSON.stringify({ value, ts: Date.now(), full_id: sessionId } satisfies ValueMsg<T>);
      if (opts?.throttle) {
        let t = throttlers.get(topic);
        if (!t) { t = createThrottler((m) => send(m.topic, m.payload), 22); throttlers.set(topic, t); }
        t.push({ topic, payload });
      } else send(topic, payload);
    },

    publishRaw(suffix, payload, opts): void {
      send(full(suffix), typeof payload === 'string' ? payload : JSON.stringify(payload), opts?.retain ?? true);
    },

    subscribe(filter, cb): () => void {
      const entry = { filter: filter.replace(/^\/+/, ''), cb };
      subs.add(entry);
      return () => subs.delete(entry);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearTimeout(readyTimer);
      if (heartbeat) clearInterval(heartbeat);
      for (const t of throttlers.values()) t.flush();
      throttlers.clear();
      subs.clear();
      if (client) {
        send(presenceTopic, JSON.stringify({ active: false, full_id: sessionId }));
        try { client.end(true); } catch { /* ignore */ }
      }
    },
  };
}

/** MQTT topic-filter match (`+` single level, `#` multi level), on Twist-relative topics. */
function matches(filter: string, topic: string): boolean {
  if (filter === '#') return true;
  const f = filter.split('/'), t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (f[i] === '+') { if (t[i] === undefined) return false; continue; }
    if (f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}
