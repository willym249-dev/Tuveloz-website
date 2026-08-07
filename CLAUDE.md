# Tuveloz — working notes

Read this before writing code, copy, or ads. The rules below are decisions
already made, not suggestions. Where a rule has a source file, that file wins if
they ever disagree — fix this doc rather than working around it.

## What this is

A mobile-friendly vehicle-service marketplace for Montgomery County, Maryland.
Customers request work, compare quotes, and pick a provider. Independent
providers apply, quote, and run their own book of business. Next 16 on
Cloudflare Workers, D1, R2; Stripe Connect for payouts; English/Spanish
throughout.

## Phase — the thing most likely to be got wrong

**Pre-launch.** Provider onboarding is open. **Customer requests are not live.**

Every piece of public copy must be true under that constraint. Never imply a
customer can book, pay, or get service today, and never imply jobs are waiting
for a provider who signs up.

## Money facts — say these exactly

- **Free for providers.** No listing fee, no subscription, no per-lead fee.
- **Providers keep 100% of their quoted price.** The customer pays a **5%
  service fee** to the site.
- **Never write "providers keep 95%."** It's wrong and it's the single easiest
  mistake to make here. The fee is customer-side, itemized on each quote.
- No exclusivity — providers can work every other platform at the same time.

## Honesty rules (from `brand/outreach/provider-outreach-kit.md`)

These bind ads, DMs, social posts, and site copy identically.

- Never promise income, job volume, or earnings. This includes stating a
  going labor rate next to a `/join` CTA — it reads as an earnings claim.
- Never promise founding-provider perks beyond what `/founding-providers`
  publishes. **Publish it, then promise it. Never the reverse.**
- No astroturfing — business posts come from the business account.
- Label AI-generated creative wherever the platform asks.
- One follow-up maximum in outreach. None after a "no."
- Any statistic used in creative keeps a visible source and stays inside its
  cited range.

## Launch services — the whole list

Battery / jump start · wiper blades & bulbs · fluid top-off · detailing ·
basic diagnostics.

**Not** towing, tires, or A/C. Don't show them in creative either.

## Founding provider program

Ranks 1–20 never pay a provider membership fee, permanently. Ranks 1–10 also
get a spotlight post. Rank is assigned once at first verification and never
recomputed — `lib/founding-cohort.ts`, assigned in
`app/api/admin/provider-compliance/route.ts`. `FOUNDING_COHORT_SIZE` is a
business decision, not a config tweak. Refused deliberately, in writing:
search-ranking or job-routing preference, guaranteed jobs or income, territory
locks. Full reasoning in `brand/outreach/founding-provider-program.md`.

## Bilingual is not a nice-to-have

21.7% of the county is Hispanic and the independent auto trade skews heavily
Spanish-speaking. Ship ES alongside EN — separate creatives for ads, real
coverage on the site. `npm run i18n:check` verifies Spanish coverage.

## Commands

```bash
npm ci                     # locked install (Node >= 22.13)
npm run dev                # local dev
npm test                   # production build + feature checks — run before pushing
npm run lint
npm run i18n:check         # Spanish coverage
npm run db:migrate:local   # apply D1 migrations locally
```

## Security lines not to cross

- Never commit `.env`, `.dev.vars`, tokens, or database exports.
- Keep `STRIPE_ALLOW_LIVE_MODE=false` until the owner has deliberately
  completed the live-account, compliance, refund, and dispute review.
- Provider and customer APIs are role-separated; keep them that way.
- Protect the owner/admin hostname with Cloudflare Access in production.

## Marketing material — where things live

| Path | What |
|---|---|
| `brand/ads/HANDOFF.md` | Ad production status, asset and licensing blockers — **read first** |
| `brand/ads/provider-recruitment-ad-01.md` | 15s provider recruitment reel |
| `brand/ads/morning-ads-provider-recruitment.md` | Data-led "Morning Number" stat cards + daypart test |
| `brand/outreach/provider-outreach-kit.md` | DM / flyer / group-post copy, EN + ES |
| `brand/outreach/audience-growth-playbook.md` | Channel strategy and what to measure |
| `brand/outreach/moco-outreach-worklist.md` | Who to contact, and the anti-spam rules |
| `brand/social-media-kit/profile-copy.md` | Bios, pinned post, do/don't |

**Music licensing is an open blocker.** The Epidemic Sound subscription was
canceled with a window closing **2026-08-09**; the Artlist plan does not license
stock catalog assets. Check `brand/ads/HANDOFF.md` before putting any track
behind anything.

## What to measure

Provider applications by source, at `/admin/analytics-funnel`. Follower count
decides nothing. If applications aren't moving after four honest weeks, the
answer is a different channel, not more posting.

## Git

Work on the assigned `claude/*` branch, commit with a real message, push with
`git push -u origin <branch>`. Don't open a PR unless asked.
