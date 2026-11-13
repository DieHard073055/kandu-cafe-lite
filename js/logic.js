// All state changes live here, free of the DOM, so tests can drive the whole flow.
// Each function changes the state in place and throws an Error with a guest-friendly message when a step isn't allowed.
import { DISH, TABLES, demoSlip } from './data.js';

export const CHECK_MS = 5 * 60e3; // promise to check a transfer slip within 5 minutes
export const NEXT = { new: 'cooking', cooking: 'ready', ready: 'served' };

const nextId = (s, p) => `${p}${++s.seq}`;
const pin4 = () => String(Math.floor(1000 + Math.random() * 9000));
const fail = (msg, extra) => { throw Object.assign(new Error(msg), extra); };

export const blank = () => ({ v: 1, seq: 0, soldOut: {}, tabs: {}, orders: [], calls: [] });

export const tabAt = (s, table) => Object.values(s.tabs).find((t) => t.table === table && t.status !== 'closed');
export const ordersOf = (s, tabId) => s.orders.filter((o) => o.tab === tabId);
export const ref = (t) => `T${t.table}-${t.id}`;
export const openCall = (s, tabId) => s.calls.find((c) => c.tab === tabId && !c.ack);

// What the guest owes: accepted orders only. Pending ones aren't on the bill until the server accepts them.
export const total = (s, tabId) =>
  ordersOf(s, tabId).filter((o) => o.status === 'accepted').flatMap((o) => o.items).reduce((a, i) => a + i.qty * i.price, 0);

export function openTab(s, table, by, now) {
  if (!TABLES.includes(table)) fail('There is no such table.');
  if (tabAt(s, table)) fail(`Table ${table} already has a tab. Join it with the PIN.`);
  const t = { id: nextId(s, 'B'), table, pin: pin4(), at: now, status: 'open', guests: [by] };
  s.tabs[t.id] = t;
  return t;
}

export function joinTab(s, table, pin, by) {
  const t = tabAt(s, table);
  if (!t) fail('This table has no open tab yet.');
  if (t.status !== 'open') fail('This table is settling the bill. Ask your server.');
  if (String(pin).trim() !== t.pin) fail('That PIN doesn’t match. Check your friend’s screen.');
  if (!t.guests.includes(by)) t.guests.push(by);
  return t;
}

// lines: [{ dish, qty, note }]. Orders from staff skip the accept step.
export function placeOrder(s, tabId, by, lines, now, staff = false) {
  const t = s.tabs[tabId];
  if (!t || t.status !== 'open') fail('This tab is closed for new orders.');
  const items = lines.filter((l) => l.qty > 0);
  if (!items.length) fail('The order is empty.');
  const out = items.filter((l) => !DISH[l.dish] || s.soldOut[l.dish]).map((l) => l.dish);
  if (out.length) fail(`Sorry, ${out.map((d) => DISH[d]?.name ?? d).join(', ')} just sold out.`, { out });
  const o = {
    id: nextId(s, 'O'), tab: tabId, table: t.table, by, at: now, status: staff ? 'accepted' : 'pending', acceptedAt: staff ? now : null,
    items: items.map((l) => ({ dish: l.dish, qty: l.qty, note: String(l.note || '').trim().slice(0, 80), price: DISH[l.dish].price, k: 'new', kAt: now })),
  };
  s.orders.push(o);
  return o;
}

const order = (s, id) => s.orders.find((o) => o.id === id) ?? fail('Order not found.');

export function acceptOrder(s, id, now) {
  const o = order(s, id);
  if (o.status !== 'pending') fail('This order was already handled.');
  o.status = 'accepted';
  o.acceptedAt = now;
  o.items.forEach((i) => { i.kAt = now; });
}

export function rejectOrder(s, id) {
  const o = order(s, id);
  if (o.status !== 'pending') fail('This order was already handled.');
  o.status = 'rejected';
}

// Kitchen and server move one item along: new -> cooking -> ready -> served.
export function advance(s, id, idx, now) {
  const o = order(s, id);
  const i = o.items[idx];
  if (o.status !== 'accepted' || !i || !NEXT[i.k]) fail('This item can’t move on.');
  i.k = NEXT[i.k];
  i.kAt = now;
}

export const setSoldOut = (s, dish, on) => { if (on) s.soldOut[dish] = true; else delete s.soldOut[dish]; };

// One open call per tab: tapping again doesn't stack calls.
export function callServer(s, tabId, now) {
  const t = s.tabs[tabId];
  if (!t || t.status === 'closed') fail('This tab is closed.');
  return openCall(s, tabId) ?? (s.calls.push({ id: nextId(s, 'C'), tab: tabId, table: t.table, at: now, ack: null }), s.calls.at(-1));
}

export function ackCall(s, id, now) {
  const c = s.calls.find((x) => x.id === id);
  if (c && !c.ack) c.ack = now;
}

// Guest closes the tab: no more orders, the table shows "wants to pay".
export function requestBill(s, tabId, now) {
  const t = s.tabs[tabId];
  if (!t || t.status !== 'open') fail('This tab is already closed.');
  if (ordersOf(s, tabId).some((o) => o.status === 'pending')) fail('Your last order is waiting for the server. Close the tab once it’s accepted.');
  if (!total(s, tabId)) fail('Nothing to pay yet.');
  t.status = 'paying';
  t.billAt = now;
}

