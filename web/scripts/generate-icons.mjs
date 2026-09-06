/**
 * Generates the Theory Golf app icons from a single vector definition.
 *
 * The mark is the shield monogram reduced to its smallest legible form:
 * a heavy condensed T in cement on the near-black ground, with the
 * scarlet accent slash running behind it. The slash is knocked out
 * around the letterform so the T keeps a clear zone at 60px, which is
 * roughly how big this renders on an iPhone home screen.
 *
 * No image dependencies — PNG/ICO are written by hand so `npm i` stays
 * lean and the icons can be regenerated on any machine:
 *
 *   node scripts/generate-icons.mjs
 *
 * Outputs land in public/ and are committed. Regenerate and commit if
 * the brand colours or the geometry below change.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/* ================================================================
   BRAND
   Values mirror --background / --foreground / --primary in
   src/styles/system.css. iOS masks the icon itself, so the ground is
   drawn full-bleed and fully opaque — a transparent apple-touch-icon
   renders black on some iOS versions.
   ================================================================ */
const GROUND = [0x0c, 0x0c, 0x0c];
const CEMENT = [0xf2, 0xf0, 0xee];
const SCARLET = [0xe8, 0x20, 0x2a];

/* ================================================================
   GEOMETRY — all values are fractions of the canvas, so one
   definition serves every output size.
   ================================================================ */
const CROSSBAR = { x0: 0.31, x1: 0.69, y0: 0.24, y1: 0.35 };
const STEM = { x0: 0.434, x1: 0.566, y0: 0.24, y1: 0.75 };

// The slash is the band SLASH_MIN <= x + K*y <= SLASH_MAX. K > 1 tilts
// it shallower than 45°, which is what buys it enough room to cross the
// stem cleanly and still clear the underside of the crossbar — at 45°
// it clips the crossbar's corner and reads as a chipped edge.
const SLASH_K = 1.5;
const SLASH_MIN = 1.315;
const SLASH_MAX = 1.475;

// Clear zone held between the letterform and the slash.
const GAP = 0.026;

const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const grow = (r, g) => ({ x0: r.x0 - g, x1: r.x1 + g, y0: r.y0 - g, y1: r.y1 + g });

const CROSSBAR_GAP = grow(CROSSBAR, GAP);
const STEM_GAP = grow(STEM, GAP);

/** Colour of a single sample point in normalised [0,1] canvas space. */
function sample(x, y) {
  if (inRect(CROSSBAR, x, y) || inRect(STEM, x, y)) return CEMENT;
  if (inRect(CROSSBAR_GAP, x, y) || inRect(STEM_GAP, x, y)) return GROUND;
  const t = x + SLASH_K * y;
  if (t >= SLASH_MIN && t <= SLASH_MAX) return SCARLET;
  return GROUND;
}

/** Renders the mark to a raw RGB buffer, 4x4 supersampled for clean edges. */
function render(size) {
  const SS = 4;
  const rgb = Buffer.alloc(size * size * 3);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const c = sample((px + (i + 0.5) / SS) / size, (py + (j + 0.5) / SS) / size);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const o = (py * size + px) * 3;
      const n = SS * SS;
      rgb[o] = Math.round(r / n);
      rgb[o + 1] = Math.round(g / n);
      rgb[o + 2] = Math.round(b / n);
    }
  }
  return rgb;
}

/* ================================================================
   PNG ENCODER
   ================================================================ */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // 10..12 stay 0: deflate, adaptive filtering, no interlace.

  // One filter byte (0 = none) per scanline.
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO wrapping a PNG payload — supported everywhere that matters since Vista. */
function encodeIco(size, png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry[0] = size < 256 ? size : 0;
  entry[1] = size < 256 ? size : 0;
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32BE(0, 8);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, png]);
}

/* ================================================================
   SVG — same geometry, for the browser tab at any density.
   ================================================================ */
function encodeSvg() {
  const n = (v) => +(v * 100).toFixed(2);
  const rect = (r) =>
    `<rect x="${n(r.x0)}" y="${n(r.y0)}" width="${n(r.x1 - r.x0)}" height="${n(r.y1 - r.y0)}"/>`;

  // The band drawn as one stroked centreline: direction (K, -1), width
  // SLASH_MAX - SLASH_MIN measured along the (1, K) normal. Endpoints run
  // well past the viewBox and the clip trims them.
  const len = Math.hypot(1, SLASH_K);
  const width = (SLASH_MAX - SLASH_MIN) / len;
  const mid = (SLASH_MIN + SLASH_MAX) / 2;
  const cx = 0.5;
  const cy = (mid - cx) / SLASH_K;
  const reach = 2;
  const dx = (SLASH_K / len) * reach;
  const dy = (-1 / len) * reach;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="rgb(${GROUND})"/>
  <clipPath id="b"><rect width="100" height="100"/></clipPath>
  <line clip-path="url(#b)" x1="${n(cx - dx)}" y1="${n(cy - dy)}" x2="${n(cx + dx)}" y2="${n(
    cy + dy
  )}" stroke="rgb(${SCARLET})" stroke-width="${n(width)}"/>
  <g fill="rgb(${GROUND})">${rect(CROSSBAR_GAP)}${rect(STEM_GAP)}</g>
  <g fill="rgb(${CEMENT})">${rect(CROSSBAR)}${rect(STEM)}</g>
</svg>
`;
}

/* ================================================================
   BUILD
   ================================================================ */
mkdirSync(PUBLIC_DIR, { recursive: true });

const write = (name, buf) => {
  writeFileSync(join(PUBLIC_DIR, name), buf);
  console.log(`  ${name}  ${(buf.length / 1024).toFixed(1)} kB`);
};

console.log('Theory Golf icons →');
// 180 is the iOS home-screen size; 192/512 are the PWA manifest sizes.
write('apple-touch-icon.png', encodePng(180, render(180)));
write('icon-192.png', encodePng(192, render(192)));
write('icon-512.png', encodePng(512, render(512)));
write('favicon.ico', encodeIco(32, encodePng(32, render(32))));
write('icon.svg', Buffer.from(encodeSvg(), 'utf8'));
