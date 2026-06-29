# Contributing

Thanks for taking the time to contribute. This is a small, focused project — keep changes tight and the bar high.

## Getting set up

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL + JWT_SECRET at minimum
pnpm db:push           # apply migrations
pnpm dev
```

See the [README](./README.md) for the full quickstart and configuration table.

## Before you open a PR

Run the full local check suite — CI runs the same:

```bash
pnpm check    # tsc --noEmit
pnpm lint     # eslint
pnpm test     # vitest run
pnpm format   # prettier --write
```

All four should pass clean. Add or update tests for any behavior you change — the XP, badge, ledger, and referral logic all have test coverage under `server/*.test.ts`; match that pattern.

## Guidelines

- **Keep it brand-free.** This is a template. Anything program-specific belongs in `.env` and `server/config/brand.ts`, never hardcoded in source.
- **Smallest change that solves the problem.** Touch only the files the change requires.
- **Match the existing style.** TypeScript throughout, functional React, tRPC for the API surface, Drizzle for data access.
- **One logical change per PR.** Separate refactors from features.
- **Write a clear PR description** — what changed, why, and how you verified it.

## Reporting bugs

Open an issue with: what you expected, what happened, and the minimal steps to reproduce. Include your Node/pnpm versions and any relevant log output.

## Commit messages

Use clear, imperative subject lines (e.g. `Fix XP decay off-by-one in ledger cron`). Reference the issue number when one exists.
