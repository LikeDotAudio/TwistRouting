// js/mission.js — the active working context (which room / production / floor /
// edit suite / encoder you have open) is mirrored into the URL as `#on/<group>/<name>`
// and tied to your MISSION from the schedule: the show booked to that room and
// whether your role is on its crew. A slim banner names it; click → open schedule.
//
// The hash is written with replaceState (no history spam, no hashchange storm) and
// only when no overlay/editor owns the hash — so deep-link routes are never clobbered.
(function () {
    'use strict';
    const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const fmt = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
    const nowH = () => { try { const d = new Date(); return d.getHours() + d.getMinutes() / 60; } catch (e) { return 14.2; } };

    function injectStyles() {
        if (document.getElementById('mission-styles')) return;
        const s = document.createElement('style'); s.id = 'mission-styles';
        s.textContent = `
        .mz-bar{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:1500;
            display:none;align-items:center;gap:10px;cursor:pointer;
            background:linear-gradient(90deg,rgba(8,16,34,.92),rgba(12,24,48,.92));
            border:1px solid #21406a;border-radius:999px;padding:5px 14px;
            font-family:Arial,Helvetica,sans-serif;color:#cfe6ff;font-size:11px;letter-spacing:1px;
            box-shadow:0 4px 18px rgba(0,0,0,.45);max-width:78vw;}
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
        @keyframes mzPulse{0%,100%{opacity:.8;}50%{opacity:1;box-shadow:0 0 12px rgba(255,59,59,.7);}}
        `;
        document.head.appendChild(s);
    }

    let bar;
    function ensureBar() {
        injectStyles(); if (bar) return bar;
        bar = document.createElement('div'); bar.className = 'mz-bar';
        bar.title = 'Your current mission — click to open the schedule';
        bar.addEventListener('click', () => { if (window.Schedule) window.Schedule.show(); });
        document.body.appendChild(bar);
        return bar;
    }

    // The active destination tab + its group lineage (room TYPE → … → tab name).
    function activeContext() {
        const tab = document.querySelector('.lcars-tab.active');
        if (!tab) return null;
        const name = (tab.innerText || '').trim();
        if (!name) return null;
        const lineage = [];
        for (let g = tab.closest('.lcars-group'); g; g = g.parentElement && g.parentElement.closest('.lcars-group')) {
            const l = g.querySelector(':scope > .lcars-group-label span'); if (l) lineage.unshift(l.innerText.trim());
        }
        return { name, lineage, group: lineage[0] || 'DESTINATION' };
    }

    // Best schedule slot for this context — score by shared words against room+show.
    function matchSlot(ctx) {
        const data = (window.Schedule && window.Schedule.data) || [];
        const hay = (ctx.name + ' ' + ctx.lineage.join(' ')).toLowerCase();
        const words = hay.split(/[^a-z0-9]+/).filter(w => w.length > 3);
        let best = null, score = 0;
        data.forEach(sl => {
            const room = (sl.room + ' ' + sl.show).toLowerCase();
            let sc = 0; words.forEach(w => { if (room.indexOf(w) >= 0) sc++; });
            if (sc > score) { score = sc; best = sl; }
        });
        return score > 0 ? best : null;
    }

    function roleInfo() { return (window.Auth && window.Auth.role) || null; }
    function divisionColor(tier) {
        return /command/i.test(tier) ? '#e0524a' : /scien/i.test(tier) ? '#5b8def' : '#e0b53a';
    }

    function setURL(ctx) {
        const h = location.hash || '';
        if (h && !/^#on\//.test(h)) return;   // an overlay / editor owns the hash
        const want = '#on/' + slug(ctx.group) + '/' + slug(ctx.name);
        if (h !== want) { try { history.replaceState(null, '', want); } catch (e) {} }
    }

    function render() {
        const ctx = activeContext();
        ensureBar();
        if (!ctx) { bar.classList.remove('show'); return; }
        setURL(ctx);
        const role = roleInfo();
        const slot = matchSlot(ctx);
        const now = nowH();
        let liveCls = 'idle', liveTxt = 'STANDBY';
        if (slot) {
            if (now >= slot.s && now < slot.e) { liveCls = 'now'; liveTxt = '● LIVE NOW'; }
            else if (slot.s > now) { liveCls = 'next'; liveTxt = 'UP ' + fmt(slot.s); }
            else { liveCls = 'idle'; liveTxt = 'WRAPPED'; }
        }
        const col = role ? divisionColor(role.tier) : '#6b82a3';
        const roleHtml = role
            ? `<span class="mz-role"><span class="mz-dot" style="color:${col}"></span>You: <b style="color:${col}">${role.name}</b> · ${role.sub || role.tier}</span>`
            : '';
        const showHtml = slot ? `<span class="mz-show">▣ ${slot.show}</span>` : `<span class="mz-show">▣ no show booked</span>`;
        bar.innerHTML = `<span class="mz-where">${ctx.group} · ${ctx.name}</span>${showHtml}${roleHtml}<span class="mz-live ${liveCls}">${liveTxt}</span>`;
        bar.classList.add('show');
    }

    // Re-render when the active tab changes (class mutations) and once a minute for
    // the live/up-next state. Debounced via rAF.
    let pending = false;
    function schedule() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(); }); }

    function init() {
        ensureBar();
        new MutationObserver(schedule).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
        setInterval(render, 30000);
        schedule();
        window.Mission = { render, context: activeContext };
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
