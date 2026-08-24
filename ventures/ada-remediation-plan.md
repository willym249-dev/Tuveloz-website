# Web accessibility remediation — the business case

**Status** draft · **Owner** hello@tuveloz.com · **Last reviewed** 2026-08-24
**What this is for** deciding whether to put real time into accessibility
remediation as a standalone venture, and if so, what to do in the first month.

Not a Tuveloz document. See `ventures/README.md`.

---

## First, the thing that broke

The obvious version of this business was: two federal deadlines land in spring
2026, everyone panics, you sell into the panic. That version is dead. Both
deadlines moved.

| Rule | Who | Was | **Now** |
| --- | --- | --- | --- |
| DOJ ADA Title II | State/local gov, pop. ≥50k | Apr 24 2026 | **Apr 26 2027** |
| DOJ ADA Title II | Smaller gov + special districts | Apr 26 2027 | **Apr 26 2028** |
| HHS Section 504 | Federally funded health orgs, ≥15 staff | May 11 2026 | **May 11 2027** |
| HHS Section 504 | Federally funded health orgs, <15 staff | May 10 2027 | **May 10 2028** |

DOJ extended on 17 Apr 2026. HHS followed on 7 May 2026 — four days before its
own deadline. The technical standard did not change: WCAG 2.1 Level AA in both.

So there is no stampede this quarter. Anyone selling you "the deadline is next
month" urgency right now is working from stale material.

**Why this is still the right time, not the wrong one.** Every entity that was
scrambling in March stood down in April. They will re-scramble in Q1 2027, when
the date is inside the planning horizon again and every vendor in the category
is calling them at once. The eight months between now and then is the only
window where you can get in front of these buyers without competing against a
feeding frenzy. Government fiscal years mostly started 1 July — the FY2027 money
is already appropriated and sitting there.

Second correction, this one in your favour: the figure in play was "40%+ of
demand letters hit businesses under 50 people." The real number is better than
that. **67% of ADA website lawsuits in 2024 targeted companies under $25M in
revenue**, and other counts put it at 77%. This is overwhelmingly a small-business
problem.

---

## Why the market is real

Three facts, and the third is the one that matters most.

**Almost everything fails.** WebAIM tests the top million home pages every year.
In the 2026 report, **95.9% had detectable WCAG 2 failures**, averaging 56.1
errors per page — up 10.1% from 2025. It is getting *worse*, not better. The
practical consequence: your outreach never comes up empty. You can scan a
prospect before you contact them and know, at better than nineteen-in-twenty
odds, that you have something specific and true to tell them.

**The work is repeatable.** 96% of all detected errors fall into just six
categories, and they have been the same six for seven consecutive years. Low
contrast text alone appears on 83.9% of home pages; missing alt text on over
half; unlabelled form inputs on 51%. This is not bespoke consulting. It is the
same handful of fixes, over and over, which is exactly the shape of thing that
starts as a service and turns into a product.

**The cheap alternative just lost its credibility.** In January 2025 the FTC
fined accessiBe **$1 million** for claiming its AI overlay widget made websites
WCAG-conformant when it did not — the complaint specifically cites failures on
navigation menus, form fields, and image descriptions. The FTC also found the
company had paid for reviews presented as independent. Separately, 800+
businesses running overlay widgets were sued anyway in 2023–24, and at least one
sued its overlay vendor.

That third fact is the whole opening. There is a large population of
organisations that already decided accessibility was worth paying for, already
has a budget line, already bought something — and now has documented,
federal-agency-backed reason to believe what they bought does not work.

**And you can find them programmatically.** Overlay widgets load an identifiable
third-party script. `prospect.mjs` in `a11y-audit/` detects eight of them and
cross-references against the site's actual violation count. Overlay present plus
high violation count is the single best-qualified lead in this market, and it is
a list you can generate rather than buy.

---

## Where the money is, fastest first

### 1. Overlay refugees — days to close, $1.5k–8k

Build a domain list for a sector (county-adjacent businesses, medical practices,
credit unions, regional retail). Run `prospect.mjs`. Sort by score. Every row
with an overlay flag and blockers is someone paying a monthly fee for a thing
that demonstrably is not working on their own home page.

The pitch is not "you could get sued." It is: *here is what your widget is not
catching, on your own site, by name.* Attach the teaser report. That is a
conversation, not a cold call.

### 2. Demand-letter and complaint triage — same week, $3k–8k

3,117 federal website-accessibility suits were filed in 2025, up 27% on 2024.
Demand letters typically ask $5k–25k; defending properly runs $30k–175k. A
business holding a fresh demand letter has a problem measured in days and a very
clear alternative cost.

Federal complaints are public record. Defendants are named, dated, and
searchable. This is the highest-urgency segment in the market.

**Handle this one carefully.** Your outreach must never resemble a demand
letter, imply legal authority, or suggest any connection to the plaintiff. You
are a remediation vendor contacting a business about fixing its website. Say
that plainly. Getting this wrong is its own legal problem, and it is the reason
this segment stays underserved by reputable people.

### 3. Agency white-label — weeks, recurring

Web agencies have client portfolios and no accessibility capability. They are
already being asked about this by their own clients and have nothing to say. One
agency relationship is 10–40 sites, and they handle the client management.

