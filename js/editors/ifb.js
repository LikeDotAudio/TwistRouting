// js/editors/ifb.js — Audio IFB (Interruptible Foldback) editor. Tied to the
// intercom: the talent's earpiece receives TWO things — a MIX-MINUS (the program
// minus their own mic, so no echo) and an IFB INTERRUPT (the director's talk).
//
// A Ducker automatically drops the program by the Interrupt Depth when a Talk key
// is held, fading back on release. Talk keys follow the interrupt hierarchy:
//   P1 Director (breaks program) · P2 Technical Director · P3 Production Assistant.
// The operator monitors the CONFIDENCE FEED — exactly what the talent hears.
import { register, addStyles, pushTimer } from './core.js';
import { renderGridOfSiblings } from './multi.js';
import { drawAudioWave } from './shared/audio-scope.js';

const CSS = `
.ifb{display:grid;grid-template-columns:200px minmax(0,1fr) 320px;gap:16px;height:100%;}
.ifb-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:16px;}
.ifb-card h4{margin:0 0 12px;color:#6FC8F0;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.ifb-ins{display:flex;flex-direction:column;gap:16px;}
.ifb-strip{display:flex;gap:12px;align-items:flex-end;}
.ifb-meter{position:relative;width:26px;height:150px;border-radius:5px;overflow:hidden;box-shadow:inset 0 0 0 1px #1d2942;
    background:linear-gradient(to top,#0f7a39,#39d353 55%,#ffd400 80%,#ff2b2b 100%);}
.ifb-meter .mask{position:absolute;left:0;right:0;top:0;background:#070f1f;}
.ifb-stripinfo b{display:block;font:bold 12px sans-serif;color:#cfe6ff;letter-spacing:1px;}
.ifb-stripinfo span{font:10px 'Courier New',monospace;color:#7e93b5;}

/* confidence feed (centre) */
.ifb-conf{position:relative;flex:1;display:flex;flex-direction:column;}
.ifb-feed{flex:1;position:relative;background:#03060f;border:1px solid #1d2942;border-radius:10px;overflow:hidden;min-height:200px;}
.ifb-feed canvas{position:absolute;inset:0;width:100%;height:100%;}
.ifb-status{position:absolute;left:50%;top:14px;transform:translateX(-50%);font:900 16px sans-serif;letter-spacing:3px;z-index:2;
    color:#39d353;text-shadow:0 0 8px rgba(0,0,0,.7);}
.ifb-status.talk{color:#ff6a6a;animation:ifbB 1s steps(2) infinite;}
@keyframes ifbB{50%{opacity:.35;}}
.ifb-duckwrap{margin-top:12px;}
.ifb-duck{position:relative;height:64px;background:#070f1f;border:1px solid #1d2942;border-radius:8px;overflow:hidden;}
.ifb-duck canvas{position:absolute;inset:0;width:100%;height:100%;}
.ifb-cap{font:bold 10px 'Courier New',monospace;color:#6FC8F0;letter-spacing:1px;margin:4px 2px;}

/* right: encoders + talk hierarchy */
.ifb-right{display:flex;flex-direction:column;gap:14px;overflow:auto;}
.ifb-knobs{display:flex;justify-content:space-around;}
.ifb-kn{display:flex;flex-direction:column;align-items:center;gap:7px;}
.ifb-dial{width:84px;height:84px;border-radius:50%;position:relative;cursor:ns-resize;touch-action:none;
    background:repeating-conic-gradient(from -136deg,#33486a 0 1.5deg,transparent 1.5deg 14deg),#070f1f;box-shadow:0 5px 13px rgba(0,0,0,.55);}
.ifb-dial::before{content:'';position:absolute;inset:9%;border-radius:50%;background:conic-gradient(from 225deg,var(--c,#6FC8F0) calc(var(--p,50%) * 0.75),#15233c 0);
    -webkit-mask:radial-gradient(circle,transparent 53%,#000 55%);mask:radial-gradient(circle,transparent 53%,#000 55%);filter:drop-shadow(0 0 5px var(--c,#6FC8F0));}
.ifb-dial::after{content:'';position:absolute;inset:24%;border-radius:50%;background:radial-gradient(circle at 42% 32%,#41618a,#13233c 72%);box-shadow:inset 0 2px 5px rgba(255,255,255,.2),0 2px 5px rgba(0,0,0,.5);}
.ifb-dial i{position:absolute;left:50%;top:50%;width:4px;height:36%;border-radius:3px;background:var(--c,#6FC8F0);box-shadow:0 0 6px var(--c,#6FC8F0);transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(var(--rot,0deg));}
.ifb-kn b{font:bold 13px 'Courier New',monospace;color:#cfe6ff;} .ifb-kn span{font-size:11px;color:#9fb6cc;}
.ifb-talks{display:flex;flex-direction:column;gap:10px;}
.ifb-talk{display:flex;align-items:center;gap:12px;padding:14px;border-radius:10px;border:1px solid #2c3e5e;background:#0c1730;cursor:pointer;user-select:none;}
.ifb-talk .pr{width:34px;height:34px;border-radius:8px;background:#13233c;color:#9fb6cc;font:900 14px sans-serif;display:flex;align-items:center;justify-content:center;}
.ifb-talk .nm{flex:1;font:bold 13px sans-serif;color:#cfe6ff;letter-spacing:1px;} .ifb-talk .nm small{display:block;color:#7e93b5;font-weight:normal;letter-spacing:0;}
.ifb-talk.on{background:#ff3b3b;border-color:#ff3b3b;} .ifb-talk.on .pr{background:#000;color:#ff9a9a;} .ifb-talk.on .nm{color:#fff;}
.ifb-talk.p1.on{box-shadow:0 0 14px rgba(255,59,59,.7);}
`;

