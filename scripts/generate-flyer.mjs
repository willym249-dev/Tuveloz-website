/**
 * Renders a printable provider flyer from brand/outreach/flyer-template.html,
 * filling in the QR code and the printed URL.
 *
 * The point is the tag. Every flyer, DM, reel, and bio has been handing out the
 * same bare tuveloz.com/join, so applications arrived with no way to tell which
 * one produced them — and the growth playbook calls applications-by-source the
 * only number that decides anything. A flyer generated here carries ?r=flyer,
 * and a town run carries ?r=flyer-<town>, so /admin/analytics-funnel can show
 * what each stack of paper actually returned.
 *
 * Run from the repo root:
 *   node scripts/generate-flyer.mjs                 -> provider-flyer.html      (?r=flyer)
 *   node scripts/generate-flyer.mjs wheaton         -> provider-flyer-wheaton.html
 *
 * Print one run per town and the funnel compares them side by side.
 */
import QRCode from "qrcode";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outreach = join(root, "brand", "outreach");

// Same normalization the site applies in lib/attribution.ts, so the code
// printed on paper is exactly the row that shows up in the funnel.
const town = (process.argv[2] ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, "-")
  .slice(0, 30)
  .replace(/^-+|-+$/g, "");

const code = town ? `flyer-${town}` : "flyer";
const url = `https://tuveloz.com/join?r=${code}`;
// The printed line stays short enough to retype by hand; the QR carries the
// full link for everyone else.
const printedUrl = `tuveloz.com/join?r=${code}`;

const template = readFileSync(join(outreach, "flyer-template.html"), "utf8");
if (!template.includes("__QR__")) {
  throw new Error("flyer-template.html no longer contains the __QR__ placeholder.");
}

// High correction level: these get printed, folded, and taped to counters.
const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 1, width: 600 });

const html = template
  .replaceAll("__QR__", qr)
  .replaceAll("QR code to tuveloz.com/join", `QR code to ${printedUrl}`)
  .replaceAll(">tuveloz.com/join<", `>${printedUrl}<`);

const outName = town ? `provider-flyer-${town}.html` : "provider-flyer.html";
writeFileSync(join(outreach, outName), html);
console.log(`Wrote brand/outreach/${outName} -> ${url}`);
