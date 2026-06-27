// js/clock.js
// A UTC time read-out pinned to the bottom-right, just above the credit pill.
// Click to toggle between:
//   unix : the UTC system time as a Unix epoch counter  ->  "◉ 1782456271"
//   TC   : a broadcast date-timecode at 100 fps         ->  "YYYYMMDD:HHMM:SS:FF"
// Frames (FF) run 00–99 since the clock is 100 frames/second.
(function () {
    'use strict';

    function init() {
        if (document.getElementById('ptp-clock')) return;

        const style = document.createElement('style');
        style.textContent = `
            .ptp-clock{position:fixed;right:14px;bottom:42px;z-index:1000;
                font-family:'Courier New',Consolas,monospace;font-size:13px;font-weight:bold;
                letter-spacing:1px;color:var(--cyan,#00ffff);background:rgba(5,10,21,.88);
                border:1px solid rgba(0,255,255,.35);border-radius:12px;padding:5px 12px;
                cursor:pointer;user-select:none;white-space:nowrap;
                box-shadow:0 0 10px rgba(0,0,0,.5);transition:box-shadow .2s,border-color .2s,color .2s;}
            .ptp-clock:hover{border-color:var(--cyan,#00ffff);box-shadow:0 0 14px rgba(0,255,255,.5);}
            .ptp-clock .ptp-dot{color:#33dd66;}
            .ptp-clock.tc{color:#ffaa00;border-color:rgba(255,170,0,.45);}
            .ptp-clock.tc:hover{box-shadow:0 0 14px rgba(255,170,0,.5);}
        `;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'ptp-clock';
        el.className = 'ptp-clock';
        el.title = 'Click to toggle: Unix time ⟷ timecode (100 fps)';
        document.body.appendChild(el);

        let mode = 'ptp';   // 'ptp' | 'tc'
        el.addEventListener('click', () => {
            mode = (mode === 'ptp') ? 'tc' : 'ptp';
            el.classList.toggle('tc', mode === 'tc');
        });

        const pad = (n) => String(n).padStart(2, '0');

        function tick() {
            const d = new Date();   // UTC components below = system time in UTC
            const Y = d.getUTCFullYear(), Mo = pad(d.getUTCMonth() + 1), Da = pad(d.getUTCDate());
            const H = pad(d.getUTCHours()), Mi = pad(d.getUTCMinutes()), S = pad(d.getUTCSeconds());
            const FF = pad(Math.floor(d.getUTCMilliseconds() / 10)); // 100 fps -> 00..99
            const unix = Math.floor(d.getTime() / 1000);             // UTC epoch seconds
            el.innerHTML = (mode === 'ptp')
                ? `<span class="ptp-dot">◉</span> ${unix}`
                : `${Y}${Mo}${Da}:${H}${Mi}:${S}:${FF}`;
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
