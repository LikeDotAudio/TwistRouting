// js/editors/stagebox-input.js — Stage Box Input "Smart Object" editor. Full
// technical visibility of a physical input from the console: preamp gain +
// headroom, software-interlocked +48V phantom (Smart-Verify against the mic
// library — blocks ribbon mics), auto impedance match, cable-length HF
// compensation, stand-based high-pass, a channel alias, a PPM meter with a
// rolling 30-second history plot, and confidence monitoring.
import { register, addStyles, pushTimer } from './core.js';

const MICS = [
    { name: 'Sennheiser MKH 416', type: 'Shotgun', gain: [30, 60], imp: 25, ribbon: false, hpf: 80, sens: -32 },
    { name: 'Shure SM7B', type: 'Dynamic', gain: [50, 70], imp: 150, ribbon: false, hpf: 50, sens: -59 },
    { name: 'Royer R-121', type: 'Ribbon', gain: [45, 70], imp: 300, ribbon: true, hpf: 40, sens: -50 },
    { name: 'DPA 4061', type: 'Lavalier', gain: [25, 55], imp: 30, ribbon: false, hpf: 100, sens: -44 },
    { name: 'Neumann U87', type: 'Condenser', gain: [15, 50], imp: 200, ribbon: false, hpf: 60, sens: -38 },
];
const STANDS = { 'Boom Arm': 70, 'Floor Tripod': 110, 'Desk Mount': 90, 'Hand-Held': 60 };

const CSS = `
.sb{display:grid;grid-template-columns:300px minmax(0,1fr) 280px;gap:16px;height:100%;}
.sb-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.sb-card h4{margin:0 0 12px;color:#6FC8F0;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.sb-col{display:flex;flex-direction:column;gap:14px;overflow:auto;}
.sb-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;font-size:13px;color:#aec6e4;}
.sb-row b{color:#fff;font-family:'Courier New',monospace;}
.sb-alias{width:100%;box-sizing:border-box;background:#070f1f;border:1px solid #2c3e5e;border-radius:8px;color:#fff;font:bold 15px 'Courier New',monospace;padding:9px 12px;letter-spacing:1px;}
.sb-sel{width:100%;box-sizing:border-box;background:#070f1f;border:1px solid #2c3e5e;border-radius:8px;color:#cfe6ff;font:13px sans-serif;padding:9px;}
.sb-knrow{display:flex;justify-content:space-around;margin:6px 0;}
.sb-kn{display:flex;flex-direction:column;align-items:center;gap:7px;}
.sb-dial{width:84px;height:84px;border-radius:50%;position:relative;cursor:ns-resize;touch-action:none;
    background:repeating-conic-gradient(from -136deg,#33486a 0 1.5deg,transparent 1.5deg 14deg),#070f1f;box-shadow:0 5px 13px rgba(0,0,0,.55);}
.sb-dial::before{content:'';position:absolute;inset:9%;border-radius:50%;background:conic-gradient(from 225deg,var(--c,#6FC8F0) calc(var(--p,50%) * 0.75),#15233c 0);
    -webkit-mask:radial-gradient(circle,transparent 53%,#000 55%);mask:radial-gradient(circle,transparent 53%,#000 55%);filter:drop-shadow(0 0 5px var(--c,#6FC8F0));}
.sb-dial::after{content:'';position:absolute;inset:24%;border-radius:50%;background:radial-gradient(circle at 42% 32%,#41618a,#13233c 72%);box-shadow:inset 0 2px 5px rgba(255,255,255,.2),0 2px 5px rgba(0,0,0,.5);}
.sb-dial i{position:absolute;left:50%;top:50%;width:4px;height:36%;border-radius:3px;background:var(--c,#6FC8F0);box-shadow:0 0 6px var(--c,#6FC8F0);transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(var(--rot,0deg));}
.sb-kn b{font:bold 14px 'Courier New',monospace;color:#cfe6ff;} .sb-kn span{font-size:11px;color:#9fb6cc;}
.sb-key{display:block;width:100%;padding:14px;border-radius:10px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;font:bold 13px sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-align:center;margin-top:10px;}
.sb-key.on{background:#39d353;color:#04140a;border-color:#39d353;box-shadow:0 0 10px rgba(57,211,83,.5);}
.sb-key.conf.on{background:#6FC8F0;color:#001019;border-color:#6FC8F0;}
.sb-warn{margin-top:10px;padding:10px;border-radius:8px;background:rgba(255,59,59,.12);border:1px solid #ff3b3b;color:#ff9a9a;font:bold 11px sans-serif;display:none;}
.sb-warn.on{display:block;}
/* centre: meter + history */
.sb-mid{display:flex;flex-direction:column;gap:14px;}
.sb-metwrap{display:flex;gap:16px;align-items:stretch;flex:0 0 auto;}
.sb-meter{position:relative;width:34px;height:200px;border-radius:6px;overflow:hidden;box-shadow:inset 0 0 0 1px #1d2942;
    background:linear-gradient(to top,#0f7a39,#39d353 55%,#ffd400 80%,#ff2b2b 100%);}
.sb-meter .mask{position:absolute;left:0;right:0;top:0;background:#070f1f;}
.sb-meter .pk{position:absolute;left:0;right:0;height:2px;background:#fff;}
.sb-headroom{flex:1;font:13px 'Courier New',monospace;color:#aec6e4;line-height:2;}
.sb-headroom b{color:#fff;} .sb-headroom .hot{color:#ff6a6a;}
.sb-hist{flex:1;position:relative;background:#03060f;border:1px solid #1d2942;border-radius:10px;overflow:hidden;min-height:150px;}
.sb-hist canvas{position:absolute;inset:0;width:100%;height:100%;}
.sb-hist .cap{position:absolute;left:8px;top:6px;font:bold 10px 'Courier New',monospace;color:#6FC8F0;letter-spacing:1px;z-index:2;}
`;

