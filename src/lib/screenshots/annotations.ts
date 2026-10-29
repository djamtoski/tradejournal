/**
 * Annotations are drawn over the image, never baked into it. Coordinates are
 * in a 1000-wide viewBox whose height follows the image's aspect ratio.
 */

export const VIEW_W = 1000;

export const colors = {
  profit: "#4cb782",
  loss: "#eb5757",
  accent: "#5e6ad2",
  white: "#f7f8f8",
  amber: "#f2b84b",
} as const;
export type ColorKey = keyof typeof colors;

export type Shape =
  | { id: string; kind: "arrow" | "box" | "line"; x1: number; y1: number; x2: number; y2: number; color: ColorKey }
  | { id: string; kind: "text"; x1: number; y1: number; text: string; color: ColorKey };

export type Annotations = { aspect: number; shapes: Shape[] };

/** Validates stored or submitted JSON; anything malformed is dropped. */
export function parseAnnotations(raw: unknown): Annotations | null {
  if (!raw || typeof raw !== "object") return null;
  const { aspect, shapes } = raw as { aspect?: unknown; shapes?: unknown };
  if (typeof aspect !== "number" || !(aspect > 0 && aspect < 20) || !Array.isArray(shapes)) return null;
  const num = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 100_000;
  const clean: Shape[] = [];
  for (const s of shapes.slice(0, 200)) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const color = (Object.keys(colors) as ColorKey[]).includes(o.color as ColorKey) ? (o.color as ColorKey) : "accent";
    const id = typeof o.id === "string" ? o.id.slice(0, 40) : Math.random().toString(36).slice(2);
    if ((o.kind === "arrow" || o.kind === "box" || o.kind === "line") && [o.x1, o.y1, o.x2, o.y2].every(num)) {
      clean.push({ id, kind: o.kind, x1: o.x1 as number, y1: o.y1 as number, x2: o.x2 as number, y2: o.y2 as number, color });
    } else if (o.kind === "text" && num(o.x1) && num(o.y1) && typeof o.text === "string" && o.text.trim()) {
      clean.push({ id, kind: "text", x1: o.x1 as number, y1: o.y1 as number, text: o.text.slice(0, 200), color });
    }
  }
  return { aspect, shapes: clean };
}
