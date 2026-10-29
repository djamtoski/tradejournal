import "server-only";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { applyUrlOverrides, FILTER_COOKIE, parseFilterCookie, type Filters } from "./filters";

type SP = Record<string, string | string[] | undefined>;

/**
 * Effective filters for this request: the saved cookie, minus accounts that no
 * longer exist, with any range/mode URL override applied. Call inside Suspense.
 */
export async function readFilters(sp: SP = {}): Promise<Filters> {
  const [jar, accounts] = await Promise.all([
    cookies(),
    db.select({ id: schema.accounts.id }).from(schema.accounts),
  ]);
  const saved = parseFilterCookie(jar.get(FILTER_COOKIE)?.value);
  const known = new Set(accounts.map((a) => a.id));
  return applyUrlOverrides({ ...saved, accountIds: saved.accountIds.filter((id) => known.has(id)) }, sp);
}
