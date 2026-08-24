# Tuveloz documentation index

Everything written down about this project, in one list. If you are new here —
or you are an AI assistant starting a fresh conversation — read
[`AI-HANDOFF.md`](AI-HANDOFF.md) first. It explains the whole project in one
self-contained page.

## Start here

| Document | What it answers |
| --- | --- |
| [`AI-HANDOFF.md`](AI-HANDOFF.md) | What is Tuveloz, how does it work, what state is it in? Written to be pasted into any AI assistant. |
| [`LOG.md`](LOG.md) | What has recently happened and been decided? The shared memory between sessions — read the top before starting, add an entry before finishing. |
| [`OPEN-ITEMS.md`](OPEN-ITEMS.md) | What is outstanding and what falls due soon? Checked weekly by automation that opens an issue when something is overdue. |
| [`FILING-GUIDE.md`](FILING-GUIDE.md) | Where does a new document go, what do I name it, and what must never be committed? |
| [`../README.md`](../README.md) | How do I install and run this locally? |
| [`../DEPLOYMENT.md`](../DEPLOYMENT.md) | How do I set up GitHub and Cloudflare and deploy it? |

## Operations

| Document | What it answers |
| --- | --- |
| [`PROVIDER_ACTIVATION_RUNBOOK.md`](PROVIDER_ACTIVATION_RUNBOOK.md) | How do we move from "applications open" to providers actually working jobs? The exact sequence and what blocks it. |
| [`STAGING.md`](STAGING.md) | What is the difference between the test lab and staging, and how do I set staging up? |
| [`operations/email-authentication.md`](operations/email-authentication.md) | What authenticates Tuveloz email, does SPF/DKIM/DMARC align for the sending domain, and in what order should DMARC be tightened? |
| [`operations/zeo-remote-access-tailscale.md`](operations/zeo-remote-access-tailscale.md) | How does the phone reach the Zeo companion on the home PC, and why did the Tailscale "share a device" invite fail? |
| [`operations/evidence-scanner-activation.md`](operations/evidence-scanner-activation.md) | How do I turn on the evidence malware scanner, and how do I confirm it actually works rather than just reporting success? |
| [`operations/security-and-data-incident-plan.md`](operations/security-and-data-incident-plan.md) | What do I do in the first hour of a data exposure, account takeover, or vendor breach — and what must not be deleted while doing it? |
| [`operations/vehicle-incident-claims-and-stop-work-plan.md`](operations/vehicle-incident-claims-and-stop-work-plan.md) | What do I do when someone is hurt or a vehicle is damaged on a job — how does work stop, payment hold, and evidence get preserved without directing the repair? |
| [`operations/`](operations/) | Runbooks, procedures, and incident write-ups added from here on. |

## Product and technical

| Document | What it answers |
| --- | --- |
| [`EVIDENCE_SCANNER_CALLBACK.md`](EVIDENCE_SCANNER_CALLBACK.md) | How does the malware scanner clear uploaded provider evidence, and what is the callback contract? |
| [`product/`](product/) | Feature specifications and design decision records added from here on. |
| [`product/provider-signup-eligibility-first.md`](product/provider-signup-eligibility-first.md) | Why does provider signup ask for service choices before telling an applicant whether they qualify, and what was proposed to fix it? |
| [`product/spanish-is-invisible-to-search.md`](product/spanish-is-invisible-to-search.md) | Eight pages have reviewed Spanish — why has no search engine ever seen it, and what would a fix cost? |
| [`product/spanish-titles-and-descriptions-draft.md`](product/spanish-titles-and-descriptions-draft.md) | What would the eight `/es` pages say in a Spanish search result, and what needs checking before those strings go live? |
| [`PROVIDER_CLASSIFICATION_DESIGN.md`](PROVIDER_CLASSIFICATION_DESIGN.md) | Why are providers independent contractors, which product facts hold that classification, and what must never be built? |
| [`COMPETITIVE_LANDSCAPE.md`](COMPETITIVE_LANDSCAPE.md) | Who else does this, where does Tuveloz exceed the category, and where is it still short of table stakes? |

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
| [`business/launch-gate-briefing.md`](business/launch-gate-briefing.md) | What does each of the 18 launch gates ask, who is allowed to answer it, and what evidence already exists in the code? |
| [`business/revenue-before-launch.md`](business/revenue-before-launch.md) | What can Tuveloz actually charge for while every transactional path is closed, which obvious ideas are traps, and what is the sequence? |
| [`../brand/outreach/`](../brand/outreach/) | Provider recruitment kits, the founding provider program, the growth playbook, and the Montgomery County outreach worklist. |
| [`../brand/ads/`](../brand/ads/) | Ad concepts, production briefs, and finished cuts. |
| [`../brand/social-media-kit/`](../brand/social-media-kit/) | Profile and cover images for every platform, plus the brand colors and how to regenerate assets. |
| [`../brand/repair-paperwork-pack/`](../brand/repair-paperwork-pack/) | The Maryland estimate and itemized invoice a repair business owes its customer, as print-ready forms generated from the statute implementation. |
| [`marketing/`](marketing/) | What the "I've Got This" video series is and how each episode is produced, including the Higgsfield runbook. |

## Historical

Kept for the record, not as current instruction. Each says when it was written;
where one disagrees with a file above, the file above wins.

| Document | What it answers |
| --- | --- |
| [`SESSION-HANDOFF.md`](SESSION-HANDOFF.md) | What a second assistant was told about this repo on 2026-08-08, when work was split across parallel sessions. |
| [`GPT-BRIEF-got-this-ads.md`](GPT-BRIEF-got-this-ads.md) | The scope handed to GPT for the ad series in that split. |
| [`GPT-BRIEF-signup-improvements.md`](GPT-BRIEF-signup-improvements.md) | The scope handed to GPT for signup copy in that split. |

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
