// js/dest-glow.js — a destination that has feeds routed INTO it shimmers, so at a
// glance you can see which rooms / floors / encoders / suites are "live" with an
// incoming signal. A destination twist is live when its .drop-zone holds feeds.
//
// Decoupled: a debounced MutationObserver re-scans the twists on any DOM change
// (drops, unroutes, lazy tab loads) and toggles `.has-routes`. Class toggles are
// attribute mutations, not childList, so this never re-triggers itself.
(function () {
    'use strict';
    const STYLE_ID = 'dest-glow-styles';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        @keyframes dgShimmer{
            0%,100%{box-shadow:0 0 5px rgba(110,200,240,.40),0 0 13px rgba(110,200,240,.16);}
            50%    {box-shadow:0 0 13px rgba(120,220,255,.85),0 0 28px rgba(120,220,255,.32);}}
        .twist-container.has-routes{animation:dgShimmer 2.6s ease-in-out infinite;
            border-color:rgba(120,220,255,.7)!important;position:relative;}
        .twist-container.has-routes::after{content:'◉';position:absolute;top:3px;right:6px;
            font-size:10px;line-height:1;color:#7fe0ff;text-shadow:0 0 7px rgba(120,220,255,.9);
            pointer-events:none;animation:dgShimmer 2.6s ease-in-out infinite;}
        @media (prefers-reduced-motion:reduce){
            .twist-container.has-routes,.twist-container.has-routes::after{animation:none;}}
        `;
        document.head.appendChild(s);
    }

    function refresh() {
        document.querySelectorAll('.twist-container').forEach(tw => {
            const dz = tw.querySelector('.drop-zone');
            const live = !!(dz && dz.querySelector(':scope > *'));
            tw.classList.toggle('has-routes', live);
        });
    }

    let pending = false;
    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; refresh(); });
    }

    function init() {
        injectStyles();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        schedule();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