Wholesale $500–800 per site scan-and-report; they mark it up. Lower rate, near-zero
sales cost, and it compounds — this is the line that turns the business from
freelancing into something with leverage.

### 4. Government and healthcare contracts — 60–120 days, $15k–60k

Slow, but large, and the deadline is real and dated. Maryland state agencies
have small-procurement delegation up to $100k, with purchases up to $5k at a
purchaser's discretion and $5k–15k needing two quotes. Local thresholds vary by
county and municipality — check the specific procurement code before you quote.

That structure matters: a $4,500 audit can often be bought on a purchase order
without a competitive solicitation. Land the audit under the discretionary
threshold, then the remediation is a sole-source follow-on to the vendor who
already did the assessment.

Montgomery County alone sits inside a dense cluster of municipalities, school
systems, library systems, community colleges, transit and special districts —
every one of them covered by Title II with a 2027 or 2028 date.

Start seeding now for Q1 2027 close. Do not expect this to pay August rent.

---

## Pricing

| Offer | Price | Your time |
| --- | --- | --- |
| Automated scan + prioritised report | $1,500 | ~2 hrs |
| Full audit (adds manual keyboard + screen-reader pass) | $3,500–5,000 | 1–2 days |
| Remediation, delivered as merged pull requests | $6,000–15,000 | 3–10 days |
| Monitoring retainer (monthly re-scan + diff + fixes) | $300–600/mo | ~2 hrs/mo |
| Agency wholesale, per site | $500–800 | ~1 hr |

The retainer is the line to push. Accessibility regresses every time someone
ships a new page — that is precisely why the WebAIM numbers keep getting worse —
so recurring monitoring is a genuine need rather than an invented one.

---

## Your actual advantage

Almost nobody in this market ships the fix.

The category splits into audit firms that hand over a PDF and leave, and overlay
vendors that hand over a script tag that does not work. Both leave the client
holding a problem they cannot act on. The PDF says "37 issues found"; the client
has no developer who can act on it.

You write production code. Delivering *a merged pull request, with before-and-after
scan evidence*, is a categorically different product from a report. It is also
the thing that makes remediation defensible: the client ends up with a real
audit trail showing what was found, when, and what was done about it.

That is the offer. Not "we will assess your accessibility." **"We will fix it,
and show you the diff."**

---

## Week one

- **Day 1** — Pick one sector and build a 200-domain list. Medical practices and
  credit unions are good first picks: overlay-heavy, real budgets, and
  Section 504 exposure if they take any federal health money.
- **Day 2** — Run `prospect.mjs` over it. Expect roughly 190 to have failures.
  Sort by score, keep the top 40, prioritise overlay hits.
- **Day 3** — Generate teaser reports for the top 20. Write one email template,
  personalised only by the two most specific findings on that site.
- **Day 4** — Send 20. Set up a one-page site with a free scan form as the
  inbound path.
- **Day 5** — Call the 5 highest-scoring non-responders. Offer the $1,500 audit.
- **Ongoing** — Contact three agencies. This is the highest-leverage hour in the
  week and the easiest to skip.

Realistic first-month outcome: two to four audits, $3k–6k, and one agency
conversation that matters more than the cash.

---

## What will kill you

**Saying "compliant."** No vendor can promise ADA compliance; there is no
certification and no safe harbour. The FTC just took $1M off a company for
claiming otherwise. Never write compliant, certified, guaranteed, or
lawsuit-proof in any deliverable, email, or web page. `a11y-audit` has a test
that fails the build if those phrases appear in report output — keep it.

**Overselling automated coverage.** Automated rules catch a minority of WCAG 2.1
AA. Keyboard operation, focus order, whether alt text is *meaningful* rather than
merely present, error recovery, screen-reader comprehension — all need a human.
If you sell a clean scan as conformance and the client is then sued, you are the
one who created their exposure. Every artifact the tool emits carries that
caveat. Leave it in.

**Signing government work without insurance.** Get errors-and-omissions cover
before the first public-sector contract. Most will require it anyway.

**Taking remediation on stacks you cannot touch.** Proprietary CMSes and
vendor-locked platforms turn a $10k fix into a month of fighting someone else's
support desk. Audit anything; remediate only what you can actually edit.

---

## What I would want to know before going further

- Whether a scan-before-contact motion draws complaints in practice. It is
  ordinary public-page fetching at trivial volume, but the demand-letter
  industry has made this sector twitchy about unsolicited outreach.
- Real conversion on the overlay-refugee list. The logic is sound and untested.
- Whether the agency channel resells or tries to hire the capability in-house
  once they see the margin.
- Local procurement thresholds for the specific Montgomery County municipalities
  worth targeting — the state figures above do not automatically apply to them.

---

## Sources

- WebAIM Million 2026 — <https://webaim.org/projects/million/>
- FTC v. accessiBe, Jan 2025 — <https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-order-requires-online-marketer-pay-1-million-deceptive-claims-its-ai-product-could-make-websites>
- HHS OCR Section 504 deadline extension — <https://www.hhs.gov/press-room/hhs-extends-mobile-and-web-accessibility-deadline.html>
- DOJ Title II extension analysis — <https://accessible.org/news/doj-extends-ada-title-ii-web-compliance-deadline/>
- Maryland procurement thresholds — <https://procurement.maryland.gov/mpm-3-pre-solicitation/>
