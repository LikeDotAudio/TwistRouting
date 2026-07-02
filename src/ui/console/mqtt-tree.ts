// src/ui/console/mqtt-tree — the MQTT chip + a live retained-topic TREE panel.
//
// TypeScript port of the standalone twist-mqtt-tree.html diagnostic (audit
// §appendix — the twist equivalent of comMQTT's MqttConnectionTester.html).
// Clicking the bottom-right MQTT chip opens a panel that subscribes to `Twist/#`
// and lists the live retained tree the TwistBus advertises.
//
// It opens its OWN diagnostic connection rather than reusing the shared TwistBus:
// the bus suppresses self-echoes (it drops anything this console published), so a
// bus-fed tree would be empty on a front-end-only deployment. A separate viewer
// sees the full retained tree — including this console's own advertisements.
//
// Broker config stays runtime-overridable (audit §4.2): the panel writes the same
// localStorage.twistMqtt the boot path reads. Save & Connect reloads so the shared
// publishing bus also moves to the new host; the tree itself auto-connects on open.
import { el, addStyles } from '../dom.js';
import type { TwistBus } from '../../platform/mqtt/index.js';
import { TWIST_ROOT, getBrokerSetting, setBrokerSetting } from '../../platform/mqtt/index.js';

// ---- minimal mqtt.js typings (mirrors platform/mqtt/client.ts) --------------
interface MqttClient {
  on(ev: 'connect' | 'reconnect' | 'close' | 'offline' | 'error', cb: (arg?: unknown) => void): void;
  on(ev: 'message', cb: (topic: string, payload: Uint8Array) => void): void;
  subscribe(topic: string, opts?: { qos?: 0 | 1 | 2 }): void;
  end(force?: boolean): void;
}
interface MqttModule { connect(url: string, opts?: Record<string, unknown>): MqttClient; }

// window.mqtt is declared globally by platform/mqtt/client.ts; read it via a cast.
const winMqtt = (): MqttModule | undefined => (window as unknown as { mqtt?: MqttModule }).mqtt;

/** Load mqtt.js: use an already-present global, else inject the unpkg script. */
function loadMqtt(): Promise<MqttModule | null> {
  if (winMqtt()) return Promise.resolve(winMqtt()!);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/mqtt/dist/mqtt.min.js';
    s.async = true;
    s.onload = () => resolve(winMqtt() ?? null);
    s.onerror = () => { console.warn('MQTT tree: failed to load mqtt.js from CDN'); resolve(null); };
    document.head.appendChild(s);
  });
}

/** Normalise a broker host[:port] or ws(s):// url to a WebSocket url (or null). */
function resolveUrl(raw: string): string | null {
  const v = (raw || '').trim();
  if (!v || v === 'off' || v === '0') return null;
  if (/^wss?:\/\//i.test(v)) return v;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return v.includes(':') ? `${proto}://${v}` : `${proto}://${v}:9001`;
}

const escapeHtml = (s: string): string => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));

// The chip is pinned bottom-RIGHT, directly above the .ptp-clock read-out (which
// sits at bottom:42px) so the two live together as the bottom-right status stack.
// Stacking above the clock (rather than left of it) keeps it clear of the clock's
// variable width as its format cycles. lcars-pulse.ts nudges both `right` offsets
// inward past the 20px edge pulse (mirrors its .ptp-clock rule).
const MQ_CSS = `
.mq-chip{position:fixed;right:14px;bottom:76px;z-index:1600;display:inline-flex;align-items:center;gap:7px;
    background:#0c1730;border:1px solid #2c3e5e;border-radius:6px 14px 14px 6px;color:#bcd3ee;
    font:bold 10px sans-serif;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;cursor:pointer;
    box-shadow:0 3px 12px rgba(0,0,0,.5);}
.mq-chip:hover{border-color:#3a6acc;color:#fff;}
.mq-dot{width:9px;height:9px;border-radius:50%;background:#6b82a3;box-shadow:0 0 6px currentColor;color:#6b82a3;}
.mq-dot.on{background:#ffd400;color:#ffd400;} .mq-dot.live{background:#39d353;color:#39d353;}
.mqt{position:fixed;right:14px;bottom:114px;z-index:1601;display:none;flex-direction:column;
    width:min(820px,94vw);height:min(70vh,720px);background:#0a0805;color:#ffcf6b;
    border:1px solid #3a2f10;border-radius:10px;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.7);
    font:13px/1.4 'Courier New',monospace;}
.mqt.open{display:flex;}
.mqt-head{display:flex;align-items:center;gap:12px;padding:9px 14px;background:#C2B74B;color:#1a1206;
    font-weight:900;letter-spacing:2px;flex:0 0 auto;}
.mqt-head input{font:inherit;padding:4px 8px;border:none;border-radius:4px;width:190px;}
.mqt-head button{font:bold 11px sans-serif;letter-spacing:1px;text-transform:uppercase;border:none;
    border-radius:5px;padding:5px 10px;cursor:pointer;background:#1a1206;color:#ffcf6b;}
.mqt-head button:hover{filter:brightness(1.3);}
.mqt-head .sp{flex:1;}
.mqt-head .mqt-count{background:#1a1206;color:#C2B74B;padding:2px 9px;border-radius:8px;font:bold 12px monospace;}
.mqt-head .mqt-x{background:transparent;color:#1a1206;font-size:16px;padding:2px 6px;}
.mqt-eff{padding:5px 14px;font:10px monospace;color:#8a7430;background:#140f06;flex:0 0 auto;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mqt-scroll{flex:1 1 auto;overflow:auto;}
.mqt table{width:100%;border-collapse:collapse;}
.mqt th,.mqt td{text-align:left;padding:5px 14px;border-bottom:1px solid #1c1810;vertical-align:top;}
.mqt th{position:sticky;top:0;background:#140f06;color:#C2B74B;letter-spacing:1px;}
.mqt td.topic{color:#6FC8F0;white-space:nowrap;}
.mqt td.val{color:#ffe9b0;white-space:pre-wrap;word-break:break-word;}
.mqt td.age{color:#8a7430;text-align:right;white-space:nowrap;}
.mqt .empty{padding:40px;text-align:center;color:#6a5a30;letter-spacing:1px;}`;

