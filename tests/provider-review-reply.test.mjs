import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("reply-review only touches a published review the signed-in provider owns", async () => {
  const source = await read("app/api/provider-profile/route.ts");

  // The action exists and is gated by the same activeProvider + same-origin POST guard.
  assert.match(source, /action === "reply-review"/);
  // Ownership is enforced in the lookup: the review must match this provider's
  // email and be published — a provider can never reply to someone else's review.
  assert.match(
    source,
    /eq\(jobReviews\.id, reviewId\),\s*eq\(jobReviews\.providerEmail, provider\.email\),\s*eq\(jobReviews\.status, "published"\)/,
  );
  // Reply text is length-capped like every other provider-supplied field.
  assert.match(source, /clean\(payload\.reply, 600\)/);
  // An empty reply clears the response and its timestamp.
  assert.match(source, /providerReplyAt: reply \? new Date\(\)\.toISOString\(\) : ""/);
});

test("provider replies are published on the public storefront, not just the private workspace", async () => {
  const publicApi = await read("app/api/public-provider/route.ts");
  assert.match(publicApi, /providerReply: jobReviews\.providerReply/);

  const storefront = await read("app/providers/[slug]/page.tsx");
  assert.match(storefront, /Response from the provider/);
  assert.match(storefront, /review\.providerReply/);
});

test("job_reviews reply columns are added by a non-destructive additive migration", async () => {
  const migration = await read("drizzle/0051_provider_review_reply.sql");
  assert.match(migration, /ALTER TABLE `job_reviews` ADD `provider_reply` text DEFAULT '' NOT NULL/);
  assert.match(migration, /ALTER TABLE `job_reviews` ADD `provider_reply_at` text DEFAULT '' NOT NULL/);
  // Must stay additive: no table rebuild / drop that could disturb existing rows or triggers.
  assert.doesNotMatch(migration, /DROP TABLE|__new_job_reviews/);
});
