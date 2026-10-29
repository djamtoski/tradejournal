# Trading Journal — Feature Spec (clean-room)

Written from public documentation and observed product behavior only. No source
code from TradeNote (GPL-3.0) is copied or paraphrased. The implementation must
be written independently from this document.

## 1. Core concepts

- **Execution**: one fill (symbol, side, qty, price, time, fees, account).
- **Trade**: executions grouped into a round trip from flat to flat. Intraday or swing.
- **Day**: all trades closed on a calendar date, plus the day's journal, rating and screenshots.
- **Account**: a broker account. Trades belong to exactly one account.
- **Tag / Tag group**: user labels for trades (setups, mistakes). Groups organise the tags.
- **Asset classes**: stocks, futures (with multiplier), forex, options (single-leg).

## 2. Import

- Upload a broker export (CSV or XLSX). A per-broker parser normalises it into executions.
- A generic CSV template covers brokers without a dedicated parser.
- Show a preview before committing, and detect duplicate executions.
- Group executions into trades with FIFO position tracking, and support partial exits and scale-ins.
- Keep an import history per upload, with undo/delete.
- Manually add or edit trades.

## 3. Trade metrics (per trade)

- Gross P&L, fees, net P&L, quantity, entry/exit average, duration, side.
- MFE/MAE (excursions): entered manually or from price data. Optional R-multiple from a stop.
- Rating/satisfaction (followed my rules: yes/no), tags, note, screenshots.

## 4. Filters (global, persisted)

- Date: quick ranges (today, week, month, year, all) and a custom range.
- Accounts (multi), tags (all / none / selected), side (long/short), asset class.
- Gross vs net toggle.
- Grouping for charts: daily, weekly, monthly.
- Profitability measure: avg P&L per trade, avg P&L per share/unit, profit factor.

## 5. Dashboard

- **Overview**: net P&L, win rate (chart), profit factor, avg win / avg loss,
  expectancy, trade count, equity curve, P&L per period.
- **Time**: P&L by weekday, entry-time bucket and trade duration.
- **Activity**: P&L by trades per day and executions per day.
- **Setups**: P&L by side, tag and tag group.
- **Instruments**: P&L by symbol and entry-price bucket.

## 6. Calendar

- Month grid and year view. Each day shows net P&L and trade count, coloured by result.
- Clicking a day opens the Daily view.

## 7. Daily view

- Day summary: P&L, win rate, volume, trade count, day rating.
- Tabs: Trades (expand a trade to edit tags, notes and rating), Blotter (per-symbol
  aggregate), Screenshots, Journal.
- Intraday P&L curve for the day.

## 8. Journal (Diary)

- Rich-text daily entries, linked to the date. Searchable list.

## 9. Playbook

- Rich-text documents (for example, one per year) describing setups and rules. Setups can be linked to tags.

## 10. Screenshots

- Upload an image for a trade or a day. Annotate it with arrows, boxes and text.
  Gallery with filters.

## 11. Settings

- Profile, accounts, tags and tag groups, timezone, currency, default filters,
  light/dark theme, data export/backup.

## 12. Non-goals for v1

- Payments/subscriptions, product analytics/telemetry, multi-tenant SaaS.

## 13. Candidate additions (beyond the original)

- Risk/R-multiple tracking with planned stops and targets.
- Trade-level emotion/mistake checklists.
- Goals and rule streaks (for example, "max 3 trades a day").
- Live broker sync via API (later).
- AI review of journal entries and trade patterns (later).

---

## Implementation status

Built: sections 2–11 in their first version (CSV import with column matching,
preview, duplicate skipping, trade grouping and undo; trade metrics with MFE/MAE,
stop/target and rule rating; dashboard; calendar; daily view; journal; playbook
with linked setup stats; annotated screenshots; settings with accounts, tags,
exports and erase).

Second round, one pull request per topic:

- [x] Trading timezone setting: days, hours and CSV times follow it
- [x] Shared filters: account, asset class, range, net/gross, grouping
- [ ] Manual trades and open positions
- [ ] Risk: per-account 1R and R-multiples
- [ ] Dashboard tabs: Overview, Time, Activity, Setups, Instruments
- [ ] Goals and streaks
- [ ] Tradovate import preset and watched inbox folder
- [ ] AI review through Claude Code (`/review-trades`)

Deliberately left out: rich-text journal/playbook, currency, light theme,
restore from backup, payments and telemetry.
