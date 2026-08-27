# BriefReceipt pilot intake checklist — 2026-08-27

- **Status:** draft for owner review — the intake route itself stays disabled
  until the owner verifies and enables it
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-27
- **Purpose:** Defines exactly what "complete intake" means for the $99
  founding pilot, so the two-business-day clock has an unambiguous start and
  the first interested reply doesn't turn into an improvised scramble.

## Why this exists

The offer says: one plain receipt per post within two business days **after
complete intake and accepted payment**. Until this file, "complete intake" was
undefined. A qualified lead arriving today would have hit an empty process.
This checklist is the process, ready for the owner to approve, adjust, and
wire to a real route.

## What the customer must supply (all of it, before the clock starts)

1. **The brief** — as a document or pasted text the customer owns and has the
   right to share. If requirements were only ever communicated in DMs, the
   customer extracts and pastes the exact requirement lines themselves.
   **We never accept or store forwarded DM threads, chat exports, or
   screenshots of private conversations** — that is a hard boundary, not a
   convenience.
2. **Up to 10 public Instagram post URLs, and for each post the caption text
   (copy-pasted by the customer) plus one full-view screenshot of the post as
   the public sees it.** Public posts only — no login, no password, no account
   access, ever; screenshots come from the customer's own public view, never
   from inside an account. The caption text and screenshot are what receipts
   quote, which keeps every receipt verifiable by the customer and producible
   even when a post is later edited or an automated fetch is blocked. A post
   that is private, deleted, or missing its caption/screenshot gets its
   receipt line marked UNVERIFIABLE rather than guessed at.
3. **Scope confirmation** — which brief requirements to check. Default scope:
   every objectively checkable line item — required tags and hashtags,
   required mentions, required caption elements, posting dates and windows,
   usage-rights windows. Explicitly out of scope: tone, aesthetics, whether
   content is "good," and any legal conclusion.
4. **Campaign dates and usage terms** if they are not already in the brief.
5. **A delivery email address** the customer chooses for receiving receipts.
6. **Three confirmations, checked by the customer:**
   - they own or are authorized to share the brief;
   - they understand receipts are factual brief-vs-post comparisons, not
     legal advice;
   - every approval and payment decision is theirs.

## Payment

- Payment is **accepted before the clock starts**; intake without accepted
  payment is a conversation, not a pilot.
- The rail is the owner's decision and is currently **disabled and
  unverified**. Candidate: a hosted payment link where the processor handles
  card data end-to-end — **BriefReceipt never sees or stores card numbers.**
- **Never reuse Tuveloz's Stripe configuration.** Tuveloz's payment stack sits
  behind deliberate live-mode locks in this same repository; BriefReceipt is a
  separate business and gets a separate, owner-created rail. No exceptions.

## What a receipt is (deliverable spec)

One receipt per post, plain text, three columns per checked line:

```
BRIEF SAYS   <the requirement, quoted or tightly paraphrased>
POST SHOWS   <what is actually observable in the public post>
STATUS       MATCH / MISS / UNVERIFIABLE
```

- One receipt covers one post; a 10-post pilot returns 10 receipts.
- UNVERIFIABLE is an honest answer, never silently dropped.
- No scores, no grades, no recommendations beyond the lines themselves.

## Clock rules

- The two-business-day clock starts only when **both** are true: every item
  above is supplied, and payment is accepted.
- If intake is incomplete, we reply naming exactly what is missing; the clock
  does not start, and that is stated plainly rather than implied.

## What we never collect, from anyone, for any reason

Passwords, OTPs, phone numbers, birth dates, cookies, payment-card data,
private messages or exports of them.

## Before this route can go live (owner actions)

1. Approve or amend this checklist.
2. Create the payment rail (separate from Tuveloz) and verify a test
   transaction end-to-end.
3. Decide the intake channel (email to a BriefReceipt address, or a simple
   form) and verify it receives submissions.
4. Update `claude-operations-state.json`: flip `payments` and
   `private_intake` from `disabled_and_unverified` only after each is
   actually verified — the state file records reality, never intent.
