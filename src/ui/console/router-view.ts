// src/ui/console/router-view — the "1990s VIEW": an interactive router crosspoint
// grid styled after classic Minesweeper. Port of js/router-view.js.
//
// Rows = SENDERS (source feeds grouped by box → parent); columns = RECEIVERS
// (destination twists grouped by production → parent). A sunken/flagged cell is a
// live route. Click a crosspoint to make/break it (via placeSourceInTwist / drop-
// zone removal); click a group header to fold; hover lights the row+column. URL
// route at #/1990s (?src/&dst/&s/&r).
import { addStyles } from '../dom.js';
import { placeSourceInTwist } from './matrix.js';
import { updateTwistVisuals } from './helix.js';
import { loadAllDestinations } from './footer.js';

const ROUTE = '#/1990s';
const SEP = '␟';

interface RowLeaf { origin: string; parent: string; group?: boolean; label?: string; labels: string[]; node?: HTMLElement | null; nodes?: Array<HTMLElement | null> }
interface ColLeaf { prod: string; parent: string; group?: boolean; twist?: string; twists: string[]; el?: HTMLElement; els?: HTMLElement[] }

const RV_CSS = `
.rv-btn{position:fixed;right:14px;bottom:76px;z-index:1000;background:#3FC1C9;color:#001b1d;border:none;border-radius:18px 6px 6px 18px;font-family:Arial,Helvetica,sans-serif;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:8px 18px 8px 16px;cursor:pointer;box-shadow:inset 5px 0 0 #2a8b91;}
.rv-btn:hover{filter:brightness(1.1);}
.rv-overlay{position:fixed;inset:0;z-index:2500;display:none;flex-direction:column;background:#008080;color:#000;font-family:'MS Sans Serif',Tahoma,Geneva,sans-serif;font-size:12px;}
.rv-overlay.open{display:flex;}
.rv-win{margin:18px;display:flex;flex-direction:column;flex:1;min-height:0;background:#c0c0c0;border:3px solid;border-color:#fff #808080 #808080 #fff;}
.rv-titlebar{background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-weight:bold;letter-spacing:1px;padding:5px 8px;display:flex;align-items:center;gap:12px;}
.rv-titlebar .rv-x{margin-left:auto;background:#c0c0c0;color:#000;border:2px solid;border-color:#fff #808080 #808080 #fff;width:22px;height:20px;line-height:14px;text-align:center;font-weight:bold;cursor:pointer;}
.rv-x:active{border-color:#808080 #fff #fff #808080;}
.rv-bar{display:flex;align-items:center;gap:10px;padding:8px;flex-wrap:wrap;border-bottom:2px solid #808080;}
.rv-bar input{font-family:inherit;font-size:12px;padding:3px 6px;min-width:140px;border:2px solid;border-color:#808080 #fff #fff #808080;background:#fff;}
.rv-tg{font-family:inherit;font-weight:bold;font-size:11px;padding:5px 10px;cursor:pointer;background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;white-space:nowrap;}
.rv-tg.on{border-color:#808080 #fff #fff #808080;background:#9a9a9a;}
.rv-count{font-size:11px;color:#000080;font-weight:bold;}
.rv-help{margin-left:auto;font-size:11px;color:#404040;}
.rv-body{flex:1;overflow:auto;padding:10px;background:#c0c0c0;}
.rv-msg{padding:40px;text-align:center;color:#404040;}
table.rv-grid{border-collapse:separate;border-spacing:0;}
.rv-grid th,.rv-grid td{padding:0;text-align:center;white-space:nowrap;}
.rv-prodhead,.rv-twisthead,.rv-originhead,.rv-feedhead,.rv-corner{background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;font-weight:bold;padding:3px 8px;}
.rv-prodhead,.rv-originhead{cursor:pointer;color:#000080;letter-spacing:1px;position:sticky;}
.rv-prodhead:active,.rv-originhead:active{border-color:#808080 #fff #fff #808080;}
.rv-twisthead{font-weight:normal;color:#000;writing-mode:vertical-rl;transform:rotate(180deg);vertical-align:bottom;height:120px;padding:8px 3px;}
.rv-twisthead.grp{font-style:italic;color:#000080;}
.rv-feedhead.grp{font-style:italic;color:#000080;}
.rv-pparenthead{writing-mode:vertical-rl;transform:rotate(180deg);vertical-align:bottom;height:110px;background:#000080;color:#fff;font-weight:bold;letter-spacing:1px;position:sticky;top:0;z-index:5;border:2px solid;border-color:#1084d0 #000040 #000040 #1084d0;}
.rv-rparenthead{writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;background:#000080;color:#fff;font-weight:bold;letter-spacing:1px;padding:6px 3px;position:sticky;left:0;z-index:2;border:2px solid;border-color:#1084d0 #000040 #000040 #1084d0;}
.rv-dot{font-weight:bold;margin-right:2px;font-size:11px;}
.rv-dot.v{color:#b388ff;} .rv-dot.a{color:#FF9C63;} .rv-dot.s{color:#39d353;}
.rv-grid thead th{position:sticky;top:0;z-index:3;}
.rv-corner{position:sticky;left:0;top:0;z-index:4;}
.rv-originhead{left:0;z-index:2;text-align:left;}
.rv-feedhead{position:sticky;left:0;z-index:2;text-align:left;font-weight:normal;}
.rv-row-off .rv-feedhead{color:#606060;}
.rv-cell{width:24px;height:22px;background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;cursor:pointer;font-weight:bold;color:#000080;}
.rv-cell.grp{cursor:default;}
.rv-cell.on{border-color:#808080 #fff #fff #808080;background:#bdbdbd;color:#c00000;}
.rv-cell.on::after{content:'\\2737';}
.rv-cell.grp.on::after{content:'\\25A0';color:#000080;}
.rv-cell.bad{background:#ff8080;}
.rv-hl{background:#ffff80 !important;}
.rv-cell.on.rv-hl{background:#ffd0d0 !important;}`;

