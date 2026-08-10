# Working log

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-06

This is the shared memory between every chat session, tool, and person working
on Tuveloz. A conversation ends and takes its context with it; this file is what
survives.

**Newest entry goes at the top**, directly under this line. Read the top few
entries to catch up. Write one before you finish.

---

## 2026-08-10 — Closed three silent dead ends in account creation

**What happened.** Audited both signup paths end to end after asking whether
customers and providers can actually get accounts without trouble. Nothing was
broken, but three failures were silent — the visitor was told a code was on its
way and no email was ever sent, with no error to act on.

1. A provider picking the Provider tab and "Create account" without having
   applied. `eligibleAccountRoles()` only returns `provider` once an
   application row exists, so the server correctly refused and the generic
   response read as success. The provider create tab now says applications come
   first and links to `/join`.
2. The emailed-code throttle (3 per 15 minutes) was never surfaced. Both
   request routes returned the generic success text even when throttled, so
   anyone whose first code went to spam burned all three retries blind. Both
   routes now answer 429 with a real message.
3. No code entry step mentioned spam folders, the 10-minute expiry, or the send
   limit. All three now do.

**Decisions made.** Surfacing the 429 is only safe because the throttle now
runs *before* the eligibility lookup. The previous row-counting throttle could
only count rows it had written, so a 429 would itself have confirmed that an
address was real — an enumeration oracle, and the exact thing the generic "if
that email is eligible" wording exists to prevent. Throttling is now consumed
first, keyed by a hash of email+role+purpose, via the existing
`consumeFixedWindow` helper in `lib/public-write-rate-limit.ts` (no migration
needed). `issuePasswordChallenge` no longer throttles internally: its two
callers have to consume the window at different points — before the eligibility
lookup for a self-service request, after the password check for a sign-in — and
one shared throttle fired at the wrong moment for one of them.

Refusals stay generic. Naming which emails have applications would enumerate
providers; the fix is to state the rule up front, not to explain the refusal.

`tests/account-code-delivery.test.mjs` guards all of it, including the
throttle-before-eligibility ordering. That ordering assertion was
mutation-tested: reversing the two blocks fails it.

**Email authentication, checked the same day.** SPF, DKIM, and DMARC were
verified for `updates.tuveloz.com` by direct DNS query. DKIM aligns exactly and
SPF aligns under relaxed via Resend's `send.updates.tuveloz.com` bounce domain,
so alignment is correct. The gap is policy: `_dmarc.updates.tuveloz.com` does
not exist, so discovery falls back to `_dmarc.tuveloz.com`, which is `p=none`
with no `sp=` tag — monitoring only, no enforcement. Findings and the deliberate
tightening sequence are in
[`operations/email-authentication.md`](operations/email-authentication.md), with
dated rows in [`OPEN-ITEMS.md`](OPEN-ITEMS.md). The decision recorded: stay at
`p=none` until someone is actually reading `dmarc@tuveloz.com`, then move to
`p=quarantine` deliberately, and rotate the 1024-bit DKIM key to 2048.

**No end-to-end email test was possible before merge.** There is no preview
deployment for a pull request — every deploy step in `deploy-cloudflare.yml` is
gated on `github.event_name != 'pull_request'` — and staging cannot send at all:
`scripts/generate-staging-wrangler.mjs` sets `RESEND_FROM_EMAIL` to an empty
string and the staging Worker holds no `RESEND_API_KEY`, which `STAGING.md`
documents as intentional.

Verification was done locally instead, and is now committed as
`tests/e2e/account-signup.e2e.mjs` (`npm run test:e2e:account`). It runs in a
throwaway worktree against a real dev server, a real local D1, and a real
browser, with delivery pointed at `scripts/dev-mail-catcher.mjs` on loopback —
no production credential, no staging email, nothing leaving the machine. It
proves the property that matters: an eligible and an ineligible address are
indistinguishable across all four requests — same statuses, same response text
— while the catcher shows the two paths really did different work underneath,
three codes sent versus none. Reversing the throttle ordering makes it fail, so
it is a real guard.

What is still unproven is anything about **delivery**: nobody has watched a
code arrive in a real inbox, and the `Authentication-Results` header that would
turn the DNS analysis above into evidence has not been captured. Enabling
staging mail needs a separate Resend key and a `STAGING.md` update; whether to
do that at all is an open item.

