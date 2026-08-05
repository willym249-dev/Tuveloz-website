# Audience Growth Playbook (pre-launch)

Phase: provider onboarding open, customer requests not live.
Companion to `provider-outreach-kit.md` (1:1 DMs) and
`../social-media-kit/profile-copy.md` (bios and pinned post).

---

## 1. What followers are actually for here

Follower count is the wrong scoreboard for a marketplace that only serves one
county. Montgomery County is roughly a million people, and the pool of
independent mobile mechanics, detailers, and jump-start operators inside it is
plausibly in the hundreds — not the thousands. A national following of 10,000
would be worth less than 200 people who live between Silver Spring and
Germantown.

So followers are not the goal. They buy exactly three things:

1. **Credibility at the moment of decision.** A provider who gets a DM checks
   the profile before clicking `/join`. An empty profile reads as a scam.
2. **A launch-day audience.** When customer requests open, an owned channel is
   the cheapest way to tell people. Building it costs nothing now; buying
   attention on launch week costs money.
3. **Algorithmic reach.** Early followers who watch and share teach the feed
   who to show the next post to. This compounds only if they're local.

Everything below optimizes for **local** followers and **provider
applications**, in that order of effort, with applications as the number that
actually matters.

**Targets for the next 8 weeks** (planning numbers, not forecasts):

| Metric | Target | Why this number |
|---|---|---|
| Posts live per platform | 9+ | Below ~6 a profile looks abandoned |
| Local followers (IG + TikTok + FB combined) | 200–400 | Enough to look real and seed reach |
| Provider applications from social | 20–40 | The number that decides launch viability |
| Google Business Profile | Live and verified | Highest-intent channel; still not live |

---

## 2. Fix the floor before driving any traffic

Do not run ads or a DM push at a profile with three posts on it. Traffic hits
an empty grid and bounces, and you pay for it twice — once in ad spend, once in
the provider who decided you weren't real.

**Pre-flight checklist, all platforms:**

