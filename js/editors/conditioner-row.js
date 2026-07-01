// js/editors/conditioner-row.js — the "Signal Conditioner Row" (TEST TOOLS / per-studio edge).
//
// A studio's edge "glue" rack rebuilt as a bank of small conditioner Apps in
// SIGNAL ORDER. Route a source in and it flows left→right through the chain:
// frame-sync → convert → legalize → strip captions → shuffle → delay → loudness
// → meter/probe → re-route into production. Flip to EGRESS to dress signal on the
// way out (loudness → CC/SCTE insert → format → sync/embed → failover → output).
//
// This is the Part-3 (Operator GUI) surface for the conditioner-row pattern
// audited in docs/Audit /Signal-Conditioner-Row-Design-Audit.md. Each stage maps
// to an App in the requirements catalog (AR.x badge). Like every editor here the
// data is synthetic; the value is the orderable, bypassable, preset-driven row —
// ready to be backed by real control-plane APIs (delta report, Interpretation B).
//
// Shared toolkit only — no re-implementation:
//   • VU / PPM tap ........ core.meterBar()                  (audio-mixer meters)
//   • LOUDNESS tap ........ js/editors/shared/loudness.js    (audio-monitor BS.1770)
import { register, addStyles, pushTimer, channelsFor, gatherSources, knob, meterBar } from './core.js';
import { createLoudnessTracker, drawLoudnessPlot } from './shared/loudness.js';

// One conditioner = { key, name, ar, cap, note, ctrl }. ctrl is optional:
//   {sel:[...]}  a house-spec selector · {knobs:[...]} rotaries · {tap:'meter'|'loud'}
const INGRESS = [
    { key: 'fsync', name: 'Frame Sync', ar: 'AR.4.22', cap: 'signal', note: 'align to house PTP', ctrl: { knobs: ['Delay'], sel: ['PTP LOCK', 'FREERUN'], tap: 'lock' } },
    { key: 'udc',   name: 'Up/Down/Cross', ar: 'AR.4.2', cap: 'signal', note: 'raster + scan', ctrl: { sel: ['1080i59', '1080p59', 'UHD p59'] } },
    { key: 'fr',    name: 'Frame-Rate Conv', ar: 'AR.4.3', cap: 'signal', note: 'cadence', ctrl: { sel: ['59.94', '50', '23.98'] } },
    { key: 'hdr',   name: 'SDR / HDR', ar: 'AR.4.23', cap: 'shade', note: 'transfer + gamut', ctrl: { sel: ['BT.709', 'HDR10', 'HLG'] } },
    { key: 'proc',  name: 'Proc Amp / Colour', ar: 'AR.4.1', cap: 'shade', note: 'legalize', ctrl: { knobs: ['Y', 'Chroma', 'Black'] } },
    { key: 'cc',    name: 'Caption Stripper', ar: 'AR.9.1', cap: 'signal', note: 'CC / ANC hygiene', ctrl: { sel: ['PASS', 'STRIP', 'EXTRACT'] } },
    { key: 'shuf',  name: 'Audio Shuffler', ar: 'AR.5.2', cap: 'audio', note: 'IS-08 channel map', ctrl: { sel: ['L R C LFE Ls Rs', 'L R (stereo)', 'CUSTOM'] } },
    { key: 'adly',  name: 'Audio Delay', ar: 'AR.5.3', cap: 'audio', note: 'lip-sync align', ctrl: { knobs: ['Delay ms'] } },
    { key: 'loud',  name: 'Loudness Norm', ar: 'AR.5.25', cap: 'audio', note: '−23 LUFS target', ctrl: { sel: ['-23 LUFS', '-24 LUFS'], tap: 'loud' } },
    { key: 'mtr',   name: 'Meter / Probe', ar: 'AR.8.10', cap: 'view', note: 'confidence tap', ctrl: { tap: 'meter' } },
    { key: 'route', name: 'Re-Route', ar: 'AR.7.1', cap: 'route', note: 'onto data plane', ctrl: { sel: ['→ VISION MIX', '→ AUDIO MIX', '→ MULTIVIEW'] } },
];
const EGRESS = [
    { key: 'eloud', name: 'Loudness Norm', ar: 'AR.5.25', cap: 'audio', note: 'delivery target', ctrl: { sel: ['-23 LUFS', '-24 LUFS'], tap: 'loud' } },
    { key: 'ecc',   name: 'Caption Insert', ar: 'AR.9.1', cap: 'signal', note: 'CC into ANC', ctrl: { sel: ['608/708', 'OFF'] } },
    { key: 'scte',  name: 'SCTE Insert', ar: 'AR.9.3', cap: 'signal', note: 'splice cues', ctrl: { sel: ['ARMED', 'OFF'] } },
    { key: 'efmt',  name: 'Format Conv', ar: 'AR.4.2', cap: 'signal', note: 'delivery raster', ctrl: { sel: ['1080i59', '1080p59', 'UHD p59'] } },
    { key: 'sync',  name: 'A/V Sync + Embed', ar: 'AR.8.15', cap: 'signal', note: 'verify + embed', ctrl: { tap: 'lock' } },
    { key: 'fail',  name: 'Auto Changeover', ar: 'AR.4.8', cap: 'route', note: 'main / backup', ctrl: { sel: ['MAIN', 'BACKUP', 'HITLESS'] } },
    { key: 'emtr',  name: 'Meter / Probe', ar: 'AR.8.10', cap: 'view', note: 'as-delivered', ctrl: { tap: 'meter' } },
    { key: 'out',   name: 'System Output', ar: 'AR.3.2', cap: 'route', note: 'off-ramp', ctrl: { sel: ['ST 2110', 'SRT', 'MPEG-TS'] } },
];

