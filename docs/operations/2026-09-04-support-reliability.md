# Tuveloz support reliability and provider application fixes

- **Status:** active; deployed in PR #183
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-04
- **Applies to:** public assistant, owner support, provider onboarding

The live assistant returned HTTP 503 `AI_UNCONFIGURED` for basic fee and parts
questions. Public pages and `/api/health` were reachable; a healthy database did
not prove that the assistant worked. The observed live release was
`9476db32fbd41d4df126096048cdb4c9b3771063`.

## Resulting behavior

Known Tuveloz questions return published policy wording and source links before
any model call. English and Spanish both work without an API key. The launch
notice remains visible. Uncovered questions receive an honest unavailable
message when no AI provider is configured. The UI identifies policy answers and
hides vehicle starters in that state. Failed questions stay available to retry.

Contact the owner opens an editable message and reply-email form. Submission
requires explicit consent and transmits only that message, reply email, role,
and language. It does not collect the transcript or subscribe the visitor to
marketing. The reply email is visitor-provided and unverified.

`POST /api/support` requires same-origin requests, bounded JSON, validation,
consent, and durable fixed-window limits: 60/hour globally, 5/hour by IP, and
3/hour by reply email. The recipient is the configured `OWNER_EMAIL`; the
visitor cannot select a recipient. Identical request retries use the existing
email outbox and Resend idempotency key. A 202 response means durably queued,
not inbox receipt. Missing email configuration or database failure returns an
error instead of a success confirmation.

The narrowly recognized `owner:support:` event can send during onboarding;
transaction mail remains blocked. Delivery uses the existing retry and failure
incident mechanisms. No new database migration is required. Operations should
check email delivery failures in the protected owner dashboard.

Provider changes improve mobile service-category width, remove the duplicate
H1, correct requirements wording to include Tuveloz checks, remove the
unmeasured completion-time claim, describe the provider side of the job flow,
and clarify that the Customer Service Fee does not reduce the provider's quote.
The customer-launch state, provider requirements, and pinned policy releases
are unchanged.

## Verification and limits

Production update: commit `c508a95f65656385d5a2503f657b65de60d4e51f`
deployed successfully in [run 33934287388](https://github.com/willym249-dev/Tuveloz-website/actions/runs/33934287388).
Twelve independent live HTTP checks and English/Spanish browser checks passed.
The labeled support test was subsequently found in the monitored owner inbox;
Gmail displayed `send.updates.tuveloz.com` as mailed-by and
`updates.tuveloz.com` as signed-by. Owner replies through Google Workspace need
separate authentication verification. The bullets below retain the original
pre-release checks.

- Regression reproduced: the initial availability tests failed five of seven
  cases against the original handler. Published-answer and Spanish cases pass
  after the repair.
- Actual route tests cover missing keys, upstream errors, short policy questions,
  Spanish, malformed support requests, missing consent, origin checks, rate
  rejection, database failure, and protected email classification.
- Local browser verified English fee answers, Spanish parts answers, the editable
  support form, and a successful synthetic submission. The local Resend-shaped
  mail catcher received exactly the submitted message and reply details.
- At a 390px browser viewport, the document content and scroll width were both
  375px (scrollbar excluded), provider category text width was 231px, and the
  provider page had one H1.
- Production account creation, document upload, email delivery, and payment
  flows were not exercised. No production test application was submitted.

Zeo's current BrainGateway reported `route_not_ready`: no verified general
checkpoint or attested chat runtime. No legacy outside model was relabeled as
Zeo and no Zeo integration is claimed. The independent Claude availability
probe returned HTTP 403 with `is_error=true`; it reviewed no code. Codex authored
and verified these changes, so there is no three-assistant review claim.

## Release

Use the normal reviewed GitHub Actions release path after owner approval. Run
`npm run lint` and `npm test`, inspect the final diff, and verify the deployed
commit through `/api/health`. Confirm `/api/ai` returns policy-guide mode and
answers a benign policy question without a key. Verify owner support delivery
with an explicitly approved test before relying on it for customer support.
Do not change the marketplace, Stripe, or SMS launch switches as part of this fix.

Attaching Zeo later needs an authenticated server-side integration and a
verified ready chat runtime; the public website must not expose the owner's
private Zeo management interface. Published policy answers and owner contact
should remain available if that runtime is unavailable.
