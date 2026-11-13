// Kitchen screen: a board of every accepted item, new -> cooking -> ready, plus the availability switches.
import { S } from './store.js';
import * as L from './logic.js';
import { DISHES, DISH } from './data.js';
import { ACT, esc, since, toast, icon, clock } from './ui.js';

const COLS = [['new', 'New', 'receipt', 'Start'], ['cooking', 'Cooking', 'flame', 'Ready'], ['ready', 'Ready for pickup', 'dish', null]];

export const kitchenItems = (s) => s.orders.filter((o) => o.status === 'accepted')
  .flatMap((o) => o.items.map((i, idx) => ({ o, i, idx }))).filter((x) => x.i.k !== 'served');

export function kitchenView(s) {
  const items = kitchenItems(s);
  const out = DISHES.filter((d) => s.soldOut[d.id]).length;
  return `<div class="pad">
    <div class="avail"><p class="avail-h">${icon('alert')}<b>Availability</b><small>${out ? `${out} item${out > 1 ? 's' : ''} off the menu` : 'Everything is on the menu'} · tap a dish when it runs out</small></p>
      <div class="chips">${DISHES.map((d) => `<button class="chip ${s.soldOut[d.id] ? 'out' : ''}" data-act="sold" data-arg="${d.id}" aria-pressed="${!!s.soldOut[d.id]}"><i></i>${esc(d.name)}</button>`).join('')}</div></div>
    <div class="board">${COLS.map(([k, name, ic, btn]) => {
      // oldest first: the ticket that has waited longest is on top
      const col = items.filter((x) => x.i.k === k).sort((a, b) => (k === 'new' ? a.o.acceptedAt - b.o.acceptedAt : a.i.kAt - b.i.kAt));
      return `<section class="col-k k-${k}"><h2>${icon(ic)}${name}<span class="count">${col.length}</span></h2>
        ${col.map(({ o, i, idx }) => `<article class="ticket">
          <header><span class="tno">${o.table}</span><span class="grow"><b>Table ${o.table}</b><small>#${o.id.slice(1)} · ${clock(o.at)}</small></span>${since(k === 'new' ? o.acceptedAt : i.kAt, k === 'ready' ? 180 : 600, k === 'ready' ? 360 : 900)}</header>
          <p class="t-item"><span class="q">${i.qty}</span>${esc(DISH[i.dish].name)}</p>${i.note ? `<p class="note">${icon('pen')} ${esc(i.note)}</p>` : ''}
          ${btn ? `<button class="btn sm wide" data-act="kmove" data-arg="${o.id}:${idx}">${btn}${icon('right')}</button>` : `<small class="await">${icon('clock')} Awaiting server</small>`}
        </article>`).join('') || `<p class="empty sm">No tickets</p>`}</section>`;
    }).join('')}</div></div>`;
}

ACT.kmove = (a) => { const [id, idx] = a.split(':'); L.advance(S(), id, Number(idx), Date.now()); };
ACT.sold = (id) => {
  const s = S();
  const on = !s.soldOut[id];
  L.setSoldOut(s, id, on);
  toast(on ? `${DISH[id].name} marked unavailable` : `${DISH[id].name} is back on`, on ? 'Hidden from the menu.' : 'Showing on the menu again.', on ? 'warn' : 'ok');
};
