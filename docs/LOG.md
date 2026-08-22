# Working log

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-06

This is the shared memory between every chat session, tool, and person working
on Tuveloz. A conversation ends and takes its context with it; this file is what
survives.

**Newest entry goes at the top**, directly under this line. Read the top few
entries to catch up. Write one before you finish.

---

## 2026-08-22 — Zeo got a sports betting desk, and two of its guards were not guarding

**Why this is here.** Nothing Tuveloz-side changed, and nothing Tuveloz-side is
blocked. It is recorded for the same reason the Zeo entries below it are: Zeo
reads this project under a read-only workspace, the owner works in both, and a
session that hears "the betting tab is wrong" needs to know where that code
lives. The work is in the Zeo repository on branch
`claude/zeo-gambling-trades-stats-ue03qh`, commit `0f7d28c`. **Do not look for
it here** — this repository has no `bet` verb and should not grow one.

**What was asked and what was built.** The owner asked for a gambling tab on
Zeo's investing page: live games, the stats behind them, who to back, and when
an underdog has a real case, MMA and boxing included. `zeo_betting.py` reads
ESPN's public scoreboards for eleven leagues — UFC, PFL and boxing among them —
takes the book's margin out of the published moneyline, and compares that fair
price against a bounded model. It surfaces as a second tab in the window the
**Investing** button opens, a **Sports** button beside it, and a **Sportsbook**
panel in Zeo Remote.

**The shape it was given, and why.** The same fail-closed pattern this project
uses, because the honest version of "who should I bet" is not a pick:

- **Zeo cannot place a wager.** No sportsbook adapter, no credential, no
  submission path. That is deliberately harder than `zeo_investing`, which has
  a real broker port held shut by two switches — here there is no port, so
  there is no switch to flip by mistake. `bet log` records a bet the owner
  already placed.
- **No stake is a recommendation until the record earns it.** Every call is
  written to an append-only ledger at the price it was made at, and scored
  against the market's own probability. The gate needs 200 settled calls and a
  win over that benchmark. Kelly numbers print as what they *would* say.
- **Matchup evidence is capped** at 0.18 log-odds per lever and 0.45 in total,
  because every input is public and already in the price.

**The part worth carrying forward.** Two guards were found reporting coverage
they did not have, both while wiring this up, and both are the same failure
this project keeps meeting:

- `zeo_verb_admission.parser_subcommands` scraped `sub` but not `subcommand`,
  so every branch spelled the longer way came back empty — which that function
  reports as "cannot tell", and the test then skips. `invest radar`,
  `invest analyze`, `invest analyse` and `invest counsel` have been swallowed
  as chat by the desktop box for as long as they have existed. The remote page
  runs two of them from buttons, which is exactly why nobody noticed.
- `run_zeo_precommit.related_test_modules` paired `zeo_x.py` only with
  `test_zeo_x.py`. The repository mostly names them `test_x.py`, so the gate
  saw 39 of 203 modules and missed 90 that do have tests. Most staged edits
  were gated by nothing, and looked gated.

Both are fixed. The lesson is the one already written into
`zeo_verb_admission`'s own docstring and proved again twice: a guard that
returns "nothing found" is indistinguishable from a guard that found nothing
wrong, and only the first one is a bug. Anything in either repository that
scrapes source text to check itself is worth asking that question about.

**Update, same day: the biggest guess was wrong, and it was found without a
live payload.** The egress policy on the cloud environment blocks every host
except GitHub and the package registries — `example.com` is blocked too, so it
was never about ESPN. GitHub being reachable turned out to be enough: the
public `pseudo-r/Public-ESPN-API` repository documents ESPN's undocumented
endpoints with live verification dates, and reading it corrected two things
that no amount of local testing would have.

**ESPN publishes no career statistics for MMA at all.** `common/v3/.../
athletes/{id}/stats` returns 404 for that sport, as do the league-scoped
athlete `statistics` and `splits` endpoints. The SLpM and takedown-defence
figures everyone quotes are UFCStats numbers, not ESPN's. The desk had been
written to read them out of ESPN's summary payload, which has never contained
them — so the grappling and striking levers, the two with the best claim to be
worth running, could not fire and never would have. Nothing in the output would
have said so; it would have looked like a card with no mismatches on it. Those
rates are now *derived* in `zeo_fighter_stats.py` by summing ESPN's per-fight
counts over a fighter's recent bouts and dividing by the minutes actually
fought, with the sample size attached to every read and the results cached.

**The odds block names the favourite.** ESPN publishes `favorite` and
`underdog` flags, and often the athlete id, beside each moneyline. Prices are
now matched to competitors by id where one is given, which removes the failure
that would have inverted a whole league silently. Boxing is marked unconfirmed
— ESPN's own enumeration lists seventeen sports and boxing is not among them —
and Bellator was added, since UFC, PFL and Bellator are the three MMA
promotions its site API is known to serve.

**Two more, found the same way, and the first is the largest of all.**
`sportsdataverse/sportsdataverse-py` is a public library that carries recorded
ESPN payloads as test fixtures. Fifty-five real contests across eight leagues
were run through the parser: every one parsed whole — names, home and away,
overall records, scores, state, start time. **And not one of them carried a
price.** Eight recorded scoreboards have no `odds` key at all, and ESPN's
endpoint documentation lists betting odds only under the core API, per
competition. The desk had been reading the moneyline off the card, so against
real data it would have priced nothing and reported "no moneyline published
yet" on every game on the board — an entire feature that looks like a quiet
evening rather than a bug. Prices are now fetched per contest.

The second was a missing path segment. The fighter drill-down needs
`/v2/sports/{sport}/leagues/{league}/athletes/{id}/eventlog`, and it had been
built without `leagues` — because the site API's equivalent path does not have
one. Every request would have 404'd and every fighter would have come back with
no rates, which reads as a card of fighters nobody has information about. Both
URLs now match, character for character, what that working library sends.

**Update: it was run on `zeo-home`, seven times, and four more defects fell
out.** The cloud session cannot reach that machine, but the machine is a
self-hosted GitHub Actions runner and it was online, so a read-only workflow
on the branch put the capture there and the job log brought the answer back.
Prices, injuries and head-to-head now read live: Yankees -108 against Toronto
+101 through DraftKings, Sabally and Fiebich correctly ruled out, "IND leads
series 2-1".

The four, all of them silent:

- **The moneyline is not on the scoreboard.** Every league, every run,
  `priced on card 0`. It is a per-competition core-API endpoint.
- **A missing `leagues` path segment** would have 404'd every fighter lookup.
- **The fighter id is on the competitor**, not the nested athlete, so every
  bout reported nobody having any statistics.
- **The head-to-head block is called `seasonseries`.** This looked for two
  other names, found neither anywhere, and reported "head to head no" on
  every game for as long as it existed.

And one that was not silent, which is worse. A live Premier League read came
back at **-16.6% hold** with both sides reported as positive expected value,
because soccer can end level and the draw was not in the de-vig. Fixing that
exposed a second half: the model still forced the two sides to sum to one,
handing the draw's entire share to the favourite, so Manchester United showed
89.9% against a fair price of 71.2% and the difference was called a
twenty-cent edge. It reads 71.7% and -4.0c now.

