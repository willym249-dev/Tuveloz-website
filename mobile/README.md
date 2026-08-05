# Tuveloz app

The Tuveloz marketplace mobile app: customers describe vehicle work they need,
independent automotive service providers quote on it, and the two sides
transact through the app.

Initial launch market: **Montgomery County, Maryland**.

> This is a brand-new codebase and is **separate from the Tuveloz website**. It
> shares no code with the Next.js site in the repository root — only the brand
> palette, which is copied into `src/theme/tokens.ts`. See
> [docs/decisions/0001-project-location.md](docs/decisions/0001-project-location.md)
> for why it currently lives in this directory and how to extract it.

## Stack

| Concern    | Choice                                     |
| ---------- | ------------------------------------------ |
| Runtime    | React Native 0.86 via Expo SDK 57          |
| Language   | TypeScript (strict)                        |
| Navigation | Expo Router (file-based, typed routes)     |
| Styling    | NativeWind 4 (Tailwind) over design tokens |
| Identity   | Firebase Authentication                    |
| Data       | Supabase (Postgres + row-level security)   |
| Payments   | Stripe — Phase 4, not yet integrated       |

## Requirements

- Node.js 20.19.4 or newer
- npm
- The Expo Go app, or an iOS Simulator / Android emulator
- A Firebase project with Email/Password sign-in enabled
- A Supabase project with Firebase registered as a third-party auth provider

## Getting started

```bash
cd mobile
npm install

cp .env.example .env      # then fill in the values
npm start
```

`npm start` prints a QR code. Open it with Expo Go, or press `i` / `a` for a
simulator.

The app **will not start** without a valid `.env` — `src/lib/env.ts` validates
the configuration up front and fails with a message naming the missing keys,
rather than letting the app boot into a broken state.

### Setting up the backends

1. **Firebase** — create a project, add a Web app, enable Email/Password
   sign-in, and copy the config values into `.env`.
2. **Supabase** — create a project, run the migrations in
   [`supabase/migrations`](supabase/migrations), and register Firebase as a
   third-party auth provider. Full steps in
   [`supabase/README.md`](supabase/README.md).

## Everyday commands

| Command                           | What it does                                              |
| --------------------------------- | --------------------------------------------------------- |
| `npm start`                       | Start the dev server                                      |
| `npm run ios` / `npm run android` | Start and open a simulator                                |
| `npm run typecheck`               | `tsc --noEmit`                                            |
| `npm run lint`                    | ESLint                                                    |
| `npm run format`                  | Prettier, writing changes                                 |
| `npm run verify`                  | typecheck + lint + format check — run before every commit |
| `npm run deps:check`              | Check dependency versions against the Expo SDK            |

## Where things live

```
mobile/
├── src/
│   ├── app/            Expo Router routes — the URL structure of the app
│   ├── components/ui/  The design system. Import from '@/components/ui'
│   ├── features/       Feature-owned logic (auth, profile, …)
│   ├── lib/            Cross-cutting infrastructure (env, errors, Firebase, Supabase)
│   ├── providers/      React context providers
│   ├── theme/          Design tokens — the source of truth for colour and type
│   ├── types/          Shared types, including the database schema
│   └── constants/      Copy and values reused across screens
├── supabase/           SQL migrations and backend setup notes
├── docs/               Architecture, design system, decisions
└── assets/             App icons and the brand mark they are generated from
```

## Documentation

- [PROJECT_STATUS.md](PROJECT_STATUS.md) — what is built, what is next. **Read this first.**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — tokens and UI primitives
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — conventions and workflow
- [ROADMAP.md](ROADMAP.md) — the phased build order
- [docs/DECISIONS.md](docs/DECISIONS.md) — the decision log, indexing the ADRs in [docs/decisions/](docs/decisions/)
