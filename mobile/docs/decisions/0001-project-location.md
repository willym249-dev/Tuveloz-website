# 0001. The app lives in `mobile/` but shares no code with the website

**Status:** Accepted
**Date:** 2026-08-05

## Context

The Tuveloz app is a brand-new codebase and is specified as completely separate
from the Tuveloz website. The website is a mature Next-on-Cloudflare
application in the root of the `Tuveloz-website` repository, with its own
`app/` directory, `package.json`, Wrangler config and D1 migrations.

At the time this was decided, `Tuveloz-website` was the only repository on the
account. Creating a new GitHub repository is an outward-facing action that
belongs to the project owner, not to a contributor acting unasked.

## Decision

The app is built as a fully self-contained project in `mobile/`:

- its own `package.json`, lockfile, TypeScript config, ESLint config and
  toolchain;
- its own `node_modules`, not hoisted or shared;
- **zero imports across the boundary in either direction.**

The only thing crossing over is the brand palette, and it is _copied_ into
`src/theme/tokens.ts` rather than imported, so neither project can break the
other.

## Consequences

- Separation is real at the code level: the app could be deleted without
  affecting the website, and vice versa.
- Extraction to its own repository is mechanical whenever the owner wants it:

  ```bash
  git subtree split --prefix=mobile -b tuveloz-app
  # then push that branch to a new empty repository as its main
  ```

  Nothing in the app assumes it lives in a subdirectory — no relative paths
  reach outside `mobile/`.

- Until extraction, the two projects share a repository, so issues, branches
  and CI runs are mixed together. This is the main cost, and it is the reason
  to extract sooner rather than later.
- The website's tooling (`npm test` at the root) does not see the app, and the
  app's does not see the website. Neither needs to change.

## Alternatives considered

**Create a new GitHub repository immediately.** The cleanest end state, and
where this is expected to land. Not done here because creating a repository on
someone's account is their decision to make, and the extraction path above
makes it a cheap change later rather than an irreversible one now.

**A shared monorepo with workspaces.** Would let the app and website share
types and validation. Rejected: it couples two very different toolchains
(Cloudflare Workers vs Metro), contradicts the stated separation, and buys
nothing while the two share no logic.
