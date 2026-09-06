# Private document scanner

This is an optional, owner-operated alternative to the Cloudmersive integration.
It uses ClamAV and local PDF/image checks. There is no scanner subscription or
per-file API fee. The owner's computer supplies power, memory and uptime.

**Deployment selection: ClamAV.** Processing also requires the dedicated Worker
credential and the owner's running background task. The site quarantines uploads
until an authenticated, complete scan result arrives. Identity, insurance,
licensing, provider acceptance and launch approval remain separate checks.

## What it checks

- Evidence: PDF, JPG, PNG or WebP, at most 3,500,000 bytes. Message images retain
  their existing 8 MiB allowance; messages cannot use PDFs.
- Exact original size and SHA-256 before downloading, scanning and recording.
- A complete scan by the pinned ClamAV 1.5.4 engine with official definitions
  no more than 72 hours old. Missing definitions, limits, errors and timeouts
  never produce a clean result.
- Strict PDF parsing, including compressed objects and escaped names. Encrypted
  files, scripts, embedded files, automatic actions, unsafe links, external
  streams, XML entities and malformed documents are blocked. Ordinary HTTP/HTTPS
  links and internal page navigation remain usable. PDF pages are not removed.
- Full image verification and decoding, with a 50-million-pixel ceiling and one
  frame. Images are not rewritten by the scanner.

These are file-safety checks, not proof that an insurance policy or license is
valid. They do not claim feature equivalence to Cloudmersive Advanced Virus Scan.

## Connection and isolation

`runner.py` makes outbound HTTPS requests only to `https://tuveloz.com`. It opens
no listening ports, refuses redirects and proxy environment settings, and signs
each request with a dedicated HMAC credential. The site leases one pending file
at a time for ten minutes. Expired leases can be retried; changed bytes, another
file's receipt or a conflicting second result cannot clear quarantine.

Each file is piped to a new Docker container with no network, no Linux
capabilities, a read-only root, a non-root user and explicit CPU, memory and
process limits. Original bytes use memory and a temporary container filesystem;
the runner does not save originals. Neither the host filesystem, Docker socket
nor scanner credential is mounted into the container. The signature updater is
separate: it has internet access and a writable signature volume, but receives
no document bytes, jobs or credential.

The Windows runner decrypts its credential with the signed-in owner's DPAPI
account. Store its encrypted file outside the repository in an owner-restricted
directory. Never put its cleartext value in chat, a command argument, a log,
`wrangler.jsonc` or a committed file.

## Prepare and verify

The current runner expects Docker inside WSL Ubuntu, with permission to invoke
Docker through that distribution's root account. It does not install WSL or
Docker. Use an owner-controlled Windows account and a maintained host.

1. Build `scanner/Dockerfile`. Keep the returned immutable `sha256:...` image ID
   in a private JSON file with the shape `{"image":"sha256:..."}`. The base image
   and Python releases are pinned; pip verifies downloaded wheel hashes.
2. Create the Docker volume `tuveloz-clamav-signatures-v1`, with the volume owned
   by the official image's `clamav` user. Refresh official definitions before
   scanning. No other container needs access to this volume.
3. Run the parser/runner unit tests and the site's full verification workflow.
   Exercise real ClamAV with a normal PDF/image, a harmless script-containing
   PDF, the standard harmless EICAR antivirus fixture, stale/missing definitions
   and an offline runner. Use synthetic files, never applicant documents as
   development fixtures.
4. Rehearse the signed claim, download and result path against the local fixture
   in `tests/e2e/self-hosted-scan-server.mjs`. This is not a production canary.

## Activation

Apply migration `0066_self_hosted_scan_jobs.sql` through the normal gated release.
For a new installation, keep `EVIDENCE_SCAN_PROVIDER=unconfigured` during preparation.

An authorized operator must first install a fresh, dedicated 64-character random
hex credential as the encrypted Worker secret `SELF_HOSTED_SCAN_SECRET`, and
DPAPI-protect the same credential on the owner PC. Preserve the existing
Cloudmersive and legacy callback secrets. Do not reuse them for this runner.

Install an owner-controlled task that runs the following with absolute paths
from the same Windows account that protected the credential:

```text
python scanner/runner.py --secret-file <private DPAPI file> --image-file <private image JSON> --state-dir <private state directory> --update-signatures
```

Use a five-minute schedule, do not overlap runs, and bound execution to fifteen
minutes. The runner handles up to three files per run and refreshes definitions
at most once every four hours. Configure startup/logon behavior explicitly;
installing a task does not prove that it runs after a restart. Verify both a
manual run and the scheduled run from its task history and `last-run.json`.

Only after these steps, release `EVIDENCE_SCAN_PROVIDER=clamav` through the normal
GitHub deployment workflow. The old Cloudmersive sweeps become inactive. The
legacy callback refuses ClamAV results; the new endpoint requires both file
checks and a matching receipt. Test the deployed path with an explicitly marked
synthetic provider fixture using the real recorder and private storage. Confirm
the exact pending request was consumed, its terminal scan and hash-chained
audit agree, and the provider evidence itself is still pending owner review.

Readiness additionally verifies the retained policy receipt, immutable result,
original lease, file hash, engine version and audit binding. It requires recent
operational evidence; configuration or a local test alone cannot satisfy it.
Other launch and live-payment gates are not changed by this integration.

## Interruptions and rollback

When the PC is off, asleep, signed out without a suitable task logon mode, or
offline, files remain pending. A failed signature update also stops that run.
Capacity depends on this PC; assess queue age before expanding provider intake.
`last-run.json` contains counts and a timestamp, not document data. A working
scanner needs current scheduled-run evidence as well as a previously clean file.

To stop processing, disable the owner task and deploy
`EVIDENCE_SCAN_PROVIDER=unconfigured`. New files stay quarantined. Do not delete
existing evidence, scan rows or audit receipts. If the scanner credential is
compromised, disable processing and coordinate rotation on both sides before
re-enabling it. A new engine or policy version needs fresh tests and a compatible
server validator; an unrecognized version is rejected.

## Verification commands

```text
python -m pip install --require-hashes -r scanner/requirements.txt
python -m unittest discover -s scanner -p "test_*.py" -v
node --experimental-strip-types --test tests/self-hosted-scans.test.mjs
npm test
npm run lint
npm run typecheck
```

Parser tests use synthetic documents and controlled engine responses. The actual
engine and full connection must also be rehearsed. Keep the distinctions among
unit tests, local integration, deployment, scheduled execution and live canary
evidence explicit in release records.
