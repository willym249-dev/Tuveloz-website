# Brief for GPT — signup improvements (provider + customer)

You own copy. A parallel Claude session owns the code and will not edit copy
files you produce. Read `docs/SESSION-HANDOFF.md` first for repo-wide context,
then this file. Where the two disagree about signup, this file is newer.

Verified against the source on 2026-08-08. Nothing below is inherited.

---

## 1. Non-negotiables

Break any of these and the work is unusable.

- **Fee model:** providers keep **100%** of their quoted price; customers pay a
  **5%** fee on top. Never write "providers keep 95%".
- **Pre-launch gate:** `CUSTOMER_JOB_POSTING_PAUSED = true` in
  `lib/launch-status.ts`. No customer can post a job. Copy may never imply
  otherwise. Customer *accounts* are open; customer *requests* are not.
- **Plain language.** Everyday words, 8-year-old-simple. Not jargon.
- **Minimal disclosure.** Show what the audience needs. Keep legal disclosures,
  hide internal operations.
- **Audience:** Montgomery County, Maryland. Providers are mobile mechanics and
  detailers, a meaningful share of them Spanish-speaking.
- Provider requirements are **legally required documents only** — this always
  includes every IRS obligation (W-9, 1099). Never trim those.

---

## 2. Actual state of the three signup surfaces

| Surface | File | Reality |
| --- | --- | --- |
| Provider signup | `app/components/provider-signup-form.tsx` (1,872 lines) | Live. 3 steps. Autosaves a draft to `localStorage`. |
| Customer account signup | `app/account/page.tsx` (916 lines) | Live. Email + password + 6-digit code. Also the provider sign-in. |
| Customer job request | `app/components/customer-request-form.tsx` | **Unreachable.** Behind the pre-launch gate. Do not write copy for it. |

### The language situation — read this before writing any Spanish

The site is **English-only right now, deliberately.** Two mechanisms:

- `getLanguageSnapshot()` in `app/components/site-language.tsx:832` returns the
  literal `"en"` regardless of any stored preference.
- `SiteLanguageButton` returns `null`, so no toggle renders anywhere.

The in-code comment explains why: the `spanishText` dictionary is incomplete and
predates several English-only rewrites (homepage, Terms of Use, Provider
Agreement). Rather than drop someone into a half-translated legal page, the
whole toggle is off.

Consequence: the provider form contains hundreds of
`providerFormIsSpanish ? "…" : "…"` branches that **no user can currently
reach.** They are correct code sitting behind a closed door.

**How translation actually works.** `spanishText` in `site-language.tsx` is a
flat `Record<string, string>` mapping an exact English string to its Spanish
equivalent. A `MutationObserver` walks `document.body` and swaps any text node
whose full content matches a key, plus `placeholder`, `title`, and `aria-label`
attributes. So adding Spanish is **pure data entry into one object** — no
component changes, no code. That is why this work is yours.

---

## 3. Your scope

In priority order.

### 3.1 Fill the Spanish dictionary for the signup path

Add entries to `spanishText`. Keys must match the rendered English **exactly**,
character for character, or the swap silently does nothing. Copy the English
from the source file, do not retype it.

Cover, at minimum:

- **All of `app/account/page.tsx`** — every visible string. This is both the
  customer signup and the provider sign-in, so it is the highest-value file.
  Includes the role tabs, mode tabs, all four form variants, button labels,
  busy-state labels ("Sending…", "Verifying…"), the password guidance, the
  policy-consent sentence, the passkey block, and the security note.
- **The provider form's English-only blocks**, which stay English even when the
  Spanish branch is taken. These are real gaps in an otherwise bilingual file:
  - `provider-signup-form.tsx:1794-1831` — the entire verification-code section:
    "6-digit verification code", "Verifying...", "Verify email and continue",
    "Send the code again", "Edit application".
  - `:1746-1750` — the work-authorization acknowledgment.
  - `:1756-1770` — the terms bundle and privacy acknowledgment, including the
    link text.
  - `:928-954` — the step-1 legal explainer inside `<details>`.

Deliver as a single fenced block of `"English": "Spanish",` lines, ready to
paste into the object. Flag any string you think should **not** be translated
(legal terms of art, official document names) rather than guessing.

**Do not turn the toggle back on.** That is a launch decision, not yours, and it
needs native-speaker review of the legal pages first. Note in your reply how
close to complete the dictionary is after your pass.

### 3.2 Write the customer-signup value proposition

Today `/account` in create mode says customer job tools are closed, then asks
for a password. It gives no reason to sign up. Write, in English:

- A one-line reason to create an account **now**, honest about the gate.
- A short "what you get today / what opens at launch" pair.
- The replacement for the role tab currently reading
  "Provider applicant / provider".

Then translate all of it.

### 3.3 Password guidance

The rule is: at least 10 characters, one uppercase letter, one special
character, max 128, spaces allowed. Currently one static sentence, and on submit
`passwordError()` surfaces one failure at a time. Claude is adding live
per-rule checks — write the four short rule labels (English + Spanish) that sit
next to the checkmarks.

---

## 4. Boundaries

- **Do not edit `.tsx` components.** Deliver copy; Claude places it.
- **Do not write copy for `customer-request-form.tsx`** — it is gated off.
- **Do not change the fee model, the pre-launch honesty lines, or any legal
  acknowledgment text** without flagging it separately. Those have review
  history.
- Deliver as a new file under `docs/marketing/` or inline in your reply.

---

## 5. Decisions already made, so you don't re-litigate them

**Provider email moves to step 1** (Claude's change). Today email is collected
on step 3 of 3, and the verification challenge fires after it, so anyone who
abandons earlier leaves no trace at all.

The change is **client-side only**: the field moves up, the existing
`localStorage` draft covers it, and **no server record is created until the
existing end-of-flow challenge fires.** This improves recovery on the same
device. It explicitly does **not** enable follow-up email to people who
abandon — that would mean storing contact details from unfinished applications,
which needs a consent line and a retention answer, and is Wil's call, not ours.

If Wil later says yes to server-side capture, the copy you'd need is a single
plain-language consent sentence at the point of email entry. Draft it now as a
labeled "not yet in use" extra so it's ready, but write the step-1 field as if
it is client-side only.

---

## 6. How Wil wants to be worked with

Direct verdicts, grouped in buckets. State confidence once. No scare framing.
Be factual — verify against the files before asserting; no guessing. Don't end a
reply on a homework list. Counsel / broker / CPA / Stripe get named once as a
footnote, never as the answer to "what's next".
