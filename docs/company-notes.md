# Company notes

Things that stay true between sessions: how Tuveloz measures success, the
mistakes it has decided to avoid, and ideas worth trying.

Every question asked through `npm run ai` is grounded in this file, so what is
written here shapes future answers rather than being re-explained each time.
It is deliberately *not* the decision log (`ai-council-log.jsonl`) — that one is
a rolling window of recent answers, and anything important stored there is
forgotten a handful of questions later. This file is always sent in full.

Add a note:

```bash
npm run note -- "what we learned"
npm run note -- --section "Ideas worth trying" "the idea"
```

Or just edit this file — it is plain markdown and it is git-tracked, so a note
is reviewable like any other change.

---

## How we measure success

Four stages. Each is a distinct act, not the same person counted again, and
each fails for a different reason — so the stage where people drop tells you
what to fix.

| Stage | What it counts | A drop here means |
|---|---|---|
| 1. Awareness | Sessions that arrived | Nobody is seeing it. A reach problem, not a copy problem |
| 2. Interest | Opened the provider page on purpose | Reaching the wrong people, or the hook oversells |
| 3. Consideration | Started filling in the application | The offer lands but the form looks like work |
| 4. Decision | Submitted the application | Something inside the form is blocking |

Read them at `/admin/analytics-funnel`, both in total and per channel. Read
them per channel *before* judging a channel: strong awareness with no interest
is a targeting problem, and strong interest with no decisions is a problem with
the form, not with the channel that delivered the people.

Awareness counts browser sessions rather than page loads, so refreshes cannot
inflate the number every other rate is measured against.

Pre-launch caveat: customers cannot post jobs yet, so the customer funnel has
no decision stage of its own. Until launch, joining the launch-update list *is*
the customer decision — judge customer content on that, not on job requests.

## Common mistakes to avoid

1. **Creating content without a clear purpose.** Before making anything, name
   the stage it serves and the one action it should produce. Content that
   serves "all four stages" usually serves none.

2. **Focusing only on awareness content.** Reach is the cheapest thing to
   measure and the easiest to mistake for progress. Follower count is not the
   scoreboard — a national audience of 10,000 is worth less here than 200 people
   living between Silver Spring and Germantown. Applications are the number.

3. **Neglecting to connect different funnel stages.** Every stage needs a path
   to the next one. A page nobody links to cannot convert anyone, however good
   it is. Check the whole route, not each piece alone.

4. **Not measuring content performance.** If a link cannot be told apart from
   every other link, the channel cannot be judged and the budget is a guess.
   Tag what you hand out (`?r=` codes, §7 of the audience growth playbook).
   Saves and shares matter more than likes; they are what recruit.

5. **Forgetting to include clear next steps.** Every piece ends with one
   specific action, and the honest one for this phase: providers apply now,
   customers join the launch list. Never imply customers can book or pay today.

## Ideas worth trying

Each one names the stage it serves and how it would be measured, so it can be
judged rather than just felt good about.

- **Spanish-first content, not translated content.** A large share of MoCo's
  independent auto trade is Spanish-speaking, the signup form is already
  bilingual, and almost nobody is marketing to them in Spanish. Shoot natively
  in Spanish rather than dubbing the English cut. *Stages 1–2. Measure:*
  `?r=ig-es` against `?r=ig-en` — same content, two audiences, real comparison.

- **Give every spotlighted provider their own link and QR.** A provider
  spotlight is borrowed audience: they share it because it is their business on
  the page, and their customers are already local. *Stages 1–2. Measure:*
  `?r=spot-<name>`, so it is visible which providers actually bring people and
  worth thanking the ones who do.

- **"What it should cost in MoCo" price transparency.** The most saved and
  shared kind of local content, and it recruits providers who agree with the
  numbers while informing customers. One piece, two audiences — so give it two
  explicit next steps rather than a vague one. *Stages 1–3.*

- **Per-location flyer codes.** Parts stores, gas stations, laundromats and car
  washes are already the flyer route. `node scripts/generate-flyer.mjs <place>`
  prints a run whose QR carries `?r=flyer-<place>`. *Stage 1 → 4. Measure:*
  which counters produce applications, so the dead ones stop getting restocked.

- **Answer the "you have no customers yet" objection in public.** It is the
  first thing a provider thinks and the hardest to answer in a DM. Publishing
  the founding-cohort count and what has to be true before launch turns the
  objection into a reason to be early. *Stage 3.*

- **Link `/founding-providers` from somewhere.** It is in the sitemap and
  reachable from outreach, but nothing in the site links to it — a live example
  of mistake 3. The page already exists; the fix is a link. *Stage 3.*

- **One honest post to r/montgomerycountymd and Nextdoor.** These are hostile
  to marketing and receptive to a founder being straight with them: "I'm
  building this here, it isn't live yet, here's what I got wrong so far."
  Answer every comment, don't repost. *Stages 1–2. Measure:* `?r=rd`, `?r=nd`.

Rules any idea has to clear: never imply customers can book or pay today; never
promise income or job volume; no astroturfing — business posts come from the
business account; label AI-generated creative wherever the platform asks.

## Notes
