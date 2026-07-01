// src/editors/meter-input — the "Meter Input" test tool (TEST TOOLS destination).
// Port of js/editors/meter-input.js as a typed EditorPlugin. Route any video +
// audio source into it and it becomes a bench of measurement instruments, each
// one the SAME shared code the role editors use — nothing re-implemented:
//   • RGB PARADE waveform + VECTORSCOPE ...... ui/scopes.ts       (camera CCU scopes)
//   • AUDIO ANALYZER oscilloscope + LISSAJOUS  ui/audio-scope.ts  (IFB trace + phase)
//   • VU / PPM METERING ...................... ui/widgets.ts meter()
//   • LOUDNESS OVER TIME ..................... ui/loudness.ts     (BS.1770 graph)
import type { EditorPlugin } from '../types.js';
import { el, qs, addStyles } from '../../ui/dom.js';
import { drawParade, drawVectorscope, type ShadingState } from '../../ui/scopes.js';
import { drawAudioWave, drawLissajous } from '../../ui/audio-scope.js';
import { createLoudnessTracker, drawLoudnessPlot } from '../../ui/loudness.js';
import { meter } from '../../ui/widgets.js';

const CSS_ID = 'tr-meter-input';
const CSS = `
.mi{display:flex;flex-direction:column;gap:14px;height:100%;}
.mi-sources{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.mi-src{font:bold 10px 'Courier New',monospace;letter-spacing:1px;padding:5px 10px;border-radius:6px;background:#0c1730;border:1px solid #2c3e5e;color:#cfe6ff;}
.mi-src.empty{opacity:.5;font-style:italic;}
.mi-bars{margin-left:auto;font:bold 10px sans-serif;letter-spacing:1px;text-transform:uppercase;padding:7px 12px;border-radius:7px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;cursor:pointer;}
.mi-bars.on{background:#ffd400;color:#1a1206;border-color:#ffd400;}
.mi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start;}
.mi-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.mi-card h4{margin:0;color:#6FC8F0;font-size:11px;letter-spacing:2px;text-transform:uppercase;}
.mi-scopebox{position:relative;background:#03060f;border:1px solid #1d2942;border-radius:8px;overflow:hidden;}
.mi-wf{height:210px;} .mi-vec{height:250px;} .mi-aud{height:150px;} .mi-liss{height:190px;}
.mi-scopebox canvas{position:absolute;inset:0;width:100%;height:100%;}
.mi-tag{position:absolute;left:8px;top:6px;z-index:2;font:bold 9px 'Courier New',monospace;letter-spacing:1px;color:#6FC8F0;}
.mi-meters{display:flex;gap:10px;justify-content:center;padding:4px 0;}
.mi-chan{display:flex;flex-direction:column;align-items:center;gap:6px;}
.mi-clab{font:bold 9px 'Courier New',monospace;color:#bcd3ee;max-width:44px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mi-lufs{font:bold 34px 'Courier New',monospace;color:#cfe6ff;text-align:center;line-height:1;}
.mi-lufs small{display:block;font-size:11px;color:#6b82a3;letter-spacing:2px;margin-top:4px;}
.mi-lhist{height:120px;}`;

