// src/editors/audio-positioner — the AUDIO POSITIONER (CMDP · Circular Motion
// Displacement Potentiometer), a surround/spatial companion to the Monitor
// Console. Port of Anthony Kuzub's CMDP prototype into the A.8 side build.
//
// Every channel routed into the twist is placed on a radial field as a fader:
//   • angle  = azimuth (where the sound sits around the listener)
//   • radial travel NEAR→FAR = depth   (left-drag)
//   • cap arc = intensity/level        (right-drag / wheel)
// Channels are GROUPED by the bundle of audio sent in (shared feed colour), each
// bundle clustered into its own arc with a visibility / solo / select panel.

import type { EditorPlugin } from '../types.js';
import { el } from '../../ui/dom.js';
import type { EditorContext } from '../types.js';
import { injectAudioPositionerStyles } from './styles.js';

const NEAR_RADIUS = 120;
const FAR_RADIUS = 380;

interface Group { name: string; color: string; }
interface Chan { label: string; color: string; group: number; }

/** Longest common label prefix in a bundle → a readable group name. */
function commonPrefix(labels: string[]): string {
  if (!labels.length) return '';
  let p = labels[0] ?? '';
  for (const l of labels) { let i = 0; while (i < p.length && i < l.length && p[i] === l[i]) i++; p = p.slice(0, i); }
  return p.replace(/[\s\-_·:]+$/, '').trim();
}

/** Routed sources → channels grouped by bundle (feed colour). Falls back to
 *  config.inputs → CH N, mirroring the Monitor Console's derivation. */
function buildGroups(ctx: EditorContext): { groups: Group[]; chans: Chan[] } {
  const feeds: Array<{ label: string; color: string }> = ctx.sources.length
    ? ctx.sources.map((f) => ({ label: f.label, color: f.color }))
    : (ctx.twist.config?.inputs?.length
        ? ctx.twist.config.inputs.map((l) => ({ label: l, color: '#4d94ff' }))
        : Array.from({ length: 8 }, (_, i) => ({ label: `CH ${i + 1}`, color: '#4d94ff' })));
  // Bundle = feeds sharing a colour, in first-seen order.
  const order: string[] = [];
  const byColor = new Map<string, Array<{ label: string; color: string }>>();
  for (const f of feeds) { if (!byColor.has(f.color)) { byColor.set(f.color, []); order.push(f.color); } byColor.get(f.color)!.push(f); }
  const groups: Group[] = [];
  const chans: Chan[] = [];
  order.forEach((color, gi) => {
    const items = byColor.get(color)!;
    groups.push({ name: commonPrefix(items.map((x) => x.label)) || `BUNDLE ${gi + 1}`, color });
    items.forEach((it) => chans.push({ label: it.label, color, group: gi }));
  });
  return { groups, chans };
}

