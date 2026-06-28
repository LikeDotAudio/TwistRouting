import { register, addStyles, channelsFor, gatherSources, knob, meterBar, pushTimer } from './core.js';
// js/editors/intercom.js
(function () {
    'use strict';
    // helpers imported at module top from ./core.js

    addStyles('twist-editor-intercom', `
        /* ===== Intercom ===== */
        .ic-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:18px;}
        .ic-key{background:#10192c;border:1px solid #27344f;border-radius:7px;
            padding:10px;display:flex;flex-direction:column;gap:8px;align-items:stretch;}
        .ic-key .ic-name{font-weight:900;letter-spacing:1px;text-align:center;font-size:13px;color:#cfe0ff;
            background:#1c2840;border-radius:4px;padding:8px 4px;cursor:pointer;transition:all .1s;}
        .ic-key.talk .ic-name{background:#ff8a00;color:#000;box-shadow:0 0 12px rgba(255,138,0,.6);}
        .ic-key.listen .ic-name{box-shadow:inset 0 0 0 2px #33dd66;color:#9fffc0;}
        .ic-key.live .ic-name{outline:2px solid #ff3344;}
        .ic-tl{display:flex;gap:6px;}
        .ic-tl button{flex:1;font-size:9px;font-weight:900;letter-spacing:1px;border:none;border-radius:3px;
            padding:4px;cursor:pointer;background:#26324d;color:#cfe0ff;}
        .ic-tl button.talk.on{background:#ff8a00;color:#000;}
        .ic-tl button.listen.on{background:#1ba23f;color:#fff;}
        .ic-vol{width:100%;accent-color:var(--cyan,#00ffff);}
        .ic-sub{display:flex;gap:16px;flex-wrap:wrap;}
        .ic-card{background:#0d1424;border:1px solid #233150;border-radius:8px;padding:12px 16px;min-width:200px;}
        .ic-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 0;font-size:12px;}
        .ic-pill{font-size:10px;font-weight:900;letter-spacing:1px;padding:3px 9px;border-radius:10px;
            background:#1c2840;color:#9fb6cc;cursor:pointer;}
        .ic-pill.on{background:#33dd66;color:#000;}

        /* ===== Intercom — TALK GROUPS ===== */
        .ic-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;}
        .ic-tool-btn{padding:11px 22px;border-radius:18px;background:var(--ed-color,#FF9C63);color:#000;
            font-weight:900;letter-spacing:1px;font-size:12px;cursor:pointer;border:none;}
        .ic-tool-btn.ghost{background:#26324d;color:#cfe0ff;}
        .ic-hint{font-size:11px;letter-spacing:1px;color:var(--cyan,#00ffff);font-weight:bold;}
        .ic-groups{display:flex;flex-direction:column;gap:10px;margin-bottom:18px;}
        .ic-group{display:flex;align-items:stretch;gap:12px;background:#0d1424;border:1px solid #233150;
            border-radius:14px;padding:10px;}
        .ic-group-talk{flex:0 0 auto;min-width:170px;border:none;border-radius:12px;cursor:pointer;
            background:linear-gradient(#2a3550,#1a2440);font-weight:900;letter-spacing:2px;font-size:18px;color:#cfe0ff;
            display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:16px 26px;
            transition:all .1s;}
        .ic-group-talk small{font-size:9px;opacity:.7;font-weight:bold;letter-spacing:1px;}
        .ic-group-talk:hover{filter:brightness(1.12);}
        .ic-group.on .ic-group-talk{background:#ff8a00;color:#000;box-shadow:0 0 20px rgba(255,138,0,.75);}
        .ic-group-members{flex:1;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
        .ic-chip{font-size:11px;font-weight:bold;letter-spacing:.5px;background:#1c2840;color:#cfe0ff;
            padding:6px 11px;border-radius:10px;}
        .ic-group-x{flex:0 0 auto;align-self:center;cursor:pointer;color:#7e93b5;font-weight:900;font-size:20px;padding:0 10px;}
        .ic-group-x:hover{color:#ff6677;}
        .ic-grid.selecting .ic-key{cursor:pointer;}
        .ic-key.picked{outline:3px solid var(--cyan,#00ffff);outline-offset:1px;}
    `);

    // ======================= INTERCOM =======================================
    function renderIntercom(body, twist, config) {
        let keys = gatherSources(twist).map(s => s.label);
        if (!keys.length) keys = ['DIRECTOR', 'TD / SWITCH', 'A1 AUDIO', 'FLOOR MGR', 'CAM 1', 'CAM 2', 'CAM 3', 'VTR / REPLAY', 'GRAPHICS', 'LIGHTING', 'PRODUCER', 'TECH'];

        // ---- Talk groups: gang several panels under one big TALK button -------
        const groups = [];           // [{ name, members:[keyIndex...], on:bool }]
        let selecting = false;
        const picked = new Set();

        const toolbar = document.createElement('div');
        toolbar.className = 'ic-toolbar';
        toolbar.innerHTML = `
            <button class="ic-tool-btn" data-new>＋ NEW TALK GROUP</button>
            <button class="ic-tool-btn ghost" data-cancel style="display:none">CANCEL</button>
            <span class="ic-hint" data-hint></span>`;
        body.appendChild(toolbar);

        const groupsWrap = document.createElement('div');
        groupsWrap.className = 'ic-groups';
        body.appendChild(groupsWrap);

        const grid = document.createElement('div');
        grid.className = 'ic-grid';
        body.appendChild(grid);

        const keyEls = [];
        keys.forEach((label, i) => {
            const k = document.createElement('div');
            k.className = 'ic-key' + (i === 4 ? ' live' : '');   // CAM 1 shown on-air (tally)
            k.innerHTML = `
                <div class="ic-name">${label}</div>
                <div class="ic-tl"><button class="talk">TALK</button><button class="listen">LISTEN</button></div>
                <input class="ic-vol" type="range" min="0" max="100" value="${60 + (i * 7) % 35}">`;
            const talkBtn = k.querySelector('.talk');
            const listenBtn = k.querySelector('.listen');
            const latch = () => { k.classList.toggle('talk'); talkBtn.classList.toggle('on', k.classList.contains('talk')); };
            k.querySelector('.ic-name').addEventListener('click', latch);
            talkBtn.addEventListener('click', latch);
            listenBtn.addEventListener('click', () => { k.classList.toggle('listen'); listenBtn.classList.toggle('on', k.classList.contains('listen')); });
            // In group-build mode, a click anywhere on the panel toggles membership
            // (capture phase so it pre-empts the talk/listen handlers above).
            k.addEventListener('click', (e) => {
                if (!selecting) return;
                e.preventDefault(); e.stopPropagation();
                if (picked.has(i)) picked.delete(i); else picked.add(i);
                k.classList.toggle('picked', picked.has(i));
                updateHint();
            }, true);
            keyEls.push(k);
            grid.appendChild(k);
        });

        // ---- group-build flow ----
        const newBtn = toolbar.querySelector('[data-new]');
        const cancelBtn = toolbar.querySelector('[data-cancel]');
        const hint = toolbar.querySelector('[data-hint]');
        function updateHint() {
            hint.textContent = selecting ? `SELECT PANELS TO GANG — ${picked.size} picked` : '';
        }
        function exitSelect() {
            selecting = false;
            grid.classList.remove('selecting');
            keyEls.forEach(k => k.classList.remove('picked'));
            picked.clear();
            newBtn.textContent = '＋ NEW TALK GROUP';
            cancelBtn.style.display = 'none';
            updateHint();
        }
        newBtn.addEventListener('click', () => {
            if (!selecting) {
                selecting = true;
                grid.classList.add('selecting');
                newBtn.textContent = '✓ CREATE GROUP';
                cancelBtn.style.display = '';
                updateHint();
            } else {
                if (picked.size) {
                    groups.push({ name: 'TALK GROUP ' + (groups.length + 1), members: [...picked], on: false });
                    drawGroups();
                }
                exitSelect();
            }
        });
        cancelBtn.addEventListener('click', exitSelect);

        function setGroupOn(g, on) {
            g.on = on;
            g.members.forEach(idx => {
                const k = keyEls[idx];
                if (!k) return;
                k.classList.toggle('talk', on);
                k.querySelector('.talk').classList.toggle('on', on);
            });
        }
        function drawGroups() {
            groupsWrap.innerHTML = '';
            groups.forEach((g, gi) => {
                const row = document.createElement('div');
                row.className = 'ic-group' + (g.on ? ' on' : '');
                const big = document.createElement('button');
                big.className = 'ic-group-talk';
                big.innerHTML = `${g.name}<small>TALK TO ALL · ${g.members.length}</small>`;
                big.addEventListener('click', () => { setGroupOn(g, !g.on); row.classList.toggle('on', g.on); });
                const mem = document.createElement('div');
                mem.className = 'ic-group-members';
                g.members.forEach(idx => {
                    const c = document.createElement('span');
                    c.className = 'ic-chip'; c.textContent = keys[idx];
                    mem.appendChild(c);
                });
                const x = document.createElement('div');
                x.className = 'ic-group-x'; x.textContent = '✕'; x.title = 'Remove group';
                x.addEventListener('click', () => { if (g.on) setGroupOn(g, false); groups.splice(gi, 1); drawGroups(); });
                row.appendChild(big); row.appendChild(mem); row.appendChild(x);
                groupsWrap.appendChild(row);
            });
        }

        // Random "incoming" listen flicker so the panel feels live.
        pushTimer(setInterval(() => {
            const all = grid.querySelectorAll('.ic-key');
            if (!all.length) return;
            all.forEach(k => k.classList.remove('listen'));
            const pick = all[Math.floor(Math.random() * all.length)];
            if (Math.random() > 0.3) pick.classList.add('listen');
        }, 1400));

        const sub = document.createElement('div');
        sub.className = 'ic-sub';
        sub.innerHTML = `
            <div class="ic-card"><p class="ed-h">IFB — INTERRUPTIBLE FOLDBACK</p>
                <div class="ic-row"><span>TALENT 1 EARPIECE</span><span class="ic-pill on">PROGRAM</span></div>
                <div class="ic-row"><span>TALENT 2 EARPIECE</span><span class="ic-pill">PROGRAM</span></div>
                <div class="ic-row"><span>STAGE MANAGER</span><span class="ic-pill">PROGRAM</span></div></div>
            <div class="ic-card"><p class="ed-h">BELTPACKS</p>
                <div class="ic-row"><span>CAM 1 · PARTY-LINE A</span><span class="ic-pill on">ONLINE</span></div>
                <div class="ic-row"><span>CAM 2 · PARTY-LINE A</span><span class="ic-pill on">ONLINE</span></div>
                <div class="ic-row"><span>FLOOR · PARTY-LINE B</span><span class="ic-pill on">ONLINE</span></div></div>
            <div class="ic-card"><p class="ed-h">MATRIX</p>
                <div class="ic-row"><span>TALLY-LINKED DUCKING</span><span class="ic-pill on">ENABLED</span></div>
                <div class="ic-row"><span>PRIVATE LINE — DIR↔FLOOR</span><span class="ic-pill on">OPEN</span></div>
                <div class="ic-row"><span>ROUTER</span><span class="ic-pill on">ONLINE</span></div></div>`;
        sub.querySelectorAll('.ic-pill').forEach(p => p.addEventListener('click', () => p.classList.toggle('on')));
        body.appendChild(sub);
    }


    register(n => /intercom|comm/i.test(n), 'INTERCOM · KEY PANEL', renderIntercom);
})();
