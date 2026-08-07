import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  POLICY_ENTRIES,
  findPolicyEntries,
  replyKeepsRequiredHedges,
  starterQuestions,
  vettedAnswer,
} from "../lib/ai/policy-knowledge.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The assistant answers policy questions from vetted entries rather than from
// the model's memory. That is only safe while each entry still matches the page
// it cites, so this walks every citation.
test("every policy answer cites a page that exists and still says what it claims", async () => {
  assert.ok(POLICY_ENTRIES.length >= 10);

  for (const entry of POLICY_ENTRIES) {
    const page = await read(`app${entry.source.href}/page.tsx`).catch(() => null);
    assert.ok(page, `${entry.id} cites ${entry.source.href}, which has no page`);
    assert.ok(
      page.toLowerCase().includes(entry.anchor.toLowerCase()),
      `${entry.id} cites ${entry.source.href}, but "${entry.anchor}" is no longer on that page`,
    );
    assert.ok(entry.source.label.length > 3, `${entry.id} needs a readable source label`);
    assert.ok(["customer", "provider", "both"].includes(entry.audience));
  }
});

// Money and legal posture are where a confident wrong answer does real damage.
test("answers about money and status keep the policy's own hedges", () => {
  const byId = Object.fromEntries(POLICY_ENTRIES.map((entry) => [entry.id, entry]));

  // The payments policy calls the fee and the transfer design "proposed" and
  // subject to approval. The assistant must not upgrade that to settled fact.
  assert.match(byId["customer-fee"].answer, /still going through compliance and tax review/i);
  assert.match(byId["provider-payout"].answer, /still subject to processor, insurance, and accounting sign-off/i);
  assert.match(byId["both-launch-state"].answer, /not for real jobs yet/i);

  // Independence wording has to survive intact — it is a legal position.
  assert.match(
    byId["provider-independence"].answer,
    /does not employ, train, sponsor, assign, or supervise/i,
  );
});

test("policy retrieval fires on policy questions and stays out of the way otherwise", () => {
  const ids = (message, audience) => findPolicyEntries(message, audience).map((entry) => entry.id);

  assert.deepEqual(ids("how much do you charge me in fees", "customer"), ["customer-fee"]);
  assert.deepEqual(ids("who buys the parts", "customer"), ["customer-parts"]);
  assert.deepEqual(ids("who sees my address", "customer"), ["customer-privacy"]);
  assert.deepEqual(ids("am I an employee of tuveloz", "provider"), ["provider-independence"]);
  assert.ok(ids("when do I get paid out", "provider").includes("provider-payout"));

  // A plain symptom description must not drag policy text into the prompt.
  for (const message of [
    "my car makes a clicking noise when I brake",
    "a warning light came on this morning",
    "there is a puddle under the engine",
  ]) {
    assert.deepEqual(ids(message, "customer"), [], `"${message}" should stay vehicle guidance`);
  }

  // Audience separation: provider-only material never reaches a customer.
  const customerIds = new Set(POLICY_ENTRIES.filter((e) => e.audience === "provider").map((e) => e.id));
  for (const id of ids("how do I get paid", "customer")) {
    assert.ok(!customerIds.has(id), `${id} is provider-only but surfaced for a customer`);
  }

  assert.equal(starterQuestions("provider").length, 4);
  assert.equal(starterQuestions("customer").length, 4);
});

test("the assistant route grounds policy answers and refuses to improvise", async () => {
  const route = await read("app/api/ai/route.ts");

  assert.match(route, /findPolicyEntries/);
  assert.match(route, /Answer it using ONLY the reference material below/);
  assert.match(route, /Keep every hedge/);
  assert.match(route, /Never guess at a policy, a fee, a timeline, or a legal position/);
  // The audience the visitor picked drives which material is eligible.
  assert.match(route, /body\.audience === "provider"/);
  // Citations travel back to the UI so the reader can check the source.
  assert.match(route, /sources: policyEntries\.map/);
});

