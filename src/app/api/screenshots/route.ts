import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { parseDay } from "@/lib/dates";
import { MAX_BYTES, saveImage, sniffImage } from "@/lib/screenshots/storage";

/** Upload one image (multipart field "file"), optionally linked to a day and/or trade. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error("Choose an image to upload.");
  if (file.size > MAX_BYTES) return error("Images are limited to 10 MB.");

  const buf = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) return error("That file isn't a PNG, JPEG, WebP or GIF image.");

  const dayRaw = String(form?.get("day") ?? "");
  const day = parseDay(dayRaw) ? dayRaw : null;
  const tradeIdRaw = Number(form?.get("tradeId"));
  let tradeId: number | null = null;
  if (Number.isInteger(tradeIdRaw) && tradeIdRaw > 0) {
    const trade = await db.query.trades.findFirst({ where: eq(schema.trades.id, tradeIdRaw) });
    if (trade) tradeId = trade.id;
  }
  const caption = String(form?.get("caption") ?? "").trim().slice(0, 500) || null;

  const filePath = await saveImage(buf, ext);
  const [row] = await db
    .insert(schema.screenshots)
    .values({ filePath, day, tradeId, caption })
    .returning({ id: schema.screenshots.id });

  revalidatePath("/", "layout");
  return Response.json({ ok: true, id: row.id });
}

const error = (message: string) => Response.json({ ok: false, error: message }, { status: 400 });
