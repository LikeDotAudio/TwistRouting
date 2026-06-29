// src/editors/stagebox-input/view — faithful port of the legacy buildPanel +
// the two canvas renderers (PPM 30s history, HPF frequency response). Driven by
// a per-panel PanelState; timers/listeners register on the EditorContext disposer
// so the host tears them down on close (no module-global timer list).

import type { Disposer } from '../../ui/timers.js';
import { MICS, STANDS, initState } from './state.js';
import type { PanelState } from './state.js';

type DialKey = 'gain' | 'hpf' | 'pan';

/** Build one full Stage Box Input channel panel into `body`. */
export function buildPanel(body: HTMLElement, chName: string, dispose: Disposer): void {
  const s: PanelState = initState();
  const hist: number[] = [];

  body.innerHTML = `
      <div class="sb">
        <div class="sb-col">
          <div class="sb-card"><h4>Input Asset</h4>
            <div class="sb-row" style="display:block"><span>Channel Alias</span><input class="sb-alias" value="${chName.replace(/\s+/g, '_')}_Boom"></div>
            <div class="sb-row" style="display:block;margin-top:10px"><span>Microphone Library</span>
              <select class="sb-sel sb-mic">${MICS.map((m, i) => `<option value="${i}">${m.name} · ${m.type}</option>`).join('')}</select></div>
            <div class="sb-row" style="display:block;margin-top:10px"><span>Mic Stand / Mount</span>
              <select class="sb-sel sb-stand">${Object.keys(STANDS).map((k) => `<option>${k}</option>`).join('')}</select></div>
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
          <div class="sb-card"><h4>Noise Reduction · Pre-Gain</h4>
            <div class="sb-row"><span>Mode</span>
              <select class="sb-sel sb-nrmode"><option>Off</option><option>Broadband (NS)</option><option>Adaptive AI</option><option>De-Hum 50/60Hz</option><option>De-Ess</option></select></div>
            <div class="sb-row" style="margin-top:8px"><span>Reduction</span><span><input class="sb-nr" type="range" min="0" max="24" value="0" style="width:120px;vertical-align:middle"> <b class="sb-nrv">0 dB</b></span></div>
          </div>
          <div class="sb-card"><h4>High-Pass Filter</h4>
            <div class="sb-row"><span>Window</span>
              <select class="sb-sel sb-hpw"><option>Butterworth</option><option>Linkwitz-Riley</option><option>Bessel</option><option>Chebyshev</option><option>Hann</option><option>Blackman</option></select></div>
            <div class="sb-row" style="margin-top:8px"><span>Frequency</span><span><input class="sb-hpf2" type="range" min="20" max="300" value="80" style="width:120px;vertical-align:middle"> <b class="sb-hpfv">80 Hz</b></span></div>
            <div class="sb-row" style="margin-top:8px;display:block"><span>Slope</span>
              <div class="sb-slopes" style="display:flex;gap:6px;margin-top:6px"></div></div>
            <canvas class="sb-hpchart"></canvas>
          </div>
          <div class="sb-card"><h4>Preamp</h4>
            <div class="sb-knrow"></div>
            <div class="sb-key conf">Confidence Monitor</div>
          </div>
        </div>
      </div>`;

  const q = <T extends Element>(sel: string): T => {
    const found = body.querySelector<T>(sel);
    if (!found) throw new Error(`stagebox-input: no element matches ${sel}`);
    return found;
  };

  const knrow = q<HTMLElement>('.sb-knrow');
  const dials: Array<() => void> = [];
  const dialDefs: ReadonlyArray<readonly [DialKey, string, string]> = [
    ['gain', 'Gain', '#39d353'],
    ['hpf', 'HPF', '#6FC8F0'],
    ['pan', 'Pan', '#cba6ff'],
  ];
  dialDefs.forEach(([key, label, c]) => {
    const kn = document.createElement('div');
    kn.className = 'sb-kn';
    kn.innerHTML = `<div class="sb-dial" style="--c:${c}"><i></i></div><b></b><span>${label}</span>`;
    const dial = kn.querySelector<HTMLElement>('.sb-dial')!;
    const val = kn.querySelector<HTMLElement>('b')!;
    const paint = (): void => {
      const v = s[key];
      dial.style.setProperty('--p', v * 100 + '%');
      dial.style.setProperty('--rot', v * 270 - 135 + 'deg');
      const m = MICS[s.mic]!;
      val.textContent =
        key === 'gain'
          ? Math.round(m.gain[0] + v * (m.gain[1] - m.gain[0])) + ' dB'
          : key === 'hpf'
            ? Math.round(20 + v * 280) + ' Hz'
            : v < 0.48
              ? 'L' + Math.round((0.5 - v) * 200)
              : v > 0.52
                ? 'R' + Math.round((v - 0.5) * 200)
                : 'C';
    };
    let sy = 0;
    let sv = 0;
    let dr = false;
    dial.addEventListener('mousedown', (e) => {
      dr = true;
      sy = e.clientY;
      sv = s[key];
      e.preventDefault();
    });
    const onMove = (e: MouseEvent): void => {
      if (!dr) return;
      s[key] = Math.max(0, Math.min(1, sv + (sy - e.clientY) / 130));
      paint();
    };
    const onUp = (): void => {
      dr = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    dispose.add(() => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    });
    knrow.appendChild(kn);
    dials.push(paint);
    paint();
  });

  function applyMic(): void {
    const m = MICS[s.mic]!;
    q<HTMLElement>('.sb-imp').textContent = m.imp + ' Ω';
    q<HTMLElement>('.sb-sens').textContent = m.sens + ' dBV';
    s.hpf = Math.min(1, (STANDS[s.stand]! - 20) / 280); // stand drives the HPF
    if (m.ribbon && s.phantom) {
      s.phantom = false;
    }
    const phantom = q<HTMLElement>('.phantom');
    phantom.classList.toggle('on', s.phantom);
    phantom.style.opacity = m.ribbon ? '.5' : '1';
    q<HTMLElement>('.sb-warn').classList.toggle('on', m.ribbon);
    dials.forEach((p) => p());
  }
  q<HTMLSelectElement>('.sb-mic').addEventListener('change', (e) => {
    s.mic = +(e.target as HTMLSelectElement).value;
    applyMic();
  });
  q<HTMLSelectElement>('.sb-stand').addEventListener('change', (e) => {
    s.stand = (e.target as HTMLSelectElement).value;
    applyMic();
  });
  q<HTMLInputElement>('.sb-cable').addEventListener('input', (e) => {
    s.cable = +(e.target as HTMLInputElement).value;
    q<HTMLElement>('.sb-cablev').textContent = s.cable + ' m';
    q<HTMLElement>('.sb-hf').textContent = '+' + (s.cable * 0.012).toFixed(1) + ' dB';
  });
  q<HTMLElement>('.phantom').addEventListener('click', () => {
    if (MICS[s.mic]!.ribbon) return;
    s.phantom = !s.phantom;
    q<HTMLElement>('.phantom').classList.toggle('on', s.phantom);
  });
  q<HTMLElement>('.sb-key.conf').addEventListener('click', (e) => {
    s.conf = !s.conf;
    (e.currentTarget as HTMLElement).classList.toggle('on', s.conf);
  });
  // noise reduction + HPF window / frequency / slope — visualised as a response chart
  const redrawHPF = (): void => {
    const fc = +q<HTMLInputElement>('.sb-hpf2').value;
    const sel = body.querySelector<HTMLElement>('.sb-slope.sel');
    const sl = sel ? parseInt(sel.textContent ?? '', 10) || 12 : 12;
    drawHPF(q<HTMLCanvasElement>('.sb-hpchart'), fc, sl, q<HTMLSelectElement>('.sb-hpw').value);
  };
  q<HTMLInputElement>('.sb-nr').addEventListener('input', (e) => {
    q<HTMLElement>('.sb-nrv').textContent = (e.target as HTMLInputElement).value + ' dB';
  });
  q<HTMLInputElement>('.sb-hpf2').addEventListener('input', (e) => {
    q<HTMLElement>('.sb-hpfv').textContent = (e.target as HTMLInputElement).value + ' Hz';
    redrawHPF();
  });
  q<HTMLSelectElement>('.sb-hpw').addEventListener('change', redrawHPF);
  const slopes = q<HTMLElement>('.sb-slopes');
  ['6', '12', '18', '24'].forEach((db, i) => {
    const btn = document.createElement('button');
    btn.className = 'sb-slope' + (i === 1 ? ' sel' : '');
    btn.textContent = db + ' dB/oct';
    btn.addEventListener('click', () => {
      slopes.querySelectorAll('.sb-slope').forEach((x) => x.classList.remove('sel'));
      btn.classList.add('sel');
      redrawHPF();
    });
    slopes.appendChild(btn);
  });
  const tid = setTimeout(redrawHPF, 0); // after layout so the canvas has a size
  dispose.add(() => clearTimeout(tid));
  applyMic();

  const mask = q<HTMLElement>('.sb-meter .mask');
  const pk = q<HTMLElement>('.sb-meter .pk');
  const hr = q<HTMLElement>('.sb-headroom');
  const hc = q<HTMLCanvasElement>('.sb-hist canvas');
  let f = 0;
  dispose.interval(() => {
    f++;
    if (f % 6 === 0) s.target = Math.max(0.05, Math.min(1, s.target + (Math.random() - 0.5) * 0.45));
    // occasional "cable crackle" spike for the history view
    const crackle = s.cable > 60 && Math.random() < 0.03 ? Math.random() * 0.5 : 0;
    const goal = Math.min(1, s.target * (0.5 + s.gain) + crackle);
    s.level += (goal - s.level) * (goal > s.level ? 0.5 : 0.12);
    s.peak = s.level > s.peak ? s.level : Math.max(s.level, s.peak - 0.006);
    mask.style.height = 100 - s.level * 100 + '%';
    pk.style.bottom = s.peak * 100 + '%';
    const dbfs = Math.round((s.peak - 1) * 60);
    const head = Math.round((1 - s.peak) * 60);
    hr.innerHTML =
      `Peak&nbsp; <b>${dbfs} dBFS</b><br>Headroom&nbsp; <b class="${head < 6 ? 'hot' : ''}">${head} dB</b><br>` +
      `Phantom&nbsp; <b>${s.phantom ? '+48V ON' : 'OFF'}</b><br>Monitor&nbsp; <b>${s.conf ? 'CUE→BUS' : '—'}</b>`;
    hist.push(s.level);
    if (hist.length > 300) hist.shift();
    drawHist(hc, hist);
  }, 100);
}

