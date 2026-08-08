import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * Anything that lands a Tuveloz email in a spam folder costs more than that one
 * message: the recipient's provider learns to distrust the sending domain, and
 * the next thing it downranks is a sign-in code somebody is waiting on.
 */

test("bulk mail carries one-click unsubscribe headers", async () => {
  const sender = await read("lib/email-notifications.ts");

  // Gmail and Yahoo have required these of bulk senders since Feb 2024. A link
  // in the body is not a substitute — without the header the only way to stop
  // the mail from an inbox is "Report spam".
  assert.match(sender, /"List-Unsubscribe": `<\$\{url\}>`/);
  assert.match(sender, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
  assert.match(sender, /headers: await bulkUnsubscribeHeaders\(/);

  // Transactional mail must not claim to be a subscription.
  assert.match(sender, /if \(!eventKey\.startsWith\("launch-updates:"\)\) return \{\};/);
});

test("the one-click endpoint answers the POST those headers invite", async () => {
  const route = await read("app/api/launch-updates/unsubscribe/route.ts");

  // Advertising One-Click and then rejecting the POST is worse than not
  // advertising it: the provider records a failed unsubscribe.
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.match(route, /export async function GET\(request: Request\)/);
});

test("an empty subject or body is never queued", async () => {
  const sender = await read("lib/email-notifications.ts");

  const queue = sender.slice(
    sender.indexOf("async function queueNotification"),
    sender.indexOf("export async function sendLaunchUpdateEmail"),
  );
  assert.match(queue, /const subject = notification\.subject\.trim\(\);/);
  assert.match(queue, /const textBody = notification\.textBody\.trim\(\);/);
  assert.match(queue, /if \(!subject \|\| !textBody\) \{/);
  // The trimmed values are what get stored, not the raw ones.
  assert.match(queue, /\n      subject,\n      textBody,\n/);
});

test("every launch-update step has a subject and a body in both languages", async () => {
  const { LAUNCH_UPDATE_SEQUENCE } = await import("../lib/launch-updates.ts");

  assert.ok(LAUNCH_UPDATE_SEQUENCE.length > 0);
  for (const step of LAUNCH_UPDATE_SEQUENCE) {
    for (const field of ["subject", "subjectEs"]) {
      assert.ok(step[field]?.trim(), `step ${step.step} has no ${field}`);
      // A subject that is only a word or two reads as machine-generated.
      assert.ok(step[field].trim().length >= 12, `step ${step.step} ${field} is too thin`);
    }
    for (const field of ["body", "bodyEs"]) {
      assert.ok(step[field]?.length, `step ${step.step} has no ${field}`);
      const words = step[field].join(" ").trim().split(/\s+/).length;
      // The message in the screenshot that got filtered was a bare link. Real
      // prose is what separates a newsletter from a drive-by link.
      assert.ok(words >= 40, `step ${step.step} ${field} is only ${words} words`);
    }
  }
});

test("a subject taken from caller input is gated on being present", async () => {
  const notifications = await read("lib/marketplace-notifications.ts");

  // This is the one place a subject is not a literal in the sending module.
  assert.match(notifications, /if \(input\.emailSubject && input\.emailLines\?\.length\) \{/);
  assert.match(notifications, /subject: clean\(input\.emailSubject, 180\)/);
});

test("marketing mail refuses to send without the postal address the law requires", async () => {
  const delivery = await read("lib/launch-update-delivery.ts");
  const updates = await read("lib/launch-updates.ts");

  // CAN-SPAM requires a physical address on marketing mail, and its absence is
  // both a legal problem and a filter signal.
  assert.match(delivery, /postalAddress/);
  assert.match(updates, /postalAddress/);
  // The sequence must self-block rather than send a non-compliant footer.
  assert.match(delivery, /blocked/);
});
