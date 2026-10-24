/**
 * Generate raster PWA icons (192 & 512, `any` + maskable) from the CityDex
 * pixel mark, with no external dependencies.
 *
 * The mark is axis-aligned rectangles on a small grid, so we rasterize it
 * ourselves into RGBA and encode a PNG using node's built-in zlib. Run with:
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

const C = {
  wood: [0x5b, 0x3a, 0x29],
  parchment: [0xf4, 0xe4, 0xc1],
  woodLight: [0xa0, 0x70, 0x3c],
  berry: [0xc0, 0x39, 0x2b],
  grass: [0x6d, 0xaa, 0x2c],
};

// Rectangles as [x, y, w, h, color] on a `grid`×`grid` coordinate space.
function markRects(grid, inset) {
  // inset = margin reserved around the parchment panel (0 for full-bleed `any`,
  // larger for maskable safe zone).
  const p = inset; // panel start
  const ps = grid - inset * 2; // panel size
  return [
    [0, 0, grid, grid, C.wood],
    [p, p, ps, ps, C.parchment],
    [p, p, ps, 2, C.woodLight],
    [p, p + ps - 2, ps, 2, C.woodLight],
    // pin head
    [p + ps * 0.34, p + ps * 0.15, ps * 0.31, ps * 0.31, C.berry],
    [p + ps * 0.42, p + ps * 0.23, ps * 0.15, ps * 0.15, C.parchment],
    // pin point
    [p + ps * 0.42, p + ps * 0.46, ps * 0.15, ps * 0.15, C.berry],
    [p + ps * 0.46, p + ps * 0.61, ps * 0.08, ps * 0.12, C.berry],
    // grass
    [p + ps * 0.15, p + ps * 0.77, ps * 0.7, ps * 0.08, C.grass],
  ];
}

function rasterize(size, grid, inset) {
  const rects = markRects(grid, inset);
  const scale = size / grid;
  const rgba = Buffer.alloc(size * size * 4, 0);
  for (const [rx, ry, rw, rh, color] of rects) {
    const x0 = Math.round(rx * scale);
    const y0 = Math.round(ry * scale);
    const x1 = Math.round((rx + rw) * scale);
    const y1 = Math.round((ry + rh) * scale);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const i = (y * size + x) * 4;
        rgba[i] = color[0];
        rgba[i + 1] = color[1];
        rgba[i + 2] = color[2];
        rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // compression, filter, interlace all 0
  // Add a filter byte (0) at the start of each scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(name, size, grid, inset) {
  const rgba = rasterize(size, grid, inset);
  const png = encodePng(size, rgba);
  writeFileSync(join(publicDir, name), png);
  console.log(`wrote public/${name} (${png.length} bytes)`);
}

// `any` icons: minimal border inset. Maskable: larger inset for the safe zone.
write("icon-192.png", 192, 32, 3);
write("icon-512.png", 512, 32, 3);
write("icon-maskable-192.png", 192, 40, 7);
write("icon-maskable-512.png", 512, 40, 7);
