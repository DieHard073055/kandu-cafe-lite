// Guest phone: scan the table QR, start or join a tab, order, call the server, close the tab and pay by transfer.
import { S } from './store.js';
import * as L from './logic.js';
import { TABLES, DISH, BANK, demoSlip } from './data.js';
import { ui, ACT, SHEETS, esc, money, clock, since, due, toast, copy, open, shut, setMe, field, menuHtml, cartBar, dishTile, icon } from './ui.js';

const ITEM = { new: 'Queued', cooking: 'Cooking', ready: 'Ready', served: 'Served' };
const ORDER = { pending: 'Awaiting confirmation', accepted: 'Confirmed', rejected: 'Declined' };

const brandHero = (eyebrow, title, sub = '') => `<header class="hero">
  <div class="hero-brand"><span class="mark">K</span><span><b>Kandu Café</b><small>Dhangethi · Maldives</small></span></div>
  <p class="eyebrow">${eyebrow}</p><h1 class="display">${title}</h1>${sub ? `<p class="hero-sub">${sub}</p>` : ''}</header>`;

export function guestView(s, now) {
  const t = ui.me && s.tabs[ui.me.tab];
  if (t) return t.status === 'closed' ? thanks(t) : t.status === 'paying' ? payView(s, t, now) : tabView(s, t);
  if (ui.table) return scanned(s, ui.table);
  return `${brandHero('Table ordering', 'Scan the code on your table', 'Order, call your server and pay — all from your phone.')}
    <div class="pad"><p class="sec-t">Demo · pick a table to simulate the scan</p>
    <div class="tents">${TABLES.map((n) => {
      const busy = L.tabAt(s, n);
      return `<a class="tent" href="#guest/${n}">${icon('qr')}<b>Table ${n}</b><small>${busy ? 'Tab open' : 'Available'}</small></a>`;
    }).join('')}</div></div>`;
}

function scanned(s, table) {
  const t = L.tabAt(s, table);
  const name = `<label class="lbl" for="nm">Your name</label><input id="nm" data-bind="name" maxlength="20" autocomplete="given-name" placeholder="So friends know who ordered what" value="${field('name')}">`;
  const back = '<p class="hint center"><a href="#guest">Not your table?</a></p>';
  if (!t) return `${brandHero(`Table ${table}`, 'Welcome', 'Start a tab to see the menu. Friends who arrive later can join it with your PIN.')}
    <div class="pad"><div class="card form">${name}<button class="btn wide lg" data-act="start">Start a tab${icon('right')}</button></div>${back}</div>`;
  if (t.status !== 'open') return `${brandHero(`Table ${table}`, 'Settling the bill')}<div class="pad"><div class="card"><p class="lead">This table’s tab is being paid. Want to order more? Ask your server.</p></div>${back}</div>`;
  return `${brandHero(`Table ${table}`, 'Join your table', `${esc(t.guests.join(', '))} ${t.guests.length > 1 ? 'are' : 'is'} already here. Ask them for the 4-digit tab PIN.`)}
    <div class="pad"><div class="card form">
      <label class="lbl" for="pin">${icon('pin')} Tab PIN</label><input id="pin" class="pin" data-bind="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="0000" value="${field('pin')}">
      ${name}<button class="btn wide lg" data-act="join">Join tab${icon('right')}</button></div>
    <p class="hint center">Not with them? Let a server know. <a href="#guest">Not your table?</a></p></div>`;
}

function tabHead(t) {
  const others = t.guests.filter((g) => g !== ui.me.name);
  return `<div class="tabhead"><span class="tno lg">${t.table}</span><div class="grow"><b>Table ${t.table}</b>
    <small>${icon('users')} ${esc(ui.me.name)}${others.length ? ` with ${esc(others.join(', '))}` : ''}</small></div>
    <button class="pinchip" data-act="share" aria-label="Copy tab PIN ${t.pin}"><small>Tab PIN</small><b>${t.pin}</b></button></div>`;
}

function tabView(s, t) {
  const os = L.ordersOf(s, t.id);
  const call = L.openCall(s, t.id);
  const seg = `<div class="tabs" role="tablist"><button role="tab" aria-selected="${ui.gtab === 'menu'}" class="${ui.gtab === 'menu' ? 'on' : ''}" data-act="gtab" data-arg="menu">Menu</button>
    <button role="tab" aria-selected="${ui.gtab === 'tab'}" class="${ui.gtab === 'tab' ? 'on' : ''}" data-act="gtab" data-arg="tab">Our tab${os.length ? ` <span class="count">${os.length}</span>` : ''}</button></div>`;
  const body = ui.gtab === 'menu' ? menuHtml(s, 'g') : ordersHtml(s, t, os);
  return `${tabHead(t)}${seg}<div class="pad">${body}</div>
    <div class="dock">
      <button class="callbtn ${call ? 'on' : ''}" data-act="call">${icon('bell')}${call ? `Server on the way · ${since(call.at, 60, 120)}` : 'Call server'}</button>
      ${cartBar('g', 'View order')}
    </div>`;
}