**The lesson.** A blocked host is not always a blocked question. What could not
be reached was ESPN; what was actually needed was the shape of its payloads,
and that was sitting in a public repository the whole time. Worth asking, next
time a network policy stops a piece of work, whether the server is wanted or
the knowledge is. And a second one, from the runs that followed: a number that
looks plausible is not evidence. Every one of these survived a test suite,
because a test written from the same misunderstanding agrees with the code —
and the one that would have cost real money was the one that looked most like
a finding. Three defects were found this way and every one of them was
silent by construction: no exception, no wrong number, just a feature that
reports having found nothing. Those are the ones that survive a test suite,
because a test written from the same misunderstanding agrees with the code.

**Still open.** The container still cannot reach `site.api.espn.com`, so **no
parser has met a live payload.**
Everything is guarded field by field and a missing field becomes a stated
absence rather than a substituted zero, but the failure to expect is a lever
that silently never fires — which looks exactly like a matchup with no mismatch
in it. One command now answers it: `py -3.12 zeo_betting_capture.py` reads each
league once and prints what arrived, including every statistic name the alias
tables do not recognise and whether the per-fight derivation worked at all.
`ZEO_BETTING.md` §8 is the checklist to run on `zeo-home`, and §7 names the one
step a commit could not take — the nine
`bet_*` actions are in Zeo's `DEFAULT_CONFIG` and example config, but
`agent_config.json` is gitignored, so the live config needs them added by hand
or every `bet` command returns "not allowed by runtime allowlist".

---

## 2026-08-17 — Zeo's search failed, and the diagnosis was wrong for most of a day

> **Corrected the same evening. Read this first.** This entry originally said
> Microsoft had retired Bing's `&format=rss` feed on 2025-08-11 and that it
> answered every query with an empty channel. **That is false.** Measured from a
> GitHub runner that evening, with Zeo's own User-Agent, its `_HTML_ACCEPT`
> header and its 20,000-byte cap, the feed returned ten results for every query
> tried — including the three the owner had just watched Zeo fail on. The claim
> came from a search result describing other people's reports, written up as
> settled fact by a session that could not reach a single search host to check
> it. Bing's feed is not dead; the original text is kept below with this notice
> because the shape of the error is worth more than a tidy page.
>
> Why searching actually failed on `zeo-home` is **still unknown**. It is a
> question about that machine, not about the backend.

