import "server-only";
import { cache } from "react";
import { db, schema } from "@/db";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/tz";

export type AppSettings = { timezone: string };

/** Read once per request; missing or invalid values fall back to defaults. */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.select().from(schema.settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const tz = map.get("timezone");
  return { timezone: tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE };
});
