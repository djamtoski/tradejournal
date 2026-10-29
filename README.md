# Ledger

A private, local-first trading journal. Import your broker fills, see your
P&L by day, setup, symbol and time, and keep a daily journal next to the
numbers. Your data stays in a SQLite file on your machine.

## Features

- **Dashboard**: P&L, win rate, profit factor, expectancy, equity curve,
  daily P&L, and breakdowns by setup, symbol, weekday and entry hour
- **Calendar**: month and year views of daily P&L
- **Daily**: intraday P&L, trades, per-symbol blotter and a journal
- **Import**: any broker CSV, with automatic column matching, preview,
  duplicate skipping, and fills grouped into round-trip trades

## Stack

Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui with Watermelon UI,
Recharts, Drizzle ORM with SQLite (libSQL).

## Getting started

```bash
npm install
npm run db:migrate   # create data/journal.db
npm run db:seed      # optional: ~4 months of sample trades
npm run dev
```

Open http://localhost:3000.

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run unit tests |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:studio` | Browse the database |

## Notes

Built from a written feature spec as a clean-room project; it contains no
code from other trading journals. The `.claude/skills` folder holds the
design-system rules used when building screens with Claude Code;
`web-design-engineer` is from
[ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) (MIT).
