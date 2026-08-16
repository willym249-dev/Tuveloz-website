# Spanish is live for people and invisible to search

- **Status:** finding — no fix attempted
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-16
- **Applies to:** `app/components/site-language.tsx`, `app/sitemap.ts`, and the
  eight pages listed in `SPANISH_READY_PATHS`

Eight pages carry reviewed Spanish. A search engine has never seen a word of it,
and no metadata change fixes that. This records why, what it would take, and what
it must not break — it decides nothing.

## What is true today

`SPANISH_READY_PATHS` covers `/`, `/post-job`, `/join`, `/about`,
`/how-it-works`, `/ai`, `/faq`, and `/safety`. The translations are real,
reviewed, and guarded — `scripts/check-spanish-coverage.mjs` fails the build if a
listed page has untranslated text.

They are also unreachable from Google, for a structural reason rather than a
missing tag.

## Why: the translation happens after the page exists

Spanish is not rendered. It is **swapped into the DOM after paint**:

```
SiteLanguageProvider →  translateInterface(document.body, language)
                     →  MutationObserver re-runs it as the DOM changes
```

The language itself lives in `localStorage`, and `getLanguageSnapshot` returns
`"en"` whenever there is no `window`. So the server emits English HTML on every
request, and a crawler — which is exactly a request with no `window` and no
`localStorage` — receives English and nothing else.

Both languages also share one URL. That closes the ordinary escape hatch:
`hreflang` needs distinct URLs to point at, so it cannot be added here even as a
hint.

The result is that the Spanish work is visible to every person who clicks the
toggle and to no search engine at all.

## Why this matters more here than it would elsewhere

Marketing targets Montgomery County, where roughly a fifth of residents are
Hispanic or Latino. A Spanish-speaking customer searching for vehicle service in
Spanish cannot reach these pages through search, whatever they type. This is the
largest single SEO item on the site, and the rest of the SEO is in good order —
`robots.ts`, `sitemap.ts`, canonicals, and JSON-LD are all present and
considered, including deliberate reasoning about not indexing QR redirects or
provider profiles that would 503.

## What a fix would actually involve

Not a tag. Spanish HTML has to leave the server, which means distinct URLs and a
server-side translation step. Three routes, honestly costed:

| Approach | What it means | Cost |
| --- | --- | --- |
| Render-time i18n | Replace DOM substitution with dictionary lookups at render across sixteen files and a ~1,300-line dictionary | Largest, and the most correct long-term |
| Translate the rendered HTML | Apply the same dictionary to the HTML string for `/es/*` before it is served — same substitution, earlier | Moderate; reuses the dictionary that already exists |
| Prerender Spanish variants | Build-time Spanish copies of the eight pages | Moderate; goes stale unless wired into the build |

Whichever is chosen, the same three things follow: `/es/*` routes, `hreflang`
alternates plus a self-referencing canonical on each side, and sitemap entries
for the Spanish URLs.

## The constraint that must survive it

**The dictionary must never reach the provider clickwrap.** Provider signup
carries agreements the applicant accepts, and a translated clickwrap is a
different legal instrument from the one that was reviewed. `/join` is in
`SPANISH_READY_PATHS`, so any server-side approach has to keep the same boundary
the current one does, deliberately rather than by accident.

`SiteLanguageButton` is also only offered where a whole page has reviewed
Spanish, for the same reason: offering the toggle on a legal page would promise a
translation that does not exist. Distinct URLs must not quietly become that
promise either — an `/es/` URL for a page without reviewed Spanish would be worse
than no Spanish URL at all.

## What was not done

Nothing. No routes, no metadata, no dictionary changes. This is a finding written
up so the decision can be made with the cost visible, rather than discovered
halfway through a refactor.
