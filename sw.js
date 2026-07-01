// sw.js — offline cache for the Twist Routing app.
//
// Goal: after the first successful load, the app runs ENTIRELY from the local
// machine's cache and stops loading from the website. On install we (1) precache
// the static shell (HTML + JS) and (2) crawl the same Sources/ + Destinations/
// index.json manifests the app walks, caching every discovered .json so the
// whole dataset is local. At runtime every same-origin GET is served
// cache-first — the network is only touched on a cache miss.
//
// To ship an update, bump CACHE_VERSION: the new worker re-crawls, then deletes
// the old cache on activate. Clients pick it up on their next reload.

const CACHE_VERSION = 'twist-v109';

// Static app shell (now native ES modules). The static host ignores the ?v=
// query for files on disk; runtime caching backfills anything new.
const SHELL = [
    './',
    './index.htm',
    './lcars.css',
    './js/main.js?v=108',
    './js/util/color.js?v=108',
    './js/util/palette.js?v=108',
    './js/util/dom.js?v=108',
    './js/core/state.js?v=108',
    './js/ui/makeMediaGroup.js?v=108',
    './js/globals.js?v=108',
    './js/poolVideo.js?v=108',
    './js/poolAudio.js?v=108',
    './js/visuals.js?v=108',
    './js/matrix.js?v=108',
    './js/editors/core.js?v=108',
    './js/editors/iso-recorder.js?v=108',
    './js/editors/multi-viewer.js?v=108',
    './js/editors/vision-mixer.js?v=108',
    './js/editors/audio-mixer.js?v=108',
    './js/editors/intercom.js?v=108',
    './js/editors/camera-control.js?v=108',
    './js/editors/camera/styles.js?v=108',
    './js/editors/camera/state.js?v=108',
    './js/editors/camera/bars.js?v=108',
    './js/editors/camera/maps.js?v=108',
    './js/editors/camera/controls.js?v=108',
    './js/editors/shared/video-scopes.js?v=108',
    './js/editors/shared/audio-scope.js?v=108',
    './js/editors/shared/loudness.js?v=108',
    './js/editors/meter-input.js?v=108',
    './js/editors/conditioner-row.js?v=109',
    './js/editors/audio-monitor.js?v=108',
    './js/editors/ifb.js?v=108',
    './js/editors/stagebox-input.js?v=108',
    './js/editors/encoder.js?v=108',
    './js/editors/signaling.js?v=108',
    './js/editors/lighting.js?v=108',
    './js/editors/wysiwyg.js?v=108',
    './js/editors/multi.js?v=108',
    './js/dragDrop.js?v=108',
    './js/touchDrag.js?v=108',
    './js/productions.js?v=108',
    './js/poolPlayout.js?v=108',
    './js/poolStreams.js?v=108',
    './js/sources.js?v=108',
    './js/topbar.js?v=108',
    './js/app.js?v=108',
    './js/auth.js?v=108',
    './js/schedule.js?v=108',
    './js/mission.js?v=108',
    './js/dest-glow.js?v=108',
    './js/clock.js?v=108',
    './js/tutorial.js?v=108',
    './js/router-view.js?v=108',
    './js/captains-log.js?v=108',
    './js/portals.js?v=108',
    './js/lcars-pulse.js?v=108',
    './js/dest-selector.js?v=108',
    './js/dialog.js?v=108',
    './js/util/mono-emoji.js?v=108',
    './js/unroute.js?v=108',
    './js/source-filter.js?v=108',
    './Routes/Sources/index.json',
    './Routes/Destinations/index.json',
];

// Cache a single URL, tolerating individual failures (never reject the batch).
async function cacheOne(cache, url) {
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res && res.ok && res.type === 'basic') await cache.put(url, res.clone());
        return res;
    } catch (e) { return null; }
}

// Recursively walk an index.json tree (same convention as js/globals.js
// listDirectory: entries ending in "/" are folders, others are files) and cache
// every manifest + .json leaf, using the exact URLs the app will request.
async function crawl(dir, cache, seen) {
    if (seen.has(dir)) return;
    seen.add(dir);
    const manifestUrl = dir + 'index.json';
    const res = await cacheOne(cache, manifestUrl);
    if (!res || !res.ok) return;
    let list;
    try { list = await res.clone().json(); } catch (e) { return; }
    if (!Array.isArray(list)) return;
    for (const entry of list) {
        if (typeof entry !== 'string' || !entry) continue;
        const isDir = entry.endsWith('/');
        const name = entry.replace(/\/$/, '');
        const href = encodeURIComponent(name) + (isDir ? '/' : '');
        if (isDir) {
            await crawl(dir + href, cache, seen);
        } else if (name.toLowerCase().endsWith('.json')) {
            await cacheOne(cache, dir + href);
        }
    }
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);
        // Shell first (so a reload works offline ASAP), then the full dataset.
        await Promise.allSettled(SHELL.map(u => cacheOne(cache, u)));
        const seen = new Set();
        await Promise.allSettled([
            crawl('Routes/Sources/', cache, seen),
            crawl('Routes/Destinations/', cache, seen),
        ]);
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;   // only our own assets

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(req);
        if (cached) return cached;                     // cache-first: no network hit
        try {
            const res = await fetch(req);
            if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
            return res;
        } catch (e) {
            // Offline and uncached: fall back to the app shell for navigations.
            if (req.mode === 'navigate') {
                const shell = await cache.match('./index.htm');
                if (shell) return shell;
            }
            return Response.error();
        }
    })());
});

// Allow the page to force an immediate activation after an update.
self.addEventListener('message', (e) => {
    if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
