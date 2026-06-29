// js/editors/camera/controls.js — the tactile control surface builders:
// rotary encoders (incl. the RGB-Venn), the 5-axis joystick, the camera tally
// bank, presets, and the function keys. Each takes a shared `ctx`.
import { clamp } from './state.js';

export function fmt(key, v) {
    if (key === 'iris') return 'f/' + (1.8 + (1 - v) * 14).toFixed(1);
    if (key === 'shutter') return '1/' + Math.round(50 + v * 950);
    if (key === 'zoom') return Math.round(v * 100) + '%';
    if (/Gain|Blk|mblack|mgain|gamma/.test(key)) return (v >= .5 ? '+' : '') + Math.round((v - .5) * 200);
    return Math.round(v * 100) + '';
}

export function buildDial(ctx, key, label, color) {
    const wrap = document.createElement('div'); wrap.className = 'cc-kn';
    const dial = document.createElement('div'); dial.className = 'cc-dial'; dial.innerHTML = '<i class="ptr"></i>';
    if (color) dial.style.setProperty('--c', color);
    const val = document.createElement('b'); const lab = document.createElement('span'); lab.textContent = label;
    wrap.append(dial, val, lab);
    const paint = () => { const v = ctx.S()[key]; dial.style.setProperty('--p', (v * 100) + '%'); dial.style.setProperty('--rot', (v * 270 - 135) + 'deg'); val.textContent = fmt(key, v); };
    let sy = 0, sv = 0, dr = false;
    const start = (y) => { dr = true; sy = y; sv = ctx.S()[key]; };
    const move = (y) => { if (!dr) return; ctx.S()[key] = clamp(sv + (sy - y) / 130); paint(); ctx.shade(); };
    dial.addEventListener('mousedown', e => { start(e.clientY); e.preventDefault(); });
    window.addEventListener('mousemove', e => move(e.clientY)); window.addEventListener('mouseup', () => dr = false);
    dial.addEventListener('touchstart', e => start(e.touches[0].clientY), { passive: true });
    window.addEventListener('touchmove', e => { if (dr) move(e.touches[0].clientY); }, { passive: true });
    window.addEventListener('touchend', () => dr = false);
    ctx.knobEls.push(paint); paint();
    return wrap;
}

export function buildShading(ctx) {
    const mono = ctx.$('.cc-mono');
    [['iris', 'Iris'], ['mblack', 'M.Black'], ['gamma', 'Gamma'], ['shutter', 'Shutter'], ['mgain', 'M.Gain']]
        .forEach(([k, l]) => mono.appendChild(buildDial(ctx, k, l)));
    const venn = ctx.$('.cc-venn');
    const place = (key, label, color, x, y, blk) => {
        const slot = document.createElement('div'); slot.className = 'slot' + (blk ? ' blk' : '');
        slot.style.left = x + 'px'; slot.style.top = y + 'px';
        slot.appendChild(buildDial(ctx, key, label, color)); venn.appendChild(slot);
    };
    place('rGain', 'R Gain', '#ff4d4d', 100, 105); place('gGain', 'G Gain', '#28e04a', 280, 105); place('bGain', 'B Gain', '#4d83ff', 190, 255);
    place('rBlk', 'R', '#ff7a7a', 150, 162, true); place('gBlk', 'G', '#74ef8a', 190, 162, true); place('bBlk', 'B', '#86acff', 230, 162, true);
}

