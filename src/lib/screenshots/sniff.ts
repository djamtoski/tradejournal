export type ImageExt = "png" | "jpg" | "webp" | "gif";

/** Identify an image by its magic bytes; the browser-supplied type isn't trusted. */
export function sniffImage(buf: Uint8Array): ImageExt | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  const riff = String.fromCharCode(...buf.slice(0, 4));
  const webp = String.fromCharCode(...buf.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}
