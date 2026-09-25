import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const outreachFiles = [
  "../brand/outreach/provider-outreach-kit.md",
  "../brand/outreach/moco-outreach-worklist.md",
  "../brand/outreach/founding-provider-program.md",
  "../brand/outreach/media/captions-copy-paste.txt",
  "../brand/outreach/media/captions-v3-copy-paste.txt",
  "../brand/outreach/provider-spotlight-kit.md",
  "../brand/outreach/reel-provider-recruitment.md",
  "../brand/outreach/reel-provider-recruitment-v3.md",
];

test("provider outreach never promises launch position, completed review, jobs, or income", async () => {
  const contents = await Promise.all(
    outreachFiles.map((file) => readFile(new URL(file, import.meta.url), "utf8")),
  );
  const combined = contents.join("\n").toLowerCase();
  for (const misleadingPhrase of [
    "front of the line",
    "first in line",
    "ready day one",
    "review is done",
    "early sign-ups go first",
    "jobs start flowing",
    "guaranteed income",
    "guaranteed jobs",
  ]) {
    assert.doesNotMatch(combined, new RegExp(misleadingPhrase));
  }
});

test("outreach kit plainly states the current phase and marketplace role in both languages", async () => {
  const kit = await readFile(new URL("../brand/outreach/provider-outreach-kit.md", import.meta.url), "utf8");
  assert.match(
    kit,
    /Provider applications are open in Montgomery County, Maryland\. Customer requests, bookings, and payments are closed\./,
  );
  assert.match(kit, /Applying does not guarantee approval, customer requests, income, or a launch date\./);
  assert.match(kit, /The independent provider the customer chooses performs the vehicle service\./);
  assert.match(kit, /las solicitudes de clientes todavía no están abiertas/i);
  assert.match(kit, /https:\/\/tuveloz\.com\/join/);
  assert.match(kit, /https:\/\/tuveloz\.com\/es\/join/);
});
