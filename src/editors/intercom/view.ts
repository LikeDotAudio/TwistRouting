// src/editors/intercom/view — faithful port of renderIntercom() driven from the
// typed EditorContext (no DOM scraping). Builds the key panel, talk/listen
// buttons, talk-group builder, the random "incoming" listen flicker, and the
// IFB / beltpacks / matrix sub-cards.

import type { EditorContext } from '../types.js';
import { el } from '../../ui/dom.js';
import { injectIntercomStyles } from './styles.js';
import { createIntercomState, DEFAULT_KEYS, type TalkGroup } from './state.js';

function resolveKeys(ctx: EditorContext): string[] {
  // Legacy gatherSources(twist) → ctx.sources; then config.inputs; then defaults.
  const fromSources = ctx.sources.map((s) => s.label);
  if (fromSources.length) return fromSources;
  const inputs = ctx.twist.config?.inputs;
  if (inputs && inputs.length) return [...inputs];
  return [...DEFAULT_KEYS];
}

export function renderIntercom(host: HTMLElement, ctx: EditorContext): void {
  injectIntercomStyles();
  // Legacy overlay chrome supplied --ed-color from the production; mirror it so
  // the tool buttons pick up the production colour.
  host.style.setProperty('--ed-color', ctx.production.color);

  const state = createIntercomState(resolveKeys(ctx));
  const { keys } = state;

  // ---- toolbar ----
  const newBtn = el('button', { class: 'ic-tool-btn', dataset: { new: '' } }, ['＋ NEW TALK GROUP']);
  const cancelBtn = el('button', { class: 'ic-tool-btn ghost', dataset: { cancel: '' }, style: 'display:none' }, ['CANCEL']);
  const hint = el('span', { class: 'ic-hint' });
  const toolbar = el('div', { class: 'ic-toolbar' }, [newBtn, cancelBtn, hint]);
  host.appendChild(toolbar);

  const groupsWrap = el('div', { class: 'ic-groups' });
  host.appendChild(groupsWrap);

  const grid = el('div', { class: 'ic-grid' });
  host.appendChild(grid);

  // ---- key panels ----
  const keyEls: HTMLElement[] = [];
  const talkBtns: HTMLButtonElement[] = [];
  keys.forEach((label, i) => {
    const name = el('div', { class: 'ic-name' }, [label]);
    const talkBtn = el('button', { class: 'talk' }, ['TALK']);
    const listenBtn = el('button', { class: 'listen' }, ['LISTEN']);
    const tl = el('div', { class: 'ic-tl' }, [talkBtn, listenBtn]);
    const vol = el('input', {
      class: 'ic-vol',
      type: 'range',
      min: '0',
      max: '100',
      value: String(60 + ((i * 7) % 35)),
    });
    const k = el('div', { class: 'ic-key' + (i === 4 ? ' live' : '') }, [name, tl, vol]); // CAM 1 on-air (tally)

    const latch = (): void => {
      k.classList.toggle('talk');
      talkBtn.classList.toggle('on', k.classList.contains('talk'));
    };
    name.addEventListener('click', latch);
    talkBtn.addEventListener('click', latch);
    listenBtn.addEventListener('click', () => {
      k.classList.toggle('listen');
      listenBtn.classList.toggle('on', k.classList.contains('listen'));
    });
    // In group-build mode, a click anywhere on the panel toggles membership
    // (capture phase so it pre-empts the talk/listen handlers above).
    k.addEventListener(
      'click',
      (e) => {
        if (!state.selecting) return;
        e.preventDefault();
        e.stopPropagation();
        if (state.picked.has(i)) state.picked.delete(i);
        else state.picked.add(i);
        k.classList.toggle('picked', state.picked.has(i));
        updateHint();
      },
      true,
    );

    keyEls.push(k);
    talkBtns.push(talkBtn);
    grid.appendChild(k);
  });

  // ---- group-build flow ----
  function updateHint(): void {
    hint.textContent = state.selecting ? `SELECT PANELS TO GANG — ${state.picked.size} picked` : '';
  }
  function exitSelect(): void {
    state.selecting = false;
    grid.classList.remove('selecting');
    keyEls.forEach((k) => k.classList.remove('picked'));
    state.picked.clear();
    newBtn.textContent = '＋ NEW TALK GROUP';
    cancelBtn.style.display = 'none';
    updateHint();
  }
  newBtn.addEventListener('click', () => {
    if (!state.selecting) {
      state.selecting = true;
      grid.classList.add('selecting');
      newBtn.textContent = '✓ CREATE GROUP';
      cancelBtn.style.display = '';
      updateHint();
    } else {
      if (state.picked.size) {
        state.groups.push({ name: 'TALK GROUP ' + (state.groups.length + 1), members: [...state.picked], on: false });
        drawGroups();
      }
      exitSelect();
    }
  });
  cancelBtn.addEventListener('click', exitSelect);

  function setGroupOn(g: TalkGroup, on: boolean): void {
    g.on = on;
    g.members.forEach((idx) => {
      const k = keyEls[idx];
      const btn = talkBtns[idx];
      if (!k || !btn) return;
      k.classList.toggle('talk', on);
      btn.classList.toggle('on', on);
    });
  }
  function drawGroups(): void {
    groupsWrap.innerHTML = '';
    state.groups.forEach((g, gi) => {
      const big = el('button', { class: 'ic-group-talk' });
      big.innerHTML = `${g.name}<small>TALK TO ALL · ${g.members.length}</small>`;
      const mem = el('div', { class: 'ic-group-members' });
      g.members.forEach((idx) => {
        mem.appendChild(el('span', { class: 'ic-chip' }, [keys[idx] ?? '']));
      });
      const x = el('div', { class: 'ic-group-x', title: 'Remove group' }, ['✕']);
      const row = el('div', { class: 'ic-group' + (g.on ? ' on' : '') }, [big, mem, x]);
      big.addEventListener('click', () => {
        setGroupOn(g, !g.on);
        row.classList.toggle('on', g.on);
      });
      x.addEventListener('click', () => {
        if (g.on) setGroupOn(g, false);
        state.groups.splice(gi, 1);
        drawGroups();
      });
      groupsWrap.appendChild(row);
    });
  }

  // Random "incoming" listen flicker so the panel feels live.
  ctx.dispose.interval(() => {
    if (!keyEls.length) return;
    keyEls.forEach((k) => k.classList.remove('listen'));
    const pick = keyEls[Math.floor(Math.random() * keyEls.length)];
    if (pick && Math.random() > 0.3) pick.classList.add('listen');
  }, 1400);

  // ---- sub-cards: IFB / beltpacks / matrix ----
  const sub = el('div', { class: 'ic-sub' });
  sub.innerHTML = `
            <div class="ic-card"><p class="ed-h">IFB — INTERRUPTIBLE FOLDBACK</p>
                <div class="ic-row"><span>TALENT 1 EARPIECE</span><span class="ic-pill on">PROGRAM</span></div>
                <div class="ic-row"><span>TALENT 2 EARPIECE</span><span class="ic-pill">PROGRAM</span></div>
                <div class="ic-row"><span>STAGE MANAGER</span><span class="ic-pill">PROGRAM</span></div></div>
            <div class="ic-card"><p class="ed-h">BELTPACKS</p>
                <div class="ic-row"><span>CAM 1 · PARTY-LINE A</span><span class="ic-pill on">ONLINE</span></div>
                <div class="ic-row"><span>CAM 2 · PARTY-LINE A</span><span class="ic-pill on">ONLINE</span></div>
                <div class="ic-row"><span>FLOOR · PARTY-LINE B</span><span class="ic-pill on">ONLINE</span></div></div>
            <div class="ic-card"><p class="ed-h">MATRIX</p>
                <div class="ic-row"><span>TALLY-LINKED DUCKING</span><span class="ic-pill on">ENABLED</span></div>
                <div class="ic-row"><span>PRIVATE LINE — DIR↔FLOOR</span><span class="ic-pill on">OPEN</span></div>
                <div class="ic-row"><span>ROUTER</span><span class="ic-pill on">ONLINE</span></div></div>`;
  sub.querySelectorAll<HTMLElement>('.ic-pill').forEach((p) => p.addEventListener('click', () => p.classList.toggle('on')));
  host.appendChild(sub);
}
