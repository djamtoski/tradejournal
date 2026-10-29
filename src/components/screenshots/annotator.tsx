"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight, Minus, MousePointer2, Square, Trash2, Type, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { colors, VIEW_W, type Annotations, type ColorKey, type Shape } from "@/lib/screenshots/annotations";
import { updateScreenshot } from "@/lib/screenshots/actions";
import { ArrowMarkers, ShapeView } from "./annotation-layer";

type Tool = "select" | "arrow" | "box" | "line" | "text";

const tools: { id: Tool; label: string; icon: typeof Square; key: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, key: "V" },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight, key: "A" },
  { id: "box", label: "Box", icon: Square, key: "B" },
  { id: "line", label: "Level line", icon: Minus, key: "L" },
  { id: "text", label: "Text", icon: Type, key: "T" },
];

const newId = () => Math.random().toString(36).slice(2, 10);

/** Draw on top of a screenshot. Saves shapes as JSON; the image itself is untouched. */
export function Annotator({
  id,
  src,
  alt,
  initial,
}: {
  id: number;
  src: string;
  alt: string;
  initial: Annotations | null;
}) {
  const [aspect, setAspect] = useState<number | null>(initial?.aspect ?? null);
  const [shapes, setShapes] = useState<Shape[]>(initial?.shapes ?? []);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState<ColorKey>("amber");
  const [draft, setDraft] = useState<Shape | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const svgRef = useRef<SVGSVGElement>(null);

  const h = aspect ? VIEW_W / aspect : 0;

  const commit = useCallback(
    (next: Shape[]) => {
      setHistory((hst) => [...hst.slice(-49), shapes]);
      setShapes(next);
      setDirty(true);
      setSaved(false);
    },
    [shapes],
  );

  const undo = useCallback(() => {
    setHistory((hst) => {
      if (!hst.length) return hst;
      setShapes(hst[hst.length - 1]);
      setDirty(true);
      setSelected(null);
      return hst.slice(0, -1);
    });
  }, []);

  const removeSelected = useCallback(() => {
    if (!selected) return;
    commit(shapes.filter((s) => s.id !== selected));
    setSelected(null);
  }, [selected, shapes, commit]);

  const save = () => {
    if (!aspect) return;
    startTransition(async () => {
      await updateScreenshot(id, { annotations: { aspect, shapes } });
      setDirty(false);
      setSaved(true);
    });
  };

  // Keyboard: tool shortcuts, undo, delete, save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (textAt || (e.target as HTMLElement)?.closest("input, textarea")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        removeSelected();
      } else if (!e.metaKey && !e.ctrlKey) {
        const t = tools.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
        if (t) setTool(t.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const point = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * VIEW_W,
      y: ((e.clientY - r.top) / r.height) * h,
    };
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!aspect) return;
    const p = point(e);
    if (tool === "select") {
      const hit = (e.target as Element).closest("[data-shape]")?.getAttribute("data-shape");
      setSelected(hit ?? null);
      return;
    }
    if (tool === "text") {
      setTextAt(p);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({ id: newId(), kind: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color });
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draft || draft.kind === "text") return;
    const p = point(e);
    // Level lines snap horizontal unless Shift is held.
    const y2 = draft.kind === "line" && !e.shiftKey ? draft.y1 : p.y;
    setDraft({ ...draft, x2: p.x, y2 });
  };

  const onUp = () => {
    if (!draft || draft.kind === "text") return;
    const big = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 8;
    if (big) commit([...shapes, draft]);
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              aria-pressed={tool === t.id}
              title={`${t.label} (${t.key})`}
              aria-label={t.label}
              className={cn(
                "grid size-7 place-items-center rounded-[5px] transition-colors",
                tool === t.id ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_var(--input)]" : "text-faint hover:text-foreground",
              )}
            >
              <t.icon className="size-4" strokeWidth={1.5} />
            </button>
          ))}
        </div>
        <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-card px-1.5">
          {(Object.keys(colors) as ColorKey[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
                if (selected) commit(shapes.map((s) => (s.id === selected ? { ...s, color: c } : s)));
              }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={cn("size-4 rounded-full transition-transform", color === c && "ring-2 ring-foreground/70 ring-offset-2 ring-offset-card")}
              style={{ backgroundColor: colors[c] }}
            />
          ))}
        </div>
        <button type="button" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)" aria-label="Undo" className="grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30">
          <Undo2 className="size-4" strokeWidth={1.5} />
        </button>
        <button type="button" onClick={removeSelected} disabled={!selected} title="Delete selected (Del)" aria-label="Delete selected shape" className="grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30">
          <Trash2 className="size-4" strokeWidth={1.5} />
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[12px] text-faint" aria-live="polite">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : saved ? "Saved" : `${shapes.length} ${shapes.length === 1 ? "mark" : "marks"}`}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[10px] border border-border bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- served from the local API, not optimizable */}
        <img
          src={src}
          alt={alt}
          className="block w-full select-none"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (!aspect && img.naturalWidth) setAspect(img.naturalWidth / img.naturalHeight);
          }}
        />
        {aspect && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${h}`}
            className={cn("absolute inset-0 size-full touch-none", tool === "select" ? "cursor-default" : tool === "text" ? "cursor-text" : "cursor-crosshair")}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            <ArrowMarkers />
            {shapes.map((s) => (
              <g key={s.id} data-shape={s.id} className={tool === "select" ? "cursor-pointer" : undefined}>
                <ShapeView shape={s} selected={s.id === selected} />
              </g>
            ))}
            {draft && <ShapeView shape={draft} />}
          </svg>
        )}
        {textAt && aspect && (
          <TextInput
            left={`${(textAt.x / VIEW_W) * 100}%`}
            top={`${(textAt.y / h) * 100}%`}
            color={colors[color]}
            onDone={(text) => {
              if (text.trim()) commit([...shapes, { id: newId(), kind: "text", x1: textAt.x, y1: textAt.y, text: text.trim(), color }]);
              setTextAt(null);
            }}
          />
        )}
      </div>
      <p className="text-[12px] text-faint">
        Drag to draw. Level lines stay horizontal; hold Shift to angle them. Select a mark to recolor or delete it.
      </p>
    </div>
  );
}

function TextInput({ left, top, color, onDone }: { left: string; top: string; color: string; onDone: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(v);
        if (e.key === "Escape") onDone("");
      }}
      onBlur={() => onDone(v)}
      placeholder="Label"
      aria-label="Annotation text"
      className="absolute h-7 min-w-32 -translate-y-1/2 rounded border border-input bg-popover px-2 text-[13px] font-semibold outline-none"
      style={{ left, top, color }}
    />
  );
}
