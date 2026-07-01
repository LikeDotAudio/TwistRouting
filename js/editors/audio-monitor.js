// js/editors/audio-monitor.js — a broadcast Audio Monitor (confidence monitor).
// Opens when an "Audio Monitor" twist is selected. Scales from 1 to 24 channels,
// organised in SDI Quad-Blocks (groups of 4), with per-channel PPM/VU ballistic
// meters + peak-hold + true-peak warning, CUE/SOLO (local bus — never touches the
// main output), per-block phase correlation + Lissajous, and a master section
// with volume, MUTE/DIM, stereo downmix and ITU-R BS.1770 loudness (LUFS).
import { register, addStyles, channelsFor, pushTimer } from './core.js';
import { renderGridOfSiblings } from './multi.js';
import { createLoudnessTracker, drawLoudnessPlot } from './shared/loudness.js';

const CSS = `
.am2{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;height:100%;}
.am2-bridge{overflow:auto;display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start;padding:2px;}
.am2-block{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:12px;}
.am2-bh{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;}
.am2-bh b{color:#6FC8F0;font-size:12px;letter-spacing:2px;}
.am2-fmt{font:bold 10px 'Courier New',monospace;color:#cfe6ff;background:#13233c;border:1px solid #2c3e5e;border-radius:6px;padding:4px 8px;cursor:pointer;letter-spacing:1px;}
.am2-fmt:hover{background:#1b2f4f;}
.am2-meters{display:flex;gap:10px;}
.am2-ch{display:flex;flex-direction:column;align-items:center;gap:6px;width:46px;}
.am2-meter{position:relative;width:24px;height:210px;border-radius:5px;overflow:hidden;box-shadow:inset 0 0 0 1px #1d2942;
    background:linear-gradient(to top,#0f7a39 0%,#39d353 55%,#ffd400 80%,#ff5a3b 92%,#ff2b2b 100%);}
.am2-meter .mask{position:absolute;left:0;right:0;top:0;background:#070f1f;}
.am2-meter .pk{position:absolute;left:0;right:0;height:2px;background:#dfeaff;}
.am2-meter.tp{box-shadow:inset 0 0 0 1px #1d2942, 0 0 9px #ff2b2b;}
.am2-meter .scale{position:absolute;right:1px;top:0;bottom:0;width:1px;}
.am2-lab{font:bold 10px 'Courier New',monospace;color:#bcd3ee;text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46px;}
.am2-cue{width:40px;padding:5px 0;border-radius:6px;border:1px solid #2c3e5e;background:#0c1730;color:#9fb6cc;font:bold 9px sans-serif;letter-spacing:1px;cursor:pointer;text-align:center;}
.am2-cue.on{background:#ffd400;color:#1a1206;border-color:#ffd400;box-shadow:0 0 8px rgba(255,212,0,.6);}
.am2-mute{width:40px;padding:4px 0;border-radius:6px;border:1px solid #2c3e5e;background:#0c1730;color:#7e93b5;font:bold 9px sans-serif;cursor:pointer;text-align:center;}
.am2-mute.on{background:#ff3b3b;color:#fff;border-color:#ff3b3b;}
.am2-phase{margin-top:10px;display:flex;gap:10px;align-items:center;}
.am2-liss{width:74px;height:74px;border-radius:8px;background:radial-gradient(circle,#060d1a,#03060f);border:1px solid #1d2942;}
.am2-corr{flex:1;}
.am2-corr .bar{position:relative;height:12px;border-radius:6px;background:linear-gradient(to right,#ff3b3b,#3a4straight 18%,#16243d 50%,#2c466e 82%,#39d353);box-shadow:inset 0 0 0 1px #1d2942;}
.am2-corr .bar{background:linear-gradient(to right,#ff3b3b 0%,#7a3b1f 22%,#16243d 50%,#1f5a3a 78%,#39d353 100%);}
.am2-corr .ind{position:absolute;top:-3px;width:4px;height:18px;border-radius:2px;background:#fff;box-shadow:0 0 5px #fff;}
.am2-corr .cl{display:flex;justify-content:space-between;font:9px 'Courier New',monospace;color:#6b82a3;margin-top:3px;}

.am2-master{display:flex;flex-direction:column;gap:14px;overflow:auto;}
.am2-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.am2-card h4{margin:0 0 12px;color:#6FC8F0;font-size:13px;letter-spacing:2px;text-transform:uppercase;}
.am2-lufs{font:bold 38px 'Courier New',monospace;color:#cfe6ff;text-align:center;line-height:1;}
.am2-lufs small{display:block;font-size:12px;color:#6b82a3;letter-spacing:2px;margin-top:6px;}
.am2-lhist{display:block;width:100%;height:96px;background:#070f1f;border:1px solid #1d2942;border-radius:8px;margin-top:12px;}
.am2-tp{margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;font:bold 11px sans-serif;letter-spacing:1px;color:#7e93b5;}
.am2-tp .led{width:12px;height:12px;border-radius:50%;background:#1f5a3a;}
.am2-tp.hot{color:#ff6a6a;} .am2-tp.hot .led{background:#ff2b2b;box-shadow:0 0 9px #ff2b2b;}
.am2-vol{display:flex;align-items:center;gap:12px;}
.am2-vol input{flex:1;-webkit-appearance:none;appearance:none;height:18px;border-radius:10px;background:#16243d;box-shadow:inset 0 0 0 1px #2c3e5e;outline:none;cursor:pointer;}
.am2-vol input::-webkit-slider-thumb{-webkit-appearance:none;width:40px;height:28px;border-radius:9px;background:radial-gradient(circle at 40% 35%,#9fdcff,#3f86b6);border:2px solid #001019;cursor:pointer;}
.am2-vol b{font:bold 14px 'Courier New',monospace;color:#fff;width:54px;text-align:right;}
.am2-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.am2-key{padding:16px 6px;border-radius:10px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;font:bold 12px sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-align:center;}
.am2-key:hover{background:#16243d;}
.am2-key.on{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.am2-key.warn.on{background:#ff3b3b;color:#fff;border-color:#ff3b3b;}
.am2-key.dim.on{background:#ffd400;color:#1a1206;border-color:#ffd400;}
`;

