// src/ui/console/auth-panel — the user-control UI (port of js/auth.js's DOM half):
//   • .au-badge  (top-right)   — current role + LOG OUT + (admin) RIGHTS
//   • .au-focus  (top-centre)  — the role's priority-task banner (4.2s on switch)
//   • login overlay            — pick a role (context-aware scope loads)
//   • rights overlay           — the roles × capabilities matrix, editable live
// Reads/writes role state via platform/auth (setRole/can/onRoleChange). applyScope
// hides [data-cap] controls the current role can't operate (progressive disclosure).
import { addStyles } from '../dom.js';
import type { Capability, Role } from '../../model/index.js';
import { ROLES, role, setRole, can, onRoleChange } from '../../platform/auth.js';

const AUTH_CSS = `
.au-badge{position:fixed;right:34px;top:10px;z-index:1500;display:flex;align-items:center;gap:0;font-family:Arial,Helvetica,sans-serif;border-radius:8px 16px 16px 8px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.5);cursor:default;}
.au-badge .who{display:flex;flex-direction:column;padding:7px 14px 7px 18px;background:var(--rc,#F2B74B);color:#0a1206;}
.au-badge .who b{font-size:12px;font-weight:900;letter-spacing:1px;line-height:1.1;}
.au-badge .who span{font-size:8px;letter-spacing:1px;opacity:.8;text-transform:uppercase;}
.au-badge .out{background:#0c1730;color:#bcd3ee;border:none;padding:0 14px;align-self:stretch;font:900 10px sans-serif;letter-spacing:1px;cursor:pointer;}
.au-badge .out:hover{background:#16243d;color:#fff;}
.au-focus{position:fixed;left:50%;top:0;transform:translate(-50%,-110%);z-index:1600;background:#0a1326;border:1px solid var(--rc,#F2B74B);border-top:none;border-radius:0 0 14px 14px;padding:11px 26px;color:#e0f0ff;font:bold 13px sans-serif;letter-spacing:1px;box-shadow:0 8px 22px rgba(0,0,0,.5);transition:transform .35s cubic-bezier(.2,1.2,.4,1);white-space:nowrap;}
.au-focus.show{transform:translate(-50%,0);}
.au-focus b{color:var(--rc,#F2B74B);}
.au-overlay{position:fixed;inset:0;z-index:3200;display:none;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 30%,rgba(13,23,48,.92),rgba(3,6,15,.96));font-family:Arial,Helvetica,sans-serif;}
.au-overlay.open{display:flex;}
.au-box{width:min(880px,94vw);max-height:90vh;overflow:auto;background:#0a1326;border:1px solid #1d2942;border-radius:16px;padding:26px;}
.au-box h2{margin:0 0 4px;color:#fff;font-size:22px;letter-spacing:2px;}
.au-box p{margin:0 0 20px;color:#7e93b5;font-size:12px;letter-spacing:1px;}
.au-roles{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;}
.au-role{text-align:left;border-radius:12px;border:1px solid #2c3e5e;background:#0c1730;padding:14px;cursor:pointer;transition:.15s;}
.au-role:hover{background:#13233c;transform:translateY(-2px);}
.au-role .tag{display:inline-block;font:900 9px sans-serif;letter-spacing:1px;text-transform:uppercase;color:#0a1206;border-radius:5px;padding:3px 7px;margin-bottom:8px;}
.au-role b{display:block;color:#fff;font-size:15px;letter-spacing:1px;}
.au-role .ti{color:#9fb6cc;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin:2px 0 6px;}
.au-role .ds{color:#aec6e4;font-size:11px;line-height:1.4;}
.au-role.sel{border-color:#F2B74B;box-shadow:0 0 14px rgba(242,183,75,.4);}
.au-badge .rights{background:#13233c;color:#F2B74B;border:none;padding:0 12px;align-self:stretch;font:900 10px sans-serif;letter-spacing:1px;cursor:pointer;display:none;}
.au-badge .rights:hover{background:#1b2f4f;} .au-badge.admin .rights{display:block;}
.au-matrix{display:grid;gap:6px;align-items:center;}
.au-mh{font:bold 9px sans-serif;color:#9fb6cc;letter-spacing:1px;text-transform:uppercase;text-align:center;}
.au-mr{font:bold 13px sans-serif;color:#cfe6ff;padding-right:8px;}
.au-mr small{display:block;color:#7e93b5;font-size:9px;font-weight:normal;letter-spacing:1px;text-transform:uppercase;}
.au-cell{height:32px;border-radius:6px;border:1px solid #2c3e5e;background:#0c1730;cursor:pointer;transition:.1s;}
.au-cell:hover{border-color:#6FC8F0;} .au-cell.on{background:var(--cc,#39d353);border-color:var(--cc,#39d353);}
.au-cell.lock{opacity:.45;cursor:not-allowed;}
.au-rnote{margin-top:14px;color:#6b82a3;font-size:11px;letter-spacing:1px;}`;

const CAPS: Array<[Capability, string]> = [
  ['switch', 'Switch'], ['route', 'Route'], ['signal', 'Signal'], ['shade', 'Shade'], ['audio', 'Audio'],
  ['gfx', 'Graphics'], ['comms', 'Comms'], ['book', 'Booking'], ['view', 'View'], ['admin', 'Admin'],
];

