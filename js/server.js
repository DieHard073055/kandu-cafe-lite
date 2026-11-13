// Server phone: rings on calls, accepts orders, serves ready food, takes orders for guests without data, checks payments.
// Also holds the staff pieces the manager reuses: payment cards and the table sheet.
import { S } from './store.js';
import * as L from './logic.js';
import { TABLES, DISH } from './data.js';
import { ui, ACT, SHEETS, esc, money, clock, since, due, toast, open, shut, menuHtml, cartBar, icon } from './ui.js';

export const ring = (s) => s.calls.filter((c) => !c.ack);
export const pendingOrders = (s) => s.orders.filter((o) => o.status === 'pending');
export const slipsToCheck = (s) => Object.values(s.tabs).filter((t) => t.slip?.state === 'checking');
export const ST_ICON = { call: 'bell', pay: 'card', new: 'receipt', ready: 'dish', waiting: 'flame', seated: 'users', free: 'check' };
const KSTATE = { new: 'Queued', cooking: 'Cooking', ready: 'Ready', served: 'Served' };

const sec = (ic, title, n) => `<h2 class="sec">${icon(ic)}${title}<span class="count">${n}</span></h2>`;

export function serverView(s, now) {
  if (ui.srv && s.tabs[ui.srv]?.status === 'open') {
    const t = s.tabs[ui.srv];
    return `<div class="tabhead"><button class="iconbtn plain" data-act="srvback" aria-label="Back to service">${icon('back')}</button>
      <span class="tno lg">${t.table}</span><div class="grow"><b>New order · Table ${t.table}</b><small>Goes straight to the kitchen</small></div>
      <span class="pinchip"><small>Tab PIN</small><b>${t.pin}</b></span></div>
      <div class="pad">${menuHtml(s, 's')}</div>
      <div class="dock">${cartBar('s', `Review order · Table ${t.table}`)}</div>`;
  }
  ui.srv = null;
  const calls = ring(s);
  const pend = pendingOrders(s);
  const ready = s.orders.filter((o) => o.status === 'accepted').flatMap((o) => o.items.map((i, idx) => ({ o, i, idx }))).filter((x) => x.i.k === 'ready');
  const paying = Object.values(s.tabs).filter((t) => t.status === 'paying');
  const quiet = !calls.length && !pend.length && !ready.length && !paying.length;
  return `<div class="pad">
    <div class="srv-top"><div><p class="eyebrow">Service</p><h1 class="title">${quiet ? 'All caught up' : `${calls.length + pend.length + ready.length + paying.length} things need you`}</h1></div>
      <button class="btn" data-act="pick">${icon('plus')}New order</button></div>
    ${calls.length ? `${sec('bell', 'Calling', calls.length)}${calls.map((c) => `<div class="card row hot">
      <span class="tno">${c.table}</span><span class="grow"><b>Table ${c.table} is calling</b><small>${icon('clock')} Waiting ${since(c.at, 60, 120)}</small></span>
      <button class="btn sm" data-act="attend" data-arg="${c.id}">Attend</button></div>`).join('')}` : ''}
    ${pend.length ? `${sec('receipt', 'To confirm', pend.length)}${pend.map((o) => orderCard(s, o)).join('')}` : ''}
    ${ready.length ? `${sec('dish', 'Ready to serve', ready.length)}${ready.map(({ o, i, idx }) => `<div class="card row">
      <span class="tno">${o.table}</span><span class="grow"><b>${i.qty} × ${esc(DISH[i.dish].name)}</b><small>${icon('clock')} Ready for ${since(i.kAt, 180, 360)}</small></span>
      <button class="btn sm" data-act="serve" data-arg="${o.id}:${idx}">${icon('check')}Served</button></div>`).join('')}` : ''}
    ${paying.length ? `${sec('card', 'Payments', paying.length)}${paying.map((t) => payCard(s, t)).join('')}` : ''}
    ${quiet ? `<div class="empty">${icon('bell', 'xl')}<b>No calls or orders</b><span>New calls and orders ring this phone.</span></div>` : ''}
  </div>
  ${calls.length ? `<div class="ringing" role="alertdialog" aria-label="Table ${calls[0].table} is calling">
    <div class="ring-ic">${icon('bell')}</div><p class="eyebrow">Incoming call</p><b class="ring-no">Table ${calls[0].table}</b><p>Waiting ${since(calls[0].at, 60, 120)}</p>
    ${calls.length > 1 ? `<small>+ ${calls.length - 1} more table${calls.length > 2 ? 's' : ''} calling</small>` : ''}
    <button class="btn wide lg" data-act="attend" data-arg="${calls[0].id}">${icon('check')}On my way</button></div>` : ''}`;
}

