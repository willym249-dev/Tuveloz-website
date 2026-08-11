# Brief for GPT — "I've Got This" ad series

You own this thread. A parallel Claude session owns the optional-certificates
feature and is not touching `brand/`. Stay in `brand/` and `docs/marketing/`.

Read `docs/SESSION-HANDOFF.md` first for repo-wide context, then this file.
Where the two disagree about the ad series, this file is newer and wins.

---

## 1. Non-negotiables

Break any of these and the work is unusable.

- **Fee model:** providers keep **100%** of their quoted price; customers pay a
  **5%** fee on top. Never write "providers keep 95%".
- **Sign-off tagline, every ad:** "Customer choice. Provider freedom." Do not
  invent a different one.
- **Pre-launch gate:** no customer can book today. Every service is
  `disabled_pending_*` with `customer_visible: false`. Nothing may imply
  customers can book. The existing on-screen line "Customer jobs aren't live
  yet." is how this is handled — keep that honesty, don't soften it.
- **Audience:** providers only (mobile mechanics, detailers) in **Montgomery
  County, Maryland** / DMV. Not customers.
- **A punchline must name the service *and* carry a second meaning.** A bare
  service noun is not a line.
- **0:00 hook is mandatory.** Roughly half of viewers leave in 3 seconds. Every
  episode opens on a silent plate with hook text.
- **Native platform text overlays**, not burned-in captions. **AI-content
  disclosure toggle on** when posting. TikTok: ~6 hashtags, local MoCo/DMV mix.
- **Never ask AI video to render a mechanism.** Generate confidence and
  aftermath separately, then cut between them.
- Brand mark: navy `#07182D` badge + orange funnel. The old T-funnel logo is
  retired. The social-media-kit PNG has a baked-in black box — use the
  transparent lockup on dark plates.

---

## 2. Actual state of the assets (verified 2026-08-08, not inherited)

The handoff says "four episodes rendered". That is true only in the sense that
four files exist. Here is what they really are:

| Episode | Source footage | Render | Reality |
| --- | --- | --- | --- |
| ep1 battery | `got-this-assets/ep1-battery/` has `clipB.mp4`, `clipC.mp4`, 3 SFX, `vo-punch.mp3` | `got-this-ep1-battery-{1x1,9x16}.mp4` (~2.6 MB / 3.9 MB) | **Real cut.** The only finished episode. |
| ep1 battery v2 | same | `got-this-ep1-battery-v2-SLATE-*.mp4` (~205 KB) | Recut per commit `24fca20` (7-second two-state joke). `SLATE` in the name means placeholder frames. |
| ep2 diagnostics | `got-this-assets/ep2-diagnostics/` is **empty** | `got-this-ep2-diagnostics-*.mp4` (~136 KB) | **Placeholder slates only.** No footage, no VO. |
| ep3 oil | `got-this-assets/ep3-oil/` is **empty** | ~136 KB | Placeholder slates only. |
| ep4 carwash | `got-this-assets/ep4-carwash/` is **empty** | ~134 KB | Placeholder slates only. |

Shared assets that do exist: `got-this-assets/shared/plate.mp4`,
`lockup.png`, `lockup-nostrap.png`, `vo-tagline.mp3`.

`build-got-this.ps1` renders a labeled `[... PENDING]` slate wherever a clip is
missing, so timing is reviewable before footage exists. That is why ep2–ep4
render at all. Do not report them as finished ads.

**Consequence for you:** ep2–ep4 punchlines are not written down anywhere. The
build script pulls each episode's punchline from a per-episode `vo-punch.mp3`,
and only ep1 has one. Writing those three punchlines as text is real, unblocked
work.

Current ep1 v2 overlay copy, in order:
`THIS ONE? EASY.` → `YOU QUOTE IT.` → `YOU KEEP 100%.` →
`Customer jobs aren't live yet.` → `Customer choice. Provider freedom.` →
`tuveloz.com/join`

---

## 3. Your scope

In priority order.

1. **Write the ep2 / ep3 / ep4 punchlines** (diagnostics, oil, car wash) as
   text, to the rule in §1: names the service, carries a second meaning,
   flatters the mechanic who spotted the mistake first. Give 3 candidates per
   episode with a recommendation, not a list to sort.
2. **Write the per-episode overlay set** matching ep1's six-beat shape above:
   0:00 hook, two setup beats, the pre-launch honesty line, the tagline, the
   URL. Keep language plain — everyday words, not jargon.
3. **Write the posting package** per episode and platform (TikTok, Instagram
   Reels, Facebook): caption, ~6 hashtags with a local MoCo/DMV mix, and the
   0:00 hook text as it will be typed into the native overlay editor.
4. **Write the Higgsfield prompts** for the missing ep2–ep4 footage, following
   the verbatim-prompt format already in `docs/marketing/HIGGSFIELD_RUNBOOK.md`.
   Confidence and aftermath as separate generations — never one clip.

Deliver as new files under `docs/marketing/`. Do not edit
`build-got-this.ps1`, and do not edit anything outside `brand/` and
`docs/marketing/`.

---

## 4. What you cannot do, and who does it

- **Higgsfield generation is manual.** The Chrome extension connects but reads a
  0x0 viewport. You write the prompt, Wil clicks. Same for social profile
  uploads — files get staged in `Downloads` and Wil clicks through.
- **Artlist:** AI Starter plan. AI credits work; the **stock catalog is not
  licensed** (downloads are watermarked). 1 credit left, expires Sept 4 2026.
  Generated asset URLs stay live, so a deleted file re-downloads free.
- **Epidemic Sound:** subscription canceled, plan ended Aug 9 2026.
  `brand/ads/ad-01-assets/music.mp3` ("On My Way (Instrumental Version)" — Ten
  Towers) was downloaded while active. Confirm licensing before running paid ads
  post-cancellation.
- **The `.mp4` files are untracked and the git-vs-external decision is Wil's,
  not yours.** Don't `git add` video.

---

## 5. Open decision to flag, not to settle

The customer-side cut is blocked by the pre-launch gate. The plan on record is
that it becomes a launch-phase re-edit of the same clips — new punchline VO, new
end card, `-Launch` flag on the build script. Don't build it yet; note anywhere
your copy would need to change when it unblocks.

---

## 6. How Wil wants to be worked with

Direct verdicts, grouped in buckets. State confidence once. No scare framing.
Be factual — verify before asserting; no guessing. Don't end a reply on a
homework list. Counsel / broker / CPA / Stripe get named once as a footnote,
never as the answer to "what's next".
