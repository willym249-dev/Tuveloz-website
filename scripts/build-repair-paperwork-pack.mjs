/**
 * Builds the Maryland repair paperwork pack from the statute implementation.
 *
 * The two documents a Maryland repair business owes its customer under
 * Md. Code, Com. Law § 14-1001 — a written estimate carrying the customer's
 * rights, and an itemized invoice — as print-ready forms any shop can use,
 * whether or not it ever applies to Tuveloz.
 *
 * Every statutory sentence is imported from lib/maryland-repair-records.ts
 * rather than retyped, so a shop's printed form and the marketplace's own
 * stored records can never quietly say different things.
 * tests/repair-paperwork-pack.test.mjs regenerates this output and fails when
 * the committed files have drifted.
 *
 *   npm run pack:repair-docs
 *
 * Passing a business stamps its details onto the form instead of leaving the
 * top block blank, which is the whole of the work in a personalized pack:
 *
 *   npm run pack:repair-docs -- --out ../packs/ace-mobile \
 *     --business "Ace Mobile Auto LLC" --registration "R-123456" \
 *     --phone "(240) 555-0142" --address "123 Example Rd" \
 *     --city "Silver Spring, MD 20901"
 *
 * Each form prints on both sides of one sheet: the working form on the front,
 * the Customer's Rights notice and the acknowledgements on the back.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  MANUFACTURER_SPECIAL_POLICY_NOTICE,
  MARYLAND_CUSTOMER_RIGHTS_HEADING,
  MARYLAND_CUSTOMER_RIGHTS_TEXT,
  MARYLAND_REPAIR_RECORDS_VERSION,
  PROVIDER_TEST_DRIVE_CERTIFICATION,
  REPAIR_FACILITY_RESPONSIBILITY_NOTICE,
  REPAIRS_NEEDED_AND_PERFORMED_STATEMENT,
} from "../lib/maryland-repair-records.ts";

const defaultOutputDirectory = new URL("../brand/repair-paperwork-pack/", import.meta.url);

/**
 * Not a Tuveloz rule and not advice — the statute's own threshold, printed on
 * the form because the consent line is the single most expensive thing a shop
 * gets wrong. Work done past it is work that cannot be charged for.
 */
const OVERAGE_CONSENT_INSTRUCTION =
  "Stop and get consent before the total exceeds this authorized amount by more than 10%. Record that consent below before the extra work starts.";

