# Tuveloz — cross-assistant handoff (written 2026-08-08)

Purpose: give another assistant (GPT or a fresh Claude session) enough context
to pick up this repo without re-deriving anything. Read this top to bottom, then
read the linked files before touching related code.

---

## 1. What Tuveloz is

A Next.js app on Cloudflare Workers + D1 (Drizzle ORM). A local-services
marketplace for Montgomery County, Maryland. Two sides: providers (mobile
mechanics, detailers) and customers.

**Phase: pre-launch.** Provider recruitment is the only thing running. Every
service in `provider-eligibility-matrix.json` is still `disabled_pending_*` with
`customer_visible: false`. Nothing may imply customers can book today.

**Fee model (never get this wrong):** providers keep **100%** of their quoted
price; customers pay a **5%** fee on top. Never write "providers keep 95%".

**Sign-off tagline on every ad:** "Customer choice. Provider freedom." Do not
invent a different one.

---

## 2. Repo orientation

| Area | Path |
| --- | --- |
| App routes | `app/` (Next.js App Router) |
| API routes | `app/api/**/route.ts` |
| Server logic | `lib/` |
| Migrations | `drizzle/*.sql` + `drizzle/meta/_journal.json` |
| Tests | `tests/*.test.mjs` (node:test, run with `npm test`) |
| Brand + ads | `brand/` |
| Marketing docs | `docs/marketing/` |
| Deploy notes | `DEPLOYMENT.md` |

### Hard rules discovered the hard way

- **Migrations are hand-written.** `drizzle-kit generate` is destructive against
  D1 here — it emits table rebuilds. Snapshots in `drizzle/meta/` intentionally
  stop at 0047. Write additive `ALTER TABLE ... ADD COLUMN` SQL by hand, bump
  `_journal.json`, and add the file to
  `tests/migration-history-integration.test.mjs`.
- **Deploy command is broken by the spaced home path.** Use
  `node node_modules/wrangler/bin/wrangler.js deploy`, not `npm run deploy`.
- **Never `git stash`.** Verify claims against the actual files before saying
  something is done.
- Public-facing copy: plain language, 8-year-old-simple, everyday words over
  jargon. Show only what the audience needs — keep legal disclosures, hide
  internal operations.
- Provider requirements are **legally required documents only** (this always
  includes every IRS obligation: W-9, 1099). Auto coverage is required only for
  towing. W-9 is visible in signup.
- `PROVIDER_SERVICE_GROUPS` labels in the codebase are not rendered anywhere —
  don't rewrite them as if they were UI copy.
- Message photo attachments are **fail-closed and hidden** until Cloudmersive
  scanning is configured. That is intentional, not a bug.
- The service-code → legal-category map in `lib/provider-compliance.ts` is
  best-faith and still needs counsel review before customer launch.

---

## 3. Recent shipped work (git log, newest first)

- `b77a4b8` — "I've Got This" provider-recruitment video series (4 episodes)
- `bf3de66` — fail-closed photo attachments on job messages
- `462ffe7` — job appointment scheduling + automatic customer reminders
- `f372f3e` — service-aware job inspection checklist
- `6ea5080` — providers can reply to customer reviews

---

## 4. In flight right now (uncommitted, branch `ads/got-this-series`)

### 4a. Optional provider certificates — code complete, not committed

New files:
- `lib/optional-certificates.ts` — catalog of five categories (ASE,
  manufacturer training, I-CAR, EV/hybrid, other) with EN/ES labels, plus
  normalization of the untrusted signup field. Cap of 12.
- `drizzle/0055_optional_certificate_category.sql` — one additive column,
  `provider_submitted_credentials.category text DEFAULT '' NOT NULL`.
- `tests/optional-certificates.test.mjs`

Modified: `app/components/provider-signup-form.tsx` (the collapsible optional
section + styles in `app/globals.css`), `app/api/providers/route.ts` (writes
each declared certificate into `provider_submitted_credentials` as
`pending` / `public_display = 'no'`, best-effort, outside the legal-record
transaction so a failure never fails the application),
`app/admin/marketplace-tools/page.tsx` + its API route (owner sees the
category), `lib/provider-application-verification.ts`,
`tests/migration-history-integration.test.mjs`, `drizzle/meta/_journal.json`.

Design intent: these are **never required**, **never gate a service**, and are
**never visible to a customer until the owner verifies them**. They reuse the
existing provider-submitted-credentials review pipeline rather than adding one.

Remaining: run the tests, commit, apply migration 0055 to D1, deploy.

### 4b. "I've Got This" ad series — rendered, assets uncommitted

Four episodes (battery, diagnostics, oil, car wash) rendered to
`brand/ads/got-this-ep*-{1x1,9x16}.mp4`. Source clips live in
`brand/ads/got-this-assets/<episode>/`. `brand/ads/build-got-this.ps1` assembles
everything end to end; missing clips render as labeled placeholder slates so
timing is reviewable before footage exists.

