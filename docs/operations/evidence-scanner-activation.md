# Turning on the evidence malware scanner

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-06
- **Applies to:** `EVIDENCE_SCAN_PROVIDER`, the Cloudmersive scheduled scanner,
  and the `evidence_file_security_and_scanner` launch gate

The owner-approved Cloudmersive account exists. Its API key and random 64-character
callback secret are stored as encrypted Worker secrets; both names were verified
in the active deployment on September 5. No secret value was printed or saved
locally during callback-secret setup. Production processing remains off:
`EVIDENCE_SCAN_PROVIDER` is `unconfigured`.
The last account check showed Free Tier. On September 5 the first recorded
Basic payment attempt failed; no paid subscription was confirmed. The owner
has since asked to reduce document uploads to 3.5 MB and add photo resizing.
Do not retry payment as part of that change. The advertised Free Tier is an
evaluation plan; confirm its suitability, capacity and actual endpoint behavior
before enabling processing. A smaller upload limit alone does not activate the
scanner or establish that the free plan supports production use.

## Provider upload sizing

New evidence uploads and the scheduled scanner share `MAX_EVIDENCE_BYTES =
3_500_000` in `lib/provider-evidence-limits.ts`. This uses decimal MB rather
than 3.5 MiB to avoid exceeding either interpretation of the vendor limit.
Photos up to 20 MB can be prepared locally in the provider's browser. Oversized
JPG, PNG and WebP images are re-encoded as JPEG, keeping the full frame and
displayed orientation. Attempts stop at 2400 pixels on the longest side and
JPEG quality 0.86; smaller originals are not enlarged. The provider must check
the resulting preview before submitting. This is not an automated guarantee
of readability or document authenticity.

Files already under the limit are unchanged. PDFs are never rasterized or
trimmed; an oversized PDF receives issuer-copy/help instructions that preserve
every page. The upload form supports English and Spanish and defaults to the
provider's saved language. This does not release translated legal agreements.

Existing stored evidence is not rewritten or deleted. An older oversized file
that is still awaiting a scan remains non-clean and needs a correctly scoped
replacement; it is never silently resized after its evidence hash was recorded.

The interface contract is
[`../EVIDENCE_SCANNER_CALLBACK.md`](../EVIDENCE_SCANNER_CALLBACK.md). This
document is the operational procedure; that one is what the scanner and its
callback must do.

## What already exists

- `lib/cloudmersive-evidence-scanner.ts` — the scheduled scanner
- `lib/cloudmersive-scan-policy.ts` — configuration test and result classifier
- `lib/evidence-scan-result-recorder.ts` — the shared D1 recorder
- `app/api/internal/evidence-scan-result/route.ts` — the signed callback
- `tests/cloudmersive-evidence-scanner.test.mjs` — result-policy, binding and retry checks
- `tests/cloudmersive-transport.test.mjs` — streamed-response deadlines, error-body
  cleanup and fail-closed outcomes for evidence and message images
- A cron trigger every 15 minutes (`wrangler.jsonc`), which calls
  `processPendingCloudmersiveEvidenceScans()` from `worker/index.ts`

Evidence is already quarantined until a scan reports `clean`, and that holds
whether or not a scanner is configured. Turning the scanner on does not create
the quarantine; it creates the only way out of it.

## Order of operations

**Do not set `EVIDENCE_SCAN_PROVIDER` first.** All three settings are checked
together by `cloudmersiveScannerConfigured()`, so setting the provider name
before the secrets exist leaves the scanner just as non-functional while the
deployed config claims a vendor is connected. Set the secrets first; flip the
config last.

### 1. Vendor account

Use a Cloudmersive account with a plan that includes the **Advanced Virus
Scan** endpoint. The basic scan endpoint is not enough — the scanner requires the
advanced threat flags, and a clean result is recorded only when all of them are
explicitly false, the virus list is explicitly empty or null, and a verified
file format is present.