function render(body, twist) {
    addStyles('sb-styles', CSS);
    const chName = ((twist.querySelector('.twist-title') || {}).innerText || 'INPUT').replace(/^[^A-Za-z0-9]*/, '').trim();
    const s = { gain: 0.5, hpf: 0.3, pan: 0.5, phantom: false, conf: false, mic: 0, stand: 'Boom Arm', cable: 15, level: 0.3, target: 0.4, peak: 0.3 };
    const hist = [];

    body.innerHTML = `
      <div class="sb">
        <div class="sb-col">
          <div class="sb-card"><h4>Input Asset</h4>
            <div class="sb-row" style="display:block"><span>Channel Alias</span><input class="sb-alias" value="${chName.replace(/\s+/g, '_')}_Boom"></div>
            <div class="sb-row" style="display:block;margin-top:10px"><span>Microphone Library</span>
              <select class="sb-sel sb-mic">${MICS.map((m, i) => `<option value="${i}">${m.name} · ${m.type}</option>`).join('')}</select></div>
            <div class="sb-row" style="display:block;margin-top:10px"><span>Mic Stand / Mount</span>
              <select class="sb-sel sb-stand">${Object.keys(STANDS).map(k => `<option>${k}</option>`).join('')}</select></div>
            <div class="sb-row" style="margin-top:10px"><span>Cable Length</span><span><input class="sb-cable" type="range" min="1" max="120" value="15" style="width:120px;vertical-align:middle"> <b class="sb-cablev">15 m</b></span></div>
          </div>
          <div class="sb-card"><h4>Electrical Integrity</h4>
            <div class="sb-row"><span>Impedance (auto)</span><b class="sb-imp">25 Ω</b></div>
            <div class="sb-row"><span>Sensitivity</span><b class="sb-sens">-32 dBV</b></div>
            <div class="sb-row"><span>HF Comp (cable)</span><b class="sb-hf">+0.0 dB</b></div>
            <div class="sb-key phantom">+48V Phantom</div>
            <div class="sb-warn">⚠ RIBBON MIC — phantom power locked (would damage element)</div>
          </div>
        </div>

        <div class="sb-mid">
          <div class="sb-card sb-metwrap">
            <div class="sb-meter"><div class="mask"></div><div class="pk"></div></div>
            <div class="sb-headroom"></div>
          </div>
          <div class="sb-card" style="flex:1;display:flex;flex-direction:column">
            <h4>Meter History · rolling 30 s</h4>
            <div class="sb-hist"><div class="cap">PPM · troubleshoot crackle / consistent peaking</div><canvas></canvas></div>
          </div>
        </div>

        <div class="sb-col">
          <div class="sb-card"><h4>Preamp</h4>
            <div class="sb-knrow"></div>
            <div class="sb-key conf">Confidence Monitor</div>
          </div>
        </div>
      </div>`;

    const $ = (q) => body.querySelector(q);
    const knrow = $('.sb-knrow'); const dials = [];
    [['gain', 'Gain', '#39d353'], ['hpf', 'HPF', '#6FC8F0'], ['pan', 'Pan', '#cba6ff']].forEach(([key, label, c]) => {
        const kn = document.createElement('div'); kn.className = 'sb-kn';
        kn.innerHTML = `<div class="sb-dial" style="--c:${c}"><i></i></div><b></b><span>${label}</span>`;
        const dial = kn.querySelector('.sb-dial'), val = kn.querySelector('b');
        const paint = () => {
            const v = s[key]; dial.style.setProperty('--p', (v * 100) + '%'); dial.style.setProperty('--rot', (v * 270 - 135) + 'deg');
            const m = MICS[s.mic];
            val.textContent = key === 'gain' ? Math.round(m.gain[0] + v * (m.gain[1] - m.gain[0])) + ' dB'
                : key === 'hpf' ? Math.round(20 + v * 280) + ' Hz'
                    : (v < .48 ? 'L' + Math.round((.5 - v) * 200) : v > .52 ? 'R' + Math.round((v - .5) * 200) : 'C');
        };
        let sy = 0, sv = 0, dr = false;
        dial.addEventListener('mousedown', e => { dr = true; sy = e.clientY; sv = s[key]; e.preventDefault(); });
        window.addEventListener('mousemove', e => { if (!dr) return; s[key] = Math.max(0, Math.min(1, sv + (sy - e.clientY) / 130)); paint(); });
        window.addEventListener('mouseup', () => dr = false);
        knrow.appendChild(kn); dials.push(paint); paint();
    });

    function applyMic() {
        const m = MICS[s.mic];
        $('.sb-imp').textContent = m.imp + ' Ω';
        $('.sb-sens').textContent = m.sens + ' dBV';
        s.hpf = Math.min(1, (STANDS[s.stand] - 20) / 280);   // stand drives the HPF
        if (m.ribbon && s.phantom) { s.phantom = false; }
        $('.phantom').classList.toggle('on', s.phantom);
        $('.phantom').style.opacity = m.ribbon ? .5 : 1;
        $('.sb-warn').classList.toggle('on', m.ribbon);
        dials.forEach(p => p());
    }
    $('.sb-mic').addEventListener('change', e => { s.mic = +e.target.value; applyMic(); });
    $('.sb-stand').addEventListener('change', e => { s.stand = e.target.value; applyMic(); });
    $('.sb-cable').addEventListener('input', e => { s.cable = +e.target.value; $('.sb-cablev').textContent = s.cable + ' m'; $('.sb-hf').textContent = '+' + (s.cable * 0.012).toFixed(1) + ' dB'; });
    $('.phantom').addEventListener('click', () => { if (MICS[s.mic].ribbon) return; s.phantom = !s.phantom; $('.phantom').classList.toggle('on', s.phantom); });
    $('.sb-conf, .sb-key.conf').addEventListener('click', e => { s.conf = !s.conf; e.currentTarget.classList.toggle('on', s.conf); });
    applyMic();

    const mask = $('.sb-meter .mask'), pk = $('.sb-meter .pk'), hr = $('.sb-headroom'), hc = $('.sb-hist canvas');
    let f = 0;
    pushTimer(setInterval(() => {
        f++;
        if (f % 6 === 0) s.target = Math.max(0.05, Math.min(1, s.target + (Math.random() - 0.5) * 0.45));
        // occasional "cable crackle" spike for the history view
        const crackle = (s.cable > 60 && Math.random() < 0.03) ? Math.random() * 0.5 : 0;
        const goal = Math.min(1, s.target * (0.5 + s.gain) + crackle);
        s.level += (goal - s.level) * (goal > s.level ? 0.5 : 0.12);
        s.peak = s.level > s.peak ? s.level : Math.max(s.level, s.peak - 0.006);
        mask.style.height = (100 - s.level * 100) + '%'; pk.style.bottom = (s.peak * 100) + '%';
        const dbfs = Math.round((s.peak - 1) * 60), head = Math.round((1 - s.peak) * 60);
        hr.innerHTML = `Peak&nbsp; <b>${dbfs} dBFS</b><br>Headroom&nbsp; <b class="${head < 6 ? 'hot' : ''}">${head} dB</b><br>`
            + `Phantom&nbsp; <b>${s.phantom ? '+48V ON' : 'OFF'}</b><br>Monitor&nbsp; <b>${s.conf ? 'CUE→BUS' : '—'}</b>`;
        hist.push(s.level); if (hist.length > 300) hist.shift();
        drawHist(hc, hist);
    }, 100));
}

function drawHist(cv, hist) {
    const w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight, ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,110,150,.18)'; [0.25, 0.5, 0.75].forEach(p => { const y = h - p * h; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); });
    ctx.beginPath();
    hist.forEach((v, i) => { const x = i / 300 * w, y = h - 3 - v * (h - 8); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = '#39d353'; ctx.lineWidth = 1.5; ctx.stroke();
    // red peak markers
    ctx.fillStyle = '#ff3b3b'; hist.forEach((v, i) => { if (v > 0.95) ctx.fillRect(i / 300 * w, 2, 2, 6); });
}

register(n => /stage\s*box|pre.?amp|input asset|mic input/i.test(n), 'STAGE BOX INPUT · SMART OBJECT', render);
