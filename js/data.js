// Demo data. The café, bank account and people are fictional.

export const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Where guests send their transfer.
export const BANK = { bank: 'Bank of Maldives', name: 'KANDU CAFE PVT LTD', acc: '7730000123456' };

export const DISHES = [
  { id: 'mashuni', name: 'Mas Huni & Roshi', dv: 'The island breakfast', desc: 'Tuna, fresh coconut, onion and lime with warm roshi.', cat: 'breakfast', price: 55, emoji: '🥥', hue: 38 },
  { id: 'catch', name: 'Catch of the Day', dv: 'Fihunu mas', desc: 'Reef fish grilled over coconut husk, rice, lime and chili.', cat: 'mains', price: 145, emoji: '🐟', hue: 188 },
  { id: 'garudhiya', name: 'Garudhiya', dv: 'Clear tuna broth', desc: 'Slow tuna broth with rice, lime, onion and chili.', cat: 'mains', price: 75, emoji: '🍲', hue: 22 },
  { id: 'tunacurry', name: 'Mas Riha', dv: 'Tuna curry', desc: 'Tuna simmered in coconut milk and roasted spices, with rice.', cat: 'mains', price: 85, emoji: '🍛', hue: 28 },
  { id: 'chickencurry', name: 'Kukulhu Riha', dv: 'Chicken curry', desc: 'Island chicken curry, rich with coconut milk, with rice.', cat: 'mains', price: 95, emoji: '🍗', hue: 14 },
  { id: 'kothu', name: 'Kothu Roshi', dv: 'Chopped roshi, chicken, egg', desc: 'Roshi chopped on the hot plate with chicken, egg and vegetables.', cat: 'mains', price: 65, emoji: '🥘', hue: 8 },
  { id: 'friedrice', name: 'Tuna Fried Rice', dv: 'Mas baiy', desc: 'Wok-fried rice with tuna, egg and vegetables.', cat: 'mains', price: 48, emoji: '🍚', hue: 48 },
  { id: 'hedhikaa', name: 'Hedhikaa Plate', dv: 'Short eats · 6 pieces', desc: 'Gulha, bajiya, kavaabu and masroshi, fried fresh.', cat: 'shorteats', price: 45, emoji: '🥟', hue: 32 },
  { id: 'kurumba', name: 'Fresh Coconut', dv: 'Kurumba', desc: 'Young coconut, opened to order.', cat: 'drinks', price: 40, emoji: '🌴', hue: 150 },
  { id: 'limejuice', name: 'Lime Juice', dv: 'Lumbo fani', desc: 'Island limes pressed over ice.', cat: 'drinks', price: 25, emoji: '🍋', hue: 80 },
  { id: 'tea', name: 'Kalhu Sai', dv: 'Black tea', desc: 'Strong, sweet island tea.', cat: 'drinks', price: 12, emoji: '☕', hue: 18 },
  { id: 'soda', name: 'Soft Drink', dv: 'Chilled can', desc: 'Ask for what’s cold.', cat: 'drinks', price: 20, emoji: '🥤', hue: 350 },
];
export const DISH = Object.fromEntries(DISHES.map((d) => [d.id, d]));
export const CATS = [['all', 'All'], ['breakfast', 'Breakfast'], ['mains', 'Mains'], ['shorteats', 'Short eats'], ['drinks', 'Drinks']];

// A clearly fake slip image, so the payment step can be shown without a real photo.
export function demoSlip(amount, ref) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect width="300" height="420" fill="#fff"/><rect width="300" height="70" fill="#c8102e"/>
<text x="150" y="44" font-family="sans-serif" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">Transfer successful</text>
<text x="150" y="130" font-family="sans-serif" font-size="34" font-weight="700" fill="#111" text-anchor="middle">MVR ${amount.toFixed(2)}</text>
<g font-family="sans-serif" font-size="14" fill="#555"><text x="24" y="190">To</text><text x="24" y="240">Account</text><text x="24" y="290">Remarks</text><text x="24" y="340">Date</text></g>
<g font-family="sans-serif" font-size="15" fill="#111" text-anchor="end"><text x="276" y="190">${BANK.name}</text><text x="276" y="240">${BANK.acc}</text><text x="276" y="290">${ref}</text><text x="276" y="340">${new Date().toLocaleString('en-GB')}</text></g>
<text x="150" y="395" font-family="sans-serif" font-size="12" font-weight="700" fill="#c8102e" text-anchor="middle" letter-spacing="1">DEMO SLIP · NOT A REAL PAYMENT</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
