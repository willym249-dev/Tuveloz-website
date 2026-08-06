# Tuveloz documentation index

Everything written down about this project, in one list. If you are new here —
or you are an AI assistant starting a fresh conversation — read
[`AI-HANDOFF.md`](AI-HANDOFF.md) first. It explains the whole project in one
self-contained page.

## Start here

| Document | What it answers |
| --- | --- |
| [`AI-HANDOFF.md`](AI-HANDOFF.md) | What is Tuveloz, how does it work, what state is it in? Written to be pasted into any AI assistant. |
| [`FILING-GUIDE.md`](FILING-GUIDE.md) | Where does a new document go, what do I name it, and what must never be committed? |
| [`../README.md`](../README.md) | How do I install and run this locally? |
| [`../DEPLOYMENT.md`](../DEPLOYMENT.md) | How do I set up GitHub and Cloudflare and deploy it? |

## Operations

| Document | What it answers |
| --- | --- |
| [`PROVIDER_ACTIVATION_RUNBOOK.md`](PROVIDER_ACTIVATION_RUNBOOK.md) | How do we move from "applications open" to providers actually working jobs? The exact sequence and what blocks it. |
| [`STAGING.md`](STAGING.md) | What is the difference between the test lab and staging, and how do I set staging up? |
| [`operations/`](operations/) | Runbooks, procedures, and incident write-ups added from here on. |

## Product and technical

| Document | What it answers |
| --- | --- |
| [`EVIDENCE_SCANNER_CALLBACK.md`](EVIDENCE_SCANNER_CALLBACK.md) | How does the malware scanner clear uploaded provider evidence, and what is the callback contract? |
| [`product/`](product/) | Feature specifications and design decision records added from here on. |

## Legal and compliance

| Document | What it answers |
| --- | --- |
| [`INTEGRATED_REVIEW_CHECKLIST.md`](INTEGRATED_REVIEW_CHECKLIST.md) | What ships in this build, and what is deliberately switched off before launch? |
| [`legal/`](legal/) | Policy research, agreement drafts, and compliance analysis added from here on. |
| [`records/`](records/) | The register of real-world documents — insurance, formation, licenses, approvals — and where the originals are kept. |

The seven published legal documents themselves are not files in this folder.
They are pages under `app/` (terms, customer agreement, provider agreement,
privacy, payments, marketplace conduct, provisional provider policy), each
pinned to a reviewed content hash in `config/policy-releases.json`.

## Business

| Document | What it answers |
| --- | --- |
| [`business/`](business/) | Plans, pricing decisions, market notes, and provider programs added from here on. |
| [`../brand/outreach/`](../brand/outreach/) | Provider recruitment kits, the founding provider program, the growth playbook, and the Montgomery County outreach worklist. |
| [`../brand/ads/`](../brand/ads/) | Ad concepts, production briefs, and finished cuts. |
| [`../brand/social-media-kit/`](../brand/social-media-kit/) | Profile and cover images for every platform, plus the brand colors and how to regenerate assets. |

## Where the rules actually live

Some of the most important "documentation" in this project is configuration and
code, not prose. When one of these disagrees with a document, the code wins:

| Source | What it governs |
| --- | --- |
| `config/provider-eligibility-matrix.json` | Which provider may perform which service, what evidence is required, and what is still disabled. Default policy is deny. |
| `config/policy-releases.json` | The reviewed content hash of each published legal page. Changing a policy page without a new release fails the build. |
| `lib/launch-status.ts` | Whether the marketplace is open, and whether customer job posting is paused. |
| `lib/launch-readiness.ts` | The 18 gates that must be recorded and approved before going live. |
| `lib/customer-fee.ts` | The 5% customer service fee. |
| `lib/stripe.ts` | The live-payment and Stripe Identity kill switches. |

## Adding to this index

Add one row for your document in the right section, saying what question it
answers rather than describing its contents. Then follow
[`FILING-GUIDE.md`](FILING-GUIDE.md) for naming and the required header block.
