import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const textExtensions = new Set([".json", ".md", ".ts", ".tsx", ".txt"]);
const scanRoots = ["app", "brand"];
const exactFiles = [
  "CLAUDE.md",
  "docs/AI-HANDOFF.md",
  "lib/ai/policy-knowledge.ts",
  "lib/customer-fee.ts",
];

async function textFilesUnder(relativeDirectory) {
  const absoluteDirectory = join(projectRoot, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await textFilesUnder(relativePath));
    } else if (textExtensions.has(extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

async function scannedCopy() {
  const files = [
    ...exactFiles,
    ...(await Promise.all(scanRoots.map(textFilesUnder))).flat(),
  ];

  return Promise.all(files.map(async (relativePath) => ({
    relativePath,
    source: await readFile(join(projectRoot, relativePath), "utf8"),
  })));
}

test("customer fee configuration remains 5 percent", async () => {
  const source = await readFile(join(projectRoot, "lib/customer-fee.ts"), "utf8");

  assert.match(source, /CUSTOMER_SERVICE_FEE_RATE_BPS\s*=\s*500\b/);
  assert.match(source, /CUSTOMER_SERVICE_FEE_PERCENT\s*=\s*5\b/);
});

test("public and assistant copy cannot revive the legacy 10 percent fee", async () => {
  const obsoleteFeePatterns = [
    /\b10\s*%\s+(?:(?:Tuveloz|customer|site|marketplace|platform)\s+){0,3}(?:service\s+)?fee\b/i,
    /\b(?:Tuveloz|customer)\b[^.\n]{0,120}\b10\s*%\s+(?:service\s+)?fee\b/i,
  ];

  for (const { relativePath, source } of await scannedCopy()) {
    for (const pattern of obsoleteFeePatterns) {
      assert.doesNotMatch(source, pattern, `legacy customer-fee copy in ${relativePath}`);
    }
  }
});

test("provider copy cannot turn the customer fee into a 95 percent payout claim", async () => {
  const keepNinetyFive = /\bproviders?\s+(?:keep|keeps|receive|receives|get|gets)\s+(?:the\s+)?95\s*%/i;

  for (const { relativePath, source } of await scannedCopy()) {
    assert.doesNotMatch(source, keepNinetyFive, `forbidden provider payout copy in ${relativePath}`);
  }
});

test("the main fee explanations state the positive contract", async () => {
  const providerAgreement = await readFile(
    join(projectRoot, "app/provider-agreement/page.tsx"),
    "utf8",
  );
  const handoff = await readFile(join(projectRoot, "docs/AI-HANDOFF.md"), "utf8");

  assert.match(providerAgreement, /full quoted price[\s\S]{0,160}5% fee/i);
  assert.match(handoff, /Providers keep \*\*100% of what they quote\*\*/);
});
