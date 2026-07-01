// src/ui/console/mission — a slim banner (top-centre) naming your active working
// context (the open destination + its group lineage), tied to your MISSION from
// the schedule (the show booked to that room, and whether you're on its crew).
// Port of js/mission.js; clicking it opens the schedule. Mirrors the context into
// the URL as #on/<group>/<name> (replaceState, only when no overlay owns the hash).
import { addStyles } from '../dom.js';
import { role } from '../../platform/auth.js';
import { showSchedule, SCHEDULE, type Slot } from './schedule.js';

const slug = (s: string): string => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const fmt = (h: number): string => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const nowH = (): number => { try { const d = new Date(); return d.getHours() + d.getMinutes() / 60; } catch { return 14.2; } };

const MZ_CSS = `
.mz-bar{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:1500;display:none;align-items:center;gap:10px;cursor:pointer;background:linear-gradient(90deg,rgba(8,16,34,.92),rgba(12,24,48,.92));border:1px solid #21406a;border-radius:999px;padding:5px 14px;font-family:Arial,Helvetica,sans-serif;color:#cfe6ff;font-size:11px;letter-spacing:1px;box-shadow:0 4px 18px rgba(0,0,0,.45);max-width:78vw;}
.mz-bar.show{display:inline-flex;}
.mz-bar:hover{border-color:#3a6acc;}
.mz-where{font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34vw;}
.mz-show{color:#9fd6ff;white-space:nowrap;}
.mz-role{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
.mz-dot{width:8px;height:8px;border-radius:50%;display:inline-block;box-shadow:0 0 6px currentColor;}
.mz-live{font-weight:900;border-radius:6px;padding:2px 8px;letter-spacing:1px;}
.mz-live.now{background:#ff3b3b;color:#fff;animation:mzPulse 1.4s ease-in-out infinite;}
.mz-live.next{background:#1d2942;color:#9fb6cc;}
.mz-live.idle{background:#13233c;color:#6b82a3;}
@keyframes mzPulse{0%,100%{opacity:.8;}50%{opacity:1;box-shadow:0 0 12px rgba(255,59,59,.7);}}`;

interface Ctx { name: string; lineage: string[]; group: string }

function activeContext(): Ctx | null {
  const tab = document.querySelector<HTMLElement>('.lcars-tab.active');
  if (!tab) return null;
  const name = (tab.innerText || '').trim();
  if (!name) return null;
  const lineage: string[] = [];
  for (let g: Element | null = tab.closest('.lcars-group'); g; g = g.parentElement && g.parentElement.closest('.lcars-group')) {
    const l = g.querySelector<HTMLElement>(':scope > .lcars-group-label span');
    if (l) lineage.unshift(l.innerText.trim());
  }
  return { name, lineage, group: lineage[0] || 'DESTINATION' };
}

function matchSlot(ctx: Ctx): Slot | null {
  const hay = (ctx.name + ' ' + ctx.lineage.join(' ')).toLowerCase();
  const words = hay.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let best: Slot | null = null, score = 0;
  SCHEDULE.forEach((sl) => {
    const room = (sl.room + ' ' + sl.show).toLowerCase();
    let sc = 0; words.forEach((w) => { if (room.indexOf(w) >= 0) sc++; });
    if (sc > score) { score = sc; best = sl; }
  });
  return score > 0 ? best : null;
}

const divisionColor = (tier: string): string => (/command/i.test(tier) ? '#e0524a' : /scien/i.test(tier) ? '#5b8def' : '#e0b53a');

export function initMission(): void {
  if (document.querySelector('.mz-bar')) return;
  addStyles('mission-styles', MZ_CSS);
  const bar = document.createElement('div');
  bar.className = 'mz-bar';
  bar.title = 'Your current mission — click to open the schedule';
  bar.addEventListener('click', () => showSchedule());
  document.body.appendChild(bar);

  const setURL = (ctx: Ctx): void => {
    const h = location.hash || '';
    if (h && !/^#on\//.test(h)) return;   // an overlay/editor owns the hash
    const want = '#on/' + slug(ctx.group) + '/' + slug(ctx.name);
    if (h !== want) { try { history.replaceState(null, '', want); } catch { /* ignore */ } }
  };

  const render = (): void => {
    const ctx = activeContext();
    if (!ctx) { bar.classList.remove('show'); return; }
    setURL(ctx);
    const r = role();
    const slot = matchSlot(ctx);
    const now = nowH();
    let liveCls = 'idle', liveTxt = 'STANDBY';
    if (slot) {
      if (now >= slot.s && now < slot.e) { liveCls = 'now'; liveTxt = '● LIVE NOW'; }
      else if (slot.s > now) { liveCls = 'next'; liveTxt = 'UP ' + fmt(slot.s); }
      else { liveCls = 'idle'; liveTxt = 'WRAPPED'; }
    }
    const col = r ? divisionColor(r.tier) : '#6b82a3';
    const roleHtml = r
      ? `<span class="mz-role"><span class="mz-dot" style="color:${col}"></span>You: <b style="color:${col}">${r.name}</b> · ${r.sub || r.tier}</span>`
      : '';
    const showHtml = slot ? `<span class="mz-show">▣ ${slot.show}</span>` : `<span class="mz-show">▣ no show booked</span>`;
    bar.innerHTML = `<span class="mz-where">${ctx.group} · ${ctx.name}</span>${showHtml}${roleHtml}<span class="mz-live ${liveCls}">${liveTxt}</span>`;
    bar.classList.add('show');
  };

  let pending = false;
  const schedule = (): void => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(); }); };
  new MutationObserver(schedule).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  setInterval(render, 30000);
  schedule();
}