**Now open.** Two friction points were left alone deliberately, as security
posture that is the owner's call rather than an assistant's:

- Password sign-in always requires an emailed code — mandatory 2FA on every
  sign-in, not optional. Passkey enrollment right after first sign-in is what
  softens this for repeat users.
- Sessions expire after 30 minutes idle and 12 hours absolute, so a provider
  working jobs will be signed out during the day.

Also unaddressed and structural: every entry path depends on Resend delivering
within 10 minutes, and phone/SMS is off (`PHONE_SMS_LIVE_MODE_ENABLED`). A
Resend incident or a domain-reputation dip locks everyone out with no fallback.

---

## 2026-08-09 — Locked the 5% customer-fee copy against regression

**What happened.** Audited the current production release and the source on
`main` after stale indexed pages exposed older 10% fee language. Cache-bypassed
production responses for the homepage, payment policy, provider agreement,
terms, customer agreement, provider signup, and post-job page contained no 10%
customer-fee claims. Production was serving the same commit as `main`.

**Decisions made.** The invariant is explicit for every assistant and every
copy surface: customers pay a 5% service fee, providers keep 100% of what they
quote, legacy 10% language is a defect, and the customer fee must never be
expressed as a deduction from provider earnings. A focused test now fails the
build if either forbidden claim returns in application, brand, AI-policy, or
assistant-handoff copy.

**Now open.** Search-engine and crawler snapshots may continue showing an old
version until they recrawl; production itself is current.

---

## 2026-08-08 — Homepage made launch-honest and shorter

**What happened.** Reworked the customer-facing hero on the homepage and customer lander so it no longer implies that live customer quotes are available today. Both now say that accounts are open while requests wait for adequate provider coverage. Added a clear “Need help today?” route to local shops, mobile mechanics, or licensed towing while dispatch is unavailable. Added a planned-fee example that labels final launch pricing and tax treatment as under review.

**Decisions made.** The homepage no longer uses provider counts, invented traction, or review substitutes as startup proof. It now focuses on customer choice, provider independence, documented service-specific requirements, and an honest launch state. The long provider-application, review, request, expansion, and feedback sections remain available on their dedicated pages or the About page instead of competing on the homepage.

**Now open.** Decide which first-wave local SEO pages to publish while customer requests remain closed. Any service page must be informational and collect launch interest rather than imply a live booking or quote turnaround.

---

## 2026-08-06 — Captured what the five open pull requests settle

**What happened.** Recorded the state of every open pull request in one place,
so the context survives when the chat sessions that produced them are deleted.
Deleting a conversation does not delete a branch, a pull request, or its
description — the work and the reasoning behind it are in Git and on GitHub, not
in the chat window. What was missing was a single place to see it together.

**The five open pull requests, oldest first.**

- **#90 — email exhaustion alerts and an open-work handoff.** A queued
  notification that used all five delivery attempts was dropped from every later
  retry batch silently, which for verification and compliance mail meant
  protective messages could go quietly undelivered. Now raises an owner incident
  on the exhausting attempt, deduplicated per event, inserted rather than sent
  inline, with a guard so an incident never raises an incident about itself. The
  dashboard counts `exhausted` separately from `failed` because the first never
  recovers on its own. Also adds `docs/OPEN_WORK_HANDOFF.md`.
- **#93 — the mobile app foundation. Must never be merged.** A complete Expo /
  React Native Phase 1 foundation under `mobile/`, sharing no code with the
  website. It belongs in a separate `tuveloz-app` repository; creating that
  repository returned `403 Resource not accessible by integration`, so the code
  was preserved here rather than discarded. Extraction is documented and was
  rehearsed in `mobile/docs/EXTRACTION.md`.
- **#95 — local-search pages and one name for the Customer Service Fee.** The
  fee had five different labels across the site, the agreements, and the Stripe
  receipt line; the economics never differed but nobody comparing two surfaces
  could know that. One name now, defined once, with a test that fails the build
  if a second name reappears. Adds 17 local-search URLs behind an explicit
  allowlist rather than a cross product, because two lists multiplied together
  produce doorway pages.
- **#96 — the `/providers` directory.** Stacked on #95 and based on its branch,
  so #95 must merge first. The directory is gated on the same `discovery` action
  that closes customer requests, because a directory listing providers while
  discovery is closed would be a way around that control.
