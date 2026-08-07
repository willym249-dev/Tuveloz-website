/**
 * Regenerates every logo asset the website serves from the DEFINITIVE brand
 * masters, so the site can never drift from the brand kit:
 *
 *   badge master:  brand/social-media-kit/tuveloz-profile-master-1024.png
 *   lockup master: brand/social-media-kit/Tuveloz Logo.png
 *
 * Outputs to public/: brand-badge.png (the header/footer mark), favicon.ico
 * (16/32/48), favicon.svg, tuveloz-favicon-v2.svg, apple-touch-icon.png (180),
 * icon-192.png, icon-512.png, og-image.png (1200x630).
 *
 * Run from the repo root:  node scripts/generate-brand-assets.mjs
 * Then bump the ?v= query strings in app/layout.tsx and
 * public/manifest.webmanifest so cached copies stop being served.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const kit = join(root, "brand", "social-media-kit");
const masterPath = join(kit, "tuveloz-profile-master-1024.png");
const lockupPath = join(kit, "Tuveloz Logo.png");

// --- Floating badge: make everything outside the keyline transparent ---
const { data, info } = await sharp(masterPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const passable = (p) => {
  const i = p * 4;
  return data[i + 3] < 10 || (data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60);
};
const outside = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const p = stack.pop();
  if (outside[p] || !passable(p)) continue;
  outside[p] = 1;
  const x = p % W, y = (p / W) | 0;
  if (x > 0) stack.push(p - 1);
  if (x < W - 1) stack.push(p + 1);
  if (y > 0) stack.push(p - W);
  if (y < H - 1) stack.push(p + W);
}
for (let p = 0; p < W * H; p++) if (outside[p]) data[p * 4 + 3] = 0;
const badgePng = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

// --- Header/footer mark: the badge trimmed edge-to-edge ---
// This is the logo every page renders through <BrandMark>, so it has to come
// out of the same master as the favicons. It is trimmed to the keyline because
// the container gives it its own spacing, unlike the app icons below.
await sharp(badgePng).trim().resize(256, 256).png().toFile(join(pub, "brand-badge.png"));
console.log("wrote brand-badge.png");

// --- PNG icons ---
for (const [size, out] of [[180, "apple-touch-icon.png"], [192, "icon-192.png"], [512, "icon-512.png"]]) {
  await sharp(badgePng).resize(size, size).png().toFile(join(pub, out));
  console.log("wrote", out);
}

// --- favicon.ico: multi-res BMP-in-ICO (16/32/48) ---
async function bmpEntry(size) {
  const { data: d } = await sharp(badgePng).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = (y * size + x) * 4, dd = ((size - 1 - y) * size + x) * 4;
    xor[dd] = d[s + 2]; xor[dd + 1] = d[s + 1]; xor[dd + 2] = d[s]; xor[dd + 3] = d[s + 3];
  }
  const and = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
  return Buffer.concat([header, xor, and]);
}
const sizes = [16, 32, 48];
const imgs = [];
for (const s of sizes) imgs.push(await bmpEntry(s));
const dir = Buffer.alloc(6 + 16 * sizes.length);
dir.writeUInt16LE(1, 2);
dir.writeUInt16LE(sizes.length, 4);
let off = 6 + 16 * sizes.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  dir.writeUInt8(s, e);
  dir.writeUInt8(s, e + 1);
  dir.writeUInt16LE(1, e + 4);
  dir.writeUInt16LE(32, e + 6);
  dir.writeUInt32LE(imgs[i].length, e + 8);
  dir.writeUInt32LE(off, e + 12);
  off += imgs[i].length;
});
writeFileSync(join(pub, "favicon.ico"), Buffer.concat([dir, ...imgs]));
console.log("wrote favicon.ico");

// --- SVG favicons embed the exact badge art at 256px ---
const png256 = await sharp(badgePng).resize(256, 256).png().toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,${png256.toString("base64")}"/></svg>\n`;
writeFileSync(join(pub, "favicon.svg"), svg);
writeFileSync(join(pub, "tuveloz-favicon-v2.svg"), svg);
console.log("wrote favicon.svg + tuveloz-favicon-v2.svg");

// --- og-image: lockup master centered on brand black, 1200x630 ---
const lkMeta = await sharp(lockupPath).metadata();
const targetW = 1040;
const scaledH = Math.round(lkMeta.height * (targetW / lkMeta.width));
const inner = await sharp(lockupPath).resize(targetW, scaledH).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: { r: 5, g: 5, b: 5 } } })
  .composite([{ input: inner, left: (1200 - targetW) / 2, top: Math.round((630 - scaledH) / 2) }])
  .png().toFile(join(pub, "og-image.png"));
console.log("wrote og-image.png");
