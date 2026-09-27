# Tuveloz public profile audit — September 25, 2026

- **Status:** public corrections submitted and checked; Google Maps review and search-snippet refresh remain pending
- **Scope:** website search result, Google Business Profile, Facebook, Instagram, TikTok, and X

This review records only public business information. It does not preserve the
mailbox address, account identifiers, private messages, credentials, or billing
details.

## What is consistent

- The website, Instagram, TikTok, Facebook, and X use the same orange-and-navy
  Tuveloz funnel mark.
- Instagram and X describe a Montgomery County vehicle-services marketplace,
  say that provider applications are open, and do not say that customer
  bookings are available.
- TikTok's profile description also states that provider applications are open
  and customer bookings come later.
- The main organic Google result accurately says that provider applications are
  open and free while customer bookings remain closed.

## Public corrections and observed results

### 1. Google Business Profile

The managed listing describes Tuveloz as a car-repair business, shows operating
hours, and appears on Maps. Tuveloz is an online marketplace and does not meet
customers or repair vehicles. Google's eligibility rules exclude online-only
businesses and lead-generation companies, so changing the listing to another
local-service category would still be misleading. The clean correction is to
request removal of this Business Profile from Search and Maps while keeping the
ordinary website result and Search Console.

Official references:

- [Google Business Profile eligibility](https://support.google.com/business/answer/13763036)
- [Request removal from Google Maps](https://support.google.com/business/answer/16043467)
- [Remove a profile from the account](https://support.google.com/business/answer/4669092)

With the owner's approval, the Maps correction was submitted as **Not open to
the public**. Google displayed its submission confirmation. This is a pending
review, not proof that the listing has been removed. Tuveloz was not marked
permanently closed.

### 2. Facebook

The public Page exposed a mailing location in a way that could look like a shop
a customer can visit. With the owner's approval, the street address was removed
through the signed-in Tuveloz Page editor. The resulting public Details section
no longer displayed the street address or map link. All ten Montgomery County
service areas and the provider signup link remained present. The Page logo is
consistent with the website. This public-profile edit did not change legal,
tax, banking, mailing, or other account records.

### 3. TikTok

Two August recruitment videos used a queue-position promise about being first
at launch. TikTok did not allow their captions to be edited. With the owner's
approval, both videos were instead changed to **Only me** and that setting was
verified in Studio. The accurate September 8 recruitment video remained
**Everyone**. Nothing was reposted, deleted, or promoted. The copy below remains
an unused draft for a future separately authorized post.

**English replacement**

> Do car work in Montgomery County? Tuveloz is preparing a local
> vehicle-services marketplace. Provider applications are open and free. You
> set your prices and choose which requests to answer. Customer jobs and
> payments are not open yet. tuveloz.com/join #MobileMechanic
> #MontgomeryCountyMD #CarTok #AutoRepair

**Spanish replacement**

> ¿Trabaja con vehículos en el Condado de Montgomery? Tuveloz está preparando
> un mercado local de servicios para vehículos. Solicitar como proveedor es
> gratis. Usted fija sus precios y decide qué solicitudes responder. Los
> trabajos y pagos de clientes todavía no están disponibles.
> tuveloz.com/es/join #MecanicoMovil #MontgomeryCountyMD #CarTok
> #ReparacionDeAutos

### 4. Stale search snippets

The review found an older copyright-page snippet and an older Facebook post
description. The current website source no longer contains the old website
phrase. After the website release, Search Console accepted indexing requests for
the homepage, `/join`, and `/es/join`; each showed **Indexing requested** and
addition to the priority crawl queue. All three pages were already indexed.
The sitemap showed **Success**, 51 discovered pages, and a September 21 last-read
date. These results do not prove a refreshed snippet or ranking. Search Console
requests for Tuveloz cannot refresh Facebook's own URL.

## September 26 search follow-up

Read the existing domain property without submitting another indexing or
validation request. The September 20 aggregate report shows 7 indexed URLs and
49 exclusions: 44 discovered but not indexed, one crawled but not indexed,
one historical 404, and three redirects. These counts predate some individual
URL checks and do not mean 49 broken website pages.

The three redirect examples are the HTTP and www homepage variants; each
currently returns a single 308 to `https://tuveloz.com/`. There are no `/q/`
examples in this report, and the current public robots file disallows `/q/`.
The overdue QR-redirect check is complete. Preserve these canonical redirects;
their exclusion is expected, as explained in
[Google's indexing report guidance](https://support.google.com/webmasters/answer/7440203).

Individual URL inspection confirms the homepage and both `/join` and
`/es/join` are indexed, fetch successfully, permit crawling/indexing, and use
the same canonical URL selected by Google. The displayed crawl dates are
September 26 for the homepage and September 25 for both signup languages.
This confirms the previously recorded indexing state; it does not prove new
rankings or refreshed search-result wording. The sitemap still reports Success,
51 discovered pages, and a September 21 last read.

A read-only public check at 23:49:14 UTC fetched all 51 sitemap URLs: every
response was 200, had a title and one matching canonical, and contained no
`noindex` in the checked response headers or metadata. No duplicate sitemap
URLs or unexpected redirects were found. Both signup languages publish reciprocal
language links. These are HTTP/metadata checks, not another form-submission test.

The historical 404 is `/founding-providers`, last crawled August 8. Its validation
still says Started, dated September 5. It currently returns 200, and Google's
September 26 live test reports **URL is available to Google / Page can be indexed**.
Its stored index status remains 404/not indexed pending Google's recrawl.
Do not restart an in-progress validation or claim the live test proves indexing.
Retain the October 2 follow-up for that result and the remaining search coverage.

Evidence outside the repository: `outputs/search-console-review-20260926.json`
and `outputs/seo-public-review-20260926.json`. No site, Maps, email, or account
setting changed; no paid service was added.

## Owner action boundary

The completed actions above were specifically approved in the owner conversation.
This record grants no additional authority to publish posts, send messages,
promote content, spend money, or change other account records.