- [ ] Avatar set from `../social-media-kit/` (correct size per platform — see
      that folder's README)
- [ ] Bio pasted from `profile-copy.md` (each is already within the character
      limit)
- [ ] Covers uploaded: Facebook `1640x624`, X `1500x500`, Google `1080x608`
- [ ] Pinned post published (the one in `profile-copy.md`)
- [ ] Both reels posted with AI-content labels on (see
      `media/captions-copy-paste.txt`)
- [ ] 6 more posts backfilled from the pillars in §4 — static text-on-brand
      cards are fine, they don't all need to be video
- [ ] Facebook Page linked to the Instagram account (one post, two platforms)
- [ ] Instagram switched to a Business/Creator account (needed for insights and
      later for the location tag)

Only after that box is checked do you spend a dollar or send a DM at scale.

---

## 3. The four levers, ranked by leverage

### Lever 1 — Google Business Profile (highest intent, currently missing)

This isn't followers, and it's still the single most valuable thing on this
list. Someone typing "mobile mechanic near me" in Wheaton has intent no reel
will ever match. The description is already written in `profile-copy.md`, the
avatar and cover are already rendered, and the link is still a commented-out
placeholder in `app/components/social-links.tsx`.

Verification takes days to weeks (postcard or video), so it is the long pole —
start it this week regardless of what else happens. Once live, add the share
link to `social-links.tsx` where the Google entry is stubbed out.

### Lever 2 — Other people's audiences

At this size you cannot out-post your way to reach. You borrow it.

- **Every provider who signs up is a distribution channel.** They already have
  customers, a Facebook Marketplace presence, a truck. A provider spotlight
  post (their photo, their business name, their service area) gets shared by
  them, their family, and their existing customers — local followers arriving
  pre-qualified. Highest-yield content the account will ever run, and it costs
  one photo and three questions. Full playbook, consent rules, and copy:
  **`provider-spotlight-kit.md`**.
- **Local Facebook groups and Nextdoor.** MoCo groups by town — Silver Spring,
  Rockville, Gaithersburg, Germantown, Wheaton — plus "MoCo small business"
  and buy/sell groups. Post from the Tuveloz account where group rules allow
  business posts, never from a personal account (the astroturf rule in
  `provider-outreach-kit.md` applies here too). Read each group's rules first;
  a removal for self-promo can get the page banned from the group permanently.
- **Local subreddits.** r/montgomerycountymd, r/mocoMD, r/washingtondc. These
  are hostile to marketing and receptive to a founder being straight with
  them. The post that works is "I'm building X here, it's not live yet, here's
  what I got wrong so far" — not a pitch. One post, answer every comment, don't
  repost.
- **Spanish-language community groups.** A large share of MoCo's independent
  auto trade is Spanish-speaking, the signup form is already bilingual, and
  almost nobody is marketing to them in Spanish. The ES copy in
  `provider-outreach-kit.md` and the bilingual site are a real advantage here —
  use them. This is likely the most underpriced channel available.

### Lever 3 — Content that's useful without a customer base

The account can't post customer results yet, so post the thing a local car
owner would save or send to a friend:

- What a dead battery actually costs around here, by shop type
- Which MoCo inspection items fail most, and what they cost
- "Your check engine light means one of these five things"
- Winter/summer prep specific to Maryland

Useful and local beats clever and generic. Saves and shares matter more than
likes — they're what pushes a post to non-followers, and a save from someone in
Rockville is worth a hundred views from Manila.

### Lever 4 — Paid, small and tightly fenced

Once the profile floor is met: $5–10/day, radius-fenced to Montgomery County,
running the provider-recruitment creative in `../ads/`. At that spend the goal
is not scale — it's finding which hook and which town convert cheapest, so
launch-week spend isn't guesswork. Optimize for link clicks to `/join`, not for
follows; the follows come along for free and the applications are the point.

Note the licensing blocker in `../ads/HANDOFF.md` before running anything with
stock music behind it — the Epidemic Sound plan lapsed Aug 9, and licensing
generally covers content published while the subscription is active.

---

## 4. Content pillars and cadence

Five pillars, rotated. One vertical video works on TikTok, Reels, Facebook, and
YouTube Shorts — shoot once, post four times.

| Pillar | Speaks to | Example |
|---|---|---|
| Provider spotlight | Providers + locals | "Meet Luis — mobile detailing, Wheaton" |
| Local car knowledge | Customers | "3 things that fail MD inspection" |
| Price transparency | Both | "What a battery swap should cost in MoCo" |
| Build in public | Both | "Why we charge providers nothing" |
| Recruitment | Providers | The two existing reels |

**Cadence: 4 posts/week.** Three is a floor, seven is unsustainable and shows.
Consistency over volume — an account that posts twice a week for six months
beats one that posts daily for three weeks and dies.

**Suggested first four weeks:**

- **Week 1** — Pinned post, both reels, one price-transparency card
- **Week 2** — Local knowledge ×2, build-in-public ×1, reel repost with new hook
- **Week 3** — First provider spotlight (as soon as one accepted provider says
  yes), local knowledge ×2, recruitment ×1
- **Week 4** — Provider spotlight ×2, price transparency ×1, launch-countdown
  teaser ×1

Hashtags: heavy stack on Instagram, ~5 on TikTok (tag-stuffing gets buried) —
both sets are already written in `media/captions-copy-paste.txt`.

---

## 5. Capture the follows already being earned

**Built.** The follow prompt (`FollowAlong` in
`app/components/social-links.tsx`) now runs at the two moments where intent is
highest — the provider application-received screen and `/welcome` for both
roles. Previously the only ask on the entire site was the footer.

Clicks emit `social_follow_clicked` with the platform and the placement
(`provider_application_received`, `welcome_provider`, `welcome_customer`), so
§6 is measurable rather than a guess. Footer links stay untracked.

**Still open:** the Google entry is commented out in `social-links.tsx` and
stays that way until Lever 1 completes — the moment the Business Profile is
verified, drop the share link in and it appears in the footer and in every
follow prompt at once.

Worth considering next: the same prompt on the customer-request confirmation
once customer launch is closer, and on the homepage email capture.

---

## 6. What to actually watch

Ignore follower count as a decision input. Weekly, look at:

- **Provider applications, by source.** The funnel already lands in
  `analytics_events` and is visible at `/admin/analytics-funnel`. This is the
  only number that decides anything.
- **Follower *locality*.** Instagram and TikTok both break down audience by
  city. If MoCo isn't the top cluster, the content is reaching the wrong
  people and the hashtags are too broad.
- **Saves and shares per post**, not likes. Shares are what recruit.
- **Profile visits → link clicks.** If visits are high and clicks are low, the
  bio is the problem, not the content.

If after four honest weeks the applications aren't moving, the answer is not
more posting. It's that social is the wrong channel for reaching this audience,
and the budget belongs in 1:1 outreach and Google. Chasing follower count past
that point is a way to feel busy while the marketplace stays empty.

---

## Honesty rules (carried over from the outreach kit)

- Never imply customers can book or pay today.
- Never promise income, job volume, or perks not published on the site.
- No astroturfing — business posts come from the business account.
- Label AI-generated creative on every platform that asks.