function neutralScopeState(): ShadingState {
  return { pan: 0.5, iris: 0.5, mgain: 0.32, mblack: 0.5, gamma: 0.5, rGain: 0.5, gGain: 0.5, bGain: 0.5, rBlk: 0.5, gBlk: 0.5, bBlk: 0.5 };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const plugin: EditorPlugin = {
  id: 'meter-input',
  title: 'METER INPUT · TEST TOOLS',
  order: 10,
  match: (n) => /meter\s*input/i.test(n),
  render(host, ctx) {
    addStyles(CSS_ID, CSS);

    // Audio channels to meter: routed feeds, else a default 8.
    const chans = (ctx.sources.length ? ctx.sources : Array.from({ length: 8 }, (_, i) => ({ id: `CH ${i + 1}`, label: `CH ${i + 1}`, color: '#39d353' }))).slice(0, 12);
    const srcTags = ctx.sources.length
      ? ctx.sources.map((s) => `<span class="mi-src" style="border-color:${s.color}">${s.label}</span>`).join('')
      : `<span class="mi-src empty">no source routed — showing reference signal</span>`;

    host.innerHTML = `
      <div class="mi">
        <div class="mi-sources">
          <span class="mi-src" style="border-color:#6FC8F0">INPUT UNDER TEST</span>
          ${srcTags}
          <div class="mi-bars" title="Inject SMPTE colour bars">◧ SMPTE BARS</div>
        </div>
        <div class="mi-grid">
          <div class="mi-card"><h4>Waveform · RGB Parade · IRE</h4>
            <div class="mi-scopebox mi-wf"><div class="mi-tag">RGB PARADE</div><canvas class="c-wf"></canvas></div></div>
          <div class="mi-card"><h4>Vectorscope · Chroma</h4>
            <div class="mi-scopebox mi-vec"><canvas class="c-vec"></canvas></div></div>
          <div class="mi-card"><h4>Audio Analyzer · Oscilloscope</h4>
            <div class="mi-scopebox mi-aud"><canvas class="c-aud"></canvas></div></div>
          <div class="mi-card"><h4>Phase · Lissajous · Stereo Correlation</h4>
            <div class="mi-scopebox mi-liss"><canvas class="c-liss"></canvas></div></div>
          <div class="mi-card"><h4>Metering · VU / PPM</h4>
            <div class="mi-meters"></div></div>
          <div class="mi-card"><h4>Loudness Over Time · ITU-R BS.1770</h4>
            <div class="mi-lufs"><span class="v">-23.0</span><small>LUFS · INTEGRATED</small></div>
            <div class="mi-scopebox mi-lhist"><canvas class="c-loud"></canvas></div></div>
        </div>
      </div>`;

    const wf = qs<HTMLCanvasElement>(host, '.c-wf');
    const vec = qs<HTMLCanvasElement>(host, '.c-vec');
    const aud = qs<HTMLCanvasElement>(host, '.c-aud');
    const liss = qs<HTMLCanvasElement>(host, '.c-liss');
    const loudCv = qs<HTMLCanvasElement>(host, '.c-loud');
    const lufsEl = qs(host, '.mi-lufs .v');

    const ui = { bars: false };
    const barsBtn = qs(host, '.mi-bars');
    barsBtn.addEventListener('click', () => { ui.bars = !ui.bars; barsBtn.classList.toggle('on', ui.bars); });

    // VU bars reuse the shared self-animating meter() so they match the mixer.
    const metersEl = qs(host, '.mi-meters');
    chans.forEach((c) => {
      const chan = el('div', { class: 'mi-chan' }, [meter(ctx.dispose, 0.3)]);
      chan.append(el('div', { class: 'mi-clab', textContent: c.label }));
      metersEl.appendChild(chan);
    });

    const s = neutralScopeState();
    const levels = chans.map(() => 0.3);
    const loudness = createLoudnessTracker({ start: -23 });
    let corr = 0.6;
    let frame = 0;

    ctx.dispose.interval(() => {
      frame++;
      // live-looking grade
      s.iris = 0.5 + Math.sin(frame * 0.03) * 0.16;
      s.mgain = 0.28 + Math.abs(Math.sin(frame * 0.021)) * 0.14;
      s.pan = 0.5 + Math.sin(frame * 0.012) * 0.18;
      (['rGain', 'gGain', 'bGain'] as const).forEach((k) => { s[k] = clamp(s[k] + (Math.random() - 0.5) * 0.02, 0.35, 0.65); });
      drawParade(wf, s, ui.bars);
      drawVectorscope(vec, s, ui.bars);

      // audio levels: wandering ballistics
      let sum = 0;
      for (let i = 0; i < levels.length; i++) {
        if (frame % 8 === 0) levels[i] = clamp((levels[i] ?? 0.3) + (Math.random() - 0.5) * 0.5, 0.05, 1);
        sum += levels[i] ?? 0;
      }
      const avg = levels.length ? sum / levels.length : 0.3;
      drawAudioWave(aud, ui.bars ? 0.7 : avg, {});
      corr = clamp(corr + (Math.random() - 0.5) * 0.06, -1, 1);
      drawLissajous(liss, corr, frame, avg);
      loudness.update(avg);
      lufsEl.textContent = loudness.lufs.toFixed(1);
      drawLoudnessPlot(loudCv, loudness.history);
    }, 40);
  },
};

export default plugin;
