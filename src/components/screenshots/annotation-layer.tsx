import { colors, VIEW_W, type Annotations, type Shape } from "@/lib/screenshots/annotations";

const STROKE = 4;
const FONT = 30;

/** Read-only SVG overlay. Sized to cover its positioned parent. */
export function AnnotationLayer({ annotations, className }: { annotations: Annotations | null; className?: string }) {
  if (!annotations?.shapes.length) return null;
  const h = VIEW_W / annotations.aspect;
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${h}`}
      className={className ?? "pointer-events-none absolute inset-0 size-full"}
      aria-hidden="true"
    >
      <ArrowMarkers />
      {annotations.shapes.map((s) => (
        <ShapeView key={s.id} shape={s} />
      ))}
    </svg>
  );
}

export function ArrowMarkers() {
  return (
    <defs>
      {Object.entries(colors).map(([key, hex]) => (
        <marker key={key} id={`arrow-${key}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={hex} />
        </marker>
      ))}
    </defs>
  );
}

export function ShapeView({ shape: s, selected }: { shape: Shape; selected?: boolean }) {
  const color = colors[s.color];
  const halo = selected ? { filter: "drop-shadow(0 0 4px rgb(255 255 255 / 0.9))" } : undefined;

  if (s.kind === "text") {
    return (
      <text
        x={s.x1}
        y={s.y1}
        fill={color}
        fontSize={FONT}
        fontFamily="var(--font-inter), system-ui, sans-serif"
        fontWeight={600}
        paintOrder="stroke"
        stroke="rgb(0 0 0 / 0.75)"
        strokeWidth={6}
        strokeLinejoin="round"
        dominantBaseline="middle"
        style={halo}
      >
        {s.text}
      </text>
    );
  }
  if (s.kind === "box") {
    return (
      <rect
        x={Math.min(s.x1, s.x2)}
        y={Math.min(s.y1, s.y2)}
        width={Math.abs(s.x2 - s.x1)}
        height={Math.abs(s.y2 - s.y1)}
        fill={`${color}1f`}
        stroke={color}
        strokeWidth={STROKE}
        rx={4}
        style={halo}
      />
    );
  }
  return (
    <line
      x1={s.x1}
      y1={s.y1}
      x2={s.x2}
      y2={s.y2}
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeDasharray={s.kind === "line" ? "12 10" : undefined}
      markerEnd={s.kind === "arrow" ? `url(#arrow-${s.color})` : undefined}
      style={halo}
    />
  );
}
