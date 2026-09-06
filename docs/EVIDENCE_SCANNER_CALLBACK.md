# TUVELOZ evidence-scanner callback

Status: implementation interface for security/vendor review. It is not a claim
that a scanner vendor is connected or that uploaded files are safe.

Provider evidence files remain quarantined until the latest result for the
exact file is `clean`. The owner dashboard cannot create a clean result.

## Configuration

- Set `EVIDENCE_SCAN_PROVIDER` to the exact scanner/vendor identifier expected
  in callback bodies.
- Store a random secret of at least 32 characters as the Worker secret
  `EVIDENCE_SCAN_WEBHOOK_SECRET`.
- For the built-in scheduled integration, set `EVIDENCE_SCAN_PROVIDER` to the
  exact value `cloudmersive` and store the Cloudmersive key as the Worker
  secret `CLOUDMERSIVE_API_KEY`.
- Do not commit the secret or place it in `wrangler.jsonc`.
- The launch-readiness dashboard remains blocked while the provider is
  `unconfigured`, the secret is missing, or an end-to-end scan has not been
  independently tested.

## Built-in Cloudmersive scheduled scanner

Every 15 minutes, the production Worker can load a small batch of existing
`pending` evidence scan requests. It runs only when all three settings are
present: `EVIDENCE_SCAN_PROVIDER=cloudmersive`, `CLOUDMERSIVE_API_KEY`, and a
32-or-more-character `EVIDENCE_SCAN_WEBHOOK_SECRET`.

For each pending request, the Worker loads the private R2 object, caps it at
the same 3.5 MB (3,500,000 byte) upload limit, recomputes SHA-256, and requires an exact match to
the D1 evidence and scan records before sending any bytes to Cloudmersive's
Advanced Virus Scan endpoint. The request blocks executables, invalid files,
scripts, password-protected files, macros, XML external entities, insecure
deserialization, HTML, unsafe archives, OLE/embedded objects, unwanted
actions, and any type outside PDF, JPG/JPEG, PNG, and WebP.

An HTTP error, timeout, malformed response, incomplete clean response, or any
other ambiguous vendor outcome leaves the request `pending` for retry. A
missing, oversized, or hash-mismatched R2 object is a terminal local integrity
error and is recorded as non-clean. A Cloudmersive `CleanResult=false` is
recorded as infected or failed. A clean result is recorded only when all
required advanced threat flags are explicitly false, the virus list is empty,
and a verified format is present.

The scheduled scanner and external signed callback share the same D1 result
recorder. That recorder conditionally claims the exact pending request, preserves
idempotency, blocks non-clean evidence, and records an audit event. A clean
scan never accepts evidence; separate owner review is still required.

## Request

Send `POST /api/internal/evidence-scan-result` with the raw JSON body and:

- `x-tuveloz-scan-timestamp`: current Unix time in seconds.
- `x-tuveloz-scan-signature`: lowercase hexadecimal HMAC-SHA256 of
  `<timestamp>.<raw-request-body>` using `EVIDENCE_SCAN_WEBHOOK_SECRET`.

The timestamp may differ from the server by no more than five minutes. The
body is limited to 20,000 characters.

Example body shape:

```json
{
  "resultId": "vendor-immutable-result-id",
  "scanRequestId": "the-pending-evidence-file-scan-id",
  "evidenceId": "the-provider-evidence-submission-id",
  "fileHash": "64-character-lowercase-sha256",
  "status": "clean",
  "scanProvider": "the-configured-provider-identifier",
  "scanEngineVersion": "engine-and-signature-version",
  "reportReference": "restricted-vendor-report-or-ticket-reference",
  "scannedAt": "2026-07-31T12:34:56.000Z"
}
```

Allowed statuses are `clean`, `infected`, `failed`, and `error`.

## Fail-closed checks

The server rejects a result unless all of these are true:

- The callback configuration exists.
- The HMAC signature and timestamp are valid.
- The scanner identifier matches the configured provider.
- The result is recent and has a unique immutable result ID.
- The evidence ID, pending scan request ID, and SHA-256 file hash all match.
- The pending scan request has not already received a result.

A clean callback only removes the malware quarantine. It never accepts provider
evidence, approves a provider, enables a service, creates a job, or moves money.
A non-clean result blocks the evidence and dependent stored eligibility records.

## Vendor integration still required

The selected scanner must receive or securely retrieve the quarantined object,
scan the exact bytes whose SHA-256 is stored, protect its credentials, retain a
restricted report, retry idempotently, and complete an end-to-end test. The
security/privacy reviewer and TUVELOZ owner must confirm that retention, vendor
access, incident handling, and every customer-facing verification statement
meet applicable law and the documented privacy/security rules. Independent
professional legal review is recommended for uncertain or high-risk issues.
