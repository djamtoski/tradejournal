import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnnotations } from "./annotations";
import { sniffImage } from "./sniff";

const bytes = (...xs: number[]) => new Uint8Array([...xs, ...Array(12).fill(0)]);

test("image types are detected from magic bytes", () => {
  assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47)), "png");
  assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff)), "jpg");
  assert.equal(sniffImage(bytes(0x47, 0x49, 0x46, 0x38)), "gif");
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  assert.equal(sniffImage(webp), "webp");
});

test("non-images and short files are rejected", () => {
  assert.equal(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>")), null);
  assert.equal(sniffImage(new TextEncoder().encode("%PDF-1.7 ......")), null);
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50])), null);
});

test("annotations keep valid shapes and drop malformed ones", () => {
  const parsed = parseAnnotations({
    aspect: 16 / 9,
    shapes: [
      { id: "a", kind: "arrow", x1: 1, y1: 2, x2: 3, y2: 4, color: "amber" },
      { id: "b", kind: "text", x1: 10, y1: 10, text: "  Entry  ", color: "nope" },
      { id: "c", kind: "box", x1: 1, y1: 2, x2: "x", y2: 4, color: "loss" },
      { id: "d", kind: "text", x1: 1, y1: 1, text: "   ", color: "white" },
      { id: "e", kind: "circle", x1: 1, y1: 1, x2: 2, y2: 2, color: "white" },
    ],
  });
  assert.ok(parsed);
  assert.deepEqual(parsed.shapes.map((s) => s.id), ["a", "b"]);
  assert.equal(parsed.shapes[1].color, "accent"); // unknown color falls back
});

test("annotations with a bad aspect ratio are rejected", () => {
  assert.equal(parseAnnotations({ aspect: 0, shapes: [] }), null);
  assert.equal(parseAnnotations({ aspect: "wide", shapes: [] }), null);
  assert.equal(parseAnnotations(null), null);
});