export function submitSlip(s, tabId, img, now) {
  const t = s.tabs[tabId];
  if (!t || t.status !== 'paying') fail('Close the tab before paying.');
  if (t.slip?.state === 'checking') fail('A slip is already being checked.');
  t.slip = { img, at: now, state: 'checking' };
}

function settle(s, t, method, now) {
  t.status = 'closed';
  t.method = method;
  t.paidAt = now;
  t.total = total(s, t.id);
  s.calls.filter((c) => c.tab === t.id && !c.ack).forEach((c) => { c.ack = now; });
}

export function approveSlip(s, tabId, now) {
  const t = s.tabs[tabId];
  if (t?.slip?.state !== 'checking') fail('No slip to approve.');
  t.slip.state = 'ok';
  settle(s, t, 'transfer', now);
}

export function rejectSlip(s, tabId) {
  const t = s.tabs[tabId];
  if (t?.slip?.state !== 'checking') fail('No slip to reject.');
  t.slip.state = 'rejected';
}

// For guests without data: the server takes cash and closes the tab.
export function payCash(s, tabId, now) {
  const t = s.tabs[tabId];
  if (!t || t.status === 'closed') fail('This tab is already closed.');
  if (ordersOf(s, tabId).some((o) => o.status === 'pending')) fail('Accept or reject the waiting order first.');
  settle(s, t, 'cash', now);
}

// One status per table for the floor view, most urgent first, with when that status started.
export const STATES = {
  call: 'Calling', pay: 'Wants to pay', new: 'New order', ready: 'Food ready', waiting: 'Waiting', seated: 'Seated', free: 'Free',
};
export function tableState(s, table) {
  const t = tabAt(s, table);
  if (!t) return { state: 'free' };
  const call = openCall(s, t.id);
  if (call) return { state: 'call', since: call.at, t };
  if (t.status === 'paying') return { state: 'pay', since: t.slip?.at ?? t.billAt, t };
  const os = ordersOf(s, t.id);
  const pending = os.filter((o) => o.status === 'pending');
  if (pending.length) return { state: 'new', since: Math.min(...pending.map((o) => o.at)), t };
  const live = os.filter((o) => o.status === 'accepted');
  const ready = live.flatMap((o) => o.items).filter((i) => i.k === 'ready');
  if (ready.length) return { state: 'ready', since: Math.min(...ready.map((i) => i.kAt)), t };
  const cooking = live.filter((o) => o.items.some((i) => i.k === 'new' || i.k === 'cooking'));
  if (cooking.length) return { state: 'waiting', since: Math.min(...cooking.map((o) => o.acceptedAt)), t };
  return { state: 'seated', since: t.at, t };
}

// A busy lunchtime floor, so the demo looks alive the moment it opens.
export function seed(now) {
  const s = blank();
  const ago = (m) => now - m * 60e3;
  const run = (table, guests, at, orders) => {
    const t = openTab(s, table, guests[0], ago(at));
    guests.slice(1).forEach((g) => t.guests.push(g));
    for (const [by, m, lines, moves = []] of orders) {
      const o = placeOrder(s, t.id, by, lines.map(([dish, qty, note]) => ({ dish, qty, note })), ago(m), by === 'Server');
      if (o.status === 'pending' && moves.length) acceptOrder(s, o.id, ago(m - 1));
      moves.forEach(([idx, steps, mAgo]) => { for (let k = 0; k < steps; k++) advance(s, o.id, idx, ago(mAgo)); });
    }
    return t;
  };
  run(2, ['Aisha', 'Nimal'], 26, [['Aisha', 24, [['kothu', 2, 'extra spicy'], ['limejuice', 2, 'less sugar']], [[0, 1, 9], [1, 3, 15]]]]);
  run(3, ['Ibrahim'], 3, [['Ibrahim', 2, [['mashuni', 1], ['tea', 2]]]]);
  run(5, ['Lena', 'Tom'], 31, [['Lena', 28, [['catch', 1, 'no chili'], ['kurumba', 2]], [[0, 2, 3], [1, 3, 22]]]]);
  run(6, ['Hassan', 'Mariyam', 'Shifa'], 48, [
    ['Hassan', 45, [['tunacurry', 2], ['tea', 3]], [[0, 3, 30], [1, 3, 38]]],
    ['Shifa', 20, [['hedhikaa', 1]], [[0, 3, 8]]],
  ]);
  const t7 = run(7, ['Ahmed'], 55, [['Server', 52, [['chickencurry', 1], ['soda', 1]], [[0, 3, 35], [1, 3, 48]]]]);
  requestBill(s, t7.id, ago(4));
  submitSlip(s, t7.id, demoSlip(total(s, t7.id), ref(t7)), ago(1.5));
  const t8 = run(8, ['Sara'], 12, [['Sara', 10, [['garudhiya', 1]], [[0, 1, 4]]]]);
  callServer(s, t8.id, ago(0.7));
  const t4 = run(4, ['Ali'], 95, [['Ali', 92, [['catch', 1], ['limejuice', 1]], [[0, 3, 70], [1, 3, 85]]]]);
  requestBill(s, t4.id, ago(62));
  payCash(s, t4.id, ago(60));
  return s;
}