function orderCard(s, o) {
  const out = o.items.filter((i) => s.soldOut[i.dish]);
  const sum = o.items.reduce((a, i) => a + i.qty * i.price, 0);
  return `<div class="card order"><div class="order-h"><span class="row"><span class="tno">${o.table}</span><span><b>Table ${o.table}</b><small>${esc(o.by)} · ${since(o.at, 120, 300)} ago</small></span></span><b>${money(sum)}</b></div>
    <ul class="items">${o.items.map((i) => `<li><span class="q">${i.qty}</span><span class="grow">${esc(DISH[i.dish].name)}${i.note ? `<small class="note">${icon('pen')} ${esc(i.note)}</small>` : ''}</span>${s.soldOut[i.dish] ? '<span class="pill bad">Unavailable</span>' : ''}</li>`).join('')}</ul>
    ${out.length ? `<p class="alert">${icon('alert')} An item ran out after this was placed. Speak to the table, then decline and re-order for them.</p>` : ''}
    <div class="acts"><button class="btn ghost" data-act="reject" data-arg="${o.id}">Decline</button><button class="btn grow" data-act="accept" data-arg="${o.id}" ${out.length ? 'disabled' : ''}>${icon('check')}Confirm &amp; send to kitchen</button></div></div>`;
}

export function payCard(s, t) {
  const amount = L.total(s, t.id);
  if (t.slip?.state === 'checking') {
    const end = t.slip.at + L.CHECK_MS;
    return `<div class="card pay"><button class="slip-btn" data-act="slip" data-arg="${t.id}" aria-label="View slip from Table ${t.table}"><img src="${t.slip.img}" alt=""></button>
      <span class="grow"><b>Table ${t.table} · ${money(amount)}</b><small>Ref ${L.ref(t)}</small><small>${icon('clock')} Verify within ${due(end)}</small></span>
      <span class="col"><button class="btn sm" data-act="approve" data-arg="${t.id}">${icon('check')}Received</button><button class="btn ghost sm" data-act="rejslip" data-arg="${t.id}">Reject</button></span></div>`;
  }
  return `<div class="card pay"><span class="tno">${t.table}</span><span class="grow"><b>Table ${t.table} · ${money(amount)}</b>
    <small>${t.slip?.state === 'rejected' ? 'Slip rejected · awaiting a new one' : `Awaiting transfer · ${since(t.billAt, 300, 600)}`}</small></span>
    <button class="btn ghost sm" data-act="cash" data-arg="${t.id}">${icon('cash')}Cash</button></div>`;
}

