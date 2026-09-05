import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("attached images start pending and never leak their storage key", async () => {
  const route = await read("app/api/messages/route.ts");
  // Multipart path validates the image and stores it before insert.
  assert.match(route, /multipart\/form-data/);
  assert.match(route, /validateJobImage\(imageFile, false\)/);
  assert.match(route, /scanStatus: imageKey \? "pending" : ""/);
  // GET exposes only a status + viewable flag, never the imageKey.
  assert.match(route, /viewable: message\.scanStatus === "clean"/);
  assert.doesNotMatch(route, /imageKey: message\.imageKey/);
  // A failed insert cleans up the orphaned object.
  assert.match(route, /deleteJobMessageImage\(imageKey\)/);
});

test("serving an image is fail-closed: participant + clean only", async () => {
  const serve = await read("app/api/message-image/route.ts");
  assert.match(serve, /getAccountSession\(request\)/);
  // Only the two people on the message may view it.
  assert.match(serve, /senderEmail\.toLowerCase\(\) === viewer \|\| message\.recipientEmail\.toLowerCase\(\) === viewer/);
  // Never serve unless a scan cleared it.
  assert.match(serve, /message\.scanStatus !== "clean"/);
});

test("scan sweep is a no-op until scanning is configured, and never trusts a non-2xx", async () => {
  const scanner = await read("lib/message-image-scanner.ts");
  assert.match(scanner, /if \(!cloudmersiveScannerConfigured\(runtime\)\) \{\s*return \{ configured: false/);
  // Non-2xx or ambiguous verdicts leave the message pending (throw), never clean.
  assert.match(scanner, /if \(!response\.ok\) \{\s*controller\.abort\(\);\s*throw new Error/);
  assert.match(scanner, /classifyCloudmersiveAdvancedResult/);
  assert.match(scanner, /classification\.status === "clean" \? "clean" : "blocked"/);
  // A missing R2 object is blocked, not shown.
  assert.match(scanner, /scanStatus: "blocked"/);
  // Retryable poison rows rotate behind newer work instead of starving the queue.
  assert.match(scanner, /scanAttemptedAt/);
  assert.match(scanner, /scanAttemptCount/);
  assert.match(scanner, /orderBy\(asc\(jobMessages\.scanAttemptedAt\)/);
  // The response body is bounded while streaming, not after loading it all.
  assert.match(scanner, /response\.body\.getReader\(\)/);
  // Terminally blocked bytes are removed from storage.
  assert.match(scanner, /deleteJobMessageImage\(row\.imageKey\)/);
});

test("message image scan sweep runs on the scheduled cron", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /import \{ processPendingMessageImageScans \} from "\.\.\/lib\/message-image-scanner"/);
  assert.match(worker, /scheduledTask\("pending message image scans", \(\) => processPendingMessageImageScans\(\)\)/);
});

test("compose UI posts multipart and renders pending/blocked/clean states", async () => {
  const ui = await read("app/components/job-messages.tsx");
  assert.match(ui, /new FormData\(\)/);
  assert.match(ui, /payload\.set\("image", image\)/);
  assert.match(ui, /\/api\/message-image\?requestId=/);
  assert.match(ui, /Photo is being checked/);
  assert.match(ui, /didn&apos;t pass a safety check/);
});

test("message image columns are added by an additive migration", async () => {
  const migration = await read("drizzle/0058_message_image_attachments.sql");
  assert.match(migration, /ALTER TABLE `job_messages` ADD `image_key`/);
  assert.match(migration, /ALTER TABLE `job_messages` ADD `scan_status`/);
  assert.match(migration, /ALTER TABLE `job_messages` ADD `scan_attempted_at`/);
  assert.doesNotMatch(migration, /DROP TABLE|__new_/);
});