test("the assistant UI offers both audiences and shows where answers came from", async () => {
  const component = await read("app/components/tuveloz-ai-assistant.tsx");

  assert.match(component, /audience/);
  assert.match(component, /starterQuestions\(audience\)/);
  assert.match(component, /ai-sources/);
  assert.match(component, /Read it yourself/);
  // Arriving from a provider page preselects the provider view.
  assert.match(component, /URLSearchParams\(window\.location\.search\)\.get\("for"\)/);
  assert.match(component, /JSON\.stringify\(\{ message: trimmed, language, history, audience \}\)/);
});

test("people can reach the assistant from where they get stuck", async () => {
  const [policy, customer, providerJobs] = await Promise.all([
    read("app/components/policy-page.tsx"),
    read("app/customer/page.tsx"),
    read("app/provider-jobs/page.tsx"),
  ]);

  assert.match(policy, /href="\/ai"/);
  assert.match(customer, /href="\/ai"/);
  assert.match(providerJobs, /href="\/ai\?for=provider"/);
});

test("ai.tuveloz.com is served by this Worker and lands on the assistant", async () => {
  const [wrangler, worker] = await Promise.all([
    read("wrangler.jsonc"),
    read("worker/index.ts"),
  ]);

  assert.match(wrangler, /"pattern":\s*"ai\.tuveloz\.com"/);
  assert.match(worker, /AI_HOSTNAMES/);
  assert.match(worker, /target\.pathname = "\/ai"/);
  // Temporary on purpose: a permanent redirect would outlive any change of mind.
  assert.match(worker, /Response\.redirect\(target\.toString\(\), 302\)/);
  // Only the root redirects, so links the assistant hands out still resolve.
  assert.match(worker, /requestUrl\.pathname !== "\/"/);
});

// The prompt asks the model to keep the policy's hedges; this makes it a rule.
// Without it, "the fee is 5%" — stated as settled fact about a design still in
// compliance review — would go straight to a customer.
test("a reply that drops a required hedge is replaced with the vetted wording", () => {
  const feeEntries = findPolicyEntries("what do you charge in fees", "customer");
  assert.ok(feeEntries.some((entry) => entry.hedged));

  for (const settled of [
    "Tuveloz charges a 5% service fee on your total.",
    "You pay the labor price plus 5%. That is the fee.",
  ]) {
    assert.equal(replyKeepsRequiredHedges(settled, feeEntries), false, settled);
  }

  for (const hedged of [
    "The current design adds a 5% fee on top of the labor price.",
    "It is 5% today, but that is still under review.",
    "Right now the plan rather than the promise is 5%.",
  ]) {
    assert.equal(replyKeepsRequiredHedges(hedged, feeEntries), true, hedged);
  }

  // The replacement is the approved text, and it carries its own hedge.
  const fallback = vettedAnswer(feeEntries);
  assert.match(fallback, /still going through compliance and tax review/);
  assert.equal(replyKeepsRequiredHedges(fallback, feeEntries), true);
});

test("the hedge guard leaves ordinary vehicle chat alone", () => {
  const none = findPolicyEntries("my brakes squeak in the morning", "customer");
  assert.deepEqual(none, []);
  // No hedged entry in play means any reply is fine — the guard must not
  // start policing car advice.
  assert.equal(replyKeepsRequiredHedges("Sounds like worn pads. Get them looked at.", none), true);
});

test("every hedged entry is one the policy itself calls provisional", () => {
  const hedged = POLICY_ENTRIES.filter((entry) => entry.hedged).map((entry) => entry.id);
  assert.deepEqual(
    hedged.sort(),
    ["both-launch-state", "customer-fee", "customer-refunds", "provider-payout"],
  );
});

test("the route serves vetted wording instead of a reply that lost its hedge", async () => {
  const route = await read("app/api/ai/route.ts");

  assert.match(route, /replyKeepsRequiredHedges\(result\.answer, policyEntries\)/);
  assert.match(route, /reply: hedgesHeld \? result\.answer : vettedAnswer\(policyEntries\)/);
});