// The full story of one table, for the manager's floor and the server's table picker.
SHEETS.table = (s) => {
  const n = ui.arg;
  const st = L.tableState(s, n);
  const t = st.t;
  if (!t) {
    return { title: `Table ${n}`, body: `<p class="lead">Available. Guests open a tab by scanning the table’s code, or you can start one for them.</p>`, foot: `<button class="btn grow" data-act="srvtable" data-arg="${n}">${icon('plus')}Start an order</button>` };
  }
  const os = L.ordersOf(s, t.id);
  const call = L.openCall(s, t.id);
  return {
    title: `Table ${n}`,
    body: `<div class="meta"><span class="status st-${st.state}">${icon(ST_ICON[st.state])}${L.STATES[st.state]}</span>
        <span>${icon('users')} ${esc(t.guests.join(', '))}</span><span>${icon('clock')} Open ${since(t.at, 3600, 5400)}</span><span>${icon('pin')} PIN ${t.pin}</span></div>
      ${os.map((o) => `<div class="mini-order ${o.status}"><div class="order-h"><small>${esc(o.by)} · ${clock(o.at)}</small><span class="pill ${o.status}">${o.status === 'pending' ? 'To confirm' : o.status === 'accepted' ? 'Confirmed' : 'Declined'}</span></div>
        <ul class="items">${o.items.map((i) => `<li><span class="q">${i.qty}</span><span class="grow">${esc(DISH[i.dish].name)}</span>${o.status === 'accepted' ? `<span class="pill k-${i.k}">${KSTATE[i.k]}</span>` : ''}</li>`).join('')}</ul></div>`).join('') || '<p class="muted">No orders yet.</p>'}
      <div class="sum strong"><span>Bill</span><b>${money(L.total(s, t.id))}</b></div>
      ${t.status === 'paying' ? payCard(s, t) : ''}`,
    foot: `${call ? `<button class="btn" data-act="attend" data-arg="${call.id}">${icon('bell')}Attend</button>` : ''}
      ${t.status === 'open' ? `<button class="btn ghost" data-act="srvtable" data-arg="${n}">${icon('plus')}Add order</button>` : ''}
      <button class="btn ghost grow" data-act="cash" data-arg="${t.id}">${icon('cash')}Paid cash · close</button>`,
  };
};

SHEETS.pick = (s) => ({
  title: 'New order for which table?',
  body: `<div class="floor small">${TABLES.map((n) => {
    const st = L.tableState(s, n);
    return `<button class="tbl st-${st.state}" data-act="srvtable" data-arg="${n}"><b>${n}</b><span class="st">${L.STATES[st.state]}</span></button>`;
  }).join('')}</div>`,
});

SHEETS.slip = (s) => {
  const t = s.tabs[ui.arg];
  return {
    title: `Transfer slip · Table ${t.table}`,
    body: `<div class="expect"><div><small>Expected amount</small><b>${money(L.total(s, t.id))}</b></div><div><small>Remarks</small><b>${L.ref(t)}</b></div></div>
      <p class="hint">${icon('info')} Match it against your banking app before confirming.</p><img class="slip-full" src="${t.slip.img}" alt="Transfer slip from Table ${t.table}">`,
    foot: `<button class="btn ghost" data-act="rejslip" data-arg="${t.id}">Reject</button><button class="btn grow" data-act="approve" data-arg="${t.id}">${icon('check')}Money received</button>`,
  };
};

ACT.pick = () => open('pick');
ACT.srvtable = (n) => {
  const s = S();
  n = Number(n);
  let t = L.tabAt(s, n);
  if (t?.status === 'paying') throw new Error(`Table ${n} is settling the bill.`);
  if (!t) { t = L.openTab(s, n, 'Server', Date.now()); toast(`Tab opened · Table ${n}`, `PIN ${t.pin} — guests with phones can join with it.`); }
  ui.srv = t.id;
  ui.carts.s = [];
  ui.role = 'server';
  location.hash = '#server';
  shut();
};
ACT.srvback = () => { ui.srv = null; ui.carts.s = []; };
ACT.attend = (id) => { L.ackCall(S(), id, Date.now()); shut(); };
ACT.accept = (id) => { L.acceptOrder(S(), id, Date.now()); toast('Sent to the kitchen'); };
ACT.reject = (id) => { L.rejectOrder(S(), id); toast('Order declined', 'Let the table know why.', 'warn'); };
ACT.serve = (a) => { const [id, idx] = a.split(':'); L.advance(S(), id, Number(idx), Date.now()); };
ACT.slip = (id) => open('slip', id);
ACT.approve = (id) => { L.approveSlip(S(), id, Date.now()); shut(); toast('Payment confirmed', 'Tab closed. The table is free.'); };
ACT.rejslip = (id) => { L.rejectSlip(S(), id); shut(); toast('Slip rejected', 'The guest is asked to upload again.', 'warn'); };
ACT.cash = (id) => { L.payCash(S(), id, Date.now()); shut(); toast('Paid in cash', 'Tab closed. The table is free.'); };
