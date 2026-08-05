# 0002. Expo with Expo Router for the app framework

**Status:** Accepted
**Date:** 2026-08-05

## Context

The stack was specified as React Native + Expo + TypeScript + Expo Router. This
ADR records the version choices and the conventions that follow from them,
since those were not specified and are expensive to change later.

## Decision

- **Expo SDK 57** (React Native 0.86, React 19.2), the current release. Every
  Expo package is pinned to its SDK-57-compatible version; `npm run deps:check`
  verifies alignment.
- **Expo Router** with **typed routes** enabled, so a bad `href` is a compile
  error rather than a runtime dead end.
- **Routes live in `src/app`**, not a top-level `app/`, keeping all source
  under `src/`.
- **Managed workflow.** No `ios/` or `android/` directories are committed;
  `expo prebuild` generates them on demand. Both are git-ignored.
- **Route groups for auth flows, real path segments for the two role areas.**
  `(auth)` and `(onboarding)` are groups. `customer/` and `provider/` are real
  segments.

## Consequences

- The role areas can both have an `account` screen without colliding, and deep
  links read unambiguously (`/customer/requests` vs `/provider/requests`).
- Typed routes are generated into `.expo/types` by `expo start`. A fresh clone
  that has never started the dev server typechecks with looser href types; run
  `npm start` once to get the strict version. CI should do the same.
- Staying in the managed workflow means native config is expressed in
  `app.config.ts` and config plugins. Adding a library that needs manual native
  changes forces a decision about prebuilding — treat that as a signal to look
  for an Expo-compatible alternative first.
- Upgrading the SDK is a coordinated bump of every `expo-*` package. `npx
expo install --fix` does most of it.

## Alternatives considered

**React Navigation directly.** More explicit, but gives up file-based routing,
deep linking for free and typed routes. Expo Router is built on React
Navigation anyway, so the escape hatch remains.

**Bare React Native CLI.** Full native control at the cost of managing two
native projects, build tooling and upgrades by hand. Not worth it for a team
this size with no unusual native requirements.