export function initRouterView(): void {
  let overlay: HTMLElement | null = null;
  let fs: HTMLInputElement, fr: HTMLInputElement, body: HTMLElement;
  let tgSrc: HTMLElement, tgDst: HTMLElement;
  let showAllSrc = false, showAllDst = false, prevHash: string | null = null, syncing = false;
  const collapsedProds = new Set<string>(), collapsedOrigins = new Set<string>();
  let rowLeaves: RowLeaf[] = [], colLeaves: ColLeaf[] = [], crossSet = new Set<string>(), hlNodes: HTMLElement[] = [];

  const firstLine = (n: Element): string => ((n as HTMLElement).innerText || '').trim().split('\n')[0] ?? '';

  function gatherSenderNodes(): Map<string, Map<string, HTMLElement | null>> {
    const m = new Map<string, Map<string, HTMLElement | null>>();
    const push = (origin: string, label: string, node: HTMLElement | null): void => {
      if (!label) return;
      if (!m.has(origin)) m.set(origin, new Map());
      const inner = m.get(origin)!;
      if (!inner.has(label)) inner.set(label, node);
    };
    document.querySelectorAll<HTMLElement>('.ingress-panel .signal-node').forEach((n) => {
      if (n.classList.contains('multiplex')) {
        const head = n.querySelector<HTMLElement>('.multiplex-header');
        const bo = n.dataset.origin || (head ? head.innerText.trim() : '');
        n.querySelectorAll<HTMLElement>('.multiplex-children .signal-node').forEach((sub) =>
          push(sub.dataset.origin || bo, firstLine(sub), sub));
      } else if (!n.classList.contains('sub-stream') && !n.classList.contains('dropped-group')) {
        const label = firstLine(n);
        push(n.dataset.origin || label, label, n);
      }
    });
    return m;
  }

  function typeDot(node: HTMLElement | null | undefined, label: string): string {
    let cls = '';
    if (node && node.classList) {
      if (node.classList.contains('video')) cls = 'v';
      else if (node.classList.contains('control')) cls = 's';
      else if (node.classList.contains('audio')) cls = 'a';
    }
    if (!cls) cls = /tally|on.?air|\bpgm\b|\bpvw\b|signal|control|gpi/i.test(label) ? 's'
      : /\bcam\b|v\d|video|-v\b/i.test(label) ? 'v' : 'a';
    const g = cls === 'v' ? '■' : cls === 's' ? '⬢' : '♪';
    return `<span class="rv-dot ${cls}">${g}</span>`;
  }

  const prodOf = (tw: HTMLElement): string => {
    const row = tw.closest('.program-row');
    return tw.dataset.prodName || (row?.querySelector<HTMLElement>('.program-title')?.innerText.trim() ?? 'UNKNOWN');
  };
  const twistNameOf = (tw: HTMLElement): string => tw.querySelector<HTMLElement>('.twist-title')?.innerText.trim() ?? 'TWIST';

  function gatherReceivers(): Map<string, Map<string, HTMLElement>> {
    const m = new Map<string, Map<string, HTMLElement>>();
    document.querySelectorAll<HTMLElement>('.twist-container').forEach((tw) => {
      const prod = prodOf(tw), tname = twistNameOf(tw);
      if (!m.has(prod)) m.set(prod, new Map());
      m.get(prod)!.set(tname, tw);
    });
    return m;
  }

  function gatherLinks(): { cross: Set<string>; cS: Set<string>; cR: Set<string> } {
    const cross = new Set<string>(), cS = new Set<string>(), cR = new Set<string>();
    document.querySelectorAll<HTMLElement>('.twist-container').forEach((tw) => {
      const dz = tw.querySelector<HTMLElement>('.drop-zone'); if (!dz) return;
      const prod = prodOf(tw), tname = twistNameOf(tw);
      dz.querySelectorAll<HTMLElement>(':scope > .signal-node').forEach((node) => {
        const feeds = node.classList.contains('dropped-group')
          ? [...node.querySelectorAll<HTMLElement>('.dropped-group-children .signal-node')] : [node];
        feeds.forEach((f) => {
          const label = firstLine(f); if (!label) return;
          const origin = f.dataset.origin || node.dataset.origin || label;
          cross.add([origin, label, prod, tname].join(SEP));
          cS.add(origin + SEP + label); cR.add(prod + SEP + tname);
        });
      });
    });
    return { cross, cS, cR };
  }

  async function loadAllSources(): Promise<void> {
    for (let p = 0; p < 4; p++) {
      let clicked = 0;
      document.querySelectorAll<HTMLElement>('.media-group-header').forEach((h) => {
        const c = h.nextElementSibling;
        if (c && !c.querySelector('.signal-node')) { h.click(); clicked++; }
      });
      if (!clicked) break;
      await new Promise((r) => setTimeout(r, 220));
    }
  }
  async function loadAllDest(): Promise<void> {
    loadAllDestinations();
    await new Promise((r) => setTimeout(r, 600));
  }

  const splitParent = (s: string): [string, string] => {
    const i = s.lastIndexOf(' — ');
    return i >= 0 ? [s.slice(0, i), s.slice(i + 3)] : ['', s];
  };

  function buildGrid(): void {
    const sf = fs.value.trim().toLowerCase(), rf = fr.value.trim().toLowerCase();
    const sMatch = (o: string, l: string): boolean => !sf || o.toLowerCase().includes(sf) || l.toLowerCase().includes(sf);
    const rMatch = (p: string, t: string): boolean => !rf || p.toLowerCase().includes(rf) || t.toLowerCase().includes(rf);

    const senderMap = gatherSenderNodes();
    const recvMap = gatherReceivers();
    const { cross, cS, cR } = gatherLinks();
    crossSet = cross;

    cS.forEach((k) => {
      const [o, l] = k.split(SEP) as [string, string];
      if (!senderMap.has(o)) senderMap.set(o, new Map());
      if (!senderMap.get(o)!.has(l)) senderMap.get(o)!.set(l, null);
    });

    colLeaves = [];
    const colGroups: Array<{ prod: string; parent: string; prodLeaf: string; span: number }> = [];
    recvMap.forEach((twists, prod) => {
      const keep = [...twists].filter(([t]) => (showAllDst || cR.has(prod + SEP + t)) && rMatch(prod, t));
      if (!keep.length) return;
      const [parent, prodLeaf] = splitParent(prod);
      if (collapsedProds.has(prod)) {
        colLeaves.push({ prod, parent, group: true, twists: keep.map(([t]) => t), els: keep.map(([, e]) => e) });
        colGroups.push({ prod, parent, prodLeaf, span: 1 });
      } else {
        keep.forEach(([t, e]) => colLeaves.push({ prod, parent, twist: t, twists: [t], el: e }));
        colGroups.push({ prod, parent, prodLeaf, span: keep.length });
      }
    });
    const colParents: Array<{ parent: string; span: number }> = [];
    colGroups.forEach((g) => { const par = g.parent || 'PRODUCTIONS'; const last = colParents[colParents.length - 1]; if (last && last.parent === par) last.span += g.span; else colParents.push({ parent: par, span: g.span }); });

    rowLeaves = [];
    const rowGroups: Array<{ origin: string; parent: string; boxLeaf: string; start: number; end: number; connected: boolean }> = [];
    senderMap.forEach((labels, origin) => {
      const keep = [...labels].filter(([l]) => (showAllSrc || cS.has(origin + SEP + l)) && sMatch(origin, l));
      if (!keep.length) return;
      const [parent, boxLeaf] = splitParent(origin);
      const idxStart = rowLeaves.length;
      if (collapsedOrigins.has(origin)) {
        rowLeaves.push({ origin, parent, group: true, labels: keep.map(([l]) => l), nodes: keep.map(([, n]) => n) });
      } else {
        keep.forEach(([l, n]) => rowLeaves.push({ origin, parent, label: l, labels: [l], node: n }));
      }
      rowGroups.push({ origin, parent, boxLeaf, start: idxStart, end: rowLeaves.length, connected: keep.some(([l]) => cS.has(origin + SEP + l)) });
    });
    const rowParents: Array<{ parent: string; start: number; end: number }> = [];
    rowGroups.forEach((g) => { const par = g.parent || 'SOURCES'; const last = rowParents[rowParents.length - 1]; if (last && last.parent === par) last.end = g.end; else rowParents.push({ parent: par, start: g.start, end: g.end }); });

    const litAt = (ri: number, ci: number): boolean => {
      const r = rowLeaves[ri], c = colLeaves[ci];
      if (!r || !c) return false;
      for (const l of (r.group ? r.labels : [r.label ?? ''])) for (const t of c.twists)
        if (crossSet.has([r.origin, l, c.prod, t].join(SEP))) return true;
      return false;
    };

    body.innerHTML = '';
    if (!rowLeaves.length || !colLeaves.length) {
      body.innerHTML = `<div class="rv-msg">${(!rowLeaves.length && !colLeaves.length)
        ? 'NOTHING TO SHOW — enable ALL SOURCES / ALL DESTINATIONS, or make some routes.'
        : !rowLeaves.length ? 'NO SENDERS — enable “ALL SOURCES”.' : 'NO RECEIVERS — enable “ALL DESTINATIONS”.'}</div>`;
      return;
    }

    const tbl = document.createElement('table');
    tbl.className = 'rv-grid';
    let h1 = `<tr><th class="rv-corner" rowspan="3" colspan="3">SRC \\ DST</th>`;
    colParents.forEach((g) => { h1 += `<th class="rv-pparenthead" colspan="${g.span}">${g.parent}</th>`; });
    h1 += '</tr><tr>';
    colGroups.forEach((g) => { h1 += `<th class="rv-prodhead" colspan="${g.span}" data-prod="${encodeURIComponent(g.prod)}">${collapsedProds.has(g.prod) ? '▸' : '▾'} ${g.prodLeaf}</th>`; });
    h1 += '</tr><tr>';
    colLeaves.forEach((c) => { h1 += c.group ? `<th class="rv-twisthead grp">ALL ${c.twists.length}</th>` : `<th class="rv-twisthead">${c.twist}</th>`; });
    h1 += '</tr>';
    const thead = document.createElement('thead'); thead.innerHTML = h1; tbl.appendChild(thead);

    let html = '';
    rowParents.forEach((pg) => {
      for (let ri = pg.start; ri < pg.end; ri++) {
        const g = rowGroups.find((x) => ri >= x.start && ri < x.end);
        const r = rowLeaves[ri];
        if (!g || !r) continue;
        const off = !r.group && !cS.has(g.origin + SEP + r.label);
        html += `<tr class="${off ? 'rv-row-off' : ''}">`;
        if (ri === pg.start) html += `<td class="rv-rparenthead" rowspan="${pg.end - pg.start}">${pg.parent}</td>`;
        if (ri === g.start) html += `<td class="rv-originhead" rowspan="${g.end - g.start}" data-origin="${encodeURIComponent(g.origin)}">${collapsedOrigins.has(g.origin) ? '▸' : '▾'} ${g.boxLeaf}</td>`;
        html += r.group ? `<td class="rv-feedhead grp">ALL ${r.labels.length} FEEDS</td>` : `<td class="rv-feedhead">${typeDot(r.node, r.label ?? '')} ${r.label}</td>`;
        colLeaves.forEach((c, ci) => {
          const lit = litAt(ri, ci), grp = r.group || c.group;
          html += `<td class="rv-cell${lit ? ' on' : ''}${grp ? ' grp' : ''}" data-r="${ri}" data-c="${ci}"></td>`;
        });
        html += '</tr>';
      }
    });
    const tbody = document.createElement('tbody'); tbody.innerHTML = html; tbl.appendChild(tbody);
    body.appendChild(tbl);

    const countEl = overlay?.querySelector<HTMLElement>('.rv-count');
    if (countEl) countEl.textContent = `${crossSet.size} ROUTES · ${rowLeaves.length}×${colLeaves.length}`;
  }

  function findDropped(twistEl: HTMLElement, origin: string, label: string): HTMLElement | null {
    const dz = twistEl.querySelector<HTMLElement>('.drop-zone'); if (!dz) return null;
    return [...dz.querySelectorAll<HTMLElement>('.signal-node')].find((n) => {
      if (n.classList.contains('dropped-group')) return false;
      if (firstLine(n) !== label) return false;
      const orig = n.dataset.origin || firstLine(n);
      return orig === origin || !origin;
    }) ?? null;
  }
  function makeRoute(s: RowLeaf, r: ColLeaf): boolean {
    if (!s.node || !r.el) return false;
    return placeSourceInTwist(r.el, s.node);
  }
  function breakRoute(s: RowLeaf, r: ColLeaf): boolean {
    if (!r.el) return false;
    const node = findDropped(r.el, s.origin, s.label ?? '');
    if (!node) return false;
    const kids = node.closest('.dropped-group-children');
    node.remove();
    if (kids && !kids.querySelector('.signal-node')) { const grp = kids.closest('.dropped-group'); if (grp) grp.remove(); }
    return true;
  }

  function onBodyClick(e: Event): void {
    const target = e.target as HTMLElement;
    const ph = target.closest<HTMLElement>('.rv-prodhead');
    if (ph?.dataset.prod) { const p = decodeURIComponent(ph.dataset.prod); collapsedProds.has(p) ? collapsedProds.delete(p) : collapsedProds.add(p); buildGrid(); return; }
    const oh = target.closest<HTMLElement>('.rv-originhead');
    if (oh?.dataset.origin) { const o = decodeURIComponent(oh.dataset.origin); collapsedOrigins.has(o) ? collapsedOrigins.delete(o) : collapsedOrigins.add(o); buildGrid(); return; }
    const cell = target.closest<HTMLElement>('.rv-cell');
    if (!cell || cell.classList.contains('grp')) return;
    const s = rowLeaves[Number(cell.dataset.r)], r = colLeaves[Number(cell.dataset.c)];
    if (!s || !r) return;
    let ok: boolean;
    if (cell.classList.contains('on')) ok = breakRoute(s, r);
    else { ok = makeRoute(s, r); if (!ok) { cell.classList.add('bad'); setTimeout(() => cell.classList.remove('bad'), 250); } }
    if (ok) { if (r.el) updateTwistVisuals(r.el); buildGrid(); }
  }

  function clearHl(): void { hlNodes.forEach((n) => n.classList.remove('rv-hl')); hlNodes = []; }
  function onBodyOver(e: Event): void {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.rv-cell');
    if (!cell) { clearHl(); return; }
    const r = cell.dataset.r, c = cell.dataset.c;
    clearHl();
    body.querySelectorAll<HTMLElement>(`.rv-cell[data-r="${r}"], .rv-cell[data-c="${c}"]`).forEach((n) => { n.classList.add('rv-hl'); hlNodes.push(n); });
  }

  function buildHash(): string {
    const p: string[] = [];
    if (showAllSrc) p.push('src=1'); if (showAllDst) p.push('dst=1');
    if (fs.value.trim()) p.push('s=' + encodeURIComponent(fs.value.trim()));
    if (fr.value.trim()) p.push('r=' + encodeURIComponent(fr.value.trim()));
    return ROUTE + (p.length ? '?' + p.join('&') : '');
  }
  function parseHash(): { src: boolean; dst: boolean; s: string; r: string } | null {
    const h = location.hash || '';
    if (h !== ROUTE && h.indexOf(ROUTE + '?') !== 0) return null;
    const q = new URLSearchParams(h.indexOf('?') >= 0 ? h.slice(h.indexOf('?') + 1) : '');
    return { src: q.get('src') === '1', dst: q.get('dst') === '1', s: q.get('s') || '', r: q.get('r') || '' };
  }
  function writeHash(): void { syncing = true; history.replaceState(null, '', buildHash()); syncing = false; }

  async function applyToggles(src: boolean, dst: boolean): Promise<void> {
    showAllSrc = src; showAllDst = dst;
    tgSrc.classList.toggle('on', src); tgSrc.textContent = src ? '✓ ALL SOURCES' : 'ALL SOURCES';
    tgDst.classList.toggle('on', dst); tgDst.textContent = dst ? '✓ ALL DESTINATIONS' : 'ALL DESTINATIONS';
    if (src) await loadAllSources();
    if (dst) await loadAllDest();
    collapsedOrigins.clear();
    if (src) [...gatherSenderNodes().keys()].forEach((o) => collapsedOrigins.add(o));
    collapsedProds.clear();
    if (dst) [...gatherReceivers().keys()].forEach((p) => collapsedProds.add(p));
  }

  function build(): HTMLElement {
    addStyles('router-view-styles', RV_CSS);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rv-overlay';
    overlay.innerHTML = `
      <div class="rv-win">
        <div class="rv-titlebar">▣ 1990s VIEW — Router.exe<span class="rv-x" title="Close">×</span></div>
        <div class="rv-bar">
          <input data-fsender placeholder="find sender…">
          <input data-freceiver placeholder="find receiver…">
          <button class="rv-tg" data-tgsrc>ALL SOURCES</button>
          <button class="rv-tg" data-tgdst>ALL DESTINATIONS</button>
          <span class="rv-count"></span>
          <span class="rv-help">click a crosspoint to make/break a route · click a group header to fold</span>
        </div>
        <div class="rv-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    fs = overlay.querySelector<HTMLInputElement>('[data-fsender]')!;
    fr = overlay.querySelector<HTMLInputElement>('[data-freceiver]')!;
    body = overlay.querySelector<HTMLElement>('.rv-body')!;
    tgSrc = overlay.querySelector<HTMLElement>('[data-tgsrc]')!;
    tgDst = overlay.querySelector<HTMLElement>('[data-tgdst]')!;
    const onFilter = (): void => { buildGrid(); writeHash(); };
    fs.addEventListener('input', onFilter);
    fr.addEventListener('input', onFilter);
    tgSrc.addEventListener('click', () => { void (async () => { await applyToggles(!showAllSrc, showAllDst); buildGrid(); writeHash(); })(); });
    tgDst.addEventListener('click', () => { void (async () => { await applyToggles(showAllSrc, !showAllDst); buildGrid(); writeHash(); })(); });
    body.addEventListener('click', onBodyClick);
    body.addEventListener('mouseover', onBodyOver);
    body.addEventListener('mouseleave', clearHl);
    overlay.querySelector('.rv-x')?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay?.classList.contains('open')) close(); });
    return overlay;
  }

  function open(): void {
    if (!(location.hash === ROUTE || location.hash.indexOf(ROUTE + '?') === 0)) {
      prevHash = location.hash; location.hash = ROUTE;
    } else void show(parseHash());
  }
  function close(): void {
    const ov = build(); ov.classList.remove('open');
    syncing = true; history.replaceState(null, '', prevHash || (location.pathname + location.search)); syncing = false;
    prevHash = null;
  }
  async function show(state: { src: boolean; dst: boolean; s: string; r: string } | null): Promise<void> {
    const ov = build();
    if (state) { fs.value = state.s; fr.value = state.r; await applyToggles(state.src, state.dst); }
    buildGrid();
    ov.classList.add('open');
  }
  function onHashChange(): void {
    if (syncing) return;
    const st = parseHash();
    if (st) void show(st);
    else overlay?.classList.remove('open');
  }

  // mount the launcher button + hash listener
  addStyles('router-view-styles', RV_CSS);
  if (!document.querySelector('.rv-btn')) {
    const btn = document.createElement('button');
    btn.className = 'rv-btn'; btn.textContent = '1990s VIEW';
    btn.title = 'Router crosspoint matrix (opens #/1990s)';
    btn.addEventListener('click', open);
    document.body.appendChild(btn);
  }
  window.addEventListener('hashchange', onHashChange);
  if (parseHash()) { build(); void show(parseHash()); }
}
