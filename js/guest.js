// Guest phone: scan the table QR, start or join a tab, order, call the server, close the tab and pay by transfer.
import { S } from './store.js';
import * as L from './logic.js';
import { TABLES, DISH, BANK, demoSlip } from './data.js';
import { ui, ACT, SHEETS, esc, money, clock, since, due, toast, copy, open, shut, setMe, field, menuHtml, cartBar, dishTile } from './ui.js';

const ITEM = { new: 'In the queue', cooking: 'Cooking', ready: 'Ready', served: 'Served' };

export function guestView(s, now) {
  const t = ui.me && s.tabs[ui.me.tab];
  if (t) return t.status === 'closed' ? thanks(t) : t.status === 'paying' ? payView(s, t, now) : tabView(s, t);
  if (ui.table) return scanned(s, ui.table);
  return `<div class="pad">
    <p class="eyebrow">Welcome to Kandu Café</p><h1 class="page-h">Scan the code on your table</h1>
    <p class="lead">Each table has a QR code. For this demo, tap a table to pretend you scanned it.</p>
    <div class="tents">${TABLES.map((n) => `<a class="tent" href="#guest/${n}"><span class="qr" aria-hidden="true"></span><b>Table ${n}</b></a>`).join('')}</div>
  </div>`;
}

function scanned(s, table) {
  const t = L.tabAt(s, table);
  const head = `<div class="hero"><p class="eyebrow">You scanned</p><h1 class="page-h">Table ${table}</h1></div>`;
  const name = `<label class="lbl" for="nm">Your name</label><input id="nm" data-bind="name" maxlength="20" autocomplete="given-name" placeholder="So your friends know who ordered what" value="${field('name')}">`;
  if (!t) return `${head}<div class="pad"><div class="card">
      <h2 class="h">Start a tab</h2><p class="lead">You’re the first one here. You’ll get a PIN to share with friends who join later.</p>
      ${name}<button class="btn wide" data-act="start">Start tab &amp; see the menu</button></div>
      <p class="hint center"><a href="#guest">Wrong table?</a></p></div>`;
  if (t.status !== 'open') return `${head}<div class="pad"><div class="card center"><h2 class="h">This table is settling the bill</h2><p class="lead">Want to order more? Ask your server.</p></div></div>`;
  return `${head}<div class="pad"><div class="card">
      <h2 class="h">Join your table’s tab</h2>
      <p class="lead">${esc(t.guests.join(', '))} ${t.guests.length > 1 ? 'are' : 'is'} already here. Ask for the 4-digit tab PIN on their phone.</p>
      <label class="lbl" for="pin">Tab PIN</label><input id="pin" class="pin" data-bind="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" value="${field('pin')}">
      ${name}<button class="btn wide" data-act="join">Join tab</button></div>
    <p class="hint center">Not with them? Let a server know. <a href="#guest">Wrong table?</a></p></div>`;
}

function tabHead(t) {
  return `<div class="tabhead"><div><p class="eyebrow">Table ${t.table} · ${esc(ui.me.name)}</p>
    <small>With ${esc(t.guests.filter((g) => g !== ui.me.name).join(', ') || 'nobody yet')}</small></div>
    <button class="pinchip" data-act="share" title="Friends joining later need this">PIN <b>${t.pin}</b></button></div>`;
}

function tabView(s, t) {
  const os = L.ordersOf(s, t.id);
  const call = L.openCall(s, t.id);
  const seg = `<div class="seg wide"><button class="${ui.gtab === 'menu' ? 'on' : ''}" data-act="gtab" data-arg="menu">Menu</button>
    <button class="${ui.gtab === 'tab' ? 'on' : ''}" data-act="gtab" data-arg="tab">Our tab${os.length ? ` (${os.length})` : ''}</button></div>`;
  const body = ui.gtab === 'menu' ? menuHtml(s, 'g') : ordersHtml(s, t, os);
  return `${tabHead(t)}<div class="pad">${seg}${body}</div>
    <div class="dock">
      <button class="callbtn ${call ? 'on' : ''}" data-act="call">${call ? `🛎️ Server is coming… ${since(call.at, 60, 120)}` : '🛎️ Call server'}</button>
      ${cartBar('g', 'View order')}
    </div>`;
}