const CSS = `
.cr{display:flex;flex-direction:column;gap:12px;height:100%;}
.cr-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.cr-src{font:bold 10px 'Courier New',monospace;letter-spacing:1px;padding:5px 10px;border-radius:6px;
    background:#0c1730;border:1px solid #2c3e5e;color:#cfe6ff;}
.cr-src.empty{opacity:.55;font-style:italic;}
.cr-dir{margin-left:auto;display:flex;border:1px solid #2c3e5e;border-radius:8px;overflow:hidden;}
.cr-dir button{font:bold 10px sans-serif;letter-spacing:1px;text-transform:uppercase;padding:7px 14px;
    background:#0c1730;color:#bcd3ee;border:0;cursor:pointer;}
.cr-dir button.on{background:#ffd400;color:#1a1206;}
.cr-preset{font:bold 10px sans-serif;letter-spacing:1px;text-transform:uppercase;padding:7px 12px;border-radius:7px;
    border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;cursor:pointer;}
.cr-preset:hover{filter:brightness(1.15);}
/* the rack: a horizontal signal-order strip that scrolls */
.cr-rack{display:flex;gap:0;align-items:stretch;overflow-x:auto;padding:4px 2px 12px;flex:1;min-height:0;}
.cr-stage{flex:0 0 168px;background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:10px;
    display:flex;flex-direction:column;gap:7px;position:relative;}
.cr-stage.byp{opacity:.42;}
.cr-arrow{flex:0 0 26px;display:flex;align-items:center;justify-content:center;color:#39507a;font-size:20px;}
.cr-shead{display:flex;align-items:center;gap:6px;}
.cr-led{width:9px;height:9px;border-radius:50%;background:#19c54b;box-shadow:0 0 7px #19c54b;flex:0 0 auto;}
.cr-led.warn{background:#e6a13a;box-shadow:0 0 7px #e6a13a;} .cr-led.byp{background:#556;box-shadow:none;}
.cr-sname{font:900 11px sans-serif;letter-spacing:1px;text-transform:uppercase;color:#cfe6ff;line-height:1.1;}
.cr-ar{font:bold 8px 'Courier New',monospace;color:#6FC8F0;border:1px solid #24405f;border-radius:4px;padding:1px 4px;margin-left:auto;}
.cr-note{font:italic 9px sans-serif;color:#7d93b3;}
.cr-sel{font:bold 9px 'Courier New',monospace;background:#0c1322;color:#bcd3ee;border:1px solid #24405f;
    border-radius:6px;padding:5px 6px;width:100%;}
.cr-knobs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
.cr-byp{margin-top:auto;font:bold 9px sans-serif;letter-spacing:1px;text-transform:uppercase;padding:5px;border-radius:6px;
    border:1px solid #2c3e5e;background:#0c1730;color:#8fa6c6;cursor:pointer;text-align:center;}
.cr-byp.on{background:#5a2130;border-color:#ff6a6a;color:#ffb3b3;}
.cr-tap{background:#03060f;border:1px solid #1d2942;border-radius:7px;padding:6px;display:flex;align-items:center;gap:8px;justify-content:center;}
.cr-vu{width:14px;height:54px;border-radius:4px;background:#0c1322;overflow:hidden;display:flex;flex-direction:column-reverse;box-shadow:inset 0 0 0 1px #1d2942;}
.cr-vu > i{display:block;width:100%;height:0%;background:linear-gradient(#19c54b,#e6e23a 70%,#ff3b3b);}
.cr-lufs{font:bold 18px 'Courier New',monospace;color:#cfe6ff;} .cr-lufs small{display:block;font-size:8px;color:#6b82a3;letter-spacing:1px;}
.cr-lhist{height:44px;width:100%;} .cr-lhist canvas{width:100%;height:100%;display:block;}
.cr-lockrow{display:flex;align-items:center;gap:6px;font:bold 9px 'Courier New',monospace;color:#9fd6a0;justify-content:center;}
/* am-knob reuse: the shared knob() expects .am-kw/.am-knob styling from audio-mixer;
   provide a compact local fallback so the row is self-contained. */
.cr .am-kw{display:flex;flex-direction:column;align-items:center;gap:3px;}
.cr .am-knob{width:34px;height:34px;border-radius:50%;background:conic-gradient(from -135deg,var(--cyan,#00ffff) 0,var(--cyan,#00ffff) calc(var(--rot,0deg)),#12203a calc(var(--rot,0deg)));
    box-shadow:inset 0 0 0 4px #0a1326,0 0 0 1px #24405f;cursor:ns-resize;}
.cr .am-klabel{font:bold 8px sans-serif;letter-spacing:.5px;color:#8fa6c6;text-transform:uppercase;}
`;

