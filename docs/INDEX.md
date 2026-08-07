# Document index

Every written asset in this repository, what it settles, and where to add to it.

**The rule: add to the file that already owns a subject. Do not start a new
document for something already covered here.** If nothing owns a subject, add
the file and add a row to this index in the same commit.

Last reviewed: August 2026.

---

## Start here

| Document | What it settles | Add to it when |
| --- | --- | --- |
| [`../CLAUDE.md`](../CLAUDE.md) | Orientation for anyone — human or assistant — opening this repo cold. The launch locks, the constraints that must not be violated, how to work here. Loaded automatically at the start of every Claude Code session. | A constraint changes, or you learn something the next person must not rediscover the hard way |
| [`INDEX.md`](INDEX.md) | This file. The map. | Any document is added, retired, or changes ownership |
| [`../README.md`](../README.md) | What the product is, what's included, local setup, security notes | Setup steps or included features change |

## Strategy and positioning

| Document | What it settles | Add to it when |
| --- | --- | --- |
| [`PITCH.md`](PITCH.md) | **The canonical pitch.** One-liner, tagline, the shared facts nobody may improvise beyond, customer pitch, provider pitch, what we must never claim, where the pitch is rendered, live copy tests, open questions | The pitch changes, an A/B test resolves, or a claim becomes true (or stops being true) |
| [`COMPETITIVE_LANDSCAPE.md`](COMPETITIVE_LANDSCAPE.md) | Where we stand against Wrench, YourMechanic, AutoNation Mobile Service, Spiffy, Openbay, ClickMechanic, FixMyCar, and the local DMV operators. The category's table stakes and post-mortems. Where we exceed it and where we fall short | A competitor moves, a table stake is met, or a gap closes |
| [`PROVIDER_CLASSIFICATION_DESIGN.md`](PROVIDER_CLASSIFICATION_DESIGN.md) | Why providers are independent contractors and what would break it. Md. § 8-205's disjunctive third prong, the control facts that lost the cases, the *Saleem* facts that won, **the never-build list**, the questions for counsel | Counsel answers something, a case turns, or someone proposes a feature on the never-build list |

## Operations

| Document | What it settles | Add to it when |
| --- | --- | --- |
| [`PROVIDER_ACTIVATION_RUNBOOK.md`](PROVIDER_ACTIVATION_RUNBOOK.md) | How a provider actually goes active: secrets, canaries, launch gates, service activation. Several gates need an outside party and cannot be satisfied in software | A gate is cleared, or the activation path changes |
| [`INTEGRATED_REVIEW_CHECKLIST.md`](INTEGRATED_REVIEW_CHECKLIST.md) | The review process before shipping | The process changes |
| [`../DEPLOYMENT.md`](../DEPLOYMENT.md) | Full GitHub and Cloudflare setup | Infrastructure changes |
| [`STAGING.md`](STAGING.md) | Staging environment | Staging changes |
| [`EVIDENCE_SCANNER_CALLBACK.md`](EVIDENCE_SCANNER_CALLBACK.md) | Malware-scanning callback contract for uploaded evidence | The scanner integration changes |

## Growth and brand

| Document | What it settles | Add to it when |
| --- | --- | --- |
| [`../brand/outreach/audience-growth-playbook.md`](../brand/outreach/audience-growth-playbook.md) | The pre-launch audience plan | The plan changes or a channel is proven or killed |
| [`../brand/outreach/provider-outreach-kit.md`](../brand/outreach/provider-outreach-kit.md) | Provider outreach DMs, EN/ES, plus the honesty rules for outreach | Message copy changes — keep it consistent with `PITCH.md` §2 and §4 |
| [`../brand/outreach/moco-outreach-worklist.md`](../brand/outreach/moco-outreach-worklist.md) | Who to contact in Montgomery County, solo operators first, and the anti-spam pacing | Targeting changes |
| [`../brand/outreach/founding-provider-program.md`](../brand/outreach/founding-provider-program.md) | Founding cohort terms: 20 seats, perks, and what was deliberately refused (no ranking preference, no routing priority, no territory locks) | The program's terms change |
| [`../brand/outreach/provider-spotlight-kit.md`](../brand/outreach/provider-spotlight-kit.md) | Spotlight process, first 10 only, written consent mandatory | The process changes |
| [`../brand/outreach/reel-provider-recruitment-v3.md`](../brand/outreach/reel-provider-recruitment-v3.md) | Current recruitment reel scripts and hashtags (v3 supersedes the v1 file beside it) | New reels are cut |
| [`../brand/social-media-kit/profile-copy.md`](../brand/social-media-kit/profile-copy.md) | Ready-to-paste bios for every platform, with the positioning notes behind them | A platform bio changes |
| [`../brand/social-media-kit/README.md`](../brand/social-media-kit/README.md) | Which avatar and cover image goes with which platform | Assets are added |
| [`../brand/ads/HANDOFF.md`](../brand/ads/HANDOFF.md) | Ad production handoff | Ads are produced |

## Machine-readable policy

Not prose, but the same rule applies — these are the source of truth for
behavior, and changing them changes what the product will allow.

| File | What it settles |
| --- | --- |
| [`../config/provider-eligibility-matrix.json`](../config/provider-eligibility-matrix.json) | The compliance rules engine's data: services, pathways, levels, evidence types and the jurisdiction that imposes each, the jurisdiction registry. `default_policy: deny` |
| [`../config/policy-releases.json`](../config/policy-releases.json) | SHA-256 of each legal page's rendered body. **Editing a legal page requires rotating its hash** or eligibility breaks |

## Conventions

- **One subject, one owner.** Duplicated facts drift apart; the pitch already
  did, which is why `PITCH.md` exists.
- **Date what you add**, and say what changed, so the next reader can tell
  current thinking from history.
- **Mark unverified claims as unverified.** `COMPETITIVE_LANDSCAPE.md` and
  `PROVIDER_CLASSIFICATION_DESIGN.md` were researched with outbound fetching
  blocked, so competitor facts and case holdings came from search summaries. Both
  say so at the top. Keep that habit.
- **Legal questions go to counsel**, not to a document. Record the question and
  the answer; do not record a guess as a conclusion.
