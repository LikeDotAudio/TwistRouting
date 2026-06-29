// js/clock.js
// A UTC read-out pinned bottom-right. Shows HH:MM (UTC) with the SECONDS rendered
// as a series of 60 pulsating dots that fill across the minute — the leading
// (current-second) dot pulses hardest. Click to toggle to a numeric view
// (Unix epoch / 100 fps timecode).
(function () {
    'use strict';

    function init() {
        if (document.getElementById('ptp-clock')) return;

        const style = document.createElement('style');
        style.textContent = `
            .ptp-clock{position:fixed;right:14px;bottom:42px;z-index:1000;
                font-family:'Courier New',Consolas,monospace;font-size:13px;font-weight:bold;
                letter-spacing:1px;color:var(--cyan,#00ffff);background:none;border:none;padding:5px 6px;
                cursor:pointer;user-select:none;white-space:nowrap;display:inline-flex;align-items:center;gap:9px;
                text-shadow:0 0 8px rgba(0,0,0,.7);transition:color .2s,filter .2s;}
            .ptp-clock:hover{filter:brightness(1.2);}
            .ck-dots{display:grid;grid-template-columns:repeat(30,2px);grid-auto-rows:2px;gap:1px;align-content:center;}
            .ck-dot{width:2px;height:2px;border-radius:50%;background:#10241c;}
            .ck-dot.on{background:#33dd66;animation:ckP 1.4s ease-in-out infinite;}
            .ck-dot.now{background:#daffe8;box-shadow:0 0 5px #6dffa0;animation:ckN .9s ease-in-out infinite;}
            @keyframes ckP{0%,100%{opacity:.5;}50%{opacity:1;}}
            @keyframes ckN{0%,100%{transform:scale(1);opacity:.75;}50%{transform:scale(1.7);opacity:1;}}
            .ptp-clock.num{color:#ffaa00;}
            .ptp-clock.num .ck-time{color:#ffaa00;}
            .ptp-clock .ptp-dot{color:#33dd66;}
        `;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'ptp-clock';
        el.className = 'ptp-clock';
        el.title = 'Click the TIME to change format · click the DOTS for your schedule';
        el.innerHTML = `<span class="ck-time"></span><span class="ck-dots"></span>`;
        document.body.appendChild(el);

        const timeEl = el.querySelector('.ck-time');
        const dotsEl = el.querySelector('.ck-dots');
        for (let i = 0; i < 60; i++) dotsEl.appendChild(document.createElement('span')).className = 'ck-dot';
        const dots = dotsEl.children;

        let mode = 'dots';   // 'dots' (UTC + seconds dots) → 'unix' → 'datetime'
        const pad = (n) => String(n).padStart(2, '0');
        let lastSec = -1;

        // Two separate hit targets on the read-out:
        //  • the TIME cycles UTC → Unix epoch → full date-timecode,
        //  • the 60 SECONDS DOTS open the production SCHEDULE (your shift & crew).
        const MODES = ['dots', 'unix', 'datetime'];
        timeEl.style.cursor = 'pointer';
        timeEl.title = 'Click to cycle  UTC · Unix epoch · date-timecode';
        timeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
            lastSec = -1;
        });
        dotsEl.style.cursor = 'pointer';
        dotsEl.title = 'Click the seconds to open your production schedule & crew';
        dotsEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.Schedule) window.Schedule.show();
        });

        function tick() {
            const d = new Date();   // UTC components = system time in UTC
            const H = pad(d.getUTCHours()), Mi = pad(d.getUTCMinutes()), S = d.getUTCSeconds();
            // The seconds dots are always present — in EVERY mode. They are the
            // heartbeat of the clock and the hit target that opens your schedule.
            if (S !== lastSec) {
                lastSec = S;
                for (let i = 0; i < 60; i++) dots[i].className = 'ck-dot' + (i <= S ? ' on' : '') + (i === S ? ' now' : '');
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
        }
        requestAnimationFrame(tick);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