function render(body, twist, config) {
    addStyles('conditioner-row-styles', CSS);
    const routed = gatherSources(twist);
    const chans = channelsFor(twist, config, 'CH', 8);

    const srcTags = routed.length
        ? routed.map(s => `<span class="cr-src" style="border-color:${s.color}">${s.label}</span>`).join('')
        : `<span class="cr-src empty">no source routed — showing reference signal</span>`;

    body.innerHTML = `
      <div class="cr">
        <div class="cr-top">
          <span class="cr-src" style="border-color:#6FC8F0">SIGNAL UNDER CONDITIONING</span>
          ${srcTags}
          <div class="cr-preset" title="Apply house conditioning preset across the row">▣ HOUSE PRESET</div>
          <div class="cr-dir">
            <button class="on" data-dir="in">Ingress</button>
            <button data-dir="out">Egress</button>
          </div>
        </div>
        <div class="cr-rack"></div>
      </div>`;

    const rack = body.querySelector('.cr-rack');
    const taps = [];   // {kind, els...} live-updating readouts, rebuilt per direction

    function buildStage(st, idx, total) {
        const wrap = document.createElement('div');
        wrap.className = 'cr-stage';
        if (st.cap) wrap.dataset.cap = st.cap;   // Auth.applyScope() can hide by role
        const c = st.ctrl || {};
        wrap.innerHTML = `
          <div class="cr-shead">
            <span class="cr-led"></span>
            <span class="cr-sname">${st.name}</span>
            <span class="cr-ar">${st.ar}</span>
          </div>
          <div class="cr-note">${st.note}</div>`;

        if (c.sel) {
            const sel = document.createElement('select');
            sel.className = 'cr-sel';
            sel.innerHTML = c.sel.map(o => `<option>${o}</option>`).join('');
            wrap.appendChild(sel);
        }
        if (c.knobs) {
            const kr = document.createElement('div'); kr.className = 'cr-knobs';
            c.knobs.forEach(l => kr.appendChild(knob(l, 0.5, '#6FC8F0')));
            wrap.appendChild(kr);
        }
        if (c.tap === 'meter') {
            const tap = document.createElement('div'); tap.className = 'cr-tap';
            const a = meterBar('cr-vu'), b = meterBar('cr-vu');
            tap.appendChild(a); tap.appendChild(b);
            wrap.appendChild(tap);
        }
        if (c.tap === 'loud') {
            const tap = document.createElement('div'); tap.className = 'cr-tap';
            tap.innerHTML = `<div class="cr-lufs"><span class="v">-23.0</span><small>LUFS INT</small></div>
                             <div class="cr-lhist"><canvas></canvas></div>`;
            wrap.appendChild(tap);
            taps.push({ kind: 'loud', el: tap.querySelector('.v'), cv: tap.querySelector('canvas'), t: createLoudnessTracker({ start: -23 }) });
        }
        if (c.tap === 'lock') {
            const row = document.createElement('div'); row.className = 'cr-lockrow';
            row.innerHTML = `<span class="cr-led"></span><span class="v">LOCKED · 0 fr</span>`;
            wrap.appendChild(row);
            taps.push({ kind: 'lock', led: row.querySelector('.cr-led'), el: row.querySelector('.v') });
        }

        // Bypass — greys the stage and idles its LED. Every conditioner must have a
        // clean-bypass path (audit §3 design rule).
        const byp = document.createElement('div'); byp.className = 'cr-byp'; byp.textContent = 'Bypass';
        const led = wrap.querySelector('.cr-shead .cr-led');
        byp.addEventListener('click', () => {
            const on = wrap.classList.toggle('byp');
            byp.classList.toggle('on', on);
            byp.textContent = on ? 'Bypassed' : 'Bypass';
            led.classList.toggle('byp', on);
        });
        wrap.appendChild(byp);
        wrap._led = led;

        rack.appendChild(wrap);
        if (idx < total - 1) {
            const ar = document.createElement('div'); ar.className = 'cr-arrow'; ar.textContent = '›';
            rack.appendChild(ar);
        }
        return wrap;
    }

    function buildChain(dir) {
        rack.innerHTML = ''; taps.length = 0;
        const chain = dir === 'out' ? EGRESS : INGRESS;
        const stages = chain.map((st, i) => buildStage(st, i, chain.length));
        // Re-apply role scoping to the freshly built stages.
        if (window.Auth && window.Auth.applyScope) window.Auth.applyScope(rack);
        return stages;
    }

    let stages = buildChain('in');

    body.querySelectorAll('.cr-dir button').forEach(b => b.addEventListener('click', () => {
        body.querySelectorAll('.cr-dir button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        stages = buildChain(b.dataset.dir);
    }));

    // House preset: nudge every selector to its first (house-spec) option — the
    // "apply a preset set across the row" gesture from the audit.
    body.querySelector('.cr-preset').addEventListener('click', () => {
        rack.querySelectorAll('.cr-stage:not(.byp) .cr-sel').forEach(s => { s.selectedIndex = 0; });
    });

    // Live conditioning: health flicker on active stages, and the meter/loudness/lock
    // taps animate off shared synthetic ballistics (same idiom as meter-input).
    const levels = chans.map(() => 0.3);
    let frame = 0;
    pushTimer(setInterval(() => {
        frame++;
        let sum = 0;
        for (let i = 0; i < levels.length; i++) {
            if (frame % 8 === 0) levels[i] = Math.max(0.05, Math.min(1, levels[i] + (Math.random() - 0.5) * 0.5));
            sum += levels[i];
        }
        const avg = levels.length ? sum / levels.length : 0.3;

        // occasional amber on a random active stage → "conditioning working"
        stages.forEach(st => {
            if (st.classList.contains('byp')) return;
            if (frame % 20 === 0) st._led.classList.toggle('warn', Math.random() < 0.12);
        });

        taps.forEach(tp => {
            if (tp.kind === 'loud') {
                tp.t.update(avg);
                tp.el.textContent = tp.t.lufs.toFixed(1);
                drawLoudnessPlot(tp.cv, tp.t.history);
            } else if (tp.kind === 'lock') {
                const off = Math.max(0, Math.round(Math.sin(frame * 0.05) * 1.5));
                tp.led.classList.toggle('warn', off > 0);
                tp.el.textContent = off === 0 ? 'LOCKED · 0 fr' : `RE-LOCK · ${off} fr`;
            }
        });
    }, 40));
}

register(n => /conditioner|conditioning|glue|signal\s*cond/i.test(n),
    'SIGNAL CONDITIONER ROW · STUDIO EDGE', render);
