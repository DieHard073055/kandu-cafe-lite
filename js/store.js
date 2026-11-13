// State lives in localStorage; the `storage` event keeps other windows of the same browser in sync.
// shortcut: one browser only. Phones on different devices need a real backend (e.g. Supabase realtime) to share state.
import { seed } from './logic.js';

const KEY = 'kandu.lite.v1';
let state;
let last = '';
const dayKey = () => new Date().toDateString();

export const S = () => state;

export function reset() {
  state = seed(Date.now());
  state.day = dayKey();
  save();
}
export function load() {
  try { state = JSON.parse((last = localStorage.getItem(KEY) || '')); } catch { state = null; }
  // A demo left open overnight starts fresh, so the timers always make sense.
  if (!state || state.v !== 1 || state.day !== dayKey()) reset();
}
export function save() {
  const json = JSON.stringify(state);
  if (json === last) return;
  last = json;
  try { localStorage.setItem(KEY, json); } catch { /* private mode or full: keep working in memory */ }
}
export function onRemote(fn) {
  addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = JSON.parse((last = e.newValue)); fn(); } catch { /* ignore a corrupt write */ }
  });
}
