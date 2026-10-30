# Ledger

[![CI](https://github.com/djamtoski/tradejournal/actions/workflows/ci.yml/badge.svg)](https://github.com/djamtoski/tradejournal/actions/workflows/ci.yml)
[![CodeQL](https://github.com/djamtoski/tradejournal/actions/workflows/codeql.yml/badge.svg)](https://github.com/djamtoski/tradejournal/actions/workflows/codeql.yml)

A private, local-first trading journal. Import your broker fills, see your
P&L by day, setup, symbol and time, and keep a daily journal next to the
numbers. Your data stays in a SQLite file on your machine.

## Features

- **Dashboard**: tabs for overview (P&L, win rate, profit factor, R, equity
  curve), time, activity, setups and instruments
- **Filters**: account, asset class, range and net/gross, shared across pages
- **Calendar**: month and year views of daily P&L, with goal breaches marked
- **Daily**: intraday P&L, trades, per-symbol blotter, journal and review
- **Trades**: filter, sort and edit trades: tags, mistakes, rule rating,
  stop/target, MFE/MAE and notes; add manual trades and open positions
- **Risk**: 1R per account or from the stop, with results in R-multiples
- **Goals**: daily limits, profit targets and streaks
- **Journal**: searchable entries, and whether rule-following days pay
- **Playbook**: setup and rules documents, with live stats for linked setups
- **Screenshots**: paste or drop charts, link them to a day or trade, and
  annotate with arrows, boxes, level lines and text
- **Import**: any broker CSV, with automatic column matching, preview,
  duplicate skipping, and fills grouped into round-trip trades. Tradovate
  exports are recognised automatically, and a watched inbox folder imports
  them as you save them
- **Reviews**: run `/review-trades` in Claude Code to get a written review of
  a day or week, saved into the app. The app itself never calls an AI service

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
| `npm run review:data -- --day latest` | Print the data packet `/review-trades` reads |
| `npm run review:save -- --day YYYY-MM-DD --file <md>` | Save a review into the app |

## Notes

Built from a written feature spec as a clean-room project; it contains no
code from other trading journals. The `.claude/skills` folder holds the
design-system rules used when building screens with Claude Code;
`web-design-engineer` is from
[ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) (MIT).