const DISCLAIMER =
  "This is a blank form, not legal advice. It reproduces the notices in Md. Code, Com. Law § 14-1001 and the record structure Tuveloz implements in software. Confirm it against the current statute and your own adviser before relying on it, and keep your completed copies for your records.";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const styles = `
  @page { size: letter; margin: 0.45in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    color: #101418;
    font-size: 9pt;
    line-height: 1.3;
    width: 7.6in;
    margin: 0 auto;
  }
  header.sheet { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5pt solid #0f6b3f; padding-bottom: 5pt; }
  h1 { font-size: 15pt; line-height: 1.1; }
  .kicker { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.13em; color: #0f6b3f; text-transform: uppercase; }
  .doc-number { text-align: right; font-size: 8pt; color: #33414c; }
  h2 { font-size: 8.5pt; letter-spacing: 0.09em; text-transform: uppercase; color: #0f6b3f; margin: 6pt 0 2pt; }
  .grid { display: grid; gap: 3pt 10pt; }
  .grid.two { grid-template-columns: 1fr 1fr; }
  .grid.three { grid-template-columns: 1fr 1fr 1fr; }
  .grid.four { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .field { border-bottom: 0.75pt solid #98a3ad; padding-top: 8pt; }
  .field span { font-size: 7pt; color: #55636f; text-transform: uppercase; letter-spacing: 0.06em; }
  .field.filled { padding-top: 0; }
  .field.filled strong { display: block; font-size: 10pt; font-weight: 600; padding-bottom: 1pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 3pt; }
  th { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; color: #55636f; text-align: left; border-bottom: 0.75pt solid #55636f; padding: 2pt 3pt; }
  td { border-bottom: 0.5pt solid #c3ccd3; height: 13pt; padding: 2pt 3pt; }
  td.money, th.money { text-align: right; width: 0.72in; }
  .rights { border: 1.25pt solid #101418; padding: 5pt 7pt; margin-top: 6pt; }
  .rights h3 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
  .rights p { margin-top: 3pt; }
  .notice { font-size: 7.5pt; color: #33414c; margin-top: 5pt; line-height: 1.3; }
  .notice strong { color: #101418; }
  .box { border: 0.75pt solid #55636f; padding: 5pt 6pt; margin-top: 6pt; break-inside: avoid; }
  .rights, table, .grid { break-inside: avoid; }
  .fold { break-before: page; }
  .fold-note { font-size: 7pt; color: #55636f; text-align: right; margin-top: 6pt; letter-spacing: 0.05em; text-transform: uppercase; }
  .check { font-size: 9pt; margin-top: 3pt; }
  .check::before { content: "\\2610"; font-size: 12pt; margin-right: 4pt; vertical-align: -1pt; }
  .totals { width: 2.5in; margin-left: auto; margin-top: 4pt; }
  .totals td { border-bottom: 0.5pt solid #c3ccd3; height: 13pt; }
  .totals td.label { font-size: 8pt; color: #33414c; }
  .totals tr.grand td { border-top: 1.25pt solid #101418; border-bottom: 0; font-weight: 700; font-size: 10.5pt; }
  footer { margin-top: 7pt; border-top: 0.75pt solid #c3ccd3; padding-top: 4pt; font-size: 6.8pt; color: #55636f; line-height: 1.35; }
  footer .credit { color: #0f6b3f; font-weight: 700; }
`;