function drawHist(cv: HTMLCanvasElement, hist: number[]): void {
  const w = (cv.width = cv.clientWidth);
  const h = (cv.height = cv.clientHeight);
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(80,110,150,.18)';
  [0.25, 0.5, 0.75].forEach((p) => {
    const y = h - p * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  });
  ctx.beginPath();
  hist.forEach((v, i) => {
    const x = (i / 300) * w;
    const y = h - 3 - v * (h - 8);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.strokeStyle = '#39d353';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // red peak markers
  ctx.fillStyle = '#ff3b3b';
  hist.forEach((v, i) => {
    if (v > 0.95) ctx.fillRect((i / 300) * w, 2, 2, 6);
  });
}

// High-pass filter frequency response — log freq (20–20k) × gain (dB), with the
// roll-off set by the slope and the knee character by the window type.
function drawHPF(cv: HTMLCanvasElement, fc: number, slope: number, win: string): void {
  if (!cv) return;
  const w = (cv.width = cv.clientWidth);
  const h = (cv.height = cv.clientHeight);
  if (!w || !h) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const lmin = Math.log10(20);
  const lmax = Math.log10(20000);
  const xOf = (freq: number): number => ((Math.log10(freq) - lmin) / (lmax - lmin)) * w;
  const dbTop = 6;
  const dbBot = -36;
  const yOf = (db: number): number => h - ((db - dbBot) / (dbTop - dbBot)) * h;
  ctx.font = '8px Courier New, monospace';
  ctx.strokeStyle = 'rgba(80,110,150,.16)';
  ctx.fillStyle = 'rgba(120,150,190,.6)';
  [-24, -12, 0].forEach((db) => {
    const y = yOf(db);
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillText(db + '', 2, y - 2);
  });
  [100, 1000, 10000].forEach((freq) => {
    const x = xOf(freq);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.fillText(freq >= 1000 ? freq / 1000 + 'k' : '' + freq, x + 2, h - 2);
  });
  ctx.strokeStyle = 'rgba(111,200,240,.4)';
  ctx.beginPath();
  ctx.moveTo(xOf(fc), 0);
  ctx.lineTo(xOf(fc), h);
  ctx.stroke();
  const n = slope / 6;
  const ripple = win === 'Chebyshev' ? 1 : 0;
  const gentle = win === 'Bessel' ? 1 : 0;
  ctx.beginPath();
  for (let px = 22; px <= w; px++) {
    const freq = Math.pow(10, lmin + (px / w) * (lmax - lmin));
    let db = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(fc / freq, 2 * n)));
    const near = Math.exp(-Math.pow(Math.log10(freq / fc), 2) / 0.05);
    db += ripple * near * 2.5 - gentle * near * 1.5;
    const y = yOf(Math.max(dbBot, Math.min(dbTop, db)));
    if (px === 22) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.strokeStyle = '#6FC8F0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineTo(w, h);
  ctx.lineTo(22, h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(111,200,240,.1)';
  ctx.fill();
  ctx.fillStyle = '#6FC8F0';
  ctx.font = 'bold 9px Courier New, monospace';
  ctx.fillText(`${win} · ${fc}Hz · ${slope}dB/oct`, 26, 11);
}
