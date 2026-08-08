# Project status

**Last updated:** 2026-08-05
**Phase:** 1 — foundation
**State:** Foundation complete. Ready for Phase 2 feature work.

Update this file whenever a major feature lands. It is the first thing any
contributor — human or AI — should read.

---

## What works today

| Area                       | State   | Notes                                                             |
| -------------------------- | ------- | ----------------------------------------------------------------- |
| Project scaffold           | ✅ Done | Expo SDK 57, RN 0.86, TypeScript strict, Expo Router typed routes |
| Design system              | ✅ Done | Tokens + 11 UI primitives in `src/components/ui`                  |
| Navigation                 | ✅ Done | Auth / onboarding / customer / provider route groups with guards  |
| Sign up, sign in, sign out | ✅ Done | Firebase Email/Password, validated forms, mapped error messages   |
| Password reset             | ✅ Done | Email link; response does not reveal whether an account exists    |
| Role selection             | ✅ Done | Writes the `profiles` row that decides customer vs provider       |
| Session management         | ✅ Done | `SessionProvider` joins Firebase identity + Supabase profile      |
| Customer shell             | ✅ Done | Home, Requests, Messages, Account tabs — placeholder content      |
| Provider shell             | ✅ Done | Dashboard, Requests, Jobs, Account tabs — placeholder content     |
| Database schema            | ✅ Done | `profiles` table + RLS keyed to the Firebase UID (migration 0001) |
| Verification               | ✅ Done | `npm run verify` passes; Metro bundle confirmed building          |

### Verified, not assumed

The following were run against this code, not inferred:

- `npm run typecheck` — passes, including Expo Router's generated route types
- `npm run lint` — passes with zero warnings
- `npm run format:check` — passes
- `npx expo export --platform android` — bundles successfully; the compiled
  Tailwind theme is present in the output bundle

### Not yet verified

- No run against a real Firebase or Supabase project. The auth and data code
  is typed and compiles, but the round trip has not been exercised end to end.
  **This is the first thing to do in Phase 2.**
- No automated tests yet. See "Known gaps".

---

## Known gaps

| Gap                           | Why it is open                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| No test suite                 | Phase 1 is mostly wiring. Tests land with the first real business logic (the request flow), where they earn their keep. |
| No CI                         | Add a workflow running `npm run verify` once the app has a second contributor.                                          |
| No error reporting            | `src/lib/logger.ts` is the seam. Wire Sentry or Crashlytics in Phase 4.                                                 |
| No offline handling           | Supabase reads fail loudly. Caching arrives with the request list.                                                      |
| Role is not changeable in-app | Deliberate — see ADR 0007. Support handles it for now.                                                                  |
| Web target unverified         | Expo Router supports web; only the native bundle has been built.                                                        |

---

## Next up (Phase 2 — customer features)

In dependency order:

1. **Connect the real backends.** Create the Firebase and Supabase projects,
   apply migration 0001, register the third-party auth provider, and confirm
   sign-up → role selection → profile row works end to end.
2. **Vehicles.** Customers need a vehicle before they can request work.
   Migration + repository + screens.
3. **Service requests.** The core flow: describe the work, pick a category,
   choose a location, submit.
4. **Photo upload.** Supabase Storage, with an RLS policy scoped to the request
   owner.
5. **Quotes (read side).** Customers see quotes arrive against a request.
6. **Chat and notifications.**

See [ROADMAP.md](ROADMAP.md) for the full phase plan.

---

## Decisions worth knowing before you change anything

Full records in [docs/DECISIONS.md](docs/DECISIONS.md). The short version:

- The app lives in `mobile/` inside the website repository but shares **no
  code** with it, and can be extracted to its own repository with one command
  (ADR 0001).
- Firebase owns identity; Supabase owns data. Supabase trusts the Firebase ID
  token as a third-party issuer, and every policy authorises against
  `auth.jwt() ->> 'sub'` (ADR 0004).
- The customer/provider role lives in a `profiles` row, not a Firebase custom
  claim (ADR 0007).
- Service functions return a `Result` rather than throwing (ADR 0006).
- Screens never import `firebase/*` or `supabase` directly — they go through
  `src/lib` and feature repositories (ADR 0005).
