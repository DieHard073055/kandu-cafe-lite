// Shell: role switcher, routing, rendering, events, live timers, ringing and chimes.
import { S, load, save, reset, onRemote } from './store.js';
import { ui, ACT, SHEETS, toast, open, shut, setMe, dur, esc, icon } from './ui.js';
import { guestView, slipFile } from './guest.js';
import { serverView, ring, pendingOrders, slipsToCheck } from './server.js';
import { kitchenView, kitchenItems } from './kitchen.js';
import { managerView } from './manager.js';

const ROLES = [['guest', 'Guest', guestView, 'phone'], ['server', 'Server', serverView, 'bell'], ['kitchen', 'Kitchen', kitchenView, 'chef'], ['manager', 'Manager', managerView, 'grid']];
const VIEW = Object.fromEntries(ROLES.map(([k, , v]) => [k, v]));
const app = document.getElementById('app');
const shell = document.getElementById('shell');

// #guest, #guest/5 (what a table's QR code opens), #server, #kitchen, #manager
function route() {
  const [role, table] = location.hash.slice(1).split('/');
  ui.role = VIEW[role] ? role : 'guest';
  if (ui.role === 'guest' && table) ui.table = Number(table);
  if (ui.role === 'guest' && !table && !ui.me) ui.table = null;
  shut();
  wake();
}

// Red dots on the role tabs, so a single-device demo still shows who needs attention.
const badges = (s) => ({ server: ring(s).length + pendingOrders(s).length, kitchen: kitchenItems(s).filter((x) => x.i.k === 'new').length, manager: slipsToCheck(s).length });

function render() {
  const s = S();
  const now = Date.now();
  const view = app.querySelector('.view');
  const keep = view?.dataset.role === ui.role ? view.scrollTop : 0;
  const sheet = ui.sheet && SHEETS[ui.sheet]?.(s, now);
  const b = badges(s);
  shell.className = `shell ${ui.role === 'kitchen' || ui.role === 'manager' ? 'wide' : ''}`;
  shell.dataset.theme = theme;
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(shell).getPropertyValue('--chrome').trim();
  app.innerHTML = `<header class="top">
      <span class="brand"><span class="mark" aria-hidden="true">K</span><span class="wordmark">Kandu Café <em>Lite</em></span></span>
      <nav class="seg" aria-label="Switch role">${ROLES.map(([k, n, , ic]) => `<a href="#${k}" class="${ui.role === k ? 'on' : ''}" ${ui.role === k ? 'aria-current="page"' : ''}>${icon(ic)}<span>${n}</span>${b[k] ? `<i class="dot">${b[k]}</i>` : ''}</a>`).join('')}</nav>
      <button class="iconbtn" data-act="demo" aria-label="Demo menu">${icon('more')}</button>
    </header>
    <main class="view" data-role="${ui.role}">${VIEW[ui.role](s, now)}</main>
    ${sheet ? `<div class="scrim" data-act="close"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(sheet.title)}">
      <div class="grip" aria-hidden="true"></div><div class="sheet-h"><h2 class="h">${esc(sheet.title)}</h2><button class="iconbtn" data-act="close" aria-label="Close">${icon('x')}</button></div>
      <div class="sheet-body">${sheet.body}</div>${sheet.foot ? `<div class="sheet-foot">${sheet.foot}</div>` : ''}</section>` : ''}`;
  app.querySelector('.view').scrollTop = keep;
  tick();
  chime(s, b);
}

// A change from another window shouldn't wipe what someone is typing; render once they leave the field.
let deferred = false;
const typing = () => document.activeElement?.matches('input:not([type=file]), textarea');
function softRender() { if (typing()) deferred = true; else render(); }
document.addEventListener('focusout', () => setTimeout(() => { if (deferred && !typing()) { deferred = false; render(); } }, 0));

function commit() { save(); render(); }

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  try {
    if (fn(el.dataset.arg, el) !== false) commit();
  } catch (err) {
    toast(err.message, '', 'warn');
    commit(); // the action may have tidied state (e.g. dropped a sold-out cart line) before refusing
  }
});
app.addEventListener('input', (e) => { const k = e.target.dataset.bind; if (k) ui.f[k] = e.target.value; });
app.addEventListener('change', async (e) => {
  if (e.target.dataset.file !== 'slip' || !e.target.files[0]) return;
  try { await slipFile(e.target.files[0]); } catch (err) { toast(err.message || 'Couldn’t read that image', 'Try a screenshot instead.', 'warn'); }
  commit();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet) { shut(); render(); } });
addEventListener('hashchange', () => { route(); render(); });

