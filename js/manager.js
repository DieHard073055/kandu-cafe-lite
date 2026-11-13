// Manager screen: the whole floor at a glance, slips to check, today's takings.
import * as L from './logic.js';
import { TABLES } from './data.js';
import { ACT, money, since, open } from './ui.js';
import { payCard, slipsToCheck } from './server.js';

const ICON = { call: '🛎️', pay: '💳', new: '🆕', ready: '🍽️', waiting: '⏳', seated: '🙂', free: '' };
// how long a status may last before the tile turns amber / red, in seconds
const LIMIT = { call: [60, 120], pay: [180, 300], new: [120, 300], ready: [180, 360], waiting: [900, 1200], seated: [3600, 5400] };

export function managerView(s) {
  const floor = TABLES.map((n) => ({ n, ...L.tableState(s, n) }));
  const count = (k) => floor.filter((f) => f.state === k).length;
  const closed = Object.values(s.tabs).filter((t) => t.status === 'closed');
  const slips = slipsToCheck(s);
  return `<div class="pad">
    <div class="kpis"><div><small>Takings today</small><b>${money(closed.reduce((a, t) => a + t.total, 0))}</b></div>
      <div><small>Open tabs</small><b>${floor.filter((f) => f.t).length} / ${TABLES.length}</b></div>
      <div><small>Paid tabs</small><b>${closed.length}</b></div></div>
    <div class="legend">${Object.entries(L.STATES).map(([k, n]) => `<span class="lg st-${k}"><i></i>${n} <b>${count(k)}</b></span>`).join('')}</div>
    <div class="floor">${floor.map((f) => `<button class="tbl st-${f.state}" data-act="table" data-arg="${f.n}">
      <span class="between"><b>${f.n}</b><span>${ICON[f.state]}</span></span>
      <small class="st">${L.STATES[f.state]}</small>
      ${f.t ? `${since(f.since, ...LIMIT[f.state])}<small>${f.t.guests.length} guest${f.t.guests.length > 1 ? 's' : ''} · ${money(L.total(s, f.t.id))}</small>` : ''}
    </button>`).join('')}</div>
    ${slips.length ? `<h2 class="sec">Slips to check <span>${slips.length}</span></h2>${slips.map((t) => payCard(s, t)).join('')}` : ''}
  </div>`;
}

ACT.table = (n) => open('table', Number(n));
