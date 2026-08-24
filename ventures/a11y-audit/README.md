# a11y-audit

Crawl a site, run [axe-core](https://github.com/dequelabs/axe-core) against every
page under the WCAG 2.1 AA rule set, and produce a client-ready audit — plus a
bulk triage mode for building a ranked prospect list.

This is deliberately not a compliance product. It reports observed failures and
says so in every artifact it emits.

## Install

```bash
npm install
```

Playwright needs a Chromium. It uses its own if present, otherwise the newest
`chromium-*` under `$PLAYWRIGHT_BROWSERS_PATH` (defaults to `/opt/pw-browsers`),
so container images that already ship one are not made to re-download it.
Override with `A11Y_CHROME_PATH=/path/to/chrome`.

## Audit one site

```bash
node scan.mjs https://example.gov --pages 20 --out ./reports
node report.mjs reports/example-gov.json --html --out ./reports
```

`scan.mjs` breadth-first crawls same-origin pages, skipping assets, `mailto:`
and non-HTML responses, then aggregates violations per rule across pages.

| Flag | Default | Meaning |
| --- | --- | --- |
| `--pages N` | 15 | Page ceiling |
| `--concurrency N` | 3 | Parallel page loads |
| `--timeout MS` | 30000 | Per-page navigation timeout |
| `--best-practice` | off | Include axe best-practice rules beyond WCAG AA |

`report.mjs` renders that JSON:

| Flag | Meaning |
| --- | --- |
| `--html` | Also write a styled, printable HTML report |
| `--teaser` | Short outreach summary — names the problem, withholds the fix list |
| `--out DIR` | Write files instead of printing Markdown to stdout |

## Build a prospect list

```bash
node prospect.mjs domains.txt --out ./prospects
```

One page per domain. Records violation counts **and** whether the site runs an
accessibility overlay widget (accessiBe, UserWay, AudioEye, EqualWeb and
others), then ranks by a score that weights task-blocking failures hardest and
adds a flat bonus for an overlay.

The overlay flag is the commercially interesting column. It means the
organisation already believes accessibility is worth paying for and already has
a budget line for it. Writes `prospects.json` and `prospects.csv`.

`domains.txt` is one domain per line; `#` comments and blanks are ignored. Bare
domains are assumed `https://`.

## How findings are ranked

`rules.mjs` maps axe rule IDs to WCAG success criteria and adds two judgements
axe does not make: `severity` (does this stop someone finishing a task) and
`litigationSalience` (does this failure class actually show up in complaints).
Priority combines those with how many pages are affected, damping raw instance
counts — 400 contrast failures from one bad brand colour is a single
design-token fix and should not outrank a form nobody can submit.

## Coverage, honestly

Automated rules detect a minority of WCAG 2.1 AA failures. Keyboard operation,
focus order, whether alt text is *meaningful* rather than merely present, error
recovery, and screen-reader comprehension all need a human. A clean scan is not
conformance, and no report this tool emits says otherwise.

In January 2025 the FTC fined an overlay vendor $1M for claiming its product
made sites WCAG-conformant. Do not repeat that claim in any form.

## Tests

```bash
node --test
```

Serves `fixtures/` — pages carrying known, deliberate violations — and asserts
the scanner finds exactly those.