- **#97 — jurisdiction-scoped compliance requirements, plus strategy
  documents.** Requirements now resolve from where the work happens rather than
  applying uniformly, failing closed in both directions.

**Also recorded.** Added the three migration traps to `CLAUDE.md` after
verifying them against `main`: numbers collide at `0053`, the generated
snapshots are stale past `0047` (35 snapshots for 54 migrations), and tests must
never pin the newest journal entry. Three branches have already been lost to
these.

**Now open.** Merge order matters and is not obvious from the pull request list:
#95 before #96, and #93 never. Both are in `OPEN-ITEMS.md`, along with the
launch blockers #90 surfaced.

---

## 2026-08-06 — Two documentation efforts collided; constraints consolidated

**What happened.** Opened PR #98 for the documentation structure and found PR
#97 already adds a root `CLAUDE.md` and its own `docs/INDEX.md`. Merging both
untouched would put two orientation files and two competing indexes on `main` —
the exact confusion this work exists to prevent.

**Decisions made.** The two sets of content are complementary, not duplicative,
so nothing is being discarded. #97 carries constraint knowledge — the three
fail-closed locks, the provider-classification never-build list, the Maryland
§ 8-205 and § 14-1001 detail. This branch carries filing infrastructure — the
filing guide, the records register, this log, the deadline register and its
automation. Folded #97's constraints into `CLAUDE.md` here after verifying each
claim against `main`: `PHONE_SMS_LIVE_MODE_ENABLED`, `automatic-job-routing.ts`,
`maryland-repair-records.ts`, `evidence-review-assistant.ts`, and the `testOnly`
short-circuit all exist as described.

Deliberately left out #97's jurisdiction-scoped compliance section. It describes
`imposed_by` and `local_requirements_reviewed` fields that #97 introduces and
that are not in `config/provider-eligibility-matrix.json` on `main` yet. That
section belongs in `CLAUDE.md` once #97 lands, not before.

**Now open.** Whichever PR merges second should drop its own `CLAUDE.md` and
index rather than adding a parallel one, so a single orientation file and a
single index survive. #97's three strategy documents — pitch, competitive
landscape, provider classification design — should get rows in `docs/README.md`
when they land. Both are tracked in `OPEN-ITEMS.md`.

---

## 2026-08-06 — Document organization system created

**What happened.** Set up the documentation structure: an index (`README.md`),
a portable project brief (`AI-HANDOFF.md`), filing rules (`FILING-GUIDE.md`),
category folders for business, legal, operations, and product documents, and a
register for real-world documents (`records/`). Added `CLAUDE.md` so Claude Code
sessions pick up the conventions automatically.

**Decisions made.** Originals of insurance, formation, tax, and license
documents stay outside this repository; only record cards describing them get
committed. Confirmed the repository is public, which makes that rule mandatory
rather than tidy. Existing docs stayed at their old paths because
`tests/admin-staging-test-lab.test.mjs` reads `docs/STAGING.md` by path.

**Also established.** External assistants read these documents through public
raw GitHub links rather than pasting. Added this log and `OPEN-ITEMS.md` as the
shared memory between sessions, plus a weekly workflow that opens a GitHub issue
when something in the register comes due.

**Now open.** The branch `claude/document-storage-organization-066mie` is not
merged, so none of this is reachable from `main` yet. The document register is
empty — no real business documents have been filed. See `OPEN-ITEMS.md`.

---

## How to write an entry

Add yours at the top, under the horizontal rule, using this shape:

```markdown
## YYYY-MM-DD — Short title of what happened

**What happened.** A few sentences. Enough that someone who was not here
understands what changed and why.

**Decisions made.** What was decided and what forced the answer. Skip if
nothing was decided.

**Now open.** What is unfinished, and what the next person should pick up.
Anything with a deadline goes in `OPEN-ITEMS.md` as well, not only here.

---
```

Write an entry when something changed that a future session would be wrong not
to know: a decision, a launch step, a policy change, a vendor approval, an
incident, a change of direction. Do not write one for routine edits — a log
nobody trusts to be significant is a log nobody reads.

Never rewrite or delete an old entry. If an entry turns out to be wrong, add a
new one at the top saying so. The record of what you believed at the time is
often the useful part.
