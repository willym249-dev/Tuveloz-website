/**
 * Regenerates the Expo app icons from the Tuveloz brand mark.
 *
 * The generated PNGs are committed to the repository, so this script only needs
 * to run when the brand mark changes. `sharp` is intentionally NOT a project
 * dependency (it is a heavy native module that nobody needs to build the app):
 *
 *   npm install --no-save sharp@0.35.3
 *   node scripts/generate-app-icons.mjs
 *
 * Source of truth for the mark: assets/brand/tuveloz-mark.svg
 */
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'images');

const NAVY = '#07182D';
const ORANGE = '#FF6A00';

/**
 * The mark drawn in the original 512x512 brand artboard. Its tight bounding box
 * is x:133..379, y:137..460 — i.e. 246x323 centred on (256, 298.5).
 */
const MARK_PATHS = `
  <path d="M146 150 L366 150 L300 254 L300 342 L212 342 L212 254 Z"
        fill="${ORANGE}" stroke="${ORANGE}" stroke-width="26" stroke-linejoin="round"/>
  <path d="M256 380 C241 401 227 417 227 431 A29 29 0 0 0 285 431 C285 417 271 401 256 380 Z"
        fill="${ORANGE}"/>
`;

const MARK_CENTER_X = 256;
const MARK_CENTER_Y = 298.5;
const MARK_HEIGHT = 323;

/**
 * Composes a square SVG containing the mark scaled to `coverage` of the canvas
 * height, optically centred, over an optional solid background.
 */
function markSvg({ size, coverage, background }) {
  const scale = (size * coverage) / MARK_HEIGHT;
  const translateX = size / 2 - MARK_CENTER_X * scale;
  const translateY = size / 2 - MARK_CENTER_Y * scale;
  const backdrop = background
    ? `<rect width="${size}" height="${size}" fill="${background}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${backdrop}
  <g transform="translate(${translateX} ${translateY}) scale(${scale})">${MARK_PATHS}</g>
</svg>`;
}

const TARGETS = [
  // Full-bleed store icon. iOS masks the corners itself and forbids alpha.
  { file: 'icon.png', size: 1024, coverage: 0.56, background: NAVY },
  // Android adaptive icon: the outer ~25% is cropped on some launchers, so the
  // foreground mark stays well inside the safe zone.
  { file: 'android-icon-foreground.png', size: 1024, coverage: 0.42, background: null },
  { file: 'android-icon-monochrome.png', size: 1024, coverage: 0.42, background: null },
  { file: 'splash-icon.png', size: 512, coverage: 0.72, background: null },
  { file: 'favicon.png', size: 96, coverage: 0.62, background: NAVY },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { file, size, coverage, background } of TARGETS) {
  const svg = markSvg({ size, coverage, background });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(OUT_DIR, file), png);
  console.log(`wrote assets/images/${file} (${size}x${size})`);
}
