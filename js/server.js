// Server phone: rings on calls, accepts orders, serves ready food, takes orders for guests without data, checks payments.
// Also holds the staff pieces the manager reuses: payment cards and the table sheet.
import { S } from './store.js';
import * as L from './logic.js';
import { TABLES, DISH } from './data.js';
import { ui, ACT, SHEETS, esc, money, clock, since, due, toast, open, shut, menuHtml, cartBar } from './ui.js';

export const ring = (s) => s.calls.filter((c) => !c.ack);
export const pendingOrders = (s) => s.orders.filter((o) => o.status === 'pending');
export const slipsToCheck = (s) => Object.values(s.tabs).filter((t) => t.slip?.state === 'checking');

export function serverView(s, now) {
  if (ui.srv && s.tabs[ui.srv]?.status === 'open') {
    const t = s.tabs[ui.srv];
    return `<div class="tabhead"><div><p class="eyebrow">Ordering for Table ${t.table}</p><small>Goes straight to the kitchen</small></div>
      <span class="pinchip">PIN <b>${t.pin}</b></span></div>
      <div class="pad"><button class="link" data-act="srvback">← Back to service</button>${menuHtml(s, 's')}</div>
      <div class="dock">${cartBar('s', `Review order for Table ${t.table}`)}</div>`;
  }
  ui.srv = null;
  const calls = ring(s);
  const pend = pendingOrders(s);
  const ready = s.orders.filter((o) => o.status === 'accepted').flatMap((o) => o.items.map((i, idx) => ({ o, i, idx }))).filter((x) => x.i.k === 'ready');
  const paying = Object.values(s.tabs).filter((t) => t.status === 'paying');
  const quiet = !calls.length && !pend.length && !ready.length && !paying.length;
  return `<div class="pad">
    <button class="btn wide" data-act="pick">＋ Take an order for a table</button>
    <p class="hint">For guests without data or Wi-Fi.</p>
    ${calls.length ? `<h2 class="sec">Calling <span>${calls.length}</span></h2>${calls.map((c) => `<div class="card row hot">
      <b class="tno">${c.table}</b><span class="grow"><b>Table ${c.table} needs you</b><small>Waiting ${since(c.at, 60, 120)}</small></span>
      <button class="btn sm" data-act="attend" data-arg="${c.id}">On my way</button></div>`).join('')}` : ''}
    ${pend.length ? `<h2 class="sec">New orders <span>${pend.length}</span></h2>${pend.map((o) => orderCard(s, o)).join('')}` : ''}
    ${ready.length ? `<h2 class="sec">Ready to serve <span>${ready.length}</span></h2>${ready.map(({ o, i, idx }) => `<div class="card row">
      <b class="tno">${o.table}</b><span class="grow"><b>${i.qty}× ${esc(DISH[i.dish].name)}</b><small>Ready ${since(i.kAt, 180, 360)} ago</small></span>
      <button class="btn sm" data-act="serve" data-arg="${o.id}:${idx}">Served</button></div>`).join('')}` : ''}
    ${paying.length ? `<h2 class="sec">Payments <span>${paying.length}</span></h2>${paying.map((t) => payCard(s, t)).join('')}` : ''}
    ${quiet ? '<p class="empty">All quiet. Calls and new orders will ring this phone.</p>' : ''}
  </div>
  ${calls.length ? `<div class="ringing" role="alertdialog" aria-label="Table ${calls[0].table} is calling">
    <div class="bell">🛎️</div><p>Table</p><b>${calls[0].table}</b><p>is calling · ${since(calls[0].at, 60, 120)}</p>
    ${calls.length > 1 ? `<small>+ ${calls.length - 1} more table${calls.length > 2 ? 's' : ''}</small>` : ''}
    <button class="btn wide" data-act="attend" data-arg="${calls[0].id}">On my way</button></div>` : ''}`;
}

function orderCard(s, o) {
  const out = o.items.filter((i) => s.soldOut[i.dish]);
  return `<div class="card order"><div class="between"><span class="row"><b class="tno">${o.table}</b><span><b>Table ${o.table}</b><small>${esc(o.by)} · ${since(o.at, 120, 300)}</small></span></span></div>
    <ul class="plain">${o.items.map((i) => `<li><b>${i.qty}×</b> ${esc(DISH[i.dish].name)}${s.soldOut[i.dish] ? ' <span class="pill bad">sold out</span>' : ''}${i.note ? ` <span class="note">“${esc(i.note)}”</span>` : ''}</li>`).join('')}</ul>
    ${out.length ? '<p class="bad">Something here sold out after they ordered. Talk to the table, then reject and re-order for them.</p>' : ''}
    <div class="acts"><button class="btn ghost sm" data-act="reject" data-arg="${o.id}">Reject</button><button class="btn sm grow" data-act="accept" data-arg="${o.id}" ${out.length ? 'disabled' : ''}>Accept · send to kitchen</button></div></div>`;
}

