# Tuveloz Social & Google Profile Copy

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-07

Ready-to-paste bios for every platform. Each block fits its platform's character
limit. Pair every profile with the matching avatar from this folder (see
`README.md`).

**Who these are written for.** Customer job posting is paused
(`lib/launch-status.ts`), so the person opening these profiles is a mechanic who
just got a DM or saw a recruitment reel — not a car owner looking to book. Every
bio below leads with the provider. Each one carries a **launch-week variant**
that leads with the customer instead; swap to those the week customer requests
open, and not before.

Positioning pattern, unchanged: outcome first, place second, CTA last. Sell
providers ownership, not gig work.

Shared facts used everywhere:
- What: Local marketplace for vehicle services — customers post a job, local
  independent providers send quotes, the customer chooses.
- Where: Montgomery County, Maryland (more areas by request).
- Now: Onboarding independent providers. Free to join, no provider fees
  (customers pay a small 5% service fee to the site).
- Tagline: **Customer choice. Provider freedom.**
- Site: https://tuveloz.com · Provider signup: https://tuveloz.com/join
- Email: hello@tuveloz.com

**Run one account per platform, bilingually.** A separate Spanish account splits
the posting effort and neither one reaches a size that looks real.

---

## Instagram — @tuveloz (bio limit 150)

English (120):
```
Mechanics & detailers: run your own business. Set your prices, keep what you quote. Montgomery County, MD · Join free ⬇️
```

Spanish (133):
```
Mecánicos y detalladores: tu negocio, tus precios. Quédate con el 100% de lo que cotizas. Condado de Montgomery, MD · Únete gratis ⬇️
```

Bilingual (125) — **the default for one account**:
```
Mechanics: your prices, your jobs · Mecánicos: tus precios, tus trabajos. Montgomery County, MD · Join free / Únete gratis ⬇️
```

Website field: `https://tuveloz.com/join?src=bio-ig`

<details><summary>Launch-week variant (customer-first)</summary>

```
Skip the phone tag 🚗 Post your car job, compare real quotes, you choose.
Montgomery County, MD · Providers join free ⬇️
```
(122 chars)
</details>

## TikTok — @tuveloz (bio limit 80)

English (72):
```
Mechanics: your prices, your jobs. MoCo, MD. Join free: tuveloz.com/join
```

Spanish (72):
```
Mecánicos: tus precios, tus trabajos. MoCo, MD. Gratis: tuveloz.com/join
```

Bilingual (76) — **the default for one account**:
```
Tu negocio, tus precios · Your prices, your jobs. MoCo MD · tuveloz.com/join
```

The URL is inline because TikTok only gives a website field to business accounts
or accounts past 1k followers. Once it unlocks, move the link to that field with
`?src=bio-tt` and spend the freed characters on the pitch.

<details><summary>Launch-week variant (customer-first)</summary>

```
Vehicle services, your price, your call 🚗 MoCo, MD. Join free: tuveloz.com/join
```
(80 chars)
</details>

## X — @TuvelozApp (bio limit 160)

```
Mechanics, detailers, roadside pros in Montgomery County, MD: run your own business. Set your prices, pick your jobs, join free — no provider fees.
```
(146 chars. Location: `Montgomery County, MD` · Website:
`https://tuveloz.com/join?src=bio-x`)

<details><summary>Launch-week variant (customer-first)</summary>

```
Your car, real quotes, your call. The vehicle-services marketplace for Montgomery County, MD. Providers: run your own business — join free, no provider fees.
```
(157 chars)
</details>

## Facebook Page

**Intro / short bio (99 chars):**
```
Mechanics & detailers in Montgomery County, MD: set your own prices, pick your jobs. Join free.
```

**About / long description:**
```
Tuveloz is a local marketplace for vehicle services in Montgomery County, Maryland.

For providers (onboarding now): run your own business, not somebody else's route. Set your own prices, choose your own jobs, keep your independence. Joining is free and there are no provider fees — you keep what you quote. No exclusivity, so keep every platform and client you already have.

For customers (launching soon): tell us what your vehicle needs — a jump start, battery replacement, detailing, wiper blades and bulbs, fluid top-offs, or a basic diagnostic. Local independent providers send you real quotes. You compare and choose the one that works — your schedule, your price, your call.

Customer choice. Provider freedom.

Apply as a provider: https://tuveloz.com/join
Questions: hello@tuveloz.com
```
(Category suggestions: "Automotive Service" + "Internet Marketplace". At launch,
move the customer paragraph back above the provider paragraph.)

## Google Business Profile (description limit 750)

**Left customer-first on purpose.** Google is a search-intent surface — people
arrive typing "mobile mechanic near me", not looking for work — and verification
takes days to weeks, so this copy will still be sitting there when customer
launch happens. It is honest about the current state, which is what matters.

```
Tuveloz is a local marketplace for vehicle services in Montgomery County, Maryland. Customers describe what their vehicle needs — battery and jump-start help, wiper blade and bulb replacement, fluid top-offs, detailing, or basic diagnostics — and local independent providers respond with real quotes. Customers compare options and choose what works for their schedule and budget.

Independent providers are joining now: signing up is free with no provider fees, and providers set their own prices and choose their own jobs. Customer job posting opens soon.

Customer choice. Provider freedom. Learn more or apply as a provider at tuveloz.com.
```
(~700 chars. Primary category: "Automotive service" or closest match; add
website https://tuveloz.com and hello@tuveloz.com. Once the profile is live,
add its share link to `app/components/social-links.tsx` where the Google entry
is commented out.)

---

## Hashtags

The audience is providers, so tags go where mechanics talk to each other, not
where customers search. Full reasoning and the size rule are in
`../outreach/media/captions-ad-04-copy-paste.txt`.

- Instagram: `#MobileMechanic #MecanicoMovil #MechanicLife #MechanicsOfInstagram #MontgomeryCountyMD`
- TikTok: `#MobileMechanic #MecanicoMovil #MechanicLife #MechanicsOfTikTok #MontgomeryCountyMD`
- Spanish-only posts: `#MecanicoMovil #TallerMovil #MecanicoADomicilio #LatinosEnMaryland #MontgomeryCountyMD`

Never `#AutoRepair`, `#CarTok`, `#CarsOfInstagram` or `#automotive` — those reach
customers and car enthusiasts, and neither can post a job yet.

## Pinned post / first post (use on all platforms)

```
🚗 Something new is coming to Montgomery County, MD.

Tuveloz is a marketplace where you post what your vehicle needs and local independent providers send you real quotes. You compare. You choose. No pressure.

Right now we're onboarding providers:
✅ Free to join — no provider fees
✅ Set your own prices, pick your own jobs
✅ You keep what you quote

Mechanics, detailers, roadside pros — claim your spot before customer launch: tuveloz.com/join

Customer choice. Provider freedom.
```

## Do / don't (pre-launch)

- ✅ Say "launching soon" / "onboarding providers now" — never imply customers
  can book or pay today.
- ✅ Push providers to /join; push curious customers to tuveloz.com to follow along.
- ✅ Say "keep what you quote", never "keep 95%" — the 5% customer service fee
  sits on top of the provider's quote and is paid by the customer.
- ❌ Don't list specialized services (towing, tire repair, A/C) yet — only the
  provisional launch services shown on the homepage.