**Why this is here.** Nothing Tuveloz-side changed. It is recorded because the
mistake is the same one as the entry below it, arriving from the other
direction, and because a session that reads either should read both. The work is
in the Zeo repository: `dbdbf82` (#6), then the correction in `7f3270e` (#17).

**What happened.** The owner asked Zeo whether any games were on. Zeo replied
that it had searched the web and "the search returned nothing usable, so I have
no answer for you." Asked to narrow it to the NBA, it answered from memory that
no games were scheduled for "today, June 27, 2024".

Both halves were broken, in different ways.

The lookup's default backend reads Bing's `&format=rss` feed. Microsoft retired
the Bing Search APIs on 2025-08-11; the URL still answers 200 and the channel
comes back with no items in it, for every query. Zeo's code could not tell that
apart from a question nobody has written about, so a search service that had
stopped answering was reported, every time, as a run of unlucky questions. The
sentence was honest and pointed in exactly the wrong direction: the only repair
it suggests is asking again in different words, and no wording gets past a dead
feed. Roughly a year of lookups.

The date was a separate hole. No request Zeo sends the local model has ever
carried one, so the only "today" the model has is wherever its training data
stops — and every judgement that turns on recency was being made against that
date, not just the one visible wrong answer.

**The lesson worth keeping.** An honest failure message is not automatically a
useful one. "Nothing came back" was true about the feed and false about the
question, and because it named the wrong subject it sent the owner to the one
place the fix could not be. When a component can fail for two reasons that look
identical from outside, the check that tells them apart is the feature — Zeo now
spends one control query on a failed search and, if that also comes back empty,
names the search host and the setting to change instead of the question.

This is the 2026-08-15 video mistake in reverse. That one verified the stage it
had changed and never looked at what the owner receives. This one looked only at
what the owner receives, saw a well-formed honest sentence, and never asked
whether the machinery behind it was running at all. Both are answered the same
way: assert on the artifact, and make the artifact say which failure it is.

**The bigger lesson, added with the correction above.** Everything up to here
was written about a cause that was never checked. The session could not reach
any search host, searched the web *about* the feed instead, found other people
describing empty responses, and promoted that into a fact — then shipped four
changes on it, one of which put four dead hosts ahead of the working one and
made searching worse than it found it.

Three habits that would have caught it, none of them clever:

- **A second-hand report is evidence about reports, not about the thing.** "I
  read that this is broken" and "I asked it and it is broken" are different
  claims, and only one of them justifies a fix.
- **When you cannot reach the thing, say so in the artifact.** The pull requests
  said "I could not verify this" in the body while the code, the comments and
  the commit messages asserted the retirement flatly. The caveat has to live
  where the claim lives.
- **Find the compute that can check.** A GitHub runner has ordinary internet and
  was available the entire time. Nine minutes of using it settled what a day of
  reasoning had got backwards. When a container cannot see something, the
  question is which reachable machine can — not how confidently the gap can be
  argued across.

**Update, same day: the config edit was removed rather than documented.** The
paragraph that used to sit here said searching stayed broken until the owner
hand-edited `runtime.web_lookup.backend` and `runtime.web_learning.backend` on
`zeo-home`. That was true when it was written and it should not have been the
answer. The dead host was a *default in the code*, so the place to fix it was
the code, and writing up someone else's JSON edit was a way of not noticing
that. `rss` now means an ordered list of feed URLs instead of one host: the
first that returns results wins, and a machine whose config was never touched
searches again after a pull and a restart. Merged as `804b95e`, with the
`search status` command in `061b604` reporting which host is actually
answering.

Two things that came out of it are worth more than the fix:

- **The first draft defeated the guard it was working around.** It merged the
  new candidate hosts into the `search_hosts` allowlist, which made the
  allowlist stop restricting anything. The existing test proving a
  non-allowlisted host is refused went red, and it was right to. The fix was to
  make the allowlist *filter* the candidate chain instead — the guard decides
  what may be contacted, exactly as before. A test going red because you
  loosened something is the test doing its job; the move is to redesign, never
  to edit the test until it agrees.
- **A fix for silent failure nearly shipped as slow failure.** Five candidates
  at the full 15-second timeout is a 75-second search, and the health check
  behind it makes it 150. That is worse than the silence, because the owner
  feels it on every query. The chain now runs against a wall-clock budget of
  twice the single-host timeout. Checking the cost of a change is part of the
  change.

**Now open — and this is the part a later session should act on.** Nothing
Tuveloz-side is blocked, and nothing is owed on `zeo-home` beyond `git pull` and
a restart, or the word `selfupdate` typed to Zeo.

**The original fault is still undiagnosed.** Bing's feed answers normally from
outside, with Zeo's exact headers, byte cap and queries, so whatever made
searching fail on `zeo-home` is specific to that machine — its network, its
`agent_config.json`, or something not yet guessed. Nothing in this repository
can see it. `search status` run on that machine reports which host answered and
with what, and that output is the missing evidence; anyone picking this up
should start by asking for it rather than by theorising, which is precisely the
trap the correction at the top of this entry records.

---

## 2026-08-17 — Zeo's "same video every time" was the renderer, not the premise

**Why this is here.** Nothing Tuveloz-side changed. It is recorded because the
shape of the mistake is the useful part, and because a session reading the
2026-08-10 Zeo entry should know the story continued. The work is in the Zeo
repository on `claude/video-generation-issue-2fqtzc`.

**What happened.** On 2026-08-15 Zeo was fixed so that a video request naming no
scene invents an original premise instead of reusing a hard-coded constant. That
fix worked and was verified live — three consecutive inventions, three different
stories. On 2026-08-17 the owner reported the identical original complaint,
having seen no change at all.

Both were true. The premise varied; the picture did not. Zeo's procedural
renderer recognised so few words that nearly any story collapsed to the same
defaults — an anonymous "Hero", walking, in front of the same backdrop, because
each of those three was a literal constant reached whenever the vocabulary
missed. Measured by rendering one frame per premise: a rooftop gardener, a pearl
diver, and a clockmaker differed by under one greyscale level per pixel. Even
two stories that did agree on a setting drew the same skyline, since each
backdrop's layout was hardcoded too.

**The lesson worth keeping.** The 2026-08-15 fix was verified at the layer it
changed. It generated three different premises and that was checked and true.
Nothing measured the artifact the owner actually receives, so a fix that changed
nothing the owner could see looked complete for two days. When a complaint is
about output, the test has to assert on the output — not on the stage believed
to be at fault. The new test in Zeo compares rendered frames for that reason;
ten of its fifteen cases fail on the code that was thought to be fixed.

Second-order: the same session found that "make a video yourself" was making a
video *about Zeo* — the word survived into the scene description and resolved to
the character. A request that says who chooses is not a request for a subject.

---

## 2026-08-16 — The failing DMARC sender is real, and the rua mailbox is not a black hole

Two open questions about email authentication closed in the same sitting, both
from evidence outside this repository.

**The Workspace sender is live.** `2274534` (earlier the same day) worked out
from DNS that mail sent as `hello@tuveloz.com` fails DMARC on both legs — the
root SPF authorises the registrar's forwarders and not Google, and no Workspace
DKIM selector is published — but recorded honestly that the repository could not
say whether that mailbox actually *sends* or only receives. It sends. The sent
folder holds ordinary correspondence to recipients outside the domain, the most
recent on 2026-08-08, alongside a few self-addressed tests. So the broken sender
is in current use, and the Workspace SPF include plus a published DKIM selector
moved from "confirm or rule out" to a prerequisite for enforcement. It now has
its own dated row (2026-10-05), ahead of the `p=quarantine` move on 2026-10-19,
and that row was rewritten to depend on it. The recipient addresses are personal
data and were deliberately not written down anywhere in this repository; that
external recipients exist is the whole finding.

**The `rua` address receives.** `dmarc@tuveloz.com` is a working mailbox with
three Google aggregate reports in it, dated 2026-08-08 through 2026-08-12. That
retires the receipt half of the 2026-08-24 item; naming a reader is still open,
and pointedly so, because most of those reports are unread — the exact state
`email-authentication.md` calls decorative. Worth knowing for the inventory:
Google is so far the only submitter, so what the reports show is one receiver's
view, and a sender that never mails Gmail addresses would not appear in it at
all.

Nothing in the DNS changed today. Both findings are evidence, and the fixes they
imply are owner actions in the registrar and in Workspace, not code.

## 2026-08-13 — Hero copy test refreshed from real funnel data; step events now variant-stamped

Production funnel read (D1 `analytics_events`, all-time): 76 provider signup
landings → 10 step-1 completions → 4 step-2 → 1 submitted. The cliff is
landing → step 1, so the wording work went there. Two changes:

**The measurement bug first.** `provider_step1_completed` and
`provider_step2_completed` fired with empty props, so no A/B experiment could
ever be read at the step that actually loses people — only the start and the
single completion carried variants. Both events now stamp
`variants: activeVariants()`. Every read of the experiments before 2026-08-13
is unattributable at the step level; treat the tests as starting fresh from
this date.

**`provider_hero` B replaced.** The old B ("Do great work. Get paid.") was
generic. Competitor survey (Thumbtack pro lander, TaskRabbit, YourMechanic,
Wrench, Angi) shows the converging pattern for pro recruiting: name the
visitor's place and the thing they want — Thumbtack literally renders "Get
jobs in Germantown." for a Montgomery County visitor. New B, kept
launch-honest (first in line, not jobs today): "Be first in line for car jobs
in Montgomery County." A ("Your wrench. Your rules.") stays the control.
Spanish dictionary, admin funnel labels, `tests/hero-experiment.test.mjs`, and
`tests/spanish-coverage.test.mjs` updated together. Losing the old B's data
cost nothing — see the measurement bug above.

The paused-mode customer hero paragraph was also warmed (quotes "come right to
your driveway"), with its dictionary entry replaced in the same commit. The
customer side has too little traffic to test, so that one is a judgment edit,
not an experiment. Owner reads results at `/admin/analytics-funnel`; the page
itself says to wait for ~30 visitors per variant.

**Same-day follow-up: two signup friction fixes.** A successful application now
writes the verified email to the shared remembered-email key
(`lib/remembered-email.ts`, extracted from `/account`), so the sign-in that the
success screen points to arrives prefilled instead of asking the applicant to
retype the address they just proved control of. And step errors ("pick at
least one service", invalid email, legal confirmation) now scroll into view
when raised — they rendered at the top of the form while the buttons sit at
the bottom, so on a phone the tap looked like it did nothing. Verified by the
full suite and `npm run test:e2e` (provider application, provider sign-in,
customer signup all green against a real local server and D1).

## 2026-08-11 — Terms and the Payment Policy re-released; the open-PR queue cleared

**The release, because this one is a legal act rather than an edit.** Both pages
carried retired fee names, two occurrences each — one of Terms' sitting **inside
the liability cap in section 15**, and one of the Payment Policy's being a
section heading. The retired names themselves are not repeated here: they are the
banned patterns in `tests/customer-fee-consistency.test.mjs`, which scans `docs/`,
so writing one into this log re-introduces the thing the release removed. That is
not hypothetical — the first draft of this entry named both and failed the guard.
#95 had already established one canonical name in
`lib/customer-fee.ts`, but these two pages are SHA-pinned, so renaming them meant
following the `DEPLOYMENT.md` procedure: owner approval of the exact page,
incremented versions, new release ids, and hashes recomputed as sha256 of the
page source with CRLF normalised to LF.

Released as `terms-2026-08-11-r3` and `payment-policy-2026-08-11` in #160.
`TERMS_VERSION` went to `2026-08-11-r3` and `PAYMENT_POLICY_VERSION` to
`2026-08-11`. Done now deliberately: bumping `TERMS_VERSION` changes
`CUSTOMER_POLICY_BUNDLE_VERSION`, which is recorded on acceptance records, and
with customer job posting paused there are no real acceptances to invalidate.
Waiting would have made the same change expensive.

**`PENDING_LEGAL_RELEASE` in the fee test is now empty.** That list existed only
to let those two pages serve retired wording while a release was pending. An
entry appearing there again means a page is knowingly serving retired wording —
say which release fixes it and when.

**Two capitalisations were reverted on purpose.** Two lines already read
"customer service fee" in lowercase prose. Capitalising them broke the guard
asserting the agreements and the Stripe receipt describe the same fee. Reverting
kept the change minimal and left the guard alone; loosening its pattern to
accommodate a cosmetic edit would have been the wrong trade in legal text.

**The queue.** Eleven open pull requests down to one. #93 stays — it is the
`[DO NOT MERGE]` preservation branch and goes away when `tuveloz-app` exists.
#100 was closed unmerged: its headline change was an arbitration clause the owner
shelved on 2026-08-07, and merging it would have silently reinstated a clause
removed on purpose. Its salvageable work was extracted into four separate pull
requests instead — #155, #156, #157, #158 — leaving behind the arbitration
clause, a parallel `docs/STATUS.md`, and local-search work #95 had superseded.

**The pattern across all of it, worth carrying.** Every stale branch hid at least
one regression behind a small-looking conflict. Resolving with `--ours` or
`--theirs` on a whole file is not conflict resolution — it discards one side's
entire work, and it only looks safe when the visible hunk is short. Twice that
reverted `main`'s corrected fee copy. The reliable method is to take `main`'s
file and apply the branch's own diff on top with `git apply --3way`, resolving
only the hunk that genuinely conflicts.

---

## 2026-08-11 — The homepage founding banner promised two things we refuse

**Why this mattered.** The banner told providers *"The first pros into Montgomery
County get first pick of jobs"* under the heading *"Be first. Own your corner of
the county."* Both are perks the founding program refuses in writing, and the
first is barred in code: `lib/founding-cohort.ts` says outright that nothing in
that module may influence what a customer is shown or the order providers appear
in. `founding-provider-program.md` refuses territory locks by name.

So this was not a wording preference. It was the one claim on the site that could
not have been delivered if a provider had asked us to honour it — and it sat on
the page a paid provider campaign was about to point at.

**What it says now.** Only perks that exist: the first 20 accepted are never
charged a provider membership fee if one is ever introduced, and the first 10 are
invited to a spotlight post. Both numbers match `FOUNDING_COHORT_SIZE` and
`FOUNDING_SPOTLIGHT_LIMIT`, and the membership-fee wording matches the published
`/founding-providers` page — which already said it correctly. The site contradicted
its own published program page, not just its code.

**The Spanish carried both claims too**, and would have been missed by reading the
homepage alone: `site-language.tsx` had *"escogen trabajos antes que nadie"*
(they choose jobs before anyone else) and *"Adueñese de su zona del condado"*
(take ownership of your zone of the county). The dictionary keys on the English
string, so both key and value had to change together. Anything that edits
customer- or provider-facing copy has to check the dictionary in the same change,
or the English gets fixed and the Spanish keeps making the promise.

**Left the copy as one contiguous string on purpose.** Interpolating the cohort
constants into the JSX would tie the numbers to the source of truth, but it splits
the sentence into separate text nodes and the dictionary would no longer match —
the translation would fail silently. Literal numbers, verified against the
constants by hand, is the safer trade here.

**Both brand documents already flagged this** — `SALES_PITCH.md` listed it as one
of two live contradictions, and the morning-ads campaign doc told writers never to
say it. The rule was written down and the site said it anyway. Written guidance
does not remove copy that is already shipped; someone has to go and change it.

---

## 2026-08-11 — Check open pull requests before starting anything small (#147)

**New rule in `CLAUDE.md`, next to the existing "read the log first".** The log
records finished work. Work in flight lives in open pull requests, and nothing
sent anyone there — so run `gh pr list` and skim recent `main` before starting.

**Why it earned a rule.** Sessions run in parallel and cannot see each other,
and the collisions are not random: the small, obvious, self-contained job is the
one two sessions pick independently. The big messy ones never collide. Three
times in one afternoon — #137/#138 (the same eight-line doc block, and **#138
merged with an entirely empty diff** because git read the byte-identical
addition as agreement rather than a conflict), #145/#146 (the same deletion
entry, reconciled by hand), and the tag audit itself, run twice in parallel.

All three were minutes to hours apart, so the check would have caught every one.
If someone is already on it, extend their branch rather than opening a second
pull request.

---

## 2026-08-11 — `archive/got-this-series-wip` is audited empty and deleted

**This supersedes the two "the tag must stay" notes below.** Both were correct
when written. Neither is now: the ad half landed in #132/#134, and the last
thing the tag held that `main` did not landed in #143. The tag pointed at
`858b2d1` (annotated object `76f3a25`) and is gone from local and `origin`.
Both archive refs from `ads/got-this-series` are now gone; nothing points at
those commits, so git will collect them.

**Where everything ended up**, so nobody has to reconstruct this:

| From the tag | Landed as |
| --- | --- |
| the 21 ad-pipeline and document files | #132 and #134 |
| the `lib/launch-status.ts` doc block | #137 (and #138, an empty duplicate) |
| the e2e customer-signup and provider-sign-in coverage | #140 |
| the Reel 2 retirement note | #143 |

**How it was audited, since "delete an archive" deserves showing the work.**
Three questions, in order:

1. *Files only in the tag?* `git diff --diff-filter=A origin/main <tag>` → **0**.
   Every path in the tag exists on `main`. The "18 files never committed to any
   branch" line below was already stale.
2. *Files whose content differs?* **109.** For code and tests `main` is ahead by
   the whole lineage — that is the subject of the entry below, and losing those
   older versions is the point, not a cost.
3. *Any file with lines in the tag that never reached `main`?* Seven had some.
   Each was read rather than counted:

| File | Verdict |
| --- | --- |
| `brand/outreach/reel-provider-recruitment.md` | **tag ahead — salvaged in #143** |
| `scripts/generate-brand-assets.mjs` | `main` ahead: tag is the old PNG-master/`favicon-v2` generator, before the vector master |
| `brand/social-media-kit/README.md` | `main` ahead: tag drops the served-assets table and the `brand-mark-consistency` test note |
| `brand/outreach/moco-outreach-worklist.md` | `main` ahead: tag lacks Tier 1b and the `montgomery.craigslist.org`-is-Alabama warning |
| `.env.example` | `main` ahead: same AI-key block plus the `/ai` page and its fail-closed behaviour |
| `brand/outreach/provider-outreach-kit.md` | **tag is the old fee copy** — it framed the provider share as 95%. `main`'s fuller wording stands |
| `brand/ads/HANDOFF.md` | same old fee line. Left dead deliberately |

**#143 — the only thing that needed rescuing.** `main` still listed Reel 2
("dead battery documentary stare") as a live spec to produce. It was retired on
2026-08-07 and folded into Episode 1 of the "I've Got This" series, because it
duplicated Episode 1's joke and CTA and shipping both would split one gag across
two posts. What survived is the documentary stare and the forehead on the horn,
now clip D of Episode 1. Anyone working from that file would have produced a
retired reel.

**The lesson worth keeping.** Two of the three "tag ahead?" candidates that
looked promising were the *older fee copy*, and one was the retired logo
pipeline. On a tag from a superseded lineage, "content `main` does not have" is
usually content `main` deliberately moved past. Read every candidate; do not
salvage on a line count.

**One idea died with it, deliberately.** The tag's owner-side new-account alert,
keyed `security:owner-new-account:`, does not exist on `main` and was not ported
— adding it is a product change, not test coverage. If that notification is ever
wanted, it has to be rebuilt from scratch; there is no longer a copy to read.

---

## 2026-08-11 — `archive/got-this-series-wip` is not landable; two pieces salvaged

**Why this is here.** The tag looks like unfinished work waiting to be landed.
It is not. It is a snapshot of an older lineage, so applying it to `main`
*removes* newer work rather than adding to it — and some of what it removes is
launch guarding. Anyone who finds the tag and tries to cherry-pick or merge it
will weaken the marketplace locks without meaning to. Read this before touching
it. The entry directly below covers the same tag from the ad-asset side and
concludes it must stay; both conclusions point the same way — **keep the tag,
never merge it.**

**What replaying it would delete.** Not a merge conflict to resolve — a silent
revert. Among other things: `pausedCustomerRequestResponse()`, the entire
fail-closed 503 handler for customer requests; the comment pinning that gate
ahead of origin checks, body parsing, and every database read; the
`status: "blocked"` eligibility reasons and the "Real job operations remain
disabled" copy; and the customer-facing "jobs closed" text on the account and
post-job pages. Applied file by file, the tag nets out as
`email-notifications.ts` +35/−62 and `account-auth.ts` +15/−74. The two real
conflicts, `post-job/page.tsx` and `job-posting-pause.test.mjs`, both resolve to
`main`'s side: one would have deleted imports `main` still uses, the other
replaced 14 assertions with 4.

**What was salvaged.** Two pull requests, both additive:

- **#137** — the `lib/launch-status.ts` doc block. Eight lines, no deletions,
  lock value untouched. It records that `CUSTOMER_JOB_POSTING_PAUSED` governs
  marketplace *transactions* only and must never be read as a gate on account
  creation or on a provider submitting an application. The
  `CUSTOMER_JOB_POSTING_PAUSED_SUMMARY` constant that sits beside it in the tag
  was deliberately left out — nothing on `main` renders it.

  **#138 is the same block again and its diff is empty.** Two sessions salvaged
  it from the tag in parallel, and because the added text was byte-identical git
  treated it as agreement rather than a conflict, so #138 merged changing
  nothing (`git diff 496a05b 1d9d02a` is blank). The file carries exactly one
  copy. Cite #137 as where the block came from, and check `main` for concurrent
  work before salvaging from this tag — it is small enough that two sessions
  will pick the same piece.
- **#140** — the e2e signup coverage, ported by hand onto `main`'s version of
  `tests/e2e/provider-signup.e2e.mjs` rather than copied. Adds customer account
  signup, provider sign-in, post-signup application state, and the queued
  notifications. `main`'s newer work in that file is preserved: the `maxBuffer`
  raise, the per-repo/per-branch worktree namespacing, and the `.wrangler/state`
  reset before migrating.

**The trap inside the port, worth knowing on its own.** Three of the tag's
assertions did not hold against `main`, and running the suite is what exposed
them — two of the three passed review by eye:

| | tag | `main` |
| --- | --- | --- |
| `status` on a fresh application | `"approved"` | `"new"` |
| `verification_status` | `"self-enrolled"` | `"not reviewed"` |
| customer signup alert | `security:owner-new-account:customer:` | no such event exists |

The first two are the tag's lineage advancing an application *further* on signup
than `main` does. Asserting the tag's values would have pinned the looser
posture into a test — a guard regression wearing the costume of new coverage.
The assertions pin `main`'s stricter values instead. The third would have meant
porting a new owner-notification feature out of the old lineage, which is a
product change and not test coverage, so the assertion covers the
`security:account_created:` notice `main` does queue.

**Where that leaves the tag.** Intact and unmerged, which is correct. It still
holds the only copy of everything not listed above. Treat it as a reference to
read, not a branch to land: anything wanted out of it should be ported by hand
onto `main`'s current version and then actually run, the same way #140 was.

*Superseded 2026-08-11: the tag was deleted once the salvage finished. The
port-by-hand advice still applies to any old ref; the tag itself is gone.*

---

## 2026-08-11 — The archived ad work is on main, and one archive tag is gone

**Why this happened.** Deleting `ads/got-this-series` left 21 files reachable
only through a git tag. That is safe but not discoverable: nobody browsing the
repository would find the ad build pipeline, and the whole set sat one lost tag
away from gone. Both halves have now landed on main.

**#132 — the build pipeline.** The three ffmpeg build scripts, the ep1-battery
source audio, the shared lockups and tagline VO, `R2-MANIFEST.json`, and
`scripts/r2-video-manifest.mjs` that regenerates it. Twelve files, about 324KB.
These are the pipeline's *inputs*; the 57 rendered MP4s stay out of git under
the ignore rules from #127, with the private `tuveloz-brand-video` bucket as
the durable copy.

**A regression that was caught in the restore.** Checking out `brand/ads` from
the tag also overwrote `brand/ads/HANDOFF.md`, whose tagged version carries an
older fee line that framed the provider share as 95% — while main already had the
fuller wording about never expressing the customer fee as a provider deduction.
That file was reverted so main's version stands. Restoring a directory from an
old ref silently reverts every file in it that has moved on since; check the
modified list, not just the added one.

**#134 — the documents and remaining assets.** The counterweight-clip shoot
script and its how-to, the "I've Got This" creative spec, the Higgsfield
runbook, the no-strap lockup, a favicon variant, and the three cross-assistant
handoff documents from 2026-08-08. Restored verbatim rather than renamed:
three of them break the lowercase-hyphenated convention and none carry a status
header, but the runbook links to the ideas file by its URL-encoded name and
both briefs point at `SESSION-HANDOFF.md`, so renaming breaks the set.
Normalizing names and adding headers is still open, as its own pass.
`docs/README.md` gained a row for `docs/marketing/` and a **Historical**
heading for the three handoff documents, which are a record of how work was
split that day and not current instruction.

**`archive/got-this-series` is deleted.** Nothing was orphaned by that, for a
structural reason worth remembering: `archive/got-this-series-wip` points at
`858b2d1`, whose parent *is* `0808b9b`, so the old branch tip stays reachable
through the surviving tag. Files unique to that tag versus main are now zero.

**`archive/got-this-series-wip` was kept for this reason at the time.** It held 18
files of working-tree state that were never committed to any branch.

*Superseded 2026-08-11: the salvage finished and the tag was deleted. See the
entry at the top of this log. There is no recovery command any more, and the
audit found nothing left in it that `main` did not already have.*

**Fee copy was checked before landing**, since these are marketing documents.
Every mention states the rule correctly or forbids the 95% framing; no legacy 10%
copy survived anywhere in the set.

---

## 2026-08-10 — Closed three silent dead ends in account creation

**What happened.** Audited both signup paths end to end after asking whether
customers and providers can actually get accounts without trouble. Nothing was
broken, but three failures were silent — the visitor was told a code was on its
way and no email was ever sent, with no error to act on.

1. A provider picking the Provider tab and "Create account" without having
   applied. `eligibleAccountRoles()` only returns `provider` once an
   application row exists, so the server correctly refused and the generic
   response read as success. The provider create tab now says applications come
   first and links to `/join`.
2. The emailed-code throttle (3 per 15 minutes) was never surfaced. Both
   request routes returned the generic success text even when throttled, so
   anyone whose first code went to spam burned all three retries blind. Both
   routes now answer 429 with a real message.
3. No code entry step mentioned spam folders, the 10-minute expiry, or the send
   limit. All three now do.

**Decisions made.** Surfacing the 429 is only safe because the throttle now
runs *before* the eligibility lookup. The previous row-counting throttle could
only count rows it had written, so a 429 would itself have confirmed that an
address was real — an enumeration oracle, and the exact thing the generic "if
that email is eligible" wording exists to prevent. Throttling is now consumed
first, keyed by a hash of email+role+purpose, via the existing
`consumeFixedWindow` helper in `lib/public-write-rate-limit.ts` (no migration
needed). `issuePasswordChallenge` no longer throttles internally: its two
callers have to consume the window at different points — before the eligibility
lookup for a self-service request, after the password check for a sign-in — and
one shared throttle fired at the wrong moment for one of them.

Refusals stay generic. Naming which emails have applications would enumerate
providers; the fix is to state the rule up front, not to explain the refusal.

`tests/account-code-delivery.test.mjs` guards all of it, including the
throttle-before-eligibility ordering. That ordering assertion was
mutation-tested: reversing the two blocks fails it.

**Email authentication, checked the same day.** SPF, DKIM, and DMARC were
verified for `updates.tuveloz.com` by direct DNS query. DKIM aligns exactly and
SPF aligns under relaxed via Resend's `send.updates.tuveloz.com` bounce domain,
so alignment is correct. The gap is policy: `_dmarc.updates.tuveloz.com` does
not exist, so discovery falls back to `_dmarc.tuveloz.com`, which is `p=none`
with no `sp=` tag — monitoring only, no enforcement. Findings and the deliberate
tightening sequence are in
[`operations/email-authentication.md`](operations/email-authentication.md), with
dated rows in [`OPEN-ITEMS.md`](OPEN-ITEMS.md). The decision recorded: stay at
`p=none` until someone is actually reading `dmarc@tuveloz.com`, then move to
`p=quarantine` deliberately, and rotate the 1024-bit DKIM key to 2048.

**No end-to-end email test was possible before merge.** There is no preview
deployment for a pull request — every deploy step in `deploy-cloudflare.yml` is
gated on `github.event_name != 'pull_request'` — and staging cannot send at all:
`scripts/generate-staging-wrangler.mjs` sets `RESEND_FROM_EMAIL` to an empty
string and the staging Worker holds no `RESEND_API_KEY`, which `STAGING.md`
documents as intentional.

Verification was done locally instead, and is now committed as
`tests/e2e/account-signup.e2e.mjs` (`npm run test:e2e:account`). It runs in a
throwaway worktree against a real dev server, a real local D1, and a real
browser, with delivery pointed at `scripts/dev-mail-catcher.mjs` on loopback —
no production credential, no staging email, nothing leaving the machine. It
proves the property that matters: an eligible and an ineligible address are
indistinguishable across all four requests — same statuses, same response text
— while the catcher shows the two paths really did different work underneath,
three codes sent versus none. Reversing the throttle ordering makes it fail, so
it is a real guard.

What is still unproven is anything about **delivery**: nobody has watched a
code arrive in a real inbox, and the `Authentication-Results` header that would
turn the DNS analysis above into evidence has not been captured. Enabling
staging mail needs a separate Resend key and a `STAGING.md` update; whether to
do that at all is an open item.

**Now open.** Two friction points were left alone deliberately, as security
posture that is the owner's call rather than an assistant's:

- Password sign-in always requires an emailed code — mandatory 2FA on every
  sign-in, not optional. Passkey enrollment right after first sign-in is what
  softens this for repeat users.
- Sessions expire after 30 minutes idle and 12 hours absolute, so a provider
  working jobs will be signed out during the day.

Also unaddressed and structural: every entry path depends on Resend delivering
within 10 minutes, and phone/SMS is off (`PHONE_SMS_LIVE_MODE_ENABLED`). A
Resend incident or a domain-reputation dip locks everyone out with no fallback.

---

## 2026-08-10 — Zeo was answering without most of its own rules

**Why this is here.** Zeo is the owner's local assistant and it reads Tuveloz
under a read-only workspace. Its answers about this project were being produced
without most of its behaviour policy, so anything it said today or earlier is
worth re-checking rather than trusted. The work itself is in the Zeo repository
(`C:\Users\Torta Pounder\Zeo`), sixteen commits, written up in
`ZEO_LOCAL_MODEL_BEHAVIOUR.md` there.

**What happened.** The local runner keeps roughly 2k tokens of context by
default and discards the overflow without an error. Zeo's system prompt is
about 4805 tokens, so a question carrying project excerpts arrived with most of
the policy removed — measured directly: `prompt_eval_count` 2050 against a
4805-token prompt. Not only formatting rules were lost but never invent facts,
owner corrections outrank older memory, and the security boundaries. The symptom
that exposed it was two different system prompts producing byte-identical
replies. `num_ctx` is now always sent.

**What else that uncovered.** The Tuveloz project-context path had its own
standalone prompt and so never carried the general answering rules at all; it
now does, and its reply cap moved from 850 to 1200 characters. A reply to a
question with no project context attached ended "Checked read-only project
context: None applicable." — a claim to have run a file check that never ran,
copied from the shape of earlier replies. Model-authored versions of that
footer are now stripped; only code may state which files were read.

**Decisions made.** Answers that must follow a format are no longer requested
as prose. The runner constrains generation to a JSON schema, the model fills in
fields, and code writes the format — for choice lists and for code edits alike.
The model's indentation is discarded outright rather than validated, because
one measured edit was valid Python that quietly lifted a statement out of its
loop, which a syntax check passes. No hardware was needed; the constraint was
never the model's instruction-following.

**Now open.** Nothing Tuveloz-side is blocked. Worth knowing when Zeo is used
for project questions: it reads only the approved excerpt list, and its answer
is only as current as those files.

**Update 2026-08-11.** Zeo's safety suite passes (295 tests), including coverage
of the honesty and correction boundaries that the truncation bug was removing.
The specific defect is confirmed fixed. Zeo is also backed up to a private
GitHub repository and the `zeo-home` clone is fully synchronized with it, so the
single-disk exposure implied above no longer applies. The caution above still
stands on its own terms: verified safeguards are not verified answers, and Zeo's
replies remain only as current as the excerpt list it reads. Reported by the
owner from the `zeo-home` machine, which this session could not reach; the suite
was not run from here.

---

## 2026-08-10 — Signup step 1 shows the document count, and the ads branch is archived and gone

**What shipped.** Step 1 of the provider application now names how many
documents the selected services require, before the form asks for an email.
Previously that only appeared on step 2. The count is **distinct documents**,
not rendered checklist rows: two services can require the same document and
step 2 draws it once per group, so summing the per-service lists overstates
what actually gets uploaded. The copy reads "unique documents" so the smaller
number does not look like a contradiction of those repeated rows. Live at
`/join`, English and Spanish. Merged as #126, with #127 alongside it.

**Deliberately not shipped: a time estimate.** An earlier draft paired the
count with "about 10–15 minutes." That was dropped because the flow has never
been measured. The same reasoning removed an unmeasured "set it up in minutes"
line from provider toolkit copy on the old branch, though main had already
deleted that copy independently. If the duration is ever measured, the step 1
note is where it belongs.

**`ads/got-this-series` is deleted.** It was 121 commits behind main and
already superseded by #119, and a dry-run merge conflicted in ~28 files
including `drizzle/meta/_journal.json`. Its code features had all reached main
separately, but **21 files existed nowhere else** — the `brand/ads` build
pipeline and ep1-battery audio, `scripts/r2-video-manifest.mjs`, the Higgsfield
runbook and marketing docs, two brand SVGs. Nothing was lost; two tags hold it:

| Tag | Commit | Holds |
| --- | --- | --- |
| `archive/got-this-series` | `0808b9b` | the branch tip, all 21 unique files |
| `archive/got-this-series-wip` | `858b2d1` | that tip plus 18 uncommitted working-tree files (+299/−101) committed at deletion |

**Superseded 2026-08-11 — do not use the table above as a recovery path.** All
21 files are on main, and `archive/got-this-series` has been deleted. Only
`archive/got-this-series-wip` still exists; it descends from `0808b9b`, so the
old branch tip is still reachable through it. See the entry at the top of this
log.

**A trap that nearly cost the ad videos.** The deleted branch's `.gitignore`
ignored `brand/ads/*.mp4` and `brand/ads/got-this-assets/**/*.mp4`; main never
had those rules. Switching a checkout to main therefore left all 57 rendered
MP4s untracked and stageable, one `git add -A` away from committing ~50MB of
build output into permanent history and reversing the move to private R2. #127
ports the rules. The videos remain on disk and in the `tuveloz-brand-video`
bucket, with checksums in `brand/ads/R2-MANIFEST.json`.

**Two verification traps worth remembering.** `npm run i18n:check` reports on
whatever dev server is listening, not your checkout — it was run against a
server started from the branch's own worktree on a dedicated port, after
confirming the lineage. And `git merge-base --is-ancestor` called both merged
PR branches *unmerged*, because GitHub squash-merges: the branch tips never
become ancestors of main. Deleting them safely meant diffing content against
main instead, which is the check to use here.

**Production.** Both merges deployed clean. `wrangler d1 migrations apply`
reported "No migrations to apply!", so production D1 was untouched. Health
reports application, database, and schema ready, and the launch locks are
unchanged: `onboarding_only`, accounts and provider applications open,
customer job requests and payments closed.

---

## 2026-08-10 — Phone-to-Zeo remote access, and why the Tailscale invite failed

**What happened.** The Tailscale "share a device" invite for `zeo-home` kept
returning `Failed to accept invite`. Cause: the invite was sent from
hello@tuveloz.com to hello@tuveloz.com. Device sharing crosses accounts; you
cannot share a device with the account that already owns it. The phone does not
need a share at all — signing it in to Tailscale with the same account puts it
in the same tailnet and `zeo-home` appears on its own.

**Written up** in
[`operations/zeo-remote-access-tailscale.md`](operations/zeo-remote-access-tailscale.md):
the working procedure, an ordered fault list (the usual real cause is a service
bound to `127.0.0.1` rather than anything to do with Tailscale), and the rule
that Zeo stays inside the tailnet — `tailscale serve`, never `tailscale funnel`.

Nothing in the Tuveloz application depends on any of this.

---

## 2026-08-11 — Gave the open items real dates, so the weekly check can work

**What happened.** Every row in `OPEN-ITEMS.md` was undated, which meant the
Monday deadline workflow had nothing to report and the readiness command's
deadline section always came back clean. Dated 14 of the 16 rows and corrected
the ones that had gone stale against the actual pull-request state: PR #98
merged on 2026-08-07 and is now marked done, PR #33 and PR #46 are both closed
so their stranded work only exists on their branches, and the launch-gate row
now says what `npm run readiness` found rather than asking someone to go look.
The `tuveloz-app` repository creation was split out as its own `blocked` row,
because the move of `mobile/` cannot start until it exists.

**Decisions made.** The dates are self-set targets, and the file now says so —
they are there to make the automated check function, not because an outside
party imposed them. Two exceptions are called out: the recurring reviews are
dated against launch gates that fail once a legal review is over a year old,
and the insurance row carries a placeholder to be replaced with the carrier's
real renewal date once a record card exists. The SMS sign-in row stays undated
on purpose — it describes a deliberate lock, not a commitment to unlock it.

**Now open.** Eight items now fall inside the 30-day window, so the Monday
workflow will start opening a GitHub issue where it previously found nothing.
That is the intended behaviour, not a regression.

---

## 2026-08-10 — One command that reports what Tuveloz still needs

**What happened.** Added `npm run readiness` (`scripts/check-readiness.mjs`),
which collects into a single report the four things that previously had to be
checked in four places: the three marketplace locks read from source, the 18
launch gates read from the catalogue in `lib/launch-readiness.ts` against the
decisions recorded in production D1, `.env.example` compared against the
deployed Worker's vars and secrets, and the deadline table, by running the
existing `scripts/check-deadlines.mjs`. Flags: `--offline` skips the two
Cloudflare reads, `--json` emits the same data as JSON, `--strict` exits 1 when
something required is outstanding.

**What the first run found.** Production has **zero** launch-gate decisions
recorded, so all 18 gates are pending — including the ones only an outside
authority can answer (insurance carrier, CPA, payment processor). Three
required configuration values are unset: `LAUNCH_UPDATES_POSTAL_ADDRESS` and
`IDENTITY_VERIFICATION_PROVIDERS` are declared empty in `wrangler.jsonc`, and
`STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET` has neither a var nor a secret.
Nothing is overdue in `OPEN-ITEMS.md`, but every row there is undated, so that
is not reassurance.

**Decisions made.** The report reads and never writes. Gates are answered by
the owner in `/admin/launch-readiness` and nowhere else; the script cannot
record a decision, and the marketplace locks are printed as context with a note
that nothing in the report is a reason to change one. Keys that are only needed
once a related subsystem is switched on — the two evidence-scanner secrets,
while `EVIDENCE_SCAN_PROVIDER` is `unconfigured` — are reported as not yet
needed rather than counted as gaps, so a deliberately fail-closed subsystem
does not read as broken.

**Now open.** The gate decisions and the postal address are owner and
third-party work, not code. Adding real dates to `OPEN-ITEMS.md` would make the
deadline section of this report meaningful rather than always clean.

---

## 2026-08-09 — Locked the 5% customer-fee copy against regression

**What happened.** Audited the current production release and the source on
`main` after stale indexed pages exposed older 10% fee language. Cache-bypassed
production responses for the homepage, payment policy, provider agreement,
terms, customer agreement, provider signup, and post-job page contained no 10%
customer-fee claims. Production was serving the same commit as `main`.

**Decisions made.** The invariant is explicit for every assistant and every
copy surface: customers pay a 5% service fee, providers keep 100% of what they
quote, legacy 10% language is a defect, and the customer fee must never be
expressed as a deduction from provider earnings. A focused test now fails the
build if either forbidden claim returns in application, brand, AI-policy, or
assistant-handoff copy.

**Now open.** Search-engine and crawler snapshots may continue showing an old
version until they recrawl; production itself is current.

---

## 2026-08-08 — Search Console "Page with redirect": the QR short links

**What happened.** Search Console emailed a new indexing exclusion for
tuveloz.com: *Page with redirect*. Traced it to the only two redirects the site
serves. The whole app contains exactly two: `app/q/[slug]/route.ts` and
`app/api/stripe/connect/refresh/route.ts`. The second is already behind the
`/api/` disallow. The first was not.

**Why it happened.** `/q/<slug>` is the QR short link printed on provider
materials. It 302s to `/providers/<slug>?source=qr`, counting the scan on the
way through. Nothing excluded it from crawling, so Googlebot followed the links
and reported each one as a page that redirects.

**The important part: this was never an error.** The redirect is doing exactly
what it was built to do, and "Page with redirect" is an exclusion, not a
failure — Google is saying it indexed the destination instead of the wrapper.
Nothing was broken and nothing needed unbreaking. The fix is only to stop
spending crawl budget on a wrapper whose destination is directly reachable.

**What changed.** `app/robots.ts` disallows `/q/`. The storefront it points at
stays fully crawlable; only the redirector is excluded.

**What did not, in the end.** This work originally added its own
`app/providers/[slug]/layout.tsx` to set the canonical, because the storefront
page is a client component and cannot export metadata itself. By the time it
landed on 2026-08-11, #150 had already created that file with a better version —
same canonical, plus slug sanitisation and a fail-closed `noindex` while
`MARKETPLACE_MODE` is not live. Main's version stands; only the robots rule came
from here.

**Also true, and left alone.** `ai.tuveloz.com/` 302s to `/ai` in
`worker/index.ts`. If the Search Console property is a domain property rather
than a URL-prefix one, that root will be reported the same way, and it is
equally intentional. The comment there explains why it is deliberately
temporary rather than permanent; do not "fix" it either.

**Worth knowing for later.** The sitemap lists 19 static pages and no provider
storefronts at all. That is defensible while onboarding is the only thing open,
but once storefronts are public and worth finding, `app/sitemap.ts` is where
they need to appear. Not done here — it is a launch decision, not a redirect
fix.

---

## 2026-08-08 — Homepage made launch-honest and shorter

**What happened.** Reworked the customer-facing hero on the homepage and customer lander so it no longer implies that live customer quotes are available today. Both now say that accounts are open while requests wait for adequate provider coverage. Added a clear “Need help today?” route to local shops, mobile mechanics, or licensed towing while dispatch is unavailable. Added a planned-fee example that labels final launch pricing and tax treatment as under review.

**Decisions made.** The homepage no longer uses provider counts, invented traction, or review substitutes as startup proof. It now focuses on customer choice, provider independence, documented service-specific requirements, and an honest launch state. The long provider-application, review, request, expansion, and feedback sections remain available on their dedicated pages or the About page instead of competing on the homepage.

**Now open.** Decide which first-wave local SEO pages to publish while customer requests remain closed. Any service page must be informational and collect launch interest rather than imply a live booking or quote turnaround.

---

## 2026-08-06 — Captured what the five open pull requests settle

**What happened.** Recorded the state of every open pull request in one place,
so the context survives when the chat sessions that produced them are deleted.
Deleting a conversation does not delete a branch, a pull request, or its
description — the work and the reasoning behind it are in Git and on GitHub, not
in the chat window. What was missing was a single place to see it together.

**The five open pull requests, oldest first.**

- **#90 — email exhaustion alerts and an open-work handoff.** A queued
  notification that used all five delivery attempts was dropped from every later
  retry batch silently, which for verification and compliance mail meant
  protective messages could go quietly undelivered. Now raises an owner incident
  on the exhausting attempt, deduplicated per event, inserted rather than sent
  inline, with a guard so an incident never raises an incident about itself. The
  dashboard counts `exhausted` separately from `failed` because the first never
  recovers on its own. Also adds `docs/OPEN_WORK_HANDOFF.md`.
- **#93 — the mobile app foundation. Must never be merged.** A complete Expo /
  React Native Phase 1 foundation under `mobile/`, sharing no code with the
  website. It belongs in a separate `tuveloz-app` repository; creating that
  repository returned `403 Resource not accessible by integration`, so the code
  was preserved here rather than discarded. Extraction is documented and was
  rehearsed in `mobile/docs/EXTRACTION.md`.
- **#95 — local-search pages and one name for the Customer Service Fee.** The
  fee had five different labels across the site, the agreements, and the Stripe
  receipt line; the economics never differed but nobody comparing two surfaces
  could know that. One name now, defined once, with a test that fails the build
  if a second name reappears. Adds 17 local-search URLs behind an explicit
  allowlist rather than a cross product, because two lists multiplied together
  produce doorway pages.
- **#96 — the `/providers` directory.** Stacked on #95 and based on its branch,
  so #95 must merge first. The directory is gated on the same `discovery` action
  that closes customer requests, because a directory listing providers while
  discovery is closed would be a way around that control.
- **#97 — jurisdiction-scoped compliance requirements, plus strategy
  documents.** Requirements now resolve from where the work happens rather than
  applying uniformly, failing closed in both directions.

**Also recorded.** Added the three migration traps to `CLAUDE.md` after
verifying them against `main`: numbers collide at `0053`, the generated
snapshots are stale past `0047` (35 snapshots for 54 migrations), and tests must
never pin the newest journal entry. Three branches have already been lost to
these.

**Now open.** Merge order matters and is not obvious from the pull request list:
#95 before #96, and #93 never. Both are in `OPEN-ITEMS.md`, along with the
launch blockers #90 surfaced.

---

## 2026-08-06 — Two documentation efforts collided; constraints consolidated

**What happened.** Opened PR #98 for the documentation structure and found PR
#97 already adds a root `CLAUDE.md` and its own `docs/INDEX.md`. Merging both
untouched would put two orientation files and two competing indexes on `main` —
the exact confusion this work exists to prevent.

**Decisions made.** The two sets of content are complementary, not duplicative,
so nothing is being discarded. #97 carries constraint knowledge — the three
fail-closed locks, the provider-classification never-build list, the Maryland
§ 8-205 and § 14-1001 detail. This branch carries filing infrastructure — the
filing guide, the records register, this log, the deadline register and its
automation. Folded #97's constraints into `CLAUDE.md` here after verifying each
claim against `main`: `PHONE_SMS_LIVE_MODE_ENABLED`, `automatic-job-routing.ts`,
`maryland-repair-records.ts`, `evidence-review-assistant.ts`, and the `testOnly`
short-circuit all exist as described.

Deliberately left out #97's jurisdiction-scoped compliance section. It describes
`imposed_by` and `local_requirements_reviewed` fields that #97 introduces and
that are not in `config/provider-eligibility-matrix.json` on `main` yet. That
section belongs in `CLAUDE.md` once #97 lands, not before.

**Now open.** Whichever PR merges second should drop its own `CLAUDE.md` and
index rather than adding a parallel one, so a single orientation file and a
single index survive. #97's three strategy documents — pitch, competitive
landscape, provider classification design — should get rows in `docs/README.md`
when they land. Both are tracked in `OPEN-ITEMS.md`.

---

## 2026-08-06 — Document organization system created

**What happened.** Set up the documentation structure: an index (`README.md`),
a portable project brief (`AI-HANDOFF.md`), filing rules (`FILING-GUIDE.md`),
category folders for business, legal, operations, and product documents, and a
register for real-world documents (`records/`). Added `CLAUDE.md` so Claude Code
sessions pick up the conventions automatically.

**Decisions made.** Originals of insurance, formation, tax, and license
documents stay outside this repository; only record cards describing them get
committed. Confirmed the repository is public, which makes that rule mandatory
rather than tidy. Existing docs stayed at their old paths because
`tests/admin-staging-test-lab.test.mjs` reads `docs/STAGING.md` by path.

**Also established.** External assistants read these documents through public
raw GitHub links rather than pasting. Added this log and `OPEN-ITEMS.md` as the
shared memory between sessions, plus a weekly workflow that opens a GitHub issue
when something in the register comes due.

**Now open.** The branch `claude/document-storage-organization-066mie` is not
merged, so none of this is reachable from `main` yet. The document register is
empty — no real business documents have been filed. See `OPEN-ITEMS.md`.

---

## How to write an entry

Add yours at the top, under the horizontal rule, using this shape:

```markdown
## YYYY-MM-DD — Short title of what happened

**What happened.** A few sentences. Enough that someone who was not here
understands what changed and why.

**Decisions made.** What was decided and what forced the answer. Skip if
nothing was decided.

**Now open.** What is unfinished, and what the next person should pick up.
Anything with a deadline goes in `OPEN-ITEMS.md` as well, not only here.

---
```

Write an entry when something changed that a future session would be wrong not
to know: a decision, a launch step, a policy change, a vendor approval, an
incident, a change of direction. Do not write one for routine edits — a log
nobody trusts to be significant is a log nobody reads.

Never rewrite or delete an old entry. If an entry turns out to be wrong, add a
new one at the top saying so. The record of what you believed at the time is
often the useful part.