export function payCard(s, t) {
  const amount = L.total(s, t.id);
  if (t.slip?.state === 'checking') {
    const end = t.slip.at + L.CHECK_MS;
    return `<div class="card pay"><button class="slip-btn" data-act="slip" data-arg="${t.id}" aria-label="View slip"><img src="${t.slip.img}" alt=""></button>
      <span class="grow"><b>Table ${t.table} · ${money(amount)}</b><small>Ref ${L.ref(t)}</small><small>Check within <b>${due(end)}</b></small></span>
      <span class="col"><button class="btn sm" data-act="approve" data-arg="${t.id}">Paid ✓</button><button class="btn ghost sm" data-act="rejslip" data-arg="${t.id}">Reject</button></span></div>`;
  }
  return `<div class="card pay"><b class="tno">${t.table}</b><span class="grow"><b>Table ${t.table} · ${money(amount)}</b>
    <small>${t.slip?.state === 'rejected' ? 'Slip rejected · waiting for a new one' : `Waiting for transfer · ${since(t.billAt, 300, 600)}`}</small></span>
    <button class="btn ghost sm" data-act="cash" data-arg="${t.id}">Took cash</button></div>`;
}

// The full story of one table, for the manager's floor and the server's table picker.
SHEETS.table = (s, now) => {
  const n = ui.arg;
  const st = L.tableState(s, n);
  const t = st.t;
  if (!t) {
    return { title: `Table ${n}`, body: '<p class="lead">Free. Guests open a tab by scanning the code, or a server can open one.</p>', foot: `<button class="btn grow" data-act="srvtable" data-arg="${n}">Take an order for this table</button>` };
  }
  const os = L.ordersOf(s, t.id);
  const call = L.openCall(s, t.id);
  return {
    title: `Table ${n} · ${L.STATES[st.state]}`,
    body: `<p class="lead">${esc(t.guests.join(', '))} · open ${since(t.at, 3600, 5400)} · PIN <b>${t.pin}</b></p>
      ${os.map((o) => `<div class="mini-order ${o.status}"><small>${esc(o.by)} · ${clock(o.at)} · ${o.status}</small>
        <ul class="plain">${o.items.map((i) => `<li>${i.qty}× ${esc(DISH[i.dish].name)} ${o.status === 'accepted' ? `<span class="pill k-${i.k}">${i.k}</span>` : ''}</li>`).join('')}</ul></div>`).join('') || '<p class="hint">No orders yet.</p>'}
      <div class="card total"><span>Bill</span><b>${money(L.total(s, t.id))}</b></div>
      ${t.status === 'paying' ? payCard(s, t) : ''}`,
    foot: `${call ? `<button class="btn" data-act="attend" data-arg="${call.id}">Attend call</button>` : ''}
      ${t.status === 'open' ? `<button class="btn ghost" data-act="srvtable" data-arg="${n}">Add order</button>` : ''}
      <button class="btn ghost grow" data-act="cash" data-arg="${t.id}">Took cash · close tab</button>`,
  };
};

SHEETS.pick = (s) => ({
  title: 'Which table?',
  body: `<div class="floor small">${TABLES.map((n) => {
    const st = L.tableState(s, n);
    return `<button class="tbl st-${st.state}" data-act="srvtable" data-arg="${n}"><b>${n}</b><small>${L.STATES[st.state]}</small></button>`;
  }).join('')}</div>`,
});

SHEETS.slip = (s) => {
  const t = s.tabs[ui.arg];
  return {
    title: `Slip · Table ${t.table}`,
    body: `<p class="lead">Expect <b>${money(L.total(s, t.id))}</b> with remarks <b>${L.ref(t)}</b>. Check it in your bank app.</p><img class="slip-full" src="${t.slip.img}" alt="Transfer slip from Table ${t.table}">`,
    foot: `<button class="btn ghost" data-act="rejslip" data-arg="${t.id}">Reject</button><button class="btn grow" data-act="approve" data-arg="${t.id}">Money received ✓</button>`,
  };
};

ACT.pick = () => open('pick');
ACT.srvtable = (n) => {
  const s = S();
  n = Number(n);
  let t = L.tabAt(s, n);
  if (t?.status === 'paying') throw new Error(`Table ${n} is settling the bill.`);
  if (!t) { t = L.openTab(s, n, 'Server', Date.now()); toast(`Tab opened for Table ${n}`, `PIN ${t.pin} — friends with phones can join with it.`); }
  ui.srv = t.id;
  ui.carts.s = [];
  ui.role = 'server';
  location.hash = '#server';
  shut();
};
ACT.srvback = () => { ui.srv = null; ui.carts.s = []; };
ACT.attend = (id) => { L.ackCall(S(), id, Date.now()); shut(); };
ACT.accept = (id) => { L.acceptOrder(S(), id, Date.now()); toast('Sent to the kitchen'); };
ACT.reject = (id) => { L.rejectOrder(S(), id); toast('Order rejected', 'Let the table know why.', 'warn'); };
ACT.serve = (a) => { const [id, idx] = a.split(':'); L.advance(S(), id, Number(idx), Date.now()); };
ACT.slip = (id) => open('slip', id);
ACT.approve = (id) => { L.approveSlip(S(), id, Date.now()); shut(); toast('Payment confirmed', 'Tab closed. The table is free.'); };
ACT.rejslip = (id) => { L.rejectSlip(S(), id); shut(); toast('Slip rejected', 'The guest is asked to upload again.', 'warn'); };
ACT.cash = (id) => { L.payCash(S(), id, Date.now()); shut(); toast('Paid in cash', 'Tab closed. The table is free.'); };
