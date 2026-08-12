import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Line endings are normalised because the assertions below slice the source on
// "\n}\n". A Windows checkout hands back CRLF, that terminator is never found,
// indexOf returns -1, and the "function body" silently becomes the whole rest
// of the file — so a body assertion is then testing unrelated code. It only
// misbehaves off CI, which is the worst place for a test to disagree with
// itself.
const source = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8"))
    .replace(/\r\n/g, "\n");

test("a row that uses its last delivery attempt raises an owner incident", async () => {
  const lib = await source("lib/email-notifications.ts");

  // The incident is raised from markFailed, which is the only place that knows
  // an attempt was just consumed.
  assert.match(lib, /if \(attempts >= MAX_DELIVERY_ATTEMPTS\) \{\s*await raiseDeliveryExhaustedIncident\(eventKey, error\);/);

  // Both failure paths (unconfigured Resend, and a rejected send) must pass the
  // event key through, or the incident cannot name the message that was lost.
  assert.match(lib, /new Error\("Resend email delivery is not configured\."\),\s*notification\.eventKey,/);
  assert.match(lib, /await markFailed\(notification\.id, attempts, error, notification\.eventKey\);/);
});

test("the exhaustion incident is protective and cannot be suppressed by a paused marketplace", async () => {
  const lib = await source("lib/email-notifications.ts");
  const policy = await source("lib/email-event-policy.ts");

  assert.match(
    lib,
    /export const DELIVERY_EXHAUSTED_EVENT_PREFIX = "owner:incident:email-delivery-exhausted:";/,
  );

  // "owner:incident:" is classified protective, so emailEventDeliveryIsAllowed
  // returns true regardless of CUSTOMER_JOB_POSTING_PAUSED, and the retry query
  // still treats the row as a candidate.
  assert.match(policy, /"owner:incident:%",/);
  assert.match(policy, /"owner:incident:",/);
});

test("an incident is never raised about an incident", async () => {
  const lib = await source("lib/email-notifications.ts");

  // Without this guard an unreachable owner mailbox would queue a fresh alert
  // each time the previous one exhausted, growing the outbox unboundedly.
  assert.match(
    lib,
    /if \(eventKey\.startsWith\(DELIVERY_EXHAUSTED_EVENT_PREFIX\)\) return;/,
  );

  // No owner address means no incident, rather than a row addressed to "".
  assert.match(lib, /const ownerEmail = cleanEmail\(runtimeEnv\(\)\.OWNER_EMAIL\);\s*if \(!ownerEmail\) return;/);
});

test("the incident is queued for the cron rather than delivered inline", async () => {
  const lib = await source("lib/email-notifications.ts");
  const raiser = lib.slice(lib.indexOf("async function raiseDeliveryExhaustedIncident"));
  const body = raiser.slice(0, raiser.indexOf("\n}\n"));

  // raiseDeliveryExhaustedIncident runs inside deliverEvent. Sending from here
  // would re-enter delivery while the failing row is still being written.
  assert.doesNotMatch(body, /await deliverEvent\(/);
  assert.doesNotMatch(body, /await flushPendingEmailNotifications\(/);
  assert.doesNotMatch(body, /queueNotification\(/);

  // Repeated failures of the same message collapse onto a single incident.
  assert.match(body, /eventKey: `\$\{DELIVERY_EXHAUSTED_EVENT_PREFIX\}\$\{eventKey\}`,/);
  assert.match(body, /onConflictDoNothing\(\{\s*target: emailNotificationOutbox\.eventKey,/);

  // Recipient details stay in the owner dashboard, not in the alert body.
  assert.match(body, /Recipient details stay in the/);
  assert.doesNotMatch(body, /recipientEmail: notification/);
});

test("the owner dashboard separates exhausted deliveries from recoverable failures", async () => {
  const route = await source("app/api/admin/control-center/route.ts");

  // A single source of truth for the cap, imported rather than re-declared, so
  // the dashboard cannot drift from the retry query.
  assert.match(
    route,
    /import \{ MAX_DELIVERY_ATTEMPTS as MAX_EMAIL_DELIVERY_ATTEMPTS \} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/email-notifications";/,
  );

  // attempts must be selected, or exhaustion cannot be distinguished at all.
  assert.match(route, /SELECT recipient_email AS recipientEmail, status, attempts/);

  // Exhausted rows are counted in addition to failed, not instead of it.
  assert.match(
    route,
    /summary\.failed \+= 1;[\s\S]*if \(emailRecord\.attempts >= MAX_EMAIL_DELIVERY_ATTEMPTS\) \{\s*summary\.exhausted \+= 1;/,
  );
  assert.match(route, /const created = \{ sent: 0, pending: 0, failed: 0, exhausted: 0 \};/);
});
