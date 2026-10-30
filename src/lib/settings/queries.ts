import "server-only";
import { cache } from "react";
import { db, schema } from "@/db";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/tz";

export type AppSettings = {
  timezone: string;
  /** Folder watched for broker exports; null = off. */
  inboxFolder: string | null;
  /** Account that inbox imports go into. */
  inboxAccountId: number | null;
};

/** Read once per request; missing or invalid values fall back to defaults. */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.select().from(schema.settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const tz = map.get("timezone");
  const accountId = Number(map.get("inboxAccountId"));
  return {
    timezone: tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE,
    inboxFolder: map.get("inboxFolder") || null,
    inboxAccountId: Number.isInteger(accountId) && accountId > 0 ? accountId : null,
  };
});