const FORMATS = ['QUAD', '2× STEREO', '3.1 GROUP', '4× MONO'];

function render(body, twist) { renderGridOfSiblings(body, twist, /audio\s*monitor/i, buildOne); }

function buildOne(host, twist) {
    const body = host, config = null;
    addStyles('am2-styles', CSS);
    let chans = channelsFor(twist, config, 'CH', 8).slice(0, 24);
    const st = chans.map((c, i) => ({
        label: c.label, color: c.color || '#39d353',
        level: 0.2, target: 0.35, peak: 0.2, cue: false, mute: false, fmtPair: i,
    }));
    const ui = { master: 0.75, mute: false, dim: false, downmix: false, tp: false };

    body.innerHTML = `<div class="am2"><div class="am2-bridge"></div><div class="am2-master"></div></div>`;
    const bridge = body.querySelector('.am2-bridge');

    // ---- quad blocks ----
    const blocks = [];
    for (let b = 0; b * 4 < st.length; b++) {
        const group = st.slice(b * 4, b * 4 + 4);
        const block = document.createElement('div'); block.className = 'am2-block';
        const fmt = { idx: 0 };
        block.innerHTML = `<div class="am2-bh"><b>GROUP ${b + 1}</b><div class="am2-fmt">QUAD</div></div><div class="am2-meters"></div>
            <div class="am2-phase"><canvas class="am2-liss" width="74" height="74"></canvas>
              <div class="am2-corr"><div class="bar"><div class="ind"></div></div><div class="cl"><span>-1 ø</span><span>0</span><span>+1</span></div></div></div>`;
        const meters = block.querySelector('.am2-meters');
        const chEls = group.map(ch => {
            const el = document.createElement('div'); el.className = 'am2-ch';
            el.innerHTML = `<div class="am2-meter"><div class="mask"></div><div class="pk"></div></div>
                <div class="am2-lab">${ch.label}</div>
                <div class="am2-cue">CUE</div><div class="am2-mute">MUTE</div>`;
            el.querySelector('.am2-cue').addEventListener('click', e => { ch.cue = !ch.cue; e.target.classList.toggle('on', ch.cue); });
            el.querySelector('.am2-mute').addEventListener('click', e => { ch.mute = !ch.mute; e.target.classList.toggle('on', ch.mute); });
            meters.appendChild(el);
            return { el, ch, meter: el.querySelector('.am2-meter'), mask: el.querySelector('.mask'), pk: el.querySelector('.pk') };
        });
        block.querySelector('.am2-fmt').addEventListener('click', e => { fmt.idx = (fmt.idx + 1) % FORMATS.length; e.target.textContent = FORMATS[fmt.idx]; });
        bridge.appendChild(block);
        blocks.push({ group, chEls, liss: block.querySelector('.am2-liss'), ind: block.querySelector('.am2-corr .ind'), corr: 0.6, fmt });
    }

    // ---- master section ----
    const master = body.querySelector('.am2-master');
    master.innerHTML = `
      <div class="am2-card"><h4>Loudness · ITU-R BS.1770</h4>
        <div class="am2-lufs"><span class="v">-23.0</span><small>LUFS · MOMENTARY</small></div>
        <canvas class="am2-lhist"></canvas>
        <div class="am2-tp"><span class="led"></span><span class="t">TRUE PEAK OK</span></div>
      </div>
      <div class="am2-card"><h4>Monitor Output</h4>
        <div class="am2-vol"><input type="range" min="0" max="1" step="0.01" value="0.75"><b>-6 dB</b></div>
        <div class="am2-keys" style="margin-top:14px">
          <div class="am2-key warn" data-m="mute">Mute</div>
          <div class="am2-key dim" data-m="dim">Dim</div>
          <div class="am2-key" data-m="downmix">Downmix</div>
        </div>
        <div class="am2-keys" style="margin-top:10px">
          <div class="am2-key" data-m="solo-clear">Clear Cue</div>
          <div class="am2-key" data-m="failsafe">Fail-Safe</div>
          <div class="am2-key" data-m="ref">Ref −18</div>
        </div>
      </div>`;
    const lufsEl = master.querySelector('.am2-lufs .v'), tpEl = master.querySelector('.am2-tp'), tpTxt = master.querySelector('.am2-tp .t');
    const lhEl = master.querySelector('.am2-lhist'); const loudness = createLoudnessTracker({ start: -23 });
    const vol = master.querySelector('.am2-vol input'), volLbl = master.querySelector('.am2-vol b');
    const setVolLbl = () => { const db = ui.master <= 0 ? '-∞' : Math.round((ui.master - 1) * 60); volLbl.textContent = (ui.master <= 0 ? '-∞' : db) + ' dB'; };
    vol.addEventListener('input', () => { ui.master = parseFloat(vol.value); setVolLbl(); }); setVolLbl();
    master.querySelectorAll('.am2-key[data-m]').forEach(k => k.addEventListener('click', () => {
        const m = k.dataset.m;
        if (m === 'mute') { ui.mute = !ui.mute; k.classList.toggle('on', ui.mute); }
        else if (m === 'dim') { ui.dim = !ui.dim; k.classList.toggle('on', ui.dim); }
        else if (m === 'downmix') { ui.downmix = !ui.downmix; k.classList.toggle('on', ui.downmix); }
        else if (m === 'solo-clear') { st.forEach(c => c.cue = false); body.querySelectorAll('.am2-cue.on').forEach(e => e.classList.remove('on')); }
        else { k.classList.toggle('on'); }
    }));

    // ---- animation: ballistic meters, peak hold, phase, loudness ----
    let frame = 0;
    pushTimer(setInterval(() => {
        frame++;
        let sum = 0, hot = false;
        st.forEach(ch => {
            if (frame % 8 === 0) ch.target = ch.mute ? 0 : Math.max(0.05, Math.min(1, ch.target + (Math.random() - 0.5) * 0.5));
            const goal = ch.mute ? 0 : ch.target;
            ch.level += (goal - ch.level) * (goal > ch.level ? 0.55 : 0.12);   // fast attack / slow release (PPM)
            if (ch.level > ch.peak) ch.peak = ch.level; else ch.peak = Math.max(ch.level, ch.peak - 0.006);
            sum += ch.level;
            if (ch.peak > 0.96) hot = true;
        });
        blocks.forEach(blk => {
            blk.chEls.forEach(({ ch, meter, mask, pk }) => {
                mask.style.height = (100 - ch.level * 100) + '%';
                pk.style.bottom = (ch.peak * 100) + '%';
                meter.classList.toggle('tp', ch.peak > 0.96);
            });
            // phase correlation wanders; Lissajous reflects it
            blk.corr += (Math.random() - 0.5) * 0.06; blk.corr = Math.max(-1, Math.min(1, blk.corr));
            blk.ind.style.left = `calc(${(blk.corr + 1) / 2 * 100}% - 2px)`;
            drawLiss(blk.liss, blk.corr, frame, blk.group[0] ? blk.group[0].level : 0.3);
        });
        // integrated loudness drifts with program level (shared BS.1770 tracker)
        loudness.update(sum / st.length);
        lufsEl.textContent = loudness.lufs.toFixed(1);
        tpEl.classList.toggle('hot', hot); tpTxt.textContent = hot ? 'TRUE PEAK!' : 'TRUE PEAK OK';
        drawLoudnessPlot(lhEl, loudness.history);
    }, 40));
}

function drawLiss(cv, corr, frame, amp) {
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,110,150,.25)'; ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4); ctx.moveTo(4, h / 2); ctx.lineTo(w - 4, h / 2); ctx.stroke();
    ctx.strokeStyle = corr < 0 ? 'rgba(255,90,90,.85)' : 'rgba(120,235,150,.85)'; ctx.lineWidth = 1.4; ctx.beginPath();
    const a = (0.5 + amp * 0.5) * (w / 2 - 8), spread = (1 - Math.abs(corr)) * 0.9;
    for (let i = 0; i <= 60; i++) {
        const t = i / 60 * Math.PI * 2;
        const l = Math.sin(t + frame * 0.06), r = Math.sin(t + frame * 0.06 + spread * Math.PI * (corr < 0 ? 1 : 0.3));
        // rotate L/R into X/Y (45°): the classic audio Lissajous
        const x = w / 2 + (l - r) * a * 0.5, y = h / 2 - (l + r) * a * 0.5;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
}

register(n => /audio\s*monitor|\bmonitor\b.*audio|\bAFV\b|confidence/i.test(n), 'AUDIO MONITOR · CONFIDENCE', render);