// A single positioner fader (one channel). Mirrors the prototype's Fader class.
class Fader {
  label: string; angle: number; group: number; color: string;
  visible = true; hovered = false; dragging = false;
  val: number; rot: number; x = 0; y = 0;
  readonly trackLen = FAR_RADIUS - NEAR_RADIUS;
  constructor(label: string, angleDeg: number, color: string, group: number, val: number, rot: number) {
    this.label = label; this.angle = angleDeg; this.color = color; this.group = group; this.val = val; this.rot = rot;
  }
  updatePosition(cx: number, cy: number): void {
    const rad = this.angle * Math.PI / 180, dist = NEAR_RADIUS + this.trackLen / 2;
    this.x = cx + dist * Math.cos(rad); this.y = cy + dist * Math.sin(rad);
  }
  hitTest(mx: number, my: number, cx: number, cy: number): boolean {
    const rad = this.angle * Math.PI / 180;
    const x1 = cx + (NEAR_RADIUS - 20) * Math.cos(rad), y1 = cy + (NEAR_RADIUS - 20) * Math.sin(rad);
    const x2 = cx + (FAR_RADIUS + 20) * Math.cos(rad), y2 = cy + (FAR_RADIUS + 20) * Math.sin(rad);
    const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
    if (l2 === 0) return Math.hypot(mx - x1, my - y1) < 30;
    const t = Math.max(0, Math.min(1, ((mx - x1) * (x2 - x1) + (my - y1) * (y2 - y1)) / l2));
    return Math.hypot(mx - (x1 + t * (x2 - x1)), my - (y1 + t * (y2 - y1))) < 30;
  }
  render(c: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (!this.visible) return;
    c.save();
    c.translate(this.x, this.y);
    c.rotate((this.angle + 90) * Math.PI / 180);
    const tl = this.trackLen;
    c.lineCap = 'round';
    c.lineWidth = 6; c.strokeStyle = '#000'; c.beginPath(); c.moveTo(0, -tl / 2); c.lineTo(0, tl / 2); c.stroke();
    c.lineWidth = 2; c.strokeStyle = '#222'; c.beginPath(); c.moveTo(0, -tl / 2); c.lineTo(0, tl / 2); c.stroke();
    c.lineWidth = 1; c.strokeStyle = '#666';
    for (let i = 0; i <= 10; i++) {
      const ly = -tl / 2 + tl * (i / 10), len = i % 5 === 0 ? 10 : 5;
      c.beginPath(); c.moveTo(-15, ly); c.lineTo(-15 - len, ly); c.stroke();
      c.beginPath(); c.moveTo(15, ly); c.lineTo(15 + len, ly); c.stroke();
    }
    const capY = -tl / 2 + (this.val / 100) * tl;
    c.translate(0, capY);
    c.rotate(-((this.angle + 90) * Math.PI / 180));
    const r = 22;
    c.fillStyle = '#333'; c.strokeStyle = this.hovered ? '#fff' : this.color; c.lineWidth = this.hovered ? 3 : 2;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
    const startDeg = 135, curDeg = 135 + (this.rot / 100) * 270, ar = r - 5;
    c.strokeStyle = this.color; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, ar, startDeg * Math.PI / 180, curDeg * Math.PI / 180); c.stroke();
    const indRad = curDeg * Math.PI / 180;
    c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo((r - 2) * Math.cos(indRad), (r - 2) * Math.sin(indRad)); c.stroke();
    c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fillStyle = this.color; c.fill();
    c.font = '10px Arial'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(this.val.toFixed(1), 0, -30);
    c.fillStyle = '#aaa'; c.font = '9px Arial'; c.fillText(this.rot.toFixed(0), 0, 35);
    c.restore();
    // Perimeter label (rotated upright, pushed out per group so bundles don't collide).
    c.save();
    const labRad = this.angle * Math.PI / 180, active = this.dragging || this.hovered;
    const labDist = FAR_RADIUS + 35 + this.group * 30 + (active ? 20 : 0);
    c.translate(cx + labDist * Math.cos(labRad), cy + labDist * Math.sin(labRad));
    let textRot = (this.angle + 90) * Math.PI / 180, chk = (this.angle + 90) % 360; if (chk < 0) chk += 360;
    if (chk > 90 && chk < 270) textRot += Math.PI;
    c.rotate(textRot);
    c.fillStyle = this.color; c.font = 'bold 12px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(this.label, 0, 0);
    c.restore();
  }
}