function ordersHtml(s, t, os) {
  if (!os.length) return '<p class="empty">No orders yet. Pick something from the menu.</p>';
  const waiting = os.filter((o) => o.status === 'pending').flatMap((o) => o.items).reduce((a, i) => a + i.qty * i.price, 0);
  const pending = waiting > 0;
  return `${[...os].reverse().map((o) => `<div class="card order ${o.status}">
      <div class="between"><small>${esc(o.by)} · ${clock(o.at)}</small><span class="pill ${o.status}">${{ pending: 'Waiting for server', accepted: 'Sent to kitchen', rejected: 'Not accepted' }[o.status]}</span></div>
      <ul class="lines">${o.items.map((i) => `<li>${dishTile(DISH[i.dish])}<span class="grow"><b>${i.qty}× ${esc(DISH[i.dish].name)}</b>${i.note ? `<small class="note">“${esc(i.note)}”</small>` : ''}</span>
        ${o.status === 'accepted' ? `<span class="pill k-${i.k}">${ITEM[i.k]}</span>` : ''}</li>`).join('')}</ul></div>`).join('')}
    <div class="card total"><span>Total so far${pending ? `<small>+ ${money(waiting)} waiting for the server</small>` : ''}</span><b>${money(L.total(s, t.id))}</b></div>
    <button class="btn wide ghost" data-act="bill" ${pending ? 'disabled' : ''}>Close tab &amp; pay</button>
    ${pending ? '<p class="hint center">You can close the tab once your server accepts the last order.</p>' : ''}`;
}

function payView(s, t, now) {
  const amount = L.total(s, t.id);
  const lines = {};
  L.ordersOf(s, t.id).filter((o) => o.status === 'accepted').flatMap((o) => o.items).forEach((i) => { lines[i.dish] = (lines[i.dish] || 0) + i.qty; });
  const slip = t.slip;
  const step2 = slip?.state === 'checking'
    ? `<div class="card checking"><img class="slip-thumb" src="${slip.img}" alt="Your transfer slip"><div><b>Checking your transfer</b>
        <p class="lead">We check every slip within 5 minutes.</p><p class="big">${due(slip.at + L.CHECK_MS)}</p></div></div>`
    : `<div class="card">${slip?.state === 'rejected' ? '<p class="bad">We couldn’t match your last slip. Check the amount and account, then upload again, or call your server.</p>' : ''}
        <h2 class="h">2 · Upload your transfer slip</h2>
        <label class="btn wide">📎 Choose screenshot or photo<input type="file" accept="image/*" data-file="slip" hidden></label>
        <button class="btn wide ghost" data-act="demoslip">Use a demo slip</button></div>`;
  return `${tabHead(t)}<div class="pad">
    <p class="eyebrow">Your bill</p><h1 class="page-h">${money(amount)}</h1>
    <ul class="bill">${Object.entries(lines).map(([d, q]) => `<li><span>${q}× ${esc(DISH[d].name)}</span><span>${money(q * DISH[d].price)}</span></li>`).join('')}</ul>
    <div class="card"><h2 class="h">1 · Transfer ${money(amount)}</h2>
      <dl class="bank"><dt>Bank</dt><dd>${BANK.bank}</dd><dt>Name</dt><dd>${BANK.name}</dd>
      <dt>Account</dt><dd><button class="copy" data-act="copy" data-arg="${BANK.acc}">${BANK.acc} ⧉</button></dd>
      <dt>Remarks</dt><dd><button class="copy" data-act="copy" data-arg="${L.ref(t)}">${L.ref(t)} ⧉</button></dd></dl></div>
    ${step2}
    <p class="hint center">Paying cash instead? <button class="link" data-act="call">Call your server</button></p></div>`;
}

