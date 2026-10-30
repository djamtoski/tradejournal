import { test } from "node:test";
import assert from "node:assert/strict";
import { addDaysKey, dayKey, isValidTimezone, offsetLabel, startOfDay, zonedInstant, zonedParts } from "./tz";

const NY = "America/New_York";

test("an evening UTC trade belongs to the New York day it happened on", () => {
  const t = new Date("2026-10-06T01:30:00Z"); // 21:30 on Oct 5 in New York
  assert.equal(dayKey(t, NY), "2026-10-05");
  assert.equal(dayKey(t, "UTC"), "2026-10-06");
  assert.equal(dayKey(t, "Asia/Tokyo"), "2026-10-06");
});

test("zoned parts give the local hour and weekday", () => {
  const p = zonedParts(new Date("2026-10-05T13:31:00Z"), NY); // Monday 09:31 EDT
  assert.equal(p.hour, 9);
  assert.equal(p.minute, 31);
  assert.equal(p.weekday, 1);
});

test("start of day accounts for daylight saving", () => {
  assert.equal(startOfDay("2026-07-01", NY).toISOString(), "2026-07-01T04:00:00.000Z"); // EDT
  assert.equal(startOfDay("2026-01-15", NY).toISOString(), "2026-01-15T05:00:00.000Z"); // EST
  assert.equal(startOfDay("2026-03-08", NY).toISOString(), "2026-03-08T05:00:00.000Z"); // DST starts 02:00
  assert.equal(startOfDay("2026-11-01", NY).toISOString(), "2026-11-01T04:00:00.000Z"); // DST ends 02:00
});

test("wall times round-trip, including across the DST switch", () => {
  for (const [y, m, d, h, mi] of [
    [2026, 3, 9, 9, 30],
    [2026, 11, 2, 9, 30],
    [2026, 6, 15, 15, 59],
  ]) {
    const p = zonedParts(zonedInstant(NY, y, m, d, h, mi), NY);
    assert.deepEqual([p.year, p.month, p.day, p.hour, p.minute], [y, m, d, h, mi]);
  }
});

test("a time skipped by spring-forward resolves to the hour after", () => {
  const p = zonedParts(zonedInstant(NY, 2026, 3, 8, 2, 30), NY);
  assert.equal(p.hour, 3);
  assert.equal(p.minute, 30);
});

test("a repeated fall-back time takes the first occurrence", () => {
  assert.equal(zonedInstant(NY, 2026, 11, 1, 1, 30).toISOString(), "2026-11-01T05:30:00.000Z"); // 01:30 EDT
});

test("day key arithmetic crosses months and leap days", () => {
  assert.equal(addDaysKey("2026-10-31", 1), "2026-11-01");
  assert.equal(addDaysKey("2028-03-01", -1), "2028-02-29");
  assert.equal(addDaysKey("2026-01-05", -30), "2025-12-06");
});

test("timezone validation and labels", () => {
  assert.ok(isValidTimezone(NY));
  assert.ok(!isValidTimezone("Mars/Olympus"));
  assert.equal(offsetLabel(NY, new Date("2026-07-01T12:00:00Z")), "UTC−4");
  assert.equal(offsetLabel("Asia/Kolkata", new Date("2026-07-01T12:00:00Z")), "UTC+5:30");
  assert.equal(offsetLabel("UTC"), "UTC");
});