function render(body, twist) { renderGridOfSiblings(body, twist, /\bifb\b|foldback/i, buildOne); }

function buildOne(host, twist) {
    const body = host;
    addStyles('ifb-styles', CSS);
    const PRIO = [
        { p: 1, nm: 'DIRECTOR', sub: 'Breaks program', c: '#ff3b3b' },
        { p: 2, nm: 'TECH DIRECTOR', sub: 'Urgent technical', c: '#ffd400' },
        { p: 3, nm: 'PRODUCTION ASST', sub: 'Timing cues', c: '#6FC8F0' },
    ];
    const s = { progGain: 0.7, intGain: 0.8, threshold: 0.55, prog: 0.4, progTarget: 0.45, intLvl: 0, talk: 0 };

    body.innerHTML = `
      <div class="ifb">
        <div class="ifb-card ifb-ins">
          <div>
            <div class="ifb-strip"><div class="ifb-meter ifb-mm"><div class="mask"></div></div>
              <div class="ifb-stripinfo"><b>MIX-MINUS</b><span>program − talent mic</span><span class="ifb-mmv"></span></div></div>
          </div>
          <div>
            <div class="ifb-strip"><div class="ifb-meter ifb-int"><div class="mask"></div></div>
              <div class="ifb-stripinfo"><b>IFB INPUT</b><span>interrupt bus</span><span class="ifb-intv"></span></div></div>
          </div>
        </div>

        <div class="ifb-conf">
          <div class="ifb-cap">TALENT CONFIDENCE FEED — what the earpiece hears</div>
          <div class="ifb-feed"><canvas></canvas><div class="ifb-status">● CLEAR</div></div>
          <div class="ifb-duckwrap"><div class="ifb-cap">DUCKER — program ↓ while talking</div><div class="ifb-duck"><canvas></canvas></div></div>
        </div>

        <div class="ifb-right">
          <div class="ifb-card"><h4>IFB Encoders</h4><div class="ifb-knobs"></div></div>
          <div class="ifb-card"><h4>Interrupt Hierarchy · Hold to Talk</h4><div class="ifb-talks"></div></div>
        </div>
      </div>`;

    const $ = (q) => body.querySelector(q);
    const knobs = $('.ifb-knobs');
    const dials = [];
    [['progGain', 'Program', '#39d353'], ['intGain', 'Interrupt', '#ff6a6a'], ['threshold', 'Threshold', '#ffd400']].forEach(([key, label, c]) => {
        const kn = document.createElement('div'); kn.className = 'ifb-kn';
        kn.innerHTML = `<div class="ifb-dial" style="--c:${c}"><i></i></div><b></b><span>${label}</span>`;
        const dial = kn.querySelector('.ifb-dial'), val = kn.querySelector('b');
        const paint = () => { const v = s[key]; dial.style.setProperty('--p', (v * 100) + '%'); dial.style.setProperty('--rot', (v * 270 - 135) + 'deg'); val.textContent = key === 'threshold' ? '-' + Math.round(6 + v * 18) + 'dB' : (v >= .5 ? '+' : '') + Math.round((v - .5) * 24) + 'dB'; };
        let sy = 0, sv = 0, dr = false;
        dial.addEventListener('mousedown', e => { dr = true; sy = e.clientY; sv = s[key]; e.preventDefault(); });
        window.addEventListener('mousemove', e => { if (!dr) return; s[key] = Math.max(0, Math.min(1, sv + (sy - e.clientY) / 130)); paint(); });
        window.addEventListener('mouseup', () => dr = false);
        knobs.appendChild(kn); dials.push(paint); paint();
    });

    const talks = $('.ifb-talks');
    PRIO.forEach(pr => {
        const t = document.createElement('div'); t.className = 'ifb-talk p' + pr.p;
        t.innerHTML = `<div class="pr">P${pr.p}</div><div class="nm">${pr.nm}<small>${pr.sub}</small></div>`;
        const down = () => { s.talk = pr.p; refresh(); };
        const up = () => { if (s.talk === pr.p) { s.talk = 0; refresh(); } };
        t.addEventListener('mousedown', down); t.addEventListener('mouseup', up); t.addEventListener('mouseleave', up);
        t.addEventListener('touchstart', e => { e.preventDefault(); down(); }); t.addEventListener('touchend', up);
        talks.appendChild(t);
    });
    function refresh() { body.querySelectorAll('.ifb-talk').forEach((t, i) => t.classList.toggle('on', PRIO[i].p === s.talk)); }

    const status = $('.ifb-status');
    const mm = $('.ifb-mm .mask'), intM = $('.ifb-int .mask'), feed = $('.ifb-feed canvas'), duck = $('.ifb-duck canvas');
    const duckHist = [];

    pushTimer(setInterval(() => {
        // program ballistics + ducking
        if (Math.random() < 0.12) s.progTarget = 0.25 + Math.random() * 0.6;
        s.prog += (s.progTarget - s.prog) * 0.2;
        const duckDepth = 6 + s.threshold * 18;           // dB
        const duckGain = s.talk ? Math.pow(10, -duckDepth / 20) : 1;
        const progOut = s.prog * s.progGain * duckGain;
        s.intLvl += (((s.talk ? 0.55 + Math.random() * 0.4 : 0)) - s.intLvl) * 0.3;
        const intOut = s.intLvl * s.intGain;
        const conf = Math.min(1, progOut + intOut);
        mm.style.height = (100 - progOut * 100) + '%';
        intM.style.height = (100 - intOut * 100) + '%';
        $('.ifb-mmv').textContent = dB(progOut); $('.ifb-intv').textContent = dB(intOut);
        status.textContent = s.talk ? `● P${s.talk} ${PRIO[s.talk - 1].nm} TALKING` : '● CLEAR';
        status.classList.toggle('talk', !!s.talk);
        drawAudioWave(feed, conf, { alert: !!s.talk });
        duckHist.push(duckGain); if (duckHist.length > 120) duckHist.shift();
        drawDuck(duck, duckHist);
    }, 40));
}

const dB = (v) => v <= 0.001 ? '-∞ dB' : Math.round((v - 1) * 48) + ' dB';

function drawDuck(cv, hist) {
    const w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight, ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,110,150,.25)'; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(w, 6); ctx.stroke();
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2; ctx.beginPath();
    hist.forEach((g, i) => { const x = i / 120 * w, y = h - 4 - g * (h - 10); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
}

register(n => /\bifb\b|foldback/i.test(n), 'IFB · INTERRUPTIBLE FOLDBACK', render);