const thanks = (t) => `<div class="pad center thanks"><div class="tick">✓</div><h1 class="page-h">Paid · ${money(t.total)}</h1>
  <p class="lead">${t.method === 'cash' ? 'Paid in cash.' : 'Transfer confirmed.'} Thank you for eating at Kandu Café!</p>
  <button class="btn wide" data-act="done">Done</button></div>`;

const nameOf = () => (ui.f.name || '').trim() || 'Guest';

ACT.start = () => {
  const name = nameOf();
  const t = L.openTab(S(), ui.table, name, Date.now());
  setMe({ tab: t.id, name });
  ui.gtab = 'menu';
  toast(`Tab open · PIN ${t.pin}`, 'Share the PIN with friends who join later.');
};
ACT.join = () => {
  const s = S();
  let name = nameOf();
  const t = L.tabAt(s, ui.table);
  if (t?.guests.includes(name)) name = `${name} ${t.guests.length + 1}`; // two "Guest"s stay apart
  L.joinTab(s, ui.table, ui.f.pin || '', name);
  setMe({ tab: t.id, name });
  ui.gtab = 'menu';
  ui.f.pin = '';
  toast(`You joined Table ${t.table}`, 'Your orders go on the same tab.');
};
ACT.gtab = (v) => { ui.gtab = v; };
ACT.share = () => copy(`Join our tab at Kandu Café: scan the code on Table ${S().tabs[ui.me.tab].table}, PIN ${S().tabs[ui.me.tab].pin}`);
ACT.copy = (v) => copy(v);
ACT.call = () => {
  const c = L.callServer(S(), ui.me.tab, Date.now());
  toast(`Server called to Table ${c.table}`, 'Their phone is ringing now.');
};
ACT.bill = () => open('bill');
ACT.billok = () => { L.requestBill(S(), ui.me.tab, Date.now()); shut(); };
ACT.demoslip = () => {
  const s = S();
  const t = s.tabs[ui.me.tab];
  L.submitSlip(s, t.id, demoSlip(L.total(s, t.id), L.ref(t)), Date.now());
  toast('Slip sent', 'We’ll confirm within 5 minutes.');
};
ACT.done = () => { setMe(null); ui.table = null; ui.carts.g = []; location.hash = '#guest'; };
ACT.leave = () => { setMe(null); ui.carts.g = []; ui.f = {}; shut(); };

// Shared by the guest cart and the server ordering for a table.
ACT.place = (ctx) => {
  const s = S();
  const cart = ui.carts[ctx];
  const tabId = ctx === 's' ? ui.srv : ui.me.tab;
  try {
    L.placeOrder(s, tabId, ctx === 's' ? 'Server' : ui.me.name, cart, Date.now(), ctx === 's');
  } catch (e) {
    if (e.out) ui.carts[ctx] = cart.filter((l) => !e.out.includes(l.dish));
    if (!ui.carts[ctx].length) shut();
    throw e;
  }
  ui.carts[ctx] = [];
  shut();
  if (ctx === 's') { toast('Sent to the kitchen', `Table ${s.tabs[tabId].table}`); ui.srv = null; } else { ui.gtab = 'tab'; toast('Order sent', 'Your server will confirm it in a moment.'); }
};

// Photo slips are shrunk before they go into storage.
export async function slipFile(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1000 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  L.submitSlip(S(), ui.me.tab, c.toDataURL('image/jpeg', 0.7), Date.now());
  toast('Slip sent', 'We’ll confirm within 5 minutes.');
}

SHEETS.bill = (s) => ({
  title: 'Close the tab?',
  body: `<p class="lead">Nobody at Table ${s.tabs[ui.me.tab].table} can add orders after this. Your bill is <b>${money(L.total(s, ui.me.tab))}</b>.</p>`,
  foot: '<button class="btn ghost" data-act="close">Not yet</button><button class="btn grow" data-act="billok">Close tab &amp; pay</button>',
});
