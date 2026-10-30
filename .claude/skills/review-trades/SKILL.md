---
name: review-trades
description: Write a coaching review of a trading day or week from this journal's data and save it into the app. Use when the user runs /review-trades, or asks to review a day, a week, today's trading or their latest session.
---

# Review trades

Writes a process review of one day or one week of the user's own trading, using
the journal's data, and saves it so it shows on the Daily page and on Reviews.
The app never calls an AI service; this skill is the only place trade data is
read by Claude, and only when the user asks.

## Arguments

`/review-trades [day|week] [date]`

- Period: `day` (default) or `week`. A week runs Monday to Sunday.
- Date: `YYYY-MM-DD`, `today`, or `latest` (default: the last day with trades).
  Any date inside a week picks that week.

## Steps

1. From the repo root, print the data packet:

   ```bash
   npm run review:data -- --day latest
   ```

   (`--week 2026-10-28` for a week.) The last lines give the normalized
   period and start date and the exact save command. If it reports no closed
   trades, say so and stop unless the user still wants a journal-only review.

2. Read the whole packet before writing. Work only from it. Don't invent
   trades, prices or numbers, and don't guess at anything the packet doesn't
   show (charts, news, emotions not written in the journal).

3. Analyse, in this order:
   - **Rules and limits.** Breaches with their times, trades rated "broke",
     and journal admissions. Check the "Daily rules" playbook line by line
     against the trade table: trade count, losses in a row, trading in
     windows the rules exclude, size after a red day.
   - **Cost of mistakes.** Sum net P&L of trades tagged with mistakes and of
     trades taken after a limit was broken. Compare with the day's total.
   - **Setups.** Which setups made or lost money, and whether trades matched
     their playbook entry (time window, stop, target in R where R exists).
   - **Timing and pacing.** Entry times, hold times, clusters of trades, the
     trade after a loss.
   - **Against the last 30 days.** Only mention differences that matter.

4. Write the review in markdown with exactly these sections:

   ```markdown
   ## Summary
   Two or three sentences: result, how well the plan was followed, the one
   thing that decided the day.

   ## What worked
   - 2 to 4 bullets, each pointing at specific trades (time + symbol).

   ## What cost you
   - 2 to 4 bullets with dollar amounts (and R when available).

   ## Rule breaches
   - Each breach or broken rule with its time, or "None." if clean.

   ## One focus for tomorrow
   One concrete, checkable behaviour (for a week: "One focus for next week").
   ```

   Style: plain, direct, specific, second person. Use the packet's numbers
   and its time format. Around 150 to 300 words for a day, up to 450 for a
   week. Coach the process; don't predict markets or recommend positions,
   instruments or sizes beyond the user's own written rules.

5. Save it. Write the review to `data/review-draft.md` (`data/` is git-ignored),
   then run the save command from step 1, for example:

   ```bash
   npm run review:save -- --day 2026-10-28 --file data/review-draft.md
   ```

   Saving again for the same period replaces the earlier review. Delete
   `data/review-draft.md` afterwards.

6. Reply with the Summary and the One focus, plus the link the save command
   printed. Don't paste the whole review back.
