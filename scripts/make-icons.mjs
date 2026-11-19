// Génère les icônes PNG de la PWA sans dépendance (zlib natif de Node).
// Motif : 4 cercles de métronome, le premier accentué (ambre), sur fond sombre.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [14, 17, 22];
const ACCENT = [255, 179, 64];
const DIM = [92, 200, 255];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, maskable) {
  const px = Buffer.alloc(size * (size * 3 + 1));
  const safe = maskable ? 0.62 : 0.86; // zone utile (les icônes « maskable » sont rognées)
  const circles = [0, 1, 2, 3].map((i) => ({
    x: size / 2 + (i - 1.5) * size * safe * 0.25,
    y: size / 2,
    r: size * safe * (i === 0 ? 0.11 : 0.075),
    col: i === 0 ? ACCENT : DIM,
    ring: i !== 0,
  }));
  for (let y = 0; y < size; y++) {
    px[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let col = BG;
      // coins arrondis pour l'icône normale
      const rr = size * 0.18;
      const cx = Math.min(Math.max(x, rr), size - rr);
      const cy = Math.min(Math.max(y, rr), size - rr);
      const outside = !maskable && Math.hypot(x - cx, y - cy) > rr;
      for (const c of circles) {
        const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
        if (c.ring ? d <= c.r && d >= c.r * 0.55 : d <= c.r) col = c.col;
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      const v = outside ? [0, 0, 0] : col;
      px[o] = v[0];
      px[o + 1] = v[1];
      px[o + 2] = v[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, false));
writeFileSync('public/icons/icon-512.png', png(512, false));
writeFileSync('public/icons/icon-maskable-512.png', png(512, true));
writeFileSync(
  'public/icons/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#0e1116"/><circle cx="18" cy="50" r="9.5" fill="#ffb340"/><circle cx="39.5" cy="50" r="5" fill="none" stroke="#5cc8ff" stroke-width="3"/><circle cx="61" cy="50" r="5" fill="none" stroke="#5cc8ff" stroke-width="3"/><circle cx="82.5" cy="50" r="5" fill="none" stroke="#5cc8ff" stroke-width="3"/></svg>\n`,
);
console.log('icônes générées');
