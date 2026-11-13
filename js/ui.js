// Shared UI helpers: per-window view state, action registry, sheets, toasts, timers.
import { DISH, DISHES, CATS } from './data.js';

// role: which hat this window wears. me: the guest's seat on a tab (per window, so a second window can be the friend).
export const ui = { role: 'guest', table: null, me: null, gtab: 'menu', cat: 'all', carts: { g: [], s: [] }, sheet: null, arg: null, srv: null, f: {} };
export const ACT = {}; // click handlers: ACT.name(arg, el). Return false to skip the re-render.
export const SHEETS = {}; // bottom sheets: SHEETS.name(state, now) -> { title, body, foot }

const ME = 'kandu.lite.me';
try { ui.me = JSON.parse(sessionStorage.getItem(ME)); } catch { /* none yet */ }
export function setMe(me) {
  ui.me = me;
  try { me ? sessionStorage.setItem(ME, JSON.stringify(me)) : sessionStorage.removeItem(ME); } catch { /* private mode */ }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const money = (n) => `MVR ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
export const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const open = (sheet, arg = null) => { ui.sheet = sheet; ui.arg = arg; };
export const shut = () => { ui.sheet = null; ui.arg = null; };
export const field = (k) => esc(ui.f[k] ?? '');

// Live timers: app.js rewrites these every second without a full render.
export const dur = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 600 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)} min`;
};
export const since = (t, warn = 600, crit = 900) => `<span class="tm" data-since="${t}" data-warn="${warn}" data-crit="${crit}"></span>`;
export const due = (t) => `<span class="tm" data-due="${t}"></span>`;

export function toast(title, text = '', kind = 'ok') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<i>${kind === 'warn' ? '!' : '✓'}</i><div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { el.classList.add('bye'); setTimeout(() => el.remove(), 400); }, 4200);
}

export function copy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Copied', text), () => toast('Copy this', text));
}

// ---- menu + cart, shared by the guest (cart 'g') and the server ordering for a table (cart 's') ----
export const dishTile = (d) => `<span class="dish-ic" style="--h:${d.hue}">${d.emoji}</span>`;
export const cartTotal = (cart) => cart.reduce((a, l) => a + l.qty * DISH[l.dish].price, 0);
export const cartCount = (cart) => cart.reduce((a, l) => a + l.qty, 0);

export function menuHtml(s, ctx) {
  const cart = ui.carts[ctx];
  const list = DISHES.filter((d) => !s.soldOut[d.id] && (ui.cat === 'all' || d.cat === ui.cat));
  const hidden = DISHES.filter((d) => s.soldOut[d.id]).length;
  return `<div class="cats">${CATS.map(([id, n]) => `<button class="${ui.cat === id ? 'on' : ''}" data-act="cat" data-arg="${id}">${n}</button>`).join('')}</div>
  <div class="dishes">${list.map((d) => {
    const n = cart.filter((l) => l.dish === d.id).reduce((a, l) => a + l.qty, 0);
    return `<button class="dish" data-act="dish" data-arg="${d.id}">${dishTile(d)}
      <span class="grow"><b>${esc(d.name)}</b><small>${esc(d.dv)}</small><em>${money(d.price)}</em></span>
      <span class="plus">${n ? `<i>${n}</i>` : '+'}</span></button>`;
  }).join('') || '<p class="empty">Nothing here right now.</p>'}</div>
  ${hidden ? `<p class="hint center">${hidden} item${hidden > 1 ? 's are' : ' is'} sold out today.</p>` : ''}`;
}

export function cartBar(ctx, label) {
  const cart = ui.carts[ctx];
  if (!cart.length) return '';
  return `<button class="cartbar" data-act="cart" data-arg="${ctx}"><span class="badge">${cartCount(cart)}</span><b>${label}</b><span>${money(cartTotal(cart))}</span></button>`;
}

ACT.cat = (c) => { ui.cat = c; };
ACT.dish = (id) => { ui.f.qty = 1; ui.f.note = ''; open('dish', id); };
ACT.qty = (d) => { ui.f.qty = Math.max(1, Math.min(20, (ui.f.qty || 1) + Number(d))); };
ACT.add = (ctx) => {
  const cart = ui.carts[ctx];
  const note = (ui.f.note || '').trim();
  const line = cart.find((l) => l.dish === ui.arg && l.note === note);
  if (line) line.qty += ui.f.qty; else cart.push({ dish: ui.arg, qty: ui.f.qty, note });
  shut();
};
ACT.line = (a) => {
  const [ctx, i, d] = a.split(':');
  const cart = ui.carts[ctx];
  cart[i].qty += Number(d);
  if (cart[i].qty <= 0) cart.splice(i, 1);
  if (!cart.length) shut();
};
ACT.cart = (ctx) => open('cart', ctx);

SHEETS.dish = () => {
  const d = DISH[ui.arg];
  const ctx = ui.role === 'server' ? 's' : 'g';
  return {
    title: d.name,
    body: `<div class="dish-hero">${dishTile(d)}<div><small>${esc(d.dv)}</small><p>${esc(d.desc)}</p><b>${money(d.price)}</b></div></div>
      <label class="lbl" for="note">Note for the kitchen</label>
      <input id="note" data-bind="note" maxlength="80" placeholder="e.g. no chili, less sugar" value="${field('note')}">`,
    foot: `<div class="stepper"><button data-act="qty" data-arg="-1" aria-label="One less">−</button><b>${ui.f.qty}</b><button data-act="qty" data-arg="1" aria-label="One more">+</button></div>
      <button class="btn grow" data-act="add" data-arg="${ctx}">Add · ${money(ui.f.qty * d.price)}</button>`,
  };
};

SHEETS.cart = (s) => {
  const ctx = ui.arg;
  const cart = ui.carts[ctx];
  return {
    title: ctx === 's' ? `Order for Table ${s.tabs[ui.srv]?.table}` : 'Your order',
    body: `<ul class="lines">${cart.map((l, i) => {
      const d = DISH[l.dish];
      return `<li class="${s.soldOut[l.dish] ? 'out' : ''}">${dishTile(d)}<span class="grow"><b>${esc(d.name)}</b>
        ${l.note ? `<small class="note">“${esc(l.note)}”</small>` : ''}${s.soldOut[l.dish] ? '<small class="bad">Sold out — will be removed</small>' : `<small>${money(d.price * l.qty)}</small>`}</span>
        <span class="stepper sm"><button data-act="line" data-arg="${ctx}:${i}:-1" aria-label="One less">−</button><b>${l.qty}</b><button data-act="line" data-arg="${ctx}:${i}:1" aria-label="One more">+</button></span></li>`;
    }).join('')}</ul>
    ${ctx === 'g' ? '<p class="hint">Your server confirms the order, then it goes straight to the kitchen.</p>' : '<p class="hint">Orders you place skip the confirm step and go straight to the kitchen.</p>'}`,
    foot: `<button class="btn grow" data-act="place" data-arg="${ctx}">${ctx === 's' ? 'Send to kitchen' : 'Send order'} · ${money(cartTotal(cart))}</button>`,
  };
};