function ordersHtml(s, t, os) {
  if (!os.length) return `<div class="empty">${icon('receipt', 'xl')}<b>No orders yet</b><span>Pick something from the menu.</span></div>`;
  const waiting = os.filter((o) => o.status === 'pending').flatMap((o) => o.items).reduce((a, i) => a + i.qty * i.price, 0);
  const pending = waiting > 0;
  return `${[...os].reverse().map((o) => `<div class="card order ${o.status}">
      <div class="order-h"><span>${esc(o.by)} · ${clock(o.at)}</span><span class="pill ${o.status}">${ORDER[o.status]}</span></div>
      <ul class="lines">${o.items.map((i) => `<li>${dishTile(DISH[i.dish], 'sm')}<span class="grow"><b>${i.qty} × ${esc(DISH[i.dish].name)}</b>${i.note ? `<small class="note">${icon('pen')} ${esc(i.note)}</small>` : ''}</span>
        ${o.status === 'accepted' ? `<span class="pill k-${i.k}">${ITEM[i.k]}</span>` : `<span class="muted">${money(i.qty * i.price)}</span>`}</li>`).join('')}</ul></div>`).join('')}
    <div class="card sumcard"><div class="sum"><span>Confirmed total</span><b>${money(L.total(s, t.id))}</b></div>
      ${pending ? `<div class="sum sub"><span>Awaiting confirmation</span><span>${money(waiting)}</span></div>` : ''}
      <button class="btn wide ghost" data-act="bill" ${pending ? 'disabled' : ''}>${icon('receipt')}Close tab &amp; pay</button>
      ${pending ? '<p class="hint center">Available once your server confirms the last order.</p>' : ''}</div>`;
}

function payView(s, t, now) {
  const amount = L.total(s, t.id);
  const lines = {};
  L.ordersOf(s, t.id).filter((o) => o.status === 'accepted').flatMap((o) => o.items).forEach((i) => { lines[i.dish] = (lines[i.dish] || 0) + i.qty; });
  const slip = t.slip;
  const step2 = slip?.state === 'checking'
    ? `<div class="card checking"><img class="slip-thumb" src="${slip.img}" alt="Your transfer slip"><div class="grow"><span class="pill pending">Verifying</span><b>We’re checking your transfer</b>
        <small>Usually within 5 minutes</small><p class="big">${due(slip.at + L.CHECK_MS)}</p></div></div>`
    : `<div class="card step"><span class="num">2</span><div class="grow"><h2 class="h">Upload your transfer slip</h2>
        ${slip?.state === 'rejected' ? `<p class="alert">${icon('alert')} We couldn’t match your last slip. Check the amount and account, then try again.</p>` : '<p class="muted">A screenshot from your banking app is fine.</p>'}
        <label class="btn wide">${icon('upload')}Upload screenshot<input type="file" accept="image/*" data-file="slip" hidden></label>
        <button class="btn wide ghost" data-act="demoslip">Use a demo slip</button></div></div>`;
  const row = (k, v, c) => `<dt>${k}</dt><dd>${c ? `<button class="copy" data-act="copy" data-arg="${v}" aria-label="Copy ${k}">${v}${icon('copy')}</button>` : v}</dd>`;
  return `${tabHead(t)}<div class="pad">
    <div class="billcard"><p class="eyebrow">Amount due</p><p class="amount">${money(amount)}</p>
      <ul class="bill">${Object.entries(lines).map(([d, q]) => `<li><span>${q} × ${esc(DISH[d].name)}</span><span>${money(q * DISH[d].price)}</span></li>`).join('')}</ul></div>
    <div class="card step"><span class="num">1</span><div class="grow"><h2 class="h">Transfer ${money(amount)}</h2>
      <dl class="bank">${row('Bank', BANK.bank)}${row('Account name', BANK.name)}${row('Account no.', BANK.acc, 1)}${row('Remarks', L.ref(t), 1)}</dl></div></div>
    ${step2}
    <p class="hint center">Paying with cash? <button class="link" data-act="call">Call your server</button></p></div>`;
}

const thanks = (t) => `<div class="thanks"><div class="tick">${icon('check')}</div><p class="eyebrow">Payment received</p><h1 class="display">${money(t.total)}</h1>
  <p class="lead">${t.method === 'cash' ? 'Paid in cash' : 'Bank transfer confirmed'} · Table ${t.table}<br>Thank you for dining at Kandu Café.</p>
  <button class="btn wide lg" data-act="done">Done</button></div>`;

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