const plugin: EditorPlugin = {
  id: 'audio-positioner',
  title: 'AUDIO POSITIONER · CMDP',
  order: 5,
  match: (n) => /audio\s*position|positioner|\bCMDP\b|surround\s*pan/i.test(n),
  requiredCaps: ['audio'],
  render(host, ctx) {
    injectAudioPositionerStyles();
    const { groups, chans } = buildGroups(ctx);

    const wrap = el('div', { class: 'ap-wrap' });
    const canvas = el('canvas', {}) as HTMLCanvasElement;
    wrap.append(canvas);
    host.append(wrap);
    const c = canvas.getContext('2d');
    if (!c) return;

    // Build faders, clustering each bundle into its own arc segment of the circle.
    const faders: Fader[] = [];
    const total = Math.max(1, chans.length);
    let a = -90;   // start at the top
    groups.forEach((g, gi) => {
      const items = chans.filter((ch) => ch.group === gi);
      const span = 360 * (items.length / total);
      items.forEach((ch, k) => {
        const ang = a + span * ((k + 0.5) / Math.max(1, items.length));
        faders.push(new Fader(ch.label, ang, ch.color, gi, 20 + ((k * 37) % 70), 60 + ((k * 23) % 30)));
      });
      a += span;
    });

    // ----- Group panel: visibility / solo / select / rename / rotate -----
    const groupPanel = el('div', { class: 'ap-grouppanel' });
    let selectedGroup = -1;
    const selBtns: HTMLElement[] = [];
    const refreshStatusVis = (): void => {
      statusItems.forEach((si, i) => {
        const f = faders[i]; if (!f) return;
        const show = f.visible && (selectedGroup === -1 || f.group === selectedGroup);
        si.style.display = show ? 'flex' : 'none';
      });
    };
    groups.forEach((g, gi) => {
      const row = el('div', { class: 'ap-group-row' });
      const vis = el('div', { class: 'ap-vis active', title: 'Click: toggle · Dbl-click: solo' }, ['👁']);
      vis.addEventListener('click', (e) => {
        e.stopPropagation(); vis.classList.toggle('active');
        const on = vis.classList.contains('active');
        faders.forEach((f) => { if (f.group === gi) f.visible = on; });
        refreshStatusVis();
      });
      vis.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        groupPanel.querySelectorAll('.ap-vis').forEach((b, idx) => b.classList.toggle('active', idx === gi));
        faders.forEach((f) => { f.visible = f.group === gi; });
        refreshStatusVis();
      });
      const sel = el('div', { class: 'ap-sel', style: `border-left:4px solid ${g.color}`, title: 'Click: select · Dbl-click: rename · Mid-drag: rotate' }, [g.name]);
      sel.addEventListener('click', () => {
        selectedGroup = selectedGroup === gi ? -1 : gi;
        selBtns.forEach((b, idx) => b.classList.toggle('selected', idx === gi && selectedGroup === gi));
        refreshStatusVis();
      });
      sel.addEventListener('dblclick', (e) => { e.stopPropagation(); const n = prompt('Rename bundle:', g.name); if (n) { g.name = n; sel.textContent = n; } });
      sel.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); groupDrag = { gi, x: e.clientX }; } });
      selBtns.push(sel);
      row.append(vis, sel); groupPanel.append(row);
    });
    wrap.append(groupPanel);

    // ----- Status panel: per-channel azimuth / level / depth readout -----
    const statusPanel = el('div', { class: 'ap-status' });
    const statusItems: HTMLElement[] = [];
    const statusVals: Array<{ ang: HTMLElement; vol: HTMLElement; dst: HTMLElement }> = [];
    faders.forEach((f) => {
      const ang = el('span', {}, ['0']), vol = el('span', {}, ['0']), dst = el('span', {}, ['0']);
      const item = el('div', { class: 'ap-status-item', style: `border-left:4px solid ${f.color}` }, [
        el('span', { class: 'ap-status-id', style: `color:${f.color}` }, [f.label]),
        el('span', {}, ['Az ', ang, '°']), el('span', {}, ['Lvl ', vol]), el('span', {}, ['Dst ', dst]),
      ]);
      statusPanel.append(item); statusItems.push(item); statusVals.push({ ang, vol, dst });
    });
    wrap.append(statusPanel);

    const toggle = el('button', { class: 'ap-toggle' }, ['Hide Status']);
    toggle.addEventListener('click', () => {
      const hidden = statusPanel.style.opacity === '0';
      statusPanel.style.opacity = hidden ? '1' : '0';
      statusPanel.style.pointerEvents = hidden ? 'auto' : 'none';
      toggle.textContent = hidden ? 'Hide Status' : 'Show Status';
    });
    wrap.append(toggle);

    wrap.append(el('div', { class: 'ap-hints' }, [
      el('b', {}, ['CMDP Positioner']), el('br', {}), 'Left-drag: depth', el('br', {}),
      'Right-drag / wheel: level', el('br', {}), 'Alt/Mid-drag: azimuth', el('br', {}), 'Ctrl+wheel: rotate widget',
    ]));
    if (!ctx.sources.length) wrap.append(el('div', { class: 'ap-empty' }, ['No audio bundle routed yet — route sources into this AUDIO POSITIONER and each channel drops onto the field.']));

    // ----- geometry (relative to the wrap, not the viewport) -----
    let W = 0, H = 0, cx = 0, cy = 0;
    const fit = (): void => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (w === W && h === H) return;
      W = w; H = h; canvas.width = w; canvas.height = h; cx = w / 2; cy = h / 2;
      faders.forEach((f) => f.updatePosition(cx, cy));
    };

    // ----- interaction -----
    let active: Fader | null = null, hovered: Fader | null = null;
    let startX = 0, startY = 0, startVal = 0, startRot = 0;
    let groupDrag: { gi: number; x: number } | null = null;
    const clamp = (v: number): number => Math.max(0, Math.min(100, v));
    const at = (e: MouseEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const topAt = (mx: number, my: number): Fader | null => {
      for (let i = faders.length - 1; i >= 0; i--) { const f = faders[i]; if (f && f.visible && f.hitTest(mx, my, cx, cy)) return f; }
      return null;
    };
    const onDown = (e: MouseEvent): void => {
      const [mx, my] = at(e); const hit = topAt(mx, my);
      if (hit) { active = hit; startX = mx; startY = my; startVal = hit.val; startRot = hit.rot; hit.dragging = true; }
    };
    const onMove = (e: MouseEvent): void => {
      if (groupDrag) { const dx = e.clientX - groupDrag.x; faders.forEach((f) => { if (f.group === groupDrag!.gi) { f.angle += dx * 0.5; f.updatePosition(cx, cy); } }); groupDrag.x = e.clientX; return; }
      const [mx, my] = at(e);
      if (!active) { hovered = topAt(mx, my); faders.forEach((f) => (f.hovered = f === hovered)); canvas.style.cursor = hovered ? 'pointer' : 'default'; return; }
      const f = active, isAlt = e.altKey, isRight = e.buttons === 2, isLeft = e.buttons === 1, isMid = e.buttons === 4;
      if ((isAlt && isLeft) || isMid) { f.angle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI; f.updatePosition(cx, cy); }
      else if (isRight) { f.rot = clamp(startRot + (mx - startX) * 0.5); }
      else if (isLeft) { const rad = f.angle * Math.PI / 180; const proj = (mx - startX) * Math.cos(rad) + (my - startY) * Math.sin(rad); f.val = clamp(startVal - proj / f.trackLen * 100); }
    };
    const onUp = (): void => { if (active) { active.dragging = false; active = null; } groupDrag = null; };
    const onDbl = (e: MouseEvent): void => {
      const [mx, my] = at(e); const hit = topAt(mx, my);
      if (hit) { const n = prompt('Rename channel:', hit.label); if (n) { hit.label = n; const i = faders.indexOf(hit); const idEl = statusItems[i]?.querySelector('.ap-status-id'); if (idEl) idEl.textContent = n; } }
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault(); const d = -Math.sign(e.deltaY);
      if (hovered) { if (e.altKey || e.ctrlKey) { hovered.angle += d * 3; hovered.updatePosition(cx, cy); } else hovered.rot = clamp(hovered.rot + d * 5); }
    };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    ctx.dispose.add(() => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); });

    // ----- draw loop -----
    const drawFace = (): void => {
      const r = 40, orange = '#f4902c'; c.save(); c.translate(cx, cy);
      c.fillStyle = '#333'; c.strokeStyle = orange; c.lineWidth = 2;
      c.beginPath(); c.ellipse(-r - 5, 0, 10, 15, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(r + 5, 0, 10, 15, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#444'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
      const target = active || hovered;
      if (target) { c.fillStyle = '#fff'; c.font = 'bold 10px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; let t = target.label; if (t.length > 10) t = t.slice(0, 8) + '..'; c.fillText(t, 0, 0); }
      c.fillStyle = orange; c.beginPath(); c.moveTo(0, -r - 10); c.lineTo(-10, -r + 5); c.lineTo(10, -r + 5); c.closePath(); c.fill(); c.stroke();
      c.restore();
    };
    ctx.dispose.raf(() => {
      fit();
      c.fillStyle = '#181818'; c.fillRect(0, 0, W, H);
      drawFace();
      c.strokeStyle = '#f4902c'; c.setLineDash([5, 5]); c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, NEAR_RADIUS, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(cx, cy, FAR_RADIUS, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#f4902c'; c.font = 'bold 12px Arial'; c.textAlign = 'center';
      c.fillText('NEAR', cx, cy - NEAR_RADIUS - 10); c.fillText('FAR', cx, cy - FAR_RADIUS - 10);
      faders.forEach((f) => f.render(c, cx, cy));
      faders.forEach((f, i) => { const v = statusVals[i]; if (!v) return; let ang = f.angle % 360; if (ang < 0) ang += 360; v.ang.textContent = ang.toFixed(0); v.vol.textContent = f.rot.toFixed(0); v.dst.textContent = f.val.toFixed(0); });
    });
  },
};

export default plugin;