export function buildJoystick(ctx) {
    const stick = ctx.$('.cc-stick'), puck = stick.querySelector('.puck');
    const placePuck = () => { const r = 74; puck.style.left = `calc(50% + ${(ctx.S().pan - 0.5) * 2 * r}px)`; puck.style.top = `calc(50% + ${(0.5 - ctx.S().tilt) * 2 * r}px)`; };
    const stickMove = (e) => {
        const r = stick.getBoundingClientRect();
        const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left - r.width / 2;
        const py = (e.touches ? e.touches[0].clientY : e.clientY) - r.top - r.height / 2;
        ctx.S().pan = clamp(0.5 + px / r.width); ctx.S().tilt = clamp(0.5 - py / r.height); placePuck();
    };
    const down = (e) => { ctx.ui.drag = true; stick.style.cursor = 'grabbing'; stickMove(e); };
    const up = () => { ctx.ui.drag = false; stick.style.cursor = 'grab'; };
    stick.addEventListener('mousedown', down); window.addEventListener('mousemove', e => ctx.ui.drag && stickMove(e)); window.addEventListener('mouseup', up);
    stick.addEventListener('touchstart', down, { passive: true }); stick.addEventListener('touchmove', stickMove, { passive: true }); stick.addEventListener('touchend', up);
    ctx.body.querySelectorAll('[data-ax]').forEach(inp => inp.addEventListener('input', () => { ctx.S()[inp.dataset.ax] = parseFloat(inp.value); }));
    const syncAxes = () => { ctx.body.querySelectorAll('[data-ax]').forEach(inp => inp.value = ctx.S()[inp.dataset.ax]); placePuck(); };
    return { placePuck, syncAxes };
}

export function buildTally(ctx, onSelect) {
    const t = ctx.$('.cc-tallies');
    for (let i = 0; i < 8; i++) {
        const b = document.createElement('div');
        b.className = 'cc-tally' + (i === ctx.ui.active ? ' sel' : '') + (i === 0 ? ' live' : i === 1 ? ' pvw' : '');
        b.innerHTML = `CAM ${i + 1}<span class="st"></span>`;
        b.addEventListener('click', () => { ctx.ui.active = i; sync(); onSelect(); });
        t.appendChild(b);
    }
    const sync = () => { [...t.children].forEach((b, i) => b.classList.toggle('sel', i === ctx.ui.active)); };
    return sync;
}

export function buildPresets(ctx) {
    const host = ctx.$('.cc-pre');
    for (let i = 0; i < 6; i++) {
        const k = document.createElement('div'); k.className = 'cc-key'; k.textContent = 'P' + (i + 1);
        k.addEventListener('click', () => {
            const s = ctx.S();
            if (ctx.ui.pendingSave) { s.presets[i] = { pan: s.pan, tilt: s.tilt, zoom: s.zoom, dolly: s.dolly, ped: s.ped }; ctx.ui.pendingSave = false; ctx.$('[data-act="save"]').classList.remove('on'); sync(); }
            else if (s.presets[i]) { ctx.fly = { from: { pan: s.pan, tilt: s.tilt, zoom: s.zoom, dolly: s.dolly, ped: s.ped }, to: s.presets[i], t: 0 }; }
        });
        host.appendChild(k);
    }
    const sync = () => { [...host.children].forEach((k, i) => k.classList.toggle('set', !!ctx.S().presets[i])); };
    return sync;
}

export function buildFunctions(ctx, syncKnobs) {
    ctx.body.querySelectorAll('.cc-key[data-act]').forEach(k => k.addEventListener('click', () => {
        const a = k.dataset.act, s = ctx.S(), glass = ctx.$('.cc-glass');
        if (a === 'bars') {
            ctx.ui.bars = !ctx.ui.bars; k.classList.toggle('on', ctx.ui.bars);
            glass.querySelector('.cc-smpte').classList.toggle('on', ctx.ui.bars);
            glass.querySelector('.cc-dvd').classList.toggle('on', ctx.ui.bars);
            glass.querySelector('.cc-wf-tag').textContent = ctx.ui.bars ? 'RGB PARADE · COLOUR BARS' : 'RGB PARADE · IRE';
        }
        else if (a === 'autoiris') { ctx.ui.autoiris = !ctx.ui.autoiris; k.classList.toggle('on', ctx.ui.autoiris); }
        else if (a === 'wb') { s.rGain = 0.5; s.gGain = 0.5; s.bGain = 0.5; syncKnobs(); }
        else if (a === 'save') { ctx.ui.pendingSave = !ctx.ui.pendingSave; k.classList.toggle('on', ctx.ui.pendingSave); }
        else if (a === 'path') { ctx.ui.rec = !ctx.ui.rec; k.classList.toggle('on', ctx.ui.rec); glass.querySelector('.cc-rec').classList.toggle('on', ctx.ui.rec); }
        else if (a === 'lookat') { k.classList.toggle('on'); }
    }));
}
