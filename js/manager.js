// Manager screen: the whole floor at a glance, slips to check, today's takings.
import * as L from './logic.js';
import { TABLES } from './data.js';
import { ACT, money, since, open, icon } from './ui.js';
import { payCard, slipsToCheck, ST_ICON } from './server.js';

// how long a status may last before its timer turns amber / red, in seconds
const LIMIT = { call: [60, 120], pay: [180, 300], new: [120, 300], ready: [180, 360], waiting: [900, 1200], seated: [3600, 5400] };

export function managerView(s) {
  const floor = TABLES.map((n) => ({ n, ...L.tableState(s, n) }));
  const count = (k) => floor.filter((f) => f.state === k).length;
  const closed = Object.values(s.tabs).filter((t) => t.status === 'closed');
  const open = floor.filter((f) => f.t);
  const slips = slipsToCheck(s);
  const takings = closed.reduce((a, t) => a + t.total, 0);
  const kpi = (ic, label, val, sub) => `<div class="kpi">${icon(ic)}<small>${label}</small><b>${val}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  return `<div class="pad">
    <div class="mgr-top"><div><p class="eyebrow">Floor</p><h1 class="title">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h1></div></div>
    <div class="kpis">
      ${kpi('wallet', 'Takings today', money(takings), `${closed.length} paid tab${closed.length === 1 ? '' : 's'}`)}
      ${kpi('table', 'Tables in use', `${open.length} / ${TABLES.length}`, `${open.reduce((a, f) => a + f.t.guests.length, 0)} guests seated`)}
      ${kpi('receipt', 'Open bills', money(open.reduce((a, f) => a + L.total(s, f.t.id), 0)), 'not yet paid')}
      ${kpi('alert', 'Needs attention', count('call') + count('new') + count('ready') + count('pay'), 'calls, orders, food, payments')}
    </div>
    <div class="legend">${Object.entries(L.STATES).map(([k, n]) => `<span class="lgd st-${k}"><i></i>${n}<b>${count(k)}</b></span>`).join('')}</div>
    <div class="floor">${floor.map((f) => `<button class="tbl st-${f.state}" data-act="table" data-arg="${f.n}" aria-label="Table ${f.n}, ${L.STATES[f.state]}">
      <span class="tbl-h"><b>${f.n}</b>${f.t ? since(f.since, ...LIMIT[f.state]) : ''}</span>
      <span class="status">${icon(ST_ICON[f.state])}${L.STATES[f.state]}</span>
      <span class="tbl-f">${f.t ? `<span>${icon('users')}${f.t.guests.length}</span><span>${money(L.total(s, f.t.id))}</span>` : '<span>No open tab</span>'}</span>
    </button>`).join('')}</div>
    ${slips.length ? `<h2 class="sec">${icon('card')}Slips to verify<span class="count">${slips.length}</span></h2>${slips.map((t) => payCard(s, t)).join('')}` : ''}
  </div>`;
}

ACT.table = (n) => open('table', Number(n));
