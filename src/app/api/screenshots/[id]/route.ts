import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { readImage } from "@/lib/screenshots/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/screenshots/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const row = await db.query.screenshots.findFirst({ where: eq(schema.screenshots.id, id) });
  const image = row && (await readImage(row.filePath));
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.type,
      // File names are random and never reused, so the bytes for an id never change.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
