// src/ui/console/clock — the UTC read-out pinned bottom-right (a footer element).
// Port of js/clock.js: HH:MM UTC with the seconds rendered as 60 pulsating dots
// filling across the minute (the current-second dot pulses hardest). Click the
// TIME to cycle UTC → Unix epoch → date-timecode; click the DOTS to open the
// production schedule (hook — the schedule editor ports later).
import { addStyles } from '../dom.js';

const CLOCK_CSS = `
.ptp-clock{position:fixed;right:14px;bottom:42px;z-index:1000;font-family:'Courier New',Consolas,monospace;font-size:13px;font-weight:bold;
    letter-spacing:1px;color:var(--cyan,#00ffff);background:none;border:none;padding:5px 6px;cursor:pointer;user-select:none;white-space:nowrap;
    display:inline-flex;align-items:center;gap:9px;text-shadow:0 0 8px rgba(0,0,0,.7);transition:color .2s,filter .2s;}
.ptp-clock:hover{filter:brightness(1.2);}
.ck-dots{display:grid;grid-template-columns:repeat(30,2px);grid-auto-rows:2px;gap:1px;align-content:center;}
.ck-dot{width:2px;height:2px;border-radius:50%;background:#10241c;}
.ck-dot.on{background:#33dd66;animation:ckP 1.4s ease-in-out infinite;}
.ck-dot.now{background:#daffe8;box-shadow:0 0 5px #6dffa0;animation:ckN .9s ease-in-out infinite;}
@keyframes ckP{0%,100%{opacity:.5;}50%{opacity:1;}}
@keyframes ckN{0%,100%{transform:scale(1);opacity:.75;}50%{transform:scale(1.7);opacity:1;}}
.ptp-clock.num{color:#ffaa00;}
.ptp-clock.num .ck-time{color:#ffaa00;}
.ptp-clock .ptp-dot{color:#33dd66;}`;

const pad = (n: number): string => String(n).padStart(2, '0');
const MODES = ['dots', 'unix', 'datetime'] as const;
type Mode = (typeof MODES)[number];

/** Mount the bottom-right UTC clock. `onScheduleOpen` fires when the dots are clicked. */
export function initClock(onScheduleOpen?: () => void): void {
  if (document.getElementById('ptp-clock')) return;
  addStyles('ptp-clock-styles', CLOCK_CSS);

  const el = document.createElement('div');
  el.id = 'ptp-clock';
  el.className = 'ptp-clock';
  el.title = 'Click the TIME to change format · click the DOTS for your schedule';
  el.innerHTML = `<span class="ck-time"></span><span class="ck-dots"></span>`;
  document.body.appendChild(el);

  const timeEl = el.querySelector<HTMLElement>('.ck-time')!;
  const dotsEl = el.querySelector<HTMLElement>('.ck-dots')!;
  const dots: HTMLElement[] = [];
  for (let i = 0; i < 60; i++) {
    const d = document.createElement('span');
    d.className = 'ck-dot';
    dotsEl.appendChild(d);
    dots.push(d);
  }

  let mode: Mode = 'dots';
  let lastSec = -1;
  timeEl.style.cursor = 'pointer';
  timeEl.title = 'Click to cycle  UTC · Unix epoch · date-timecode';
  timeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length] ?? 'dots';
    lastSec = -1;
  });
  dotsEl.style.cursor = 'pointer';
  dotsEl.title = 'Click the seconds to open your production schedule & crew';
  dotsEl.addEventListener('click', (e) => { e.stopPropagation(); onScheduleOpen?.(); });

  const tick = (): void => {
    const d = new Date();
    const H = pad(d.getUTCHours()), Mi = pad(d.getUTCMinutes()), S = d.getUTCSeconds();
    if (S !== lastSec) {
      lastSec = S;
      for (let i = 0; i < 60; i++) {
        const dot = dots[i];
        if (dot) dot.className = 'ck-dot' + (i <= S ? ' on' : '') + (i === S ? ' now' : '');
      }
    }
    if (mode === 'dots') {
      timeEl.textContent = `${H}:${Mi} UTC`;
    } else if (mode === 'unix') {
      timeEl.innerHTML = `<span class="ptp-dot">◉</span> ${Math.floor(d.getTime() / 1000)}`;
    } else {
      const Y = d.getUTCFullYear(), Mo = pad(d.getUTCMonth() + 1), Da = pad(d.getUTCDate());
      const FF = pad(Math.floor(d.getUTCMilliseconds() / 10));
      timeEl.textContent = `${Y}${Mo}${Da}:${H}${Mi}:${pad(S)}:${FF}`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
