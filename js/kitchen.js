// Kitchen screen: a board of every accepted item, new -> cooking -> ready, plus the sold-out switches.
import { S } from './store.js';
import * as L from './logic.js';
import { DISHES, DISH } from './data.js';
import { ACT, esc, since, toast } from './ui.js';

const COLS = [['new', 'New', 'Start cooking'], ['cooking', 'Cooking', 'Mark ready'], ['ready', 'Ready', null]];

export const kitchenItems = (s) => s.orders.filter((o) => o.status === 'accepted')
  .flatMap((o) => o.items.map((i, idx) => ({ o, i, idx }))).filter((x) => x.i.k !== 'served');

export function kitchenView(s) {
  const items = kitchenItems(s);
  return `<div class="pad">
    <div class="sold"><p class="eyebrow">Ran out? Tap it. It disappears from the menu straight away.</p>
      <div class="chips">${DISHES.map((d) => `<button class="chip ${s.soldOut[d.id] ? 'out' : ''}" data-act="sold" data-arg="${d.id}" aria-pressed="${!!s.soldOut[d.id]}">${d.emoji} ${esc(d.name)}${s.soldOut[d.id] ? ' · sold out' : ''}</button>`).join('')}</div></div>
    <div class="board">${COLS.map(([k, name, btn]) => {
      // oldest first: the ticket that has waited longest is on top
      const col = items.filter((x) => x.i.k === k).sort((a, b) => (k === 'new' ? a.o.acceptedAt - b.o.acceptedAt : a.i.kAt - b.i.kAt));
      return `<section class="col-k k-${k}"><h2>${name} <span>${col.length}</span></h2>
        ${col.map(({ o, i, idx }) => `<article class="ticket">
          <div class="between"><b class="tno">${o.table}</b>${since(k === 'new' ? o.acceptedAt : i.kAt, k === 'ready' ? 180 : 600, k === 'ready' ? 360 : 900)}</div>
          <p><b>${i.qty}×</b> ${esc(DISH[i.dish].name)}</p>${i.note ? `<p class="note">“${esc(i.note)}”</p>` : ''}
          ${btn ? `<button class="btn sm wide" data-act="kmove" data-arg="${o.id}:${idx}">${btn} →</button>` : '<small>Waiting for the server</small>'}
        </article>`).join('') || '<p class="empty sm">Nothing here</p>'}</section>`;
    }).join('')}</div></div>`;
}

ACT.kmove = (a) => { const [id, idx] = a.split(':'); L.advance(S(), id, Number(idx), Date.now()); };
ACT.sold = (id) => {
  const s = S();
  const on = !s.soldOut[id];
  L.setSoldOut(s, id, on);
  toast(on ? `${DISH[id].name} is sold out` : `${DISH[id].name} is back`, on ? 'Hidden from the menu.' : 'Showing on the menu again.', on ? 'warn' : 'ok');
};
