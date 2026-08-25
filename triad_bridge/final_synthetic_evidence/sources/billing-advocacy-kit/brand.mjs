/**
 * Stamps the business details into every client-facing document at once.
 *
 * The files in this folder stay as templates — they keep their placeholders so
 * details can be changed later without anything degrading. Output goes to
 * branded/, which is what you actually print, send, and publish.
 *
 *   node brand.mjs --business "Itemized Health" \
 *     --email you@example.com --phone "(240) 555-0142"
 *
 * --address is optional. Anything omitted leaves a blank line on the form
 * rather than a bracket, so a partial run still produces usable documents.
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const out = new URL("./branded/", import.meta.url);

/**
 * Pilot templates only.
 *
 * The fee agreement, the appeal-representative designation, and the records
 * authorization are QUARANTINED outside this kit and are deliberately absent
 * from this list, so a branding run cannot reproduce them. Do not re-add one
 * without written Maryland classification for the model it belongs to.
 */
const TEMPLATES = [
  "pilot-terms.html",
  "client-report.html",
  "referral-onepager.html",
  "site.html",
];

function parseArgs(argv) {
  const v = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    v[argv[i].slice(2)] = argv[i + 1] ?? "";
    i += 1;
  }
  return v;
}

const o = parseArgs(process.argv.slice(2));
if (!o.business) {
  process.stderr.write("--business is required.\n");
  process.exit(1);
}

const business = o.business;
const email = o.email ?? "";
const phone = o.phone ?? "";
const address = o.address ?? "";

/**
 * Order matters: the longer, more specific placeholders are replaced first so
 * a shorter one cannot eat part of a longer one.
 */
const REPLACEMENTS = [
  ["[YOUR BUSINESS NAME]", business],
  ["[YOUR EMAIL]", email],
  ["[YOUR PHONE]", phone],
  ["[secure email]", email],
  ["[street address]", address],
  ["[phone]", phone],
  ["[email]", email],
];

/**
 * Values arrive from the command line and are injected into HTML, so they are
 * escaped. An unescaped ampersand or angle bracket in a business name would
 * corrupt the markup; anything worse would be an injection.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stamp(html) {
  let s = html;
  for (const [from, to] of REPLACEMENTS) {
    s = s.split(from).join(escapeHtml(to));
  }
  // A mailto: with no address is a broken link — make it inert instead.
  if (!email) s = s.split('href="mailto:"').join('href="#start"');
  // Any mailto is built from the escaped value above, so it cannot break out of the attribute.

  // An omitted value must remove its whole phrase, not leave a stranded
  // preposition or separator. Phrase-level first, punctuation second.
  if (!phone) {
    s = s.replace(/Or call\s*\.\s*/g, "");
    s = s.replace(/\[phone\]\s*·\s*/g, "");
    s = s.replace(/\s*·\s*(?=<\/p>)/g, "");
  }
  if (!address) {
    s = s.replace(/,\s*at\s*,/g, ",");
    s = s.replace(/\bat\s*,\s*/g, "at ");
  }

  // Whatever punctuation survives the phrase rules.
  s = s.replace(/\.\s*·\s*/g, ". ");
  s = s.replace(/·\s*·/g, "·");
  s = s.replace(/\(\s*\)/g, "");
  s = s.replace(/\s+([.,])/g, "$1");
  return s;
}

await mkdir(out, { recursive: true });

for (const name of TEMPLATES) {
  const html = await readFile(new URL(name, root), "utf8");
  const stamped = stamp(html);
  const left = stamped.match(/\[(YOUR [A-Z ]+|phone|email|secure email|street address)\]/g);
  if (left) {
    process.stderr.write(`  WARNING ${name}: unfilled ${[...new Set(left)].join(", ")}\n`);
  }
  await writeFile(new URL(name, out), stamped, "utf8");
  process.stdout.write(`  wrote branded/${name}\n`);
}

const missing = [!email && "email", !phone && "phone", !address && "address"].filter(Boolean);
if (missing.length) {
  process.stdout.write(`\n  Left blank (rerun with the flag to fill): ${missing.join(", ")}\n`);
}
process.stdout.write("\n  Next: print the four PDFs from branded/, and publish branded/site.html\n");