export function initMqttTree(bus: TwistBus): void {
  if (document.querySelector('.mq-chip')) return;
  addStyles('mqtt-tree-styles', MQ_CSS);

  const dot = el('span', { class: 'mq-dot' });
  const chip = el('button', { class: 'mq-chip', title: 'MQTT — live retained topic tree' }, [dot, el('span', {}, ['MQTT'])]);

  const hostInput = el('input', { type: 'text', placeholder: 'host[:port]', value: getBrokerSetting() }) as HTMLInputElement;
  const bGo = el('button', {}, ['Save & Connect']);
  const bOff = el('button', {}, ['Disable']);
  const bX = el('button', { class: 'mqt-x', title: 'Close' }, ['×']);
  const countEl = el('span', { class: 'mqt-count' }, ['0']);
  const effEl = el('div', { class: 'mqt-eff' }, ['— not connected —']);
  const rows = el('tbody');
  rows.innerHTML = '<tr><td colspan="3" class="empty">— not connected —</td></tr>';

  const table = el('table', {}, [
    el('thead', {}, [el('tr', {}, [
      el('th', { style: 'width:44%' }, [`TOPIC (${TWIST_ROOT}/…)`]),
      el('th', {}, ['PAYLOAD']),
      el('th', { style: 'width:70px' }, ['AGE']),
    ])]),
    rows,
  ]);
  const panel = el('div', { class: 'mqt' }, [
    el('div', { class: 'mqt-head' }, [
      el('span', {}, ['TWIST MQTT TREE']), hostInput, bGo, bOff,
      el('span', { class: 'sp' }), countEl, bX,
    ]),
    effEl,
    el('div', { class: 'mqt-scroll' }, [table]),
  ]);
  document.body.append(panel, chip);

  // ---- diagnostic connection + retained-topic store -------------------------
  const store = new Map<string, { payload: string; ts: number }>();
  let client: MqttClient | null = null;
  let connected = false;
  let started = false;

  const render = (): void => {
    countEl.textContent = String(store.size);
    if (!store.size) {
      rows.innerHTML = `<tr><td colspan="3" class="empty">${connected ? '— no retained topics yet —' : '— not connected —'}</td></tr>`;
      return;
    }
    const now = Date.now();
    rows.innerHTML = [...store.keys()].sort().map((k) => {
      const { payload, ts } = store.get(k)!;
      const rel = k.startsWith(TWIST_ROOT + '/') ? k.slice(TWIST_ROOT.length + 1) : k;
      const age = Math.max(0, Math.round((now - ts) / 1000));
      return `<tr><td class="topic">${escapeHtml(rel)}</td><td class="val">${escapeHtml(payload)}</td><td class="age">${age}s</td></tr>`;
    }).join('');
  };

  const connect = (): void => {
    const url = resolveUrl(hostInput.value);
    if (!url) { effEl.textContent = '→ (disabled — enter a broker host, e.g. 44.44.44.152)'; return; }
    effEl.textContent = `→ ${url}`;
    void loadMqtt().then((mod) => {
      if (!mod) { effEl.textContent = '→ mqtt.js unavailable (CDN blocked?)'; return; }
      if (client) { try { client.end(true); } catch { /* ignore */ } }
      connected = false; store.clear(); render();
      client = mod.connect(url, { username: 'guest', password: 'guest', keepalive: 60, reconnectPeriod: 5000 });
      client.on('connect', () => { connected = true; client!.subscribe(`${TWIST_ROOT}/#`, { qos: 0 }); render(); });
      client.on('reconnect', () => { connected = false; });
      client.on('close', () => { connected = false; });
      client.on('offline', () => { connected = false; });
      client.on('message', (topic: string, payload: Uint8Array) => {
        let txt = new TextDecoder().decode(payload);
        try { txt = JSON.stringify(JSON.parse(txt)); } catch { /* leave raw */ }
        if (!txt) store.delete(topic); else store.set(topic, { payload: txt, ts: Date.now() });
        render();
      });
    });
  };

  // Chip toggles the panel; the tree auto-connects on first open if a broker is set.
  chip.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    if (open && !started && resolveUrl(hostInput.value)) { started = true; connect(); }
  });
  bX.addEventListener('click', () => panel.classList.remove('open'));
  // Save & Connect persists the host (so the shared publishing bus adopts it on the
  // next boot) and reloads; Disable clears it. Both mirror the old settings popover.
  bGo.addEventListener('click', () => { setBrokerSetting(hostInput.value); location.reload(); });
  bOff.addEventListener('click', () => { setBrokerSetting(''); location.reload(); });

  // The chip dot reflects the live diagnostic connection, falling back to the shared
  // bus's configured/connected state before the panel has been opened.
  const paint = (): void => {
    const s = bus.status();
    const live = started ? connected : s.connected;
    const enabled = started ? !!resolveUrl(hostInput.value) : s.enabled;
    dot.className = 'mq-dot' + (live ? ' live' : enabled ? ' on' : '');
    chip.title = live ? 'MQTT connected — click for the topic tree'
      : enabled ? 'MQTT configured — click for the topic tree'
      : 'MQTT off — click to set a broker';
  };
  paint();
  setInterval(() => { paint(); if (panel.classList.contains('open')) render(); }, 1000);
}
