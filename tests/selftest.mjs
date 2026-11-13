// Run: node tests/selftest.mjs — drives the whole table flow through logic.js.
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';

const now = Date.now();
const s = L.blank();
const err = (fn, re) => assert.throws(fn, re);

// open, join with a PIN, no double tab, wrong PIN refused
const t = L.openTab(s, 1, 'Aisha', now);
assert.match(t.pin, /^\d{4}$/);
err(() => L.openTab(s, 1, 'Bob', now), /already has a tab/);
err(() => L.joinTab(s, 1, t.pin === '1111' ? '2222' : '1111', 'Bob'), /PIN/);
L.joinTab(s, 1, t.pin, 'Bob');
assert.deepEqual(t.guests, ['Aisha', 'Bob']);
assert.equal(L.tableState(s, 1).state, 'seated');

// guest order waits for the server; sold-out dishes are refused
L.setSoldOut(s, 'tea', true);
err(() => L.placeOrder(s, t.id, 'Bob', [{ dish: 'tea', qty: 1 }], now), (e) => e.out?.[0] === 'tea');
const o = L.placeOrder(s, t.id, 'Bob', [{ dish: 'kothu', qty: 2, note: ' extra spicy ' }, { dish: 'soda', qty: 0 }], now);
assert.equal(o.status, 'pending');
assert.equal(o.items.length, 1, 'zero-qty lines dropped');
assert.equal(o.items[0].note, 'extra spicy');
assert.equal(L.total(s, t.id), 0, 'pending orders are not on the bill');
assert.equal(L.tableState(s, 1).state, 'new');
err(() => L.requestBill(s, t.id, now), /waiting for the server/);

// accept -> kitchen board -> ready -> served
L.acceptOrder(s, o.id, now);
assert.equal(L.total(s, t.id), 130);
assert.equal(L.tableState(s, 1).state, 'waiting');
L.advance(s, o.id, 0, now);
L.advance(s, o.id, 0, now);
assert.equal(L.tableState(s, 1).state, 'ready');
L.advance(s, o.id, 0, now);
err(() => L.advance(s, o.id, 0, now), /can’t move/);
assert.equal(L.tableState(s, 1).state, 'seated');

// a call outranks everything, and doesn't stack
const c = L.callServer(s, t.id, now);
assert.equal(L.callServer(s, t.id, now), c);
assert.equal(L.tableState(s, 1).state, 'call');
L.ackCall(s, c.id, now);

// server orders skip the accept step
const so = L.placeOrder(s, t.id, 'Server', [{ dish: 'limejuice', qty: 1 }], now, true);
assert.equal(so.status, 'accepted');
assert.equal(L.total(s, t.id), 155);

// close tab -> pay -> slip rejected -> slip approved -> table free
L.requestBill(s, t.id, now);
assert.equal(L.tableState(s, 1).state, 'pay');
err(() => L.placeOrder(s, t.id, 'Bob', [{ dish: 'kothu', qty: 1 }], now), /closed/);
err(() => L.joinTab(s, 1, t.pin, 'Late'), /settling/);
L.submitSlip(s, t.id, 'img', now);
err(() => L.submitSlip(s, t.id, 'img', now), /already/);
L.rejectSlip(s, t.id);
L.submitSlip(s, t.id, 'img2', now);
L.approveSlip(s, t.id, now);
assert.equal(t.status, 'closed');
assert.equal(t.total, 155);
assert.equal(L.tableState(s, 1).state, 'free');
L.openTab(s, 1, 'Next', now); // the table can be used again

// cash for guests without data
const t2 = L.openTab(s, 2, 'Server', now);
L.placeOrder(s, t2.id, 'Server', [{ dish: 'soda', qty: 1 }], now, true);
L.payCash(s, t2.id, now);
assert.equal(t2.total, 20);

// the demo floor shows every state
const d = L.seed(now);
const st = Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map((n) => [n, L.tableState(d, n).state]));
assert.deepEqual(st, { 2: 'waiting', 3: 'new', 4: 'free', 5: 'ready', 6: 'seated', 7: 'pay', 8: 'call' });

console.log('selftest ok');
