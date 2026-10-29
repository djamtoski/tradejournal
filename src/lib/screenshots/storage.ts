import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImageExt } from "./sniff";

export { sniffImage } from "./sniff";

/** Images live next to the database, outside the repo's tracked files. */
const DIR = path.join(process.cwd(), "data", "screenshots");

export const MAX_BYTES = 10 * 1024 * 1024;

const types = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export async function saveImage(buf: Uint8Array, ext: ImageExt) {
  await mkdir(DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(DIR, name), buf);
  return name;
}

/** Only bare generated names are accepted, so a stored path can't escape the folder. */
const SAFE = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/;

export async function readImage(name: string) {
  if (!SAFE.test(name)) return null;
  try {
    const data = await readFile(path.join(DIR, name));
    const ext = name.split(".").pop() as ImageExt;
    return { data, type: types[ext] };
  } catch {
    return null;
  }
}

export async function removeImage(name: string) {
  if (!SAFE.test(name)) return;
  await unlink(path.join(DIR, name)).catch(() => {});
}