const capLine = (r: Role): string =>
  r.caps.admin ? 'All systems' : (Object.keys(r.caps).map((k) => k.toUpperCase()).join(' · ') || 'View only');

/** Hide [data-cap="X"] elements when the current role lacks capability X. */
export function applyScope(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-cap]').forEach((el) => {
    const cap = el.dataset.cap as Capability | undefined;
    el.style.display = cap && can(cap) ? '' : (cap ? 'none' : '');
  });
}

export function initAuthPanel(): void {
  if (document.querySelector('.au-badge')) return;
  addStyles('auth-styles', AUTH_CSS);

  const badge = document.createElement('div');
  badge.className = 'au-badge';
  badge.innerHTML = `<div class="who"><b></b><span></span></div><button class="rights" title="Edit user rights">⚙ RIGHTS</button><button class="out">LOG OUT</button>`;
  document.body.appendChild(badge);

  const focus = document.createElement('div');
  focus.className = 'au-focus';
  document.body.appendChild(focus);

  // login overlay (role picker)
  const login = document.createElement('div');
  login.className = 'au-overlay';
  login.innerHTML = `<div class="au-box"><h2>SINGLE PANE OF GLASS</h2><p>SELECT ROLE · context-aware scope loads for the live production</p><div class="au-roles"></div></div>`;
  const rolesHost = login.querySelector<HTMLElement>('.au-roles')!;
  const roleCards: HTMLElement[] = [];
  ROLES.forEach((r) => {
    const card = document.createElement('button');
    card.className = 'au-role';
    card.innerHTML = `<span class="tag" style="background:${r.color}">${r.tier}</span><b>${r.name}</b><div class="ti">${r.sub || ''} · ${capLine(r)}</div><div class="ds">${r.task}</div>`;
    card.addEventListener('click', () => { setRole(r); login.classList.remove('open'); });
    rolesHost.appendChild(card);
    roleCards.push(card);
  });
  login.addEventListener('click', (e) => { if (e.target === login) login.classList.remove('open'); });
  document.body.appendChild(login);

  // rights overlay (roles × capabilities matrix)
  const rights = document.createElement('div');
  rights.className = 'au-overlay';
  rights.innerHTML = `<div class="au-box"><h2>EDIT USER RIGHTS</h2><p>CAPTAIN · ADMINISTRATIVE — toggle each role's capabilities</p><div class="au-matrix"></div><div class="au-rnote">Changes apply live to the capability gate — the basis for control-lock & progressive disclosure.</div></div>`;
  rights.addEventListener('click', (e) => { if (e.target === rights) rights.classList.remove('open'); });
  document.body.appendChild(rights);
  const matrix = rights.querySelector<HTMLElement>('.au-matrix')!;
  matrix.style.gridTemplateColumns = `170px repeat(${CAPS.length},1fr)`;
  matrix.innerHTML = '<div></div>';
  CAPS.forEach(([, l]) => { const h = document.createElement('div'); h.className = 'au-mh'; h.textContent = l; matrix.appendChild(h); });
  ROLES.forEach((r) => {
    const nm = document.createElement('div'); nm.className = 'au-mr'; nm.innerHTML = `${r.name}<small>${r.tier}</small>`; matrix.appendChild(nm);
    CAPS.forEach(([k]) => {
      const cell = document.createElement('div');
      cell.className = 'au-cell' + (r.caps[k] ? ' on' : '') + (r.id === 'ep' ? ' lock' : '');
      cell.style.setProperty('--cc', r.color);
      cell.addEventListener('click', () => {
        if (r.id === 'ep') return;                     // Captain stays full admin
        if (r.caps[k]) delete r.caps[k]; else r.caps[k] = 1;
        cell.classList.toggle('on', !!r.caps[k]);
      });
      matrix.appendChild(cell);
    });
  });

  badge.querySelector('.out')?.addEventListener('click', () => login.classList.add('open'));
  badge.querySelector('.rights')?.addEventListener('click', () => rights.classList.add('open'));

  let focusTimer: ReturnType<typeof setTimeout> | undefined;
  onRoleChange((r) => {
    document.documentElement.style.setProperty('--rc', r.color);
    badge.style.setProperty('--rc', r.color);
    focus.style.setProperty('--rc', r.color);
    const whoB = badge.querySelector<HTMLElement>('.who b');
    const whoS = badge.querySelector<HTMLElement>('.who span');
    if (whoB) whoB.textContent = r.name;
    if (whoS) whoS.textContent = r.sub || r.tier;
    badge.classList.toggle('admin', !!r.caps.admin);
    document.body.className = document.body.className.replace(/\brole-\w+\b/g, '').trim() + ' role-' + r.id;
    roleCards.forEach((c, i) => c.classList.toggle('sel', ROLES[i]?.id === r.id));
    focus.innerHTML = `Priority Task · <b>${r.task}</b>`;
    focus.classList.add('show');
    if (focusTimer) clearTimeout(focusTimer);
    focusTimer = setTimeout(() => focus.classList.remove('show'), 4200);
    applyScope();
  });

  setRole(role());   // initialise the badge/focus for the default Captain
}
