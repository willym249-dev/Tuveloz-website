# Post captions — one file per post, 5 hashtags each

Each file is the complete caption for one post on one platform. Pipe it
straight into the publisher:

```bash
python3 scripts/publish-social.py --post ad-01 --targets ig,fb \
  --caption-file brand/outreach/media/captions/ad-01-ig.txt
```

## Why five

Instagram capped hashtags at **five per post** in December 2025 — Mosseri
announced it directly, and the stated reason was that long tag lists correlate
with spam. Posts above the cap stop being surfaced in Explore, on hashtag browse
pages, and in Reels recommendations. Putting the overflow in the first comment
does not get around it.

Reporting through 2026 puts 3–5 relevant tags at roughly **25% more engagement**
than 10+ loose ones. TikTok's optimum is the same 3–5; it measurably
deprioritizes tag-stuffed posts.

This reverses the advice in the older kits in the parent folder, which tell you
to stack 25–30 tags and put them in the first comment. Those blocks are flagged
out of date. Their body copy is still fine — only the tags changed.

## The formula

One hyperlocal + one trade/niche + one discovery, then two tuned to the post:

| Slot | Doing what | Ours |
|---|---|---|
| Hyperlocal | Keeps reach inside the service area | `#MontgomeryCountyMD` |
| Regional | The DMV follows this one across DC/MD/VA | `#DMV` |
| Trade / niche | The exact audience we recruit from | `#MobileMechanic` |
| Discovery | Wide automotive reach | `#CarTok` (TikTok), `#AutoRepair` (IG) |
| Post-specific | Identity or intent | `#SkilledTrades`, `#BeYourOwnBoss`, `#CarTips` |

`#CarTok` is TikTok-native and carries 540M+ views there; on Instagram it wastes
a slot, so the IG sets swap in `#AutoRepair` or `#CarMaintenance`.

Hyperlocal tags are the highest-leverage slot we have. Local businesses using
them see meaningfully more engagement than generic business tags, and a follower
in Rockville is worth a hundred views from anywhere else — which is the whole
argument in `../../outreach/audience-growth-playbook.md` §1.

## Files

| File | Post | Platform |
|---|---|---|
| `ad-01-ig.txt` | Provider recruitment ad | Instagram / Facebook |
| `ad-01-tiktok.txt` | Provider recruitment ad | TikTok |
| `reel-deadbattery-ig.txt` | Dead-battery reel | Instagram / Facebook |
| `reel-deadbattery-tiktok.txt` | Dead-battery reel | TikTok |
| `ad-03-ig-en.txt` | Price transparency | Instagram / Facebook |
| `ad-03-tiktok-en.txt` | Price transparency | TikTok |
| `ad-03-ig-es.txt` | Price transparency (ES) | Instagram / Facebook |
| `ad-03-tiktok-es.txt` | Price transparency (ES) | TikTok |

Spanish posts go up as their own reel, never as a re-caption of the English one.

## Still true regardless of tags

- AI-content label ON — all this footage is AI-generated.
- Never imply customers can book or pay today.
- Providers keep 100% of what they quote; customers pay the 5% site fee.
- Rotate a tag or two between posts so the algorithm doesn't see an identical
  set every time.

## Sources

- https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/
- https://www.techbuzz.ai/articles/instagram-caps-hashtags-at-five-to-combat-spam
- https://bunnybooster.com/blog/instagram-hashtags-2026
- https://sproutsocial.com/insights/tiktok-hashtags/
- https://skedsocial.com/blog/how-to-use-hashtags-on-tiktok-in-2026-maximize-your-tiktok-reach-and-engagement
- https://hashtagtools.io/blog/small-business-instagram-hashtags-growth-strategy-2026
