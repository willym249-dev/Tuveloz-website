# Roadmap

The phased build order. Each phase should leave the app in a shippable state.

Current status per item lives in [`PROJECT_STATUS.md`](PROJECT_STATUS.md);
this file describes the plan and its reasoning.

---

## Phase 1 — Foundation ✅ Complete

Project structure, navigation, authentication, customer and provider accounts,
role selection, home screens, shared design system.

The point of this phase was to make later phases cheap: a design system so
screens are assembled rather than styled, a session model so no feature has to
re-solve "who is signed in", and a repository layer so the database can change
without a wide refactor.

---

## Phase 2 — Customer features

Requesting work is the transaction that makes the marketplace exist, so it
comes before anything on the provider side beyond an account.

| #   | Feature                       | Notes                                                                                                                        |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 2.0 | **Connect the real backends** | Firebase + Supabase projects, migration 0001 applied, third-party auth registered. Nothing below can be tested without this. |
| 2.1 | Vehicles                      | A request is about a vehicle, so this comes first. Make, model, year, plate optional.                                        |
| 2.2 | Request service               | Category, description, urgency, preferred timing.                                                                            |
| 2.3 | Photo upload                  | Supabase Storage. RLS scoped to the request owner. Compress before upload.                                                   |
| 2.4 | Location                      | Address or map pin, restricted to the launch area. Precise location is visible only to a provider whose quote was accepted.  |
| 2.5 | Receive quotes                | Read side: list, compare, accept.                                                                                            |
| 2.6 | Chat                          | Per-request thread between customer and the quoting provider.                                                                |
| 2.7 | Notifications                 | Push via `expo-notifications` for new quotes and messages.                                                                   |
| 2.8 | Booking history               | Past and active requests.                                                                                                    |

**Open question for 2.4:** whether location is stored as a free-text address or
as coordinates with PostGIS. Coordinates make provider matching by radius
straightforward; text is simpler and enough for a single county. Decide before
writing the migration, and record it as an ADR.

---

## Phase 3 — Provider features

| #   | Feature          | Notes                                                      |
| --- | ---------------- | ---------------------------------------------------------- |
| 3.1 | Provider profile | Business name, description, credentials, photos.           |
| 3.2 | Services         | What they do — drives which requests they see.             |
| 3.3 | Availability     | Working hours and blackout dates.                          |
| 3.4 | Quote requests   | The matched inbox. Matching rules will need their own ADR. |
| 3.5 | Submit quotes    | Line items, total, validity window.                        |
| 3.6 | Jobs             | Accepted quotes and their progress.                        |
| 3.7 | Earnings         | Read-only until Stripe lands in Phase 4.                   |

Provider verification (licences, insurance) needs a decision on how much is
enforced in-app versus handled manually during the founding-provider period.

---

## Phase 4 — Platform

| #   | Feature             | Notes                                                                                                                               |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Admin               | Likely web, not in this app. Probably belongs to the website codebase.                                                              |
| 4.2 | Stripe              | Connect for provider payouts, platform fee on each job. Requires a server for secret-key work — the app cannot hold Stripe secrets. |
| 4.3 | Ratings and reviews | Both directions, only after a completed job.                                                                                        |
| 4.4 | Analytics           | Pick a tool that fits the privacy policy.                                                                                           |
| 4.5 | Crash reporting     | Wire into `src/lib/logger.ts`.                                                                                                      |

**Phase 4 introduces a server.** Stripe secret-key operations, webhook
handling and payout release cannot run in the app. Whether that is Supabase
Edge Functions or the existing Cloudflare Worker in the website repository is
a decision to make at the start of the phase, not the end.

---

## Not scheduled

Deliberately deferred, listed so they are not mistaken for oversights:

- Social and passkey sign-in — email/password covers launch.
- Multi-language UI — the website is bilingual; the app can follow once copy
  settles.
- Tablet and web layouts — phone first.
- Accounts holding both roles — see ADR 0007.