Concept: the same guy confidently attempts a car job, fails, and the punchline
flatters the mechanic watching who spotted the mistake first. Provider-facing by
design — the customer-side cut is blocked by the pre-launch gate and becomes a
launch-phase re-edit of the same clips (new punchline VO, new end card,
`-Launch` flag).

The `.mp4` files stay out of git — decided 2026-08-08. All 57 rendered cuts and
source clips (~50MB) live in the **private** R2 bucket `tuveloz-brand-video`
under the `ads/` prefix, mirroring their repo paths (`brand/ads/x.mp4` →
`ads/x.mp4`). `.gitignore` enforces the exclusion.

The bucket has **no public custom domain** and is not served to the internet:
these are unreleased campaign assets, including placeholder slates for
episodes 2-4. Fetch one with:

```
node node_modules/wrangler/bin/wrangler.js r2 object get \
  tuveloz-brand-video/ads/<path>.mp4 --file <local> --remote
```

The `.mp4` paths in this file and in `docs/marketing/HIGGSFIELD_RUNBOOK.md` are
**local build paths** for `build-got-this.ps1`, not URLs. Do not rewrite them to
R2 addresses — the build script reads from disk.

---

## 4c. Note for whoever owns the account-analytics events

Two **additive** changes were made to your surface in `1794370`, to instrument
the launch banner. Nothing existing was renamed or removed.

- `lib/analytics.ts` — two event names (`launch_banner_impression`,
  `launch_banner_cta_clicked`), plus `rememberAttribution()` and a merge inside
  `track()`. The merge is `{ ...storedAttribution(), ...props }`: **an explicit
  prop at a call site always wins**, so your `role` and `entry` props are never
  overwritten. Events fired after a banner click now also carry
  `surface: "launch_banner"`.
- `app/api/analytics/route.ts` — the same two names added to `KNOWN_EVENTS`.
  That allowlist is not optional: an event missing from it is rejected with a
  400 and never reaches D1.

Attribution is sessionStorage under `tuveloz-attribution-v1`. It holds no
identifier, dies with the tab, and cannot follow anyone between visits.

### The banner is frozen until 2026-08-22

A two-week baseline is being collected on the current wording. **Do not change
the launch banner's copy or layout before then**, and do not change the
`variant: "baseline"` string — the two periods stop being comparable if either
moves. Instrumentation fixes are fine; wording is not.

---

## 5. Video / marketing production constraints

Read `docs/marketing/HIGGSFIELD_RUNBOOK.md` (verbatim prompts + runbook) and
`brand/outreach/reel-provider-recruitment.md` before designing any new video.

- **0:00 hook is mandatory** — roughly half of viewers leave in 3 seconds. Every
  episode opens on a silent plate with hook text.
- Use **native platform text overlays**, not burned-in captions.
- The **AI-content disclosure toggle** must be on when posting.
- TikTok: about 6 hashtags. Local MoCo/DMV mix.
- **Never ask AI video to render a mechanism.** Generate confidence and
  aftermath separately, then cut between them.
- A punchline must name the service *and* carry a second meaning. A bare service
  noun is not a line.
- Brand mark: navy `#07182D` badge + orange funnel. The old T-funnel logo is
  retired. Regenerate assets via `scripts/generate-brand-assets.mjs`. The
  social-media-kit PNG has a baked-in black box — use the transparent lockup
  rendered from the brand SVG on dark plates.

### Tooling reality
- **Artlist**: AI Starter plan. AI credits work; the **stock catalog is not
  licensed** (watermarked downloads). 1 credit left, expires Sept 4 2026.
  Generated asset URLs stay live, so a deleted file can be re-downloaded free.
- **Epidemic Sound**: Pro subscription was canceled, plan ended Aug 9 2026.
  `brand/ads/ad-01-assets/music.mp3` ("On My Way (Instrumental Version)" — Ten
  Towers) was downloaded while active. Confirm licensing before running paid ads
  post-cancellation.
- **Higgsfield cannot be driven by automation.** The Chrome extension connects
  but reads a 0x0 viewport. Generation is manual — the assistant writes prompts,
  Wil clicks.
- Social profile uploads are likewise manual: stage files in `Downloads` and
  walk the user through the click.

Older ad-production detail (Ad 01, Ad 02) lives in `brand/ads/HANDOFF.md`. It is
accurate for those two ads but predates the "I've Got This" series.

---

## 6. How Wil wants to be worked with

- Direct verdicts, grouped in buckets. State confidence once. No scare framing.
- Don't end a reply on a homework list.
- Be factual. Verify before asserting or retrying — no guessing.
- Counsel / broker / CPA / Stripe: name once as a footnote, never as the answer
  to "what's next".
- On Windows PowerShell: keep commands short. Write long text to a file and
  reference the file rather than inlining it.
