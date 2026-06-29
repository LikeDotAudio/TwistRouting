// js/schedule.js — clicking the clock opens the production SCHEDULE: the day's
// timeline of shows, the room each is assigned to, and the crew ROLES (not names)
// booked into that slot. The "live now" slot is highlighted. This is the surface
// of the Schedule → Timeline → Resource-Booking model the access system uses.
(function () {
    'use strict';
    const SCHEDULE = [
        { s: 6, e: 9, show: 'Morning Show', room: 'Primary Control Room', crew: ['First Officer · Director', 'Conn · TD', 'Chief Engineer', 'Comms', 'Ops'] },
        { s: 12, e: 12.5, show: 'News at Noon', room: 'Studio 2 · 2nd Floor', crew: ['First Officer · Director', 'Conn · TD', 'Chief Engineer', 'Tactical', 'Comms'] },
        { s: 14, e: 16, show: 'Sports Weekly', room: 'Studio 3 · 3rd Floor', crew: ['Captain · EP', 'First Officer · Director', 'Conn · TD', 'Chief Engineer', 'Tactical', 'Comms', 'Ops', 'Science'] },
        { s: 19, e: 21, show: 'Prime Time News', room: 'Primary Control Room', crew: ['Captain · EP', 'First Officer · Director', 'Conn · TD', 'Chief Engineer', 'Tactical', 'Comms'] },
    ];
    const fmt = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

    // Crew roles map to the three Starfleet divisions — Command (red), Operations
    // (gold), Sciences (blue) — so the manifest reads as a duty roster by department.
    function division(role) {
        if (/captain|first officer|director|conn|helm|\btd\b/i.test(role)) return ['Command', '#e0524a'];
        if (/science|metadata|analytics|medical|counselor/i.test(role)) return ['Sciences', '#5b8def'];
        return ['Operations', '#e0b53a'];
    }

    function injectStyles() {
        if (document.getElementById('sched-styles')) return;
        const s = document.createElement('style'); s.id = 'sched-styles';
        s.textContent = `
        .sc-ov{position:fixed;inset:0;z-index:3100;display:none;align-items:center;justify-content:center;
            background:radial-gradient(circle at 50% 30%,rgba(13,23,48,.92),rgba(3,6,15,.96));font-family:Arial,Helvetica,sans-serif;}
        .sc-ov.open{display:flex;}
        .sc-box{width:min(960px,94vw);max-height:90vh;overflow:auto;background:#0a1326;border:1px solid #1d2942;border-radius:16px;padding:26px;}
        .sc-box h2{margin:0 0 2px;color:#fff;font-size:22px;letter-spacing:2px;}
        .sc-box p{margin:0 0 20px;color:#7e93b5;font-size:12px;letter-spacing:1px;}
        .sc-slot{display:grid;grid-template-columns:120px 1fr;gap:14px;border-radius:12px;border:1px solid #2c3e5e;background:#0c1730;padding:14px;margin-bottom:12px;}
        .sc-slot.live{border-color:#ff3b3b;box-shadow:0 0 16px rgba(255,59,59,.35);}
        .sc-time{font:bold 15px 'Courier New',monospace;color:#6FC8F0;letter-spacing:1px;}
        .sc-time .badge{display:inline-block;margin-top:8px;font:900 9px sans-serif;letter-spacing:1px;border-radius:5px;padding:3px 7px;background:#1d2942;color:#9fb6cc;}
        .sc-slot.live .sc-time .badge{background:#ff3b3b;color:#fff;}
        .sc-show b{display:block;color:#fff;font-size:17px;letter-spacing:1px;}
        .sc-room{color:#9fd6ff;font-size:12px;letter-spacing:1px;margin:3px 0 10px;}
        .sc-crew{display:flex;flex-wrap:wrap;gap:6px;}
        .sc-role{font:bold 10px sans-serif;letter-spacing:.5px;border-radius:6px;padding:5px 9px;background:#13233c;color:#cfe6ff;border:1px solid #2c3e5e;}
        .sc-legend{display:flex;gap:16px;margin:-8px 0 16px;font:bold 11px sans-serif;letter-spacing:1px;}
        .sc-hint{color:#6b82a3;font-size:11px;letter-spacing:1px;margin-top:6px;}
        `;
        document.head.appendChild(s);
    }

    let ov;
    function ensure() {
        injectStyles(); if (ov) return;
        ov = document.createElement('div'); ov.className = 'sc-ov';
        ov.innerHTML = `<div class="sc-box"><h2>PRODUCTION SCHEDULE</h2><p>TODAY · TIMELINE · ROOM & CREW BOOKING</p><div class="sc-legend"><span style="color:#e0524a">■ Command</span><span style="color:#e0b53a">■ Operations</span><span style="color:#5b8def">■ Sciences</span></div><div class="sc-list"></div><div class="sc-hint">Crew shown as ROLES booked to the slot — the access system loads each operator's scope from here.</div></div>`;
        ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
        document.body.appendChild(ov);
    }
    function build() {
        const list = ov.querySelector('.sc-list'); list.innerHTML = '';
        const now = nowHours();
        SCHEDULE.forEach(sl => {
            const live = now >= sl.s && now < sl.e;
            const el = document.createElement('div'); el.className = 'sc-slot' + (live ? ' live' : '');
            el.innerHTML = `<div class="sc-time">${fmt(sl.s)}<br>–${fmt(sl.e)}<div class="badge">${live ? '● LIVE NOW' : 'BOOKED'}</div></div>
                <div class="sc-show"><b>${sl.show}</b><div class="sc-room">▣ ${sl.room}</div>
                  <div class="sc-crew">${sl.crew.map(r => { const [d, c] = division(r); return `<span class="sc-role" style="border-color:${c};color:${c}" title="${d} division">${r}</span>`; }).join('')}</div></div>`;
            list.appendChild(el);
        });
    }
    function nowHours() { try { const d = new Date(); return d.getHours() + d.getMinutes() / 60; } catch (e) { return 14.2; } }
    function show() { ensure(); build(); ov.classList.add('open'); }

    // Clicking the clock's SECONDS DOTS opens the schedule (the time read-out itself
    // cycles UTC/Unix/date-timecode — see clock.js). Belt-and-braces with the
    // listener clock.js wires directly, in case the clock mounted before us.
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.ck-dots')) show(); });
    window.Schedule = { show, data: SCHEDULE };
})();
