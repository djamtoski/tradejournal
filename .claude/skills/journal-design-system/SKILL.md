---
name: journal-design-system
description: Visual rules for this trading journal app (Linear-style calm dark). Use before building or changing any screen, component, chart or table in this repo, and when adding Watermelon UI or shadcn components.
---

# Trading journal design system

Direction: **Linear calm dark**. Quiet, precise, data-first. Restraint is the
brand: near-black warm surfaces, hairline borders, one accent used sparingly,
green/red reserved strictly for P&L meaning.

All tokens live in `src/app/globals.css` (`:root`, dark is the default and only
theme for now). Always use the Tailwind token classes (`bg-card`,
`text-muted-foreground`, `border-border`, `text-profit`) — never raw hex in
components.

## Tokens

| Role | Token / class | Value |
|---|---|---|
| Page ground | `bg-background` | `#08090A` |
| Surface 1 (cards, sidebar) | `bg-card` / `bg-sidebar` | `#101113` |
| Surface 2 (inputs, hover rows, chips) | `bg-muted` / `bg-secondary` | `#16171C` |
| Surface 3 (raised, popovers) | `bg-popover` | `#1E1F25` |
| Hairline | `border-border` | `rgba(255,255,255,0.06)` |
| Strong hairline (hover/focus) | `border-input` | `rgba(255,255,255,0.10)` |
| Primary text | `text-foreground` | `#F7F8F8` |
| Secondary text | `text-muted-foreground` | `#9CA3AF` |
| Faint text (labels, axes) | `text-faint` | `#6B7280` |
| Accent (focus, active nav, selected) | `text-primary` / `bg-primary` | `#5E6AD2` |
| Profit | `text-profit` / `bg-profit` | `#4CB782` |
| Loss | `text-loss` / `bg-loss` | `#EB5757` |

Accent covers < 5% of pixels: active nav item indicator, focus rings, the
primary button (max one per view), selected filter chips. Never as a page or
card background.

Green/red mean money up/down only. Never use them for decoration, success
toasts, or status badges unrelated to P&L.

## Typography

- Display / headings: **Inter Tight** 600, letter-spacing `-0.02em` (`font-heading`).
- Body / UI: **Inter** 400–500, 13–14px (`font-sans`). Sidebar and tables at 13px.
- Numbers: **Geist Mono** with `tabular-nums` (`font-mono tabular-nums`, or the
  `.num` utility). Every price, P&L, percentage and count in tables, KPI cards
  and axes uses it, right-aligned in columns.
- Sizes: 11 (axis/labels, uppercase not allowed — use sentence case), 12, 13,
  14 (body), 20 (page title), 28 (KPI value). Nothing larger in app screens.

## Spacing, radius, elevation, motion

- Spacing ladder: 4 / 8 / 12 / 16 / 24 / 40 / 64. Page padding 24, card padding 16, gaps 12–16.
- Radius: 6 small controls, 10 cards, 12 large panels. Never above 16, never pill-shaped buttons.
- Elevation: hairline borders, not shadows. Only popovers get `0 8px 24px rgba(0,0,0,0.4)`.
- Motion: 150ms ease-out for hover/press; 350ms `cubic-bezier(0.22,1,0.36,1)` for
  layout. No bounce, no glow, no gradients outside empty states.

## Layout

- App shell: fixed 232px sidebar (`bg-sidebar`, right hairline) + content.
  Content max-width 1400px. Sticky top bar (48px) holds page title left and the
  global filter bar right.
- Sidebar items: 13px, 32px tall, icon 16px (lucide, 1.5 stroke). Active item:
  `bg-muted` + 2px accent bar on the left + `text-foreground`.
- Keyboard-first: show shortcut chips (`kbd` in `bg-muted`, mono 11px) next to nav items and commands.

## Components

- **KPI card**: label (12px, `text-muted-foreground`) → value (28px mono) →
  delta or sparkline. Value colored by sign only when it is P&L.
- **Tables / trade lists**: dense bordered rows (36px), hairline separators, no
  zebra stripes, hover `bg-muted`. Numbers right-aligned mono. Symbol in 500 weight.
- **Charts** (Recharts): no chart junk. Gridlines `rgba(255,255,255,0.04)`
  horizontal only, axes in `text-faint` 11px mono, no axis lines. Equity curve
  uses accent stroke 1.5px with a 6%-opacity area fill. P&L bars: profit/loss
  colors. Tooltips use `bg-popover` + hairline.
- **Calendar cells**: P&L tint at 12% opacity of profit/loss color, value in mono.
- **Empty states**: an invitation — headline naming the space, one line,
  one verb CTA ("Import trades").

## Watermelon UI and shadcn

- Install from the registry: `npx shadcn@latest add @watermelon/<name>` (base
  shadcn primitives: `npx shadcn@latest add <name>`). Files land in
  `src/components/watermelon-ui/` and `src/components/ui/`.
- Read every installed file before using it. Then **re-skin it to these tokens**:
  replace hardcoded colors, gradients, large radii, glows and bouncy springs.
  Keep the structure and interaction, drop the decoration.
- Prefer composing existing primitives over adding new dependencies.

## Copy

Sentence case everywhere, verb-first buttons, no "successfully", no "!", no
"please". Errors say what happened and what to do.

## Avoid

Pure black `#000`, pure white text, colored shadows, gradient buttons, emoji,
radius > 16, more than one primary button per view, centered marketing heroes
inside the app, Inter at default weight for headings.