function page({ title, kicker, heading, documentLabel, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
<header class="sheet">
  <div>
    <div class="kicker">${escapeHtml(kicker)}</div>
    <h1>${escapeHtml(heading)}</h1>
  </div>
  <div class="doc-number">
    ${escapeHtml(documentLabel)} No. ______________<br>
    Date ______ / ______ / __________
  </div>
</header>
${body}
<footer>
  <p>${escapeHtml(DISCLAIMER)}</p>
  <p style="margin-top:3pt;">Form version ${escapeHtml(MARYLAND_REPAIR_RECORDS_VERSION)} · <span class="credit">Provided free by Tuveloz — tuveloz.com</span></p>
</footer>
</body>
</html>
`;
}

function fields(columns, labels) {
  return `<div class="grid ${columns}">${labels
    .map((label) => `<div class="field"><span>${escapeHtml(label)}</span></div>`)
    .join("")}</div>`;
}

/**
 * A stamped field still shows its label and still sits on a rule, so a
 * personalized pack reads as the same form with the top block already filled
 * in — never as a different document.
 */
function stampedFields(columns, entries) {
  return `<div class="grid ${columns}">${entries
    .map(([label, value]) => (value
      ? `<div class="field filled"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`
      : `<div class="field"><span>${escapeHtml(label)}</span></div>`))
    .join("")}</div>`;
}

function repairBusinessBlock(shop) {
  return `<h2>Repair business</h2>
${stampedFields("three", [
    ["Business name", shop.business],
    ["Maryland registration number", shop.registration],
    ["Phone", shop.phone],
  ])}
${stampedFields("two", [
    ["Street address", shop.address],
    ["City, state, ZIP", shop.city],
  ])}`;
}

function partiesBlock(shop) {
  return `
${repairBusinessBlock(shop)}

<h2>Customer</h2>
${fields("three", ["Name", "Phone", "Email"])}
${fields("two", ["Street address", "City, state, ZIP"])}

<h2>Vehicle</h2>
${fields("four", ["Year / make / model", "VIN", "Odometer", "License plate"])}
`;
}

const customerRightsBlock = `
<div class="rights">
  <h3>${escapeHtml(MARYLAND_CUSTOMER_RIGHTS_HEADING)}</h3>
  <p>${escapeHtml(MARYLAND_CUSTOMER_RIGHTS_TEXT)}</p>
</div>
<p class="notice"><strong>${escapeHtml(MANUFACTURER_SPECIAL_POLICY_NOTICE.split("\n")[0])}.</strong> ${escapeHtml(MANUFACTURER_SPECIAL_POLICY_NOTICE.split("\n").slice(1).join(" "))}</p>
<p class="notice">${escapeHtml(REPAIR_FACILITY_RESPONSIBILITY_NOTICE)}</p>
`;

function lineItemTable(rows) {
  const body = Array.from({ length: rows }, () =>
    `<tr><td></td><td></td><td></td><td></td><td class="money"></td><td class="money"></td></tr>`).join("\n    ");
  return `<table>
  <thead>
    <tr>
      <th style="width:0.62in;">Type</th>
      <th>Description of labor or part</th>
      <th style="width:1.05in;">Part number</th>
      <th style="width:0.95in;">New / used / rebuilt / recond.</th>
      <th class="money">Qty × unit</th>
      <th class="money">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${body}
  </tbody>
</table>`;
}

function totalsTable(grandLabel) {
  return `<table class="totals">
  <tr><td class="label">Labor</td><td class="money"></td></tr>
  <tr><td class="label">Parts</td><td class="money"></td></tr>
  <tr><td class="label">Sublet / other</td><td class="money"></td></tr>
  <tr><td class="label">Tax</td><td class="money"></td></tr>
  <tr class="grand"><td class="label">${escapeHtml(grandLabel)}</td><td class="money"></td></tr>
</table>`;
}

function buildEstimate(shop) {
  return page({
    title: "Written Estimate and Repair Authorization — Maryland",
    kicker: "Maryland vehicle repair · Md. Code, Com. Law § 14-1001",
    heading: "Written Estimate and Repair Authorization",
    documentLabel: "Estimate",
    body: `
${partiesBlock(shop)}

<h2>Customer's reported concern</h2>
${fields("two", ["What the customer says the vehicle is doing", "Requested by"])}

<h2>Estimated work</h2>
${lineItemTable(5)}
${totalsTable("Estimated total")}

<div class="box">
  <strong style="font-size:10pt;">Authorization</strong>
  <p class="notice" style="margin-top:2pt;">${escapeHtml(OVERAGE_CONSENT_INSTRUCTION)}</p>
  <div class="grid two" style="margin-top:5pt;">
    <div class="field"><span>Amount authorized ($)</span></div>
    <div class="field"><span>Teardown / diagnosis authorized separately ($)</span></div>
  </div>
  <p class="check">I authorize the repair business to perform the work described above, up to the amount authorized.</p>
  <p class="check">I want my replaced parts returned to me, except parts a warranty requires be sent to the manufacturer.</p>
  <p class="check">I decline the return of my replaced parts.</p>
  <div class="grid three" style="margin-top:6pt;">
    <div class="field"><span>Customer signature</span></div>
    <div class="field"><span>Printed name</span></div>
    <div class="field"><span>Date and time</span></div>
  </div>
</div>

<h2>Additional work authorized after this estimate</h2>
<p class="notice">Record every approval to go past the authorized amount, including approvals given by phone. An unrecorded verbal approval is the charge most likely to be disputed.</p>
<table>
  <thead>
    <tr>
      <th style="width:1.15in;">Date and time</th>
      <th>Additional work described to the customer</th>
      <th class="money" style="width:0.85in;">New total</th>
      <th style="width:1.5in;">Approved by / how (in person, phone, text)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td></td><td></td><td class="money"></td><td></td></tr>
    <tr><td></td><td></td><td class="money"></td><td></td></tr>
  </tbody>
</table>

<p class="fold-note">Continued on the back of this sheet</p>
<div class="fold">
${customerRightsBlock}
<p class="notice" style="margin-top:8pt;">Customer received a copy of this estimate on ______ / ______ / __________ · Customer initials ____________</p>
</div>
`,
  });
}

function buildInvoice(shop) {
  return page({
    title: "Itemized Repair Invoice — Maryland",
    kicker: "Maryland vehicle repair · Md. Code, Com. Law § 14-1001",
    heading: "Itemized Repair Invoice",
    documentLabel: "Invoice",
    body: `
${partiesBlock(shop)}
${fields("two", ["Related estimate number", "Date work completed"])}

<h2>Work performed</h2>
<p class="notice">List labor and parts separately. Every part carries its number and its condition; every labor line carries the time and the mechanic who did it.</p>
${lineItemTable(7)}

<div class="grid two" style="margin-top:4pt;">
  <div>
    <h2 style="margin-top:2pt;">Labor detail</h2>
    <table>
      <thead>
        <tr><th>Mechanic name or identifier</th><th style="width:0.8in;">Hours</th><th class="money">Rate</th></tr>
      </thead>
      <tbody>
        <tr><td></td><td></td><td class="money"></td></tr>
        <tr><td></td><td></td><td class="money"></td></tr>
      </tbody>
    </table>
  </div>
  <div>${totalsTable("Total due")}</div>
</div>

<div class="box">
  <p class="check">Replaced parts were returned to the customer.</p>
  <p class="check">Replaced parts were retained because a warranty agreement requires their return to the manufacturer.</p>
  <p class="check">The customer declined the return of replaced parts.</p>
  <p class="check">The final total exceeded the written estimate by more than 10%, and the customer's consent is recorded on the estimate before that work began.</p>
</div>

<div class="box">
  <p>${escapeHtml(REPAIRS_NEEDED_AND_PERFORMED_STATEMENT)}</p>
  <p style="margin-top:4pt;">${escapeHtml(PROVIDER_TEST_DRIVE_CERTIFICATION)}</p>
  <div class="grid three" style="margin-top:5pt;">
    <div class="field"><span>Repair business signature</span></div>
    <div class="field"><span>Printed name and title</span></div>
    <div class="field"><span>Date</span></div>
  </div>
</div>

<p class="fold-note">Continued on the back of this sheet</p>
<div class="fold">
${customerRightsBlock}

<div class="grid three" style="margin-top:8pt;">
  <div class="field"><span>Customer signature</span></div>
  <div class="field"><span>Printed name</span></div>
  <div class="field"><span>Copy given to customer on</span></div>
</div>
<p class="notice">If you collect this signature electronically instead of on paper, the customer has to agree to transact electronically first, and has to be able to keep the exact record they signed.</p>
</div>
`,
  });
}

export function buildRepairPaperworkPack(shop = {}) {
  return {
    "estimate-authorization.html": buildEstimate(shop),
    "invoice.html": buildInvoice(shop),
  };
}

/** The committed pack: the blank form, with nobody's business on it. */
export const REPAIR_PAPERWORK_PACK_FILES = buildRepairPaperworkPack();

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith("--")) continue;
    values[flag.slice(2)] = argv[index + 1] ?? "";
    index += 1;
  }
  return values;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const shop = {
    business: options.business ?? "",
    registration: options.registration ?? "",
    phone: options.phone ?? "",
    address: options.address ?? "",
    city: options.city ?? "",
  };
  const directory = options.out
    ? new URL(`${options.out.replace(/\/?$/, "/")}`, defaultOutputDirectory)
    : defaultOutputDirectory;

  await mkdir(directory, { recursive: true });
  for (const [name, contents] of Object.entries(buildRepairPaperworkPack(shop))) {
    await writeFile(new URL(name, directory), contents, "utf8");
    process.stdout.write(`wrote ${fileURLToPath(new URL(name, directory))}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
