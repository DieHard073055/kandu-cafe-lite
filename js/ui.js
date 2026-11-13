// Shared UI helpers: per-window view state, action registry, icons, sheets, toasts, timers.
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
export const money = (n) => `MVR ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const open = (sheet, arg = null) => { ui.sheet = sheet; ui.arg = arg; };
export const shut = () => { ui.sheet = null; ui.arg = null; };
export const field = (k) => esc(ui.f[k] ?? '');

// One line-icon set for the whole app (24px grid, 1.75 stroke).
const ICONS = {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  dish: '<path d="M3 18h18M4.5 18a7.5 7.5 0 0 1 15 0M12 10.5V8M10 8h4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  chef: '<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 9.18 0A4 4 0 0 1 18 13.87V21H6z"/><path d="M6 17h12"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  table: '<path d="M3 9h18M5 9v11M19 9v11M3 9l2-5h14l2 5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  pin: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
export const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

// Live timers: app.js rewrites these every second without a full render.
export const dur = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 600 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}m`;
};
export const since = (t, warn = 600, crit = 900) => `<span class="tm" data-since="${t}" data-warn="${warn}" data-crit="${crit}"></span>`;
export const due = (t) => `<span class="tm" data-due="${t}"></span>`;

export function toast(title, text = '', kind = 'ok') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<i>${icon(kind === 'warn' ? 'alert' : 'check')}</i><div><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>`;
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { el.classList.add('bye'); setTimeout(() => el.remove(), 400); }, 4200);
}

export function copy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Copied to clipboard', text), () => toast('Copy this', text));
}

// ---- menu + cart, shared by the guest (cart 'g') and the server ordering for a table (cart 's') ----
export const dishTile = (d, cls = '') => `<span class="dish-ic ${cls}" style="--h:${d.hue}" aria-hidden="true">${d.emoji}</span>`;
export const cartTotal = (cart) => cart.reduce((a, l) => a + l.qty * DISH[l.dish].price, 0);
export const cartCount = (cart) => cart.reduce((a, l) => a + l.qty, 0);

export function menuHtml(s, ctx) {
  const cart = ui.carts[ctx];
  const list = DISHES.filter((d) => !s.soldOut[d.id] && (ui.cat === 'all' || d.cat === ui.cat));
  const hidden = DISHES.filter((d) => s.soldOut[d.id]).length;
  return `<div class="cats" role="tablist">${CATS.map(([id, n]) => `<button role="tab" aria-selected="${ui.cat === id}" class="${ui.cat === id ? 'on' : ''}" data-act="cat" data-arg="${id}">${n}</button>`).join('')}</div>
  <div class="dishes">${list.map((d) => {
    const n = cart.filter((l) => l.dish === d.id).reduce((a, l) => a + l.qty, 0);
    return `<button class="dish ${n ? 'in' : ''}" data-act="dish" data-arg="${d.id}">${dishTile(d)}
      <span class="dish-tx"><b>${esc(d.name)}</b><small>${esc(d.desc)}</small><em>${money(d.price)}</em></span>
      <span class="plus" aria-label="${n ? `${n} in order` : 'Add'}">${n ? `<i>${n}</i>` : icon('plus')}</span></button>`;
  }).join('') || '<p class="empty">Nothing here right now.</p>'}</div>
  ${hidden ? `<p class="hint center">${icon('info')} ${hidden} item${hidden > 1 ? 's are' : ' is'} unavailable today.</p>` : ''}`;
}

export function cartBar(ctx, label) {
  const cart = ui.carts[ctx];
  if (!cart.length) return '';
  return `<button class="cartbar" data-act="cart" data-arg="${ctx}"><span class="badge">${cartCount(cart)}</span><b>${label}</b><span class="amt">${money(cartTotal(cart))}</span></button>`;
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

const stepper = (act, arg, n, sm = '') => `<span class="stepper ${sm}"><button data-act="${act}" data-arg="${arg}-1" aria-label="One less">${icon('minus')}</button><b>${n}</b><button data-act="${act}" data-arg="${arg}1" aria-label="One more">${icon('plus')}</button></span>`;

SHEETS.dish = () => {
  const d = DISH[ui.arg];
  const ctx = ui.role === 'server' ? 's' : 'g';
  return {
    title: d.name,
    body: `<div class="dish-hero">${dishTile(d, 'xl')}<div><p class="dv">${esc(d.dv)}</p><p class="desc">${esc(d.desc)}</p><p class="price">${money(d.price)}</p></div></div>
      <label class="lbl" for="note">${icon('pen')} Note for the kitchen <span>Optional</span></label>
      <input id="note" data-bind="note" maxlength="80" placeholder="e.g. no chili, less sugar" value="${field('note')}">`,
    foot: `${stepper('qty', '', ui.f.qty)}<button class="btn grow" data-act="add" data-arg="${ctx}">Add to order · ${money(ui.f.qty * d.price)}</button>`,
  };
};

SHEETS.cart = (s) => {
  const ctx = ui.arg;
  const cart = ui.carts[ctx];
  return {
    title: ctx === 's' ? `Order for Table ${s.tabs[ui.srv]?.table}` : 'Review your order',
    body: `<ul class="lines">${cart.map((l, i) => {
      const d = DISH[l.dish];
      return `<li class="${s.soldOut[l.dish] ? 'out' : ''}">${dishTile(d, 'sm')}<span class="grow"><b>${esc(d.name)}</b>
        ${l.note ? `<small class="note">${icon('pen')} ${esc(l.note)}</small>` : ''}${s.soldOut[l.dish] ? '<small class="bad">Unavailable — will be removed</small>' : `<small>${money(d.price * l.qty)}</small>`}</span>
        ${stepper('line', `${ctx}:${i}:`, l.qty, 'sm')}</li>`;
    }).join('')}</ul>
    <div class="sum"><span>Subtotal</span><b>${money(cartTotal(cart))}</b></div>
    <p class="hint">${icon('info')} ${ctx === 'g' ? 'Your server confirms the order, then it goes straight to the kitchen.' : 'Orders you place skip the confirm step and go straight to the kitchen.'}</p>`,
    foot: `<button class="btn grow lg" data-act="place" data-arg="${ctx}">${ctx === 's' ? 'Send to kitchen' : 'Place order'}${icon('right')}</button>`,
  };
};
