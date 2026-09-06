/**
 * Generates the Theory Golf app icons from the shield crest.
 *
 * Source of truth is assets/crest.png — the crest lifted off its white
 * paper into straight alpha, so it can be laid on either ground. This
 * script scales it down, recolours the ink to brand tokens (which also
 * clears the JPEG chroma fringing the original carried) and writes every
 * size the browsers and iOS ask for:
 *
 *   npm run gen:icons
 *
 * No image dependencies — PNG is decoded and encoded by hand, so the
 * icons can be rebuilt on any machine with just Node. Outputs land in
 * public/ and are committed; regenerate and commit if anything here
 * changes.
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, '..', 'public');
const CREST = join(HERE, 'assets', 'crest.png');

/* ================================================================
   THEME
   The crest is drawn as ink + accent, so switching the icon between
   the light and dark lockups is a one-line change here. Values mirror
   src/styles/system.css.
   ================================================================ */
const THEMES = {
  light: { ground: [0xf8, 0xf7, 0xf5], ink: [0x0a, 0x0a, 0x0a] },
  dark: { ground: [0x0c, 0x0c, 0x0c], ink: [0xf2, 0xf0, 0xee] },
};
const THEME = THEMES.light;
const ACCENT = [0xe8, 0x20, 0x2a]; // scarlet — never recoloured per brand

/** Fraction of the icon's height the crest occupies. The rest is clear
 *  zone, which iOS eats into when it masks the corners. */
const CREST_HEIGHT = 0.76;

/** A pixel is accent, not ink, once red leads the other channels by this
 *  much. Everything else — including the blend where the accent meets a
 *  black stroke — resolves to ink. */
const REDNESS = 60;

/* ================================================================
   COLOUR
   Averaging happens in linear light; doing it in sRGB thickens dark
   strokes on a light ground and thins light strokes on a dark one.
   ================================================================ */
const TO_LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const toSrgb = (v) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

/* ================================================================
   PNG
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

/**
 * Decodes the one PNG shape this script consumes: 8-bit RGBA, no
 * interlacing. That's what assets/crest.png is; anything else throws
 * rather than decoding to garbage.
 */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  const idat = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colour, , , interlace] = [data[8], data[9], data[10], data[11], data[12]];
      if (depth !== 8 || colour !== 6 || interlace !== 0) {
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}`);
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    o += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0; // left
      const b = y > 0 ? out[(y - 1) * stride + x] : 0; // up
      const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0; // up-left
      let v = line[x];
      switch (filter) {
        case 0:
          break;
        case 1:
          v += a;
          break;
        case 2:
          v += b;
          break;
        case 3:
          v += (a + b) >> 1;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default:
          throw new Error(`bad filter ${filter}`);
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, data: out };
}

function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour, no alpha — icons are opaque
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO wrapping PNG payloads — supported everywhere that matters since Vista. */
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length + entries.length * 16;
  const dir = [];
  for (const { size, png } of entries) {
    const e = Buffer.alloc(16);
    e[0] = size < 256 ? size : 0;
    e[1] = size < 256 ? size : 0;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    dir.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

/* ================================================================
   RENDER
   ================================================================ */
const source = decodePng(readFileSync(CREST));

/**
 * Recolours the crest to the theme and premultiplies it into linear
 * light, so the resampler below can just average.
 */
function prepare() {
  const { width, height, data } = source;
  const n = width * height;
  const lin = new Float64Array(n * 4); // r, g, b (premultiplied), a
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] / 255;
    if (a === 0) continue;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const ink = r - Math.max(g, b) > REDNESS ? ACCENT : THEME.ink;
    lin[i * 4] = TO_LINEAR[ink[0]] * a;
    lin[i * 4 + 1] = TO_LINEAR[ink[1]] * a;
    lin[i * 4 + 2] = TO_LINEAR[ink[2]] * a;
    lin[i * 4 + 3] = a;
  }
  return lin;
}

const LINEAR = prepare();

/**
 * Draws the icon at `size`: the crest area-averaged down onto the
 * theme's ground, centred, at CREST_HEIGHT of the canvas.
 */
function render(size) {
  const { width: sw, height: sh } = source;
  const dh = Math.round(size * CREST_HEIGHT);
  const dw = Math.round((dh * sw) / sh);
  const ox = Math.round((size - dw) / 2);
  const oy = Math.round((size - dh) / 2);

  const groundLin = THEME.ground.map((c) => TO_LINEAR[c]);
  const out = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    out[i * 3] = THEME.ground[0];
    out[i * 3 + 1] = THEME.ground[1];
    out[i * 3 + 2] = THEME.ground[2];
  }

  // Box filter: every destination pixel averages the source rectangle it
  // covers, with fractional weights at the edges.
  const scaleX = sw / dw;
  const scaleY = sh / dh;
  for (let dy = 0; dy < dh; dy++) {
    const sy0 = dy * scaleY;
    const sy1 = sy0 + scaleY;
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = dx * scaleX;
      const sx1 = sx0 + scaleX;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let total = 0;
      // Clamped: rounding can push the last row's ceil() one past the
      // edge, and reading off the end yields NaN, not zero.
      const yEnd = Math.min(sh, Math.ceil(sy1));
      const xEnd = Math.min(sw, Math.ceil(sx1));
      for (let y = Math.floor(sy0); y < yEnd; y++) {
        const wy = Math.min(y + 1, sy1) - Math.max(y, sy0);
        for (let x = Math.floor(sx0); x < xEnd; x++) {
          const w = wy * (Math.min(x + 1, sx1) - Math.max(x, sx0));
          const i = (y * sw + x) * 4;
          r += LINEAR[i] * w;
          g += LINEAR[i + 1] * w;
          b += LINEAR[i + 2] * w;
          a += LINEAR[i + 3] * w;
          total += w;
        }
      }
      r /= total;
      g /= total;
      b /= total;
      a /= total;

      // Source over ground; both sides are already premultiplied linear.
      const o = ((oy + dy) * size + ox + dx) * 3;
      out[o] = toSrgb(r + groundLin[0] * (1 - a));
      out[o + 1] = toSrgb(g + groundLin[1] * (1 - a));
      out[o + 2] = toSrgb(b + groundLin[2] * (1 - a));
    }
  }
  return out;
}

/* ================================================================
   BUILD
   ================================================================ */
mkdirSync(PUBLIC_DIR, { recursive: true });

const png = (size) => encodePng(size, render(size));
const write = (name, buf) => {
  writeFileSync(join(PUBLIC_DIR, name), buf);
  console.log(`  ${name}  ${(buf.length / 1024).toFixed(1)} kB`);
};

console.log('Theory Golf icons →');
// 180 is the iOS home-screen size; 192/512 are the PWA manifest sizes.
write('apple-touch-icon.png', png(180));
write('icon-192.png', png(192));
write('icon-512.png', png(512));
write('favicon.ico', encodeIco([16, 32, 48].map((size) => ({ size, png: png(size) }))));
