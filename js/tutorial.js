// js/tutorial.js — first-load "quick start" overlay.
// A short, LCARS-styled 5-step walkthrough shown when the app loads. Dismissible
// (button / Esc / backdrop); "don't show again" is remembered in localStorage, and
// a small "?" button (bottom-left) reopens it anytime. Self-mounting ES module.
(function () {
    'use strict';

    const STORE_KEY = 'twist-tutorial-dismissed';
    const STYLE_ID = 'twist-tutorial-styles';

    const STEPS = [
        { n: 1, title: 'Choose where you’re working',
          body: 'Select the production, control room, edit suite, encoder or floor you want to do production in — from the tabs along the top.' },
        { n: 2, title: 'Pick your sources',
          body: 'On the left, choose the playout, production output, video source and audio you want to use.' },
        { n: 3, title: 'Drag them into a production',
          body: 'Drag the sources onto a production’s twists to route them in.' },
        { n: 4, title: 'Push & hold to break it up',
          body: 'Press and hold a source to expand a stage box into its individual video + audio feeds.' },
        { n: 5, title: 'Click to take control',
          body: 'Click a production element in the destination to open its controls (vision mixer, multiviewer, audio mixer, intercom…).' },
    ];

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        .tut-overlay{position:fixed;inset:0;z-index:3000;display:none;align-items:center;justify-content:center;
            background:rgba(2,5,12,.82);backdrop-filter:blur(3px);font-family:Arial,Helvetica,sans-serif;}
        .tut-overlay.open{display:flex;}
        .tut-card{width:min(620px,92vw);max-height:88vh;overflow:auto;background:#070c18;
            border:2px solid #2c3a5a;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.6);}
        .tut-head{display:flex;align-items:stretch;height:46px;background:var(--tut-color,#FF9C63);
            border-radius:16px 16px 0 0;overflow:hidden;}
        .tut-title{flex:1;display:flex;align-items:center;padding-left:78px;color:#000;font-weight:900;
            letter-spacing:3px;font-size:15px;text-transform:uppercase;}
        .tut-x{flex:0 0 auto;width:56px;display:flex;align-items:center;justify-content:center;cursor:pointer;
            color:#000;font-size:26px;font-weight:bold;box-shadow:inset 2px 0 0 rgba(0,0,0,.25);}
        .tut-x:hover{background:rgba(0,0,0,.18);}
        .tut-body{padding:18px 22px 8px;}
        .tut-step{display:flex;gap:16px;align-items:flex-start;padding:11px 0;border-bottom:1px solid #16223c;}
        .tut-step:last-child{border-bottom:none;}
        .tut-num{flex:0 0 auto;width:40px;height:40px;border-radius:12px 4px 12px 4px;
            background:var(--tut-color,#FF9C63);color:#000;font-weight:900;font-size:18px;
            display:flex;align-items:center;justify-content:center;}
        .tut-text h4{margin:2px 0 3px;color:#e0f0ff;font-size:14px;letter-spacing:1px;}
        .tut-text p{margin:0;color:#9fb6cc;font-size:13px;line-height:1.45;}
        .tut-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;
            padding:12px 22px 20px;flex-wrap:wrap;}
        .tut-again{display:flex;align-items:center;gap:8px;color:#7e93b5;font-size:12px;cursor:pointer;user-select:none;}
        .tut-again input{width:16px;height:16px;accent-color:var(--tut-color,#FF9C63);cursor:pointer;}
        .tut-go{border:none;border-radius:18px;background:var(--tut-color,#FF9C63);color:#000;
            font-weight:900;letter-spacing:2px;font-size:13px;padding:12px 30px;cursor:pointer;}
        .tut-go:hover{filter:brightness(1.1);}
        /* "ACADEMY" button sits beside the "created by" credit (bottom-right). */
        .tut-help{position:fixed;right:417px;bottom:10px;z-index:1000;border:none;
            border-radius:18px 6px 6px 18px;background:var(--tut-color,#FF9C63);color:#000;
            font-weight:900;letter-spacing:2px;font-size:11px;text-transform:uppercase;
            padding:8px 18px 8px 16px;cursor:pointer;box-shadow:inset 5px 0 0 #c97a16;white-space:nowrap;}
        .tut-help:hover{filter:brightness(1.1);}
        `;
        document.head.appendChild(s);
    }

    let overlay = null;

    function build() {
        injectStyles();
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'tut-overlay';
        overlay.innerHTML = `
            <div class="tut-card" role="dialog" aria-label="Quick start">
                <div class="tut-head"><span class="tut-title">Quick Start</span><span class="tut-x" title="Close">&times;</span></div>
                <div class="tut-body">
                    ${STEPS.map(s => `
                        <div class="tut-step">
                            <div class="tut-num">${s.n}</div>
                            <div class="tut-text"><h4>${s.title}</h4><p>${s.body}</p></div>
                        </div>`).join('')}
                </div>
                <div class="tut-foot">
                    <label class="tut-again"><input type="checkbox" data-again>Don’t show this again</label>
                    <button class="tut-go" data-go>START</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const again = overlay.querySelector('[data-again]');
        const persist = () => { try { localStorage.setItem(STORE_KEY, again.checked ? '1' : ''); } catch (e) {} };
        overlay.querySelector('.tut-x').addEventListener('click', () => close());
        overlay.querySelector('[data-go]').addEventListener('click', () => { persist(); close(); });
        again.addEventListener('change', persist);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close();
        });
        return overlay;
    }

    function open() { build().classList.add('open'); }
    function close() { if (overlay) overlay.classList.remove('open'); }

    function addHelpButton() {
        if (document.querySelector('.tut-help')) return;
        const b = document.createElement('button');
        b.className = 'tut-help';
        b.textContent = 'ACADEMY';
        b.title = 'Quick start / Academy';
        b.addEventListener('click', open);
        document.body.appendChild(b);
    }

    function init() {
        injectStyles();
        addHelpButton();
        let dismissed = false;
        try { dismissed = !!localStorage.getItem(STORE_KEY); } catch (e) {}
        if (!dismissed) open();
    }

    window.Tutorial = { open, close };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
