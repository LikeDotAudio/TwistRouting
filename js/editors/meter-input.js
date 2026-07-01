// js/editors/meter-input.js — the "Meter Input" test tool (TEST TOOLS destination).
// Route any video + audio source into it and it becomes a bench of measurement
// instruments, each one the SAME code the role editors use — nothing here is a
// re-implementation:
//   • RGB PARADE waveform + VECTORSCOPE ...... js/editors/shared/video-scopes.js  (the camera CCU scopes)
//   • AUDIO ANALYZER oscilloscope ............ js/editors/shared/audio-scope.js    (the IFB confidence trace)
//   • VU / PPM METERING ...................... core.meterBar()                     (the audio-mixer meters)
//   • LOUDNESS OVER TIME ..................... js/editors/shared/loudness.js       (the audio-monitor BS.1770 graph)
import { register, addStyles, pushTimer, channelsFor, gatherSources, meterBar } from './core.js';
import { drawParade, drawVectorscope, neutralScopeState } from './shared/video-scopes.js';
import { drawAudioWave } from './shared/audio-scope.js';
import { createLoudnessTracker, drawLoudnessPlot } from './shared/loudness.js';

const CSS = `
.mi{display:flex;flex-direction:column;gap:14px;height:100%;}
.mi-sources{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.mi-src{font:bold 10px 'Courier New',monospace;letter-spacing:1px;padding:5px 10px;border-radius:6px;
    background:#0c1730;border:1px solid #2c3e5e;color:#cfe6ff;}
.mi-src.empty{opacity:.5;font-style:italic;}
.mi-bars{margin-left:auto;font:bold 10px sans-serif;letter-spacing:1px;text-transform:uppercase;
    padding:7px 12px;border-radius:7px;border:1px solid #2c3e5e;background:#0c1730;color:#bcd3ee;cursor:pointer;}
.mi-bars.on{background:#ffd400;color:#1a1206;border-color:#ffd400;}
.mi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start;}
.mi-card{background:#0a1326;border:1px solid #1d2942;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.mi-card h4{margin:0;color:#6FC8F0;font-size:11px;letter-spacing:2px;text-transform:uppercase;}
.mi-scopebox{position:relative;background:#03060f;border:1px solid #1d2942;border-radius:8px;overflow:hidden;}
.mi-wf{height:210px;} .mi-vec{height:250px;} .mi-aud{height:150px;}
.mi-scopebox canvas{position:absolute;inset:0;width:100%;height:100%;}
.mi-tag{position:absolute;left:8px;top:6px;z-index:2;font:bold 9px 'Courier New',monospace;letter-spacing:1px;color:#6FC8F0;}
/* metering column — the same green→amber→red bar the audio mixer draws */
.mi-meters{display:flex;gap:10px;justify-content:center;padding:4px 0;}
.mi-chan{display:flex;flex-direction:column;align-items:center;gap:6px;}
.mi-vu{width:16px;height:210px;border-radius:5px;background:#0c1322;overflow:hidden;display:flex;flex-direction:column-reverse;box-shadow:inset 0 0 0 1px #1d2942;}
.mi-vu > i{display:block;width:100%;height:0%;background:linear-gradient(#19c54b,#e6e23a 70%,#ff3b3b);}
.mi-clab{font:bold 9px 'Courier New',monospace;color:#bcd3ee;max-width:44px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
/* loudness-over-time */
.mi-lufs{font:bold 34px 'Courier New',monospace;color:#cfe6ff;text-align:center;line-height:1;}
.mi-lufs small{display:block;font-size:11px;color:#6b82a3;letter-spacing:2px;margin-top:4px;}
.mi-lhist{height:120px;}
`;

function render(body, twist, config) {
    addStyles('meter-input-styles', CSS);

    // Everything routed into the tool (for the header) and the audio channels the
    // metering / loudness read from (routed sources, else CH 1..8).
    const routed = gatherSources(twist);
    const chans = channelsFor(twist, config, 'CH', 8).slice(0, 12);

    const srcTags = routed.length
        ? routed.map(s => `<span class="mi-src" style="border-color:${s.color}">${s.label}</span>`).join('')
        : `<span class="mi-src empty">no source routed — showing reference signal</span>`;

    body.innerHTML = `
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
          <div class="mi-card"><h4>Metering · VU / PPM</h4>
            <div class="mi-meters"></div></div>
          <div class="mi-card"><h4>Loudness Over Time · ITU-R BS.1770</h4>
            <div class="mi-lufs"><span class="v">-23.0</span><small>LUFS · INTEGRATED</small></div>
            <div class="mi-scopebox mi-lhist"><canvas class="c-loud"></canvas></div></div>
        </div>
      </div>`;

    const $ = (q) => body.querySelector(q);
    const wf = $('.c-wf'), vec = $('.c-vec'), aud = $('.c-aud'), loudCv = $('.c-loud'), lufsEl = $('.mi-lufs .v');

    // SMPTE bars toggle — same `barsOn` flag the camera scopes honour.
    const ui = { bars: false };
    const barsBtn = $('.mi-bars');
    barsBtn.addEventListener('click', () => { ui.bars = !ui.bars; barsBtn.classList.toggle('on', ui.bars); });

    // Synthetic grade for the video scopes (no real pixels in this sim). Neutral to
    // start; a few axes wander so the parade/vectorscope read as a live picture.
    const s = neutralScopeState();

    // Per-channel audio ballistics drive the analyzer + loudness. The VU bars reuse
    // the shared, self-animating meterBar() so they match the mixer exactly.
    const metersEl = $('.mi-meters');
    chans.forEach(c => {
        const chan = document.createElement('div'); chan.className = 'mi-chan';
        chan.appendChild(meterBar('mi-vu'));
        const lab = document.createElement('div'); lab.className = 'mi-clab'; lab.textContent = c.label;
        chan.appendChild(lab);
        metersEl.appendChild(chan);
    });
    const levels = chans.map(() => 0.3);
    const loudness = createLoudnessTracker({ start: -23 });

    let frame = 0;
    pushTimer(setInterval(() => {
        frame++;
        // live-looking grade: breathe exposure, jitter gain, drift white balance
        s.iris = 0.5 + Math.sin(frame * 0.03) * 0.16;
        s.mgain = 0.28 + Math.abs(Math.sin(frame * 0.021)) * 0.14;
        s.pan = 0.5 + Math.sin(frame * 0.012) * 0.18;
        ['rGain', 'gGain', 'bGain'].forEach(k => { s[k] = Math.max(0.35, Math.min(0.65, s[k] + (Math.random() - 0.5) * 0.02)); });
        drawParade(wf, s, ui.bars);
        drawVectorscope(vec, s, ui.bars);

        // audio levels: fast attack / slow release toward a wandering target
        let sum = 0;
        for (let i = 0; i < levels.length; i++) {
            if (frame % 8 === 0) levels[i] = Math.max(0.05, Math.min(1, levels[i] + (Math.random() - 0.5) * 0.5));
            sum += levels[i];
        }
        const avg = levels.length ? sum / levels.length : 0.3;
        drawAudioWave(aud, ui.bars ? 0.7 : avg, {});
        loudness.update(avg);
        lufsEl.textContent = loudness.lufs.toFixed(1);
        drawLoudnessPlot(loudCv, loudness.history);
    }, 40));
}

register(n => /meter\s*input/i.test(n), 'METER INPUT · TEST TOOLS', render);