On September 5, 2026, the public [small-business pricing](https://cloudmersive.com/pricing-small-business)
and [plan selector](https://portal.cloudmersive.com/selectplan) list the free
tier at 600 calls/month, one request/second and 3.5 MB. Basic lists
$19.99 USD/month, 10,000 calls/month, two requests/second and a general 1 GB
file limit; individual API limits can differ. Confirm Advanced Virus Scan
coverage for the site's actual `3_500_000` byte limit and the account's
terms before activating it. Existing code does not coordinate a shared
rate limit between evidence and message-image sweeps; include quota and 429
retry behavior in the activation rehearsal. Do not silently reduce the site's
upload allowance or subscribe without owner approval.

### 2. Two secrets, set by an authorized operator

Both secrets are already present as of September 5. Preserve them; these commands
are for initial setup or a separately coordinated rotation, not a reason to
rotate working credentials every session.

Never in `wrangler.jsonc`, never committed. From the repository root:

```bash
node node_modules/wrangler/bin/wrangler.js secret put CLOUDMERSIVE_API_KEY
```

```bash
node node_modules/wrangler/bin/wrangler.js secret put EVIDENCE_SCAN_WEBHOOK_SECRET
```

The webhook secret must be **at least 32 characters** of random text — the
configuration check rejects anything shorter. Generate it with a password
manager; it is not a password anyone types.

`node node_modules/...` rather than `npx wrangler` is deliberate: the wrapper
breaks on this machine's spaced home path.

### 3. The one config change

In `wrangler.jsonc`, change `EVIDENCE_SCAN_PROVIDER` from `"unconfigured"` to
exactly `"cloudmersive"`. The value must match `CLOUDMERSIVE_PROVIDER` in
`lib/cloudmersive-scan-policy.ts` exactly — it is compared literally, not
case-insensitively.

Deploy through GitHub Actions by pushing to `main`. `npm run deploy` by hand
skips release stamping and health verification and is emergency-only.

## How to verify — this is the part that matters

**A green config is not a working scanner.** The launch gate is satisfied by a
canary in `lib/runtime-launch-readiness.ts` that queries D1 for a real terminal
scan row, and it cannot be satisfied by configuration at all. The row must be:

- `scanProvider = "cloudmersive"` and the expected engine version
- status `clean`, `infected`, or `failed` — a real outcome, not `pending`
- `reviewedBy = "authenticated_scanner:cloudmersive"` — written by the scanner
  itself, so a dashboard action cannot forge it
- completed **within the last 30 days**, with its audit record written within
  **5 minutes** of completion

So verification is: upload a real evidence file, wait for a cron pass, and
confirm a terminal row appears. Until one does, the gate stays unanswerable no
matter what the config says.

```bash
npm run readiness
```

Read the evidence-scanner line. If it still reports blocked after a successful
upload and a cron window, the scan did not complete — check the Worker logs
rather than re-running.

**Confirm the failure path too, not only the success path.** An HTTP error,
timeout, malformed response, or any ambiguous vendor outcome must leave the
request `pending` for retry — not clean. A missing, oversized, or
hash-mismatched R2 object is a terminal local integrity error recorded as
non-clean. If you can, verify one non-clean outcome before relying on the clean
one: a scanner that cannot fail has not been shown to work.

The 45-second vendor deadline covers both response headers and the complete
bounded response body. A vendor that starts responding and then stalls must
still time out, with no terminal clean verdict. HTTP failures release their
unread bodies. Result recording starts only after the full body is received
and classified; network deadlines do not interrupt database recording.

## What it still does not do

**A clean scan never accepts evidence.** Owner review remains separate and
required — `lib/evidence-review-assistant.ts` can never auto-accept, and its only
automatic action is a reversible bilingual correction request for a provably
expired document. Turning on the scanner removes a blocker; it does not move a
decision.

**The gate still needs a security or privacy reviewer.** Configuration plus a
passing canary makes the gate *answerable*. It does not answer it. The reviewer
also confirms restricted storage, access logs, download controls, backups, and
deletion behaviour — see the gate's row in
[`../business/launch-gate-briefing.md`](../business/launch-gate-briefing.md).

## The 30-day expiry, which will surprise someone

The canary only counts a terminal scan from the last 30 days. A deployment that
scanned nothing for a month reports blocked again even though nothing changed
and the vendor is still connected. That is deliberate — it proves the path still
works rather than that it once did. If the gate reverts to blocked and nobody
touched anything, this is the reason before it is a fault.