ACT.close = () => shut();
ACT.demo = () => open('demo');
ACT.reset = () => { reset(); setMe(null); ui.table = null; ui.srv = null; ui.carts = { g: [], s: [] }; shut(); toast('Demo reset', 'Back to a busy lunchtime floor.'); };
// Theme: a per-browser preference, so each demo device can keep its own look.
const THEMES = [['ember', 'Ember', ['--ember', '--tofu', '--matcha']], ['yolk', 'Yolk', ['--matcha', '--cream', '--yolk']], ['matcha', 'Matcha', ['--matcha', '--yolk', '--cream']],
  ['emerald', 'Emerald', ['--emerald', '--lilac', '--volt']], ['gunmetal', 'Gunmetal', ['--gunmetal', '--fog', '--molten']], ['butter', 'Butter', ['--butter', '--cocoa', '--eblue']]];
let theme = 'ember';
try { theme = localStorage.getItem('kandu.lite.theme') || theme; } catch { /* storage blocked */ }
if (!THEMES.some(([k]) => k === theme)) theme = 'ember';
ACT.theme = (k) => { theme = k; try { localStorage.setItem('kandu.lite.theme', k); } catch { /* storage blocked */ } };
ACT.newguest = () => { setMe(null); ui.carts.g = []; ui.f = {}; shut(); toast('New guest phone', 'Scan the same table and join with the PIN.'); };
SHEETS.demo = () => ({
  title: 'Demo & theme',
  body: `<p class="sec-t">Theme</p><div class="themes">${THEMES.map(([k, n, cs]) => `<button class="swatch" data-act="theme" data-arg="${k}" aria-pressed="${theme === k}"><span>${cs.map((c) => `<i style="background:var(${c})"></i>`).join('')}</span>${n}</button>`).join('')}</div>
    <p class="sec-t">How to demo</p><ol class="steps">
      <li>Open this page in <b>two windows side by side</b>: one as Guest, one as Server or Manager. They update live.</li>
      <li><b>Guest</b>: scan a free table, start a tab, order, call the server, then close the tab and pay with a demo slip.</li>
      <li><b>Friend arriving late</b>: tap “New guest phone” below, scan the same table and join with the PIN.</li>
      <li><b>Server</b>: rings on calls, accepts orders, serves, takes orders for guests without data, checks slips.</li>
      <li><b>Kitchen</b>: move tickets along, tap a dish to mark it sold out.</li>
      <li><b>Manager</b>: the whole floor at a glance. Tap any table.</li></ol>
    <p class="hint">Demo only: everything is stored in this browser. Real phones on different networks would share one live backend. Food photos are AI-generated for the demo.</p>`,
  foot: `${ui.role === 'guest' ? '<button class="btn ghost" data-act="newguest">New guest phone</button>' : ''}<button class="btn grow" data-act="reset">Reset demo floor</button>`,
});

// ---- live timers, every second ----
function tick() {
  const now = Date.now();
  app.querySelectorAll('[data-since]').forEach((el) => {
    const sec = (now - Number(el.dataset.since)) / 1000;
    el.textContent = dur(sec * 1000);
    el.classList.toggle('warn', sec >= Number(el.dataset.warn) && sec < Number(el.dataset.crit));
    el.classList.toggle('crit', sec >= Number(el.dataset.crit));
  });
  app.querySelectorAll('[data-due]').forEach((el) => {
    const left = Number(el.dataset.due) - now;
    el.textContent = left > 0 ? `${dur(left)} left` : `overdue ${dur(-left)}`;
    el.classList.toggle('crit', left <= 60e3);
  });
}

// ---- sound: the server's phone rings while any table is calling; new work chimes ----
let ac;
const audio = () => { try { ac ??= new AudioContext(); if (ac.state === 'suspended') ac.resume(); } catch { /* no audio */ } return ac; };
addEventListener('pointerdown', audio, { capture: true }); // browsers only allow sound after a tap
function tone(freq, at, len, vol = 0.18) {
  const a = audio();
  if (!a || a.state !== 'running') return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + at + len);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + len);
}
let lastRing = 0;
function ringLoop() {
  if (ui.role !== 'server' || !ring(S()).length || Date.now() - lastRing < 2600) return;
  lastRing = Date.now();
  for (let k = 0; k < 6; k++) tone(k % 2 ? 1100 : 880, k * 0.12, 0.11, 0.22);
  navigator.vibrate?.([300, 120, 300]);
}
let prev = null;
function chime(s, b) {
  if (prev && b[ui.role] > prev[ui.role] && ui.role !== 'manager') { tone(660, 0, 0.18); tone(990, 0.16, 0.3); }
  prev = b;
}

// Staff screens stay awake on the counter.
let lock = null;
async function wake() {
  if (ui.role === 'guest') { lock?.release().catch(() => {}); lock = null; return; }
  if (lock || document.visibilityState !== 'visible') return;
  try { lock = await navigator.wakeLock?.request('screen'); lock?.addEventListener('release', () => { lock = null; }); } catch { /* not allowed here */ }
}
document.addEventListener('visibilitychange', wake);

load();
route();
render();
onRemote(softRender);
setInterval(() => { tick(); ringLoop(); }, 1000);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
