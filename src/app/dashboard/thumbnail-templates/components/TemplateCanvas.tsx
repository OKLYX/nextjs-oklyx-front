'use client';

import { useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import type { BackgroundMode, TemplateElement } from '@/domain/entities/ThumbnailEntity';

/**
 * Visual template canvas. Renders each element as a draggable/resizable box
 * (react-rnd) over a scaled-down canvas.
 *
 * ⚠️ COORDINATE RULE (easiest thing to get wrong):
 * - Elements are stored in ORIGINAL canvas coordinates (px).
 * - react-rnd works in SCREEN px → multiply by `scale` to display, divide by
 *   `scale` to persist. Both directions are handled here.
 *
 * SMART ALIGNMENT GUIDES (photoshop-style, live sticky snap):
 * - While dragging, the box visually STICKS to alignment targets (canvas
 *   center/edges + other elements' center/edges) and magenta guide lines show.
 * - Sticky hysteresis: a target is grabbed within SNAP_ACQUIRE px and held until
 *   the pointer moves past the wider SNAP_RELEASE px. Inside the sticky zone the
 *   box stays perfectly still on the guide → easy precise centering.
 *
 * ⚠️ HOW THE BOX ACTUALLY FREEZES (react-rnd internals, do not "simplify"):
 * - During a drag react-draggable renders at its INTERNAL state.x (cursor), and
 *   IGNORES the controlled `position` prop (see Draggable render:
 *   `x = dragging ? state.x : position.x`). So setting `position` to the snapped
 *   value does NOT move the box mid-drag — only on release.
 * - To pin the box on the guide DURING drag we use react-rnd's
 *   `dragPositionOffset` (→ react-draggable `positionOffset`), a pure transform
 *   delta added on top of state.x. We set it to `snapped - cursor`, so the box
 *   renders exactly on the target while the cursor moves within the sticky zone.
 * - The snap decision reads the cursor position `d.x` (clean — we do NOT feed a
 *   snapped value back into `position`, which would pollute `d.x` and cause
 *   lock/unlock jitter). The `snapped - d.x` delta is coordinate-invariant, so
 *   react-rnd's bounds offset cancels out.
 *
 * Guides are edit-only aids — they do NOT change the save format (only the final
 * `region` coordinate is committed, still divided by scale).
 * File: src/app/dashboard/thumbnail-templates/components/TemplateCanvas.tsx
 */
interface TemplateCanvasProps {
  elements: TemplateElement[];
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  backgroundMode: BackgroundMode;
  gradientTopColor: string | null;
  gradientBottomColor: string | null;
  assetNames: Record<string, string>; // storageKey → display name for fixed images
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onRegionChange: (index: number, region: Partial<TemplateElement['region']>) => void;
}

const GRAY = '#808080'; // matches backend Color(0x80,0x80,0x80)

const SNAP_ACQUIRE = 6; // px to grab a target while free (screen px)
const SNAP_RELEASE = 24; // px to break away once locked → "sticky" pause on the guide

// Target priority for tie-break (lower = stronger): canvas center > canvas edge
// > element center > element edge. Applied only when |diff| ties within ±1px.
const P_CANVAS_CENTER = 0;
const P_CANVAS_EDGE = 1;
const P_ELEMENT_CENTER = 2;
const P_ELEMENT_EDGE = 3;

interface SnapTarget {
  pos: number; // target line position (screen px)
  priority: number;
}

/**
 * For one axis, find the closest snapping target for the dragged box.
 * `low` = dragged left/top (screen px), `size` = dragged w/h (screen px).
 * `lockedPos` = the target the axis is currently snapped to (or null); it keeps
 * matching up to SNAP_RELEASE px so the box "sticks" to an active guide.
 * Returns the snapped low-coordinate + the guide line position, or null.
 */
function computeAxisSnap(
  low: number,
  size: number,
  targets: SnapTarget[],
  lockedPos: number | null
) {
  // The three snap edges of the dragged box; `offset` converts a target line
  // position into the box's low coordinate: snapped = target - offset.
  const edges = [
    { value: low, offset: 0 }, // low edge (left/top)
    { value: low + size / 2, offset: size / 2 }, // center
    { value: low + size, offset: size }, // high edge (right/bottom)
  ];

  let best: { diff: number; priority: number; snapped: number; guide: number } | null = null;
  for (const t of targets) {
    // Already-locked target gets the wider break threshold (hysteresis).
    const threshold =
      lockedPos !== null && Math.abs(t.pos - lockedPos) < 0.5 ? SNAP_RELEASE : SNAP_ACQUIRE;
    for (const e of edges) {
      const diff = Math.abs(e.value - t.pos);
      if (diff > threshold) continue;
      const cand = { diff, priority: t.priority, snapped: t.pos - e.offset, guide: t.pos };
      if (best === null) {
        best = cand;
        continue;
      }
      // Primary: smaller |diff|. Tie (within ±1px): stronger (lower) priority.
      if (Math.abs(cand.diff - best.diff) <= 1) {
        if (cand.priority !== best.priority ? cand.priority < best.priority : cand.diff < best.diff) {
          best = cand;
        }
      } else if (cand.diff < best.diff) {
        best = cand;
      }
    }
  }
  return best ? { snapped: best.snapped, guide: best.guide } : null;
}

// Live background preview matching the backend renderer's paintBackground.
// GRADIENT_AUTO has no product image here → gray placeholder (same as backend preview fallback).
function backgroundStyle(
  mode: BackgroundMode,
  top: string | null,
  bottom: string | null
): string {
  switch (mode) {
    case 'BLACK':
      return '#000000';
    case 'GRAY':
      return GRAY;
    case 'GRADIENT_MANUAL':
      return top && bottom ? `linear-gradient(to bottom, ${top}, ${bottom})` : GRAY;
    case 'GRADIENT_AUTO':
      return GRAY;
    case 'WHITE':
    default:
      return '#ffffff';
  }
}

export function TemplateCanvas({
  elements,
  canvasWidth,
  canvasHeight,
  scale,
  backgroundMode,
  gradientTopColor,
  gradientBottomColor,
  assetNames,
  selectedIndex,
  onSelect,
  onRegionChange,
}: TemplateCanvasProps) {
  const displayW = canvasWidth * scale;
  const displayH = canvasHeight * scale;

  // Active guide lines (screen px) shown while dragging.
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  // Visual transform delta (snapped - cursor) that pins the dragged box on the
  // guide. Applied via react-rnd `dragPositionOffset`.
  const [offset, setOffset] = useState<{ index: number; x: number; y: number } | null>(null);
  // Currently-locked guide position per axis (for sticky hysteresis). Ref so it
  // is read synchronously within a drag gesture without extra re-renders.
  const sticky = useRef<{ vx: number | null; hy: number | null }>({ vx: null, hy: null });

  const clearDrag = () => {
    setOffset(null);
    setGuides({ v: [], h: [] });
    sticky.current = { vx: null, hy: null };
  };

  // Build snap targets (canvas + every OTHER element) and resolve x/y snap for a
  // dragged box whose cursor-following top-left is (px, py) in screen px.
  const resolveSnap = (index: number, px: number, py: number) => {
    const dragged = elements[index];
    const w = dragged.region.w * scale;
    const h = dragged.region.h * scale;

    const xTargets: SnapTarget[] = [
      { pos: displayW / 2, priority: P_CANVAS_CENTER },
      { pos: 0, priority: P_CANVAS_EDGE },
      { pos: displayW, priority: P_CANVAS_EDGE },
    ];
    const yTargets: SnapTarget[] = [
      { pos: displayH / 2, priority: P_CANVAS_CENTER },
      { pos: 0, priority: P_CANVAS_EDGE },
      { pos: displayH, priority: P_CANVAS_EDGE },
    ];

    elements.forEach((el, i) => {
      if (i === index) return;
      const l = el.region.x * scale;
      const r = (el.region.x + el.region.w) * scale;
      const cx = (el.region.x + el.region.w / 2) * scale;
      const t = el.region.y * scale;
      const b = (el.region.y + el.region.h) * scale;
      const cy = (el.region.y + el.region.h / 2) * scale;
      xTargets.push(
        { pos: cx, priority: P_ELEMENT_CENTER },
        { pos: l, priority: P_ELEMENT_EDGE },
        { pos: r, priority: P_ELEMENT_EDGE }
      );
      yTargets.push(
        { pos: cy, priority: P_ELEMENT_CENTER },
        { pos: t, priority: P_ELEMENT_EDGE },
        { pos: b, priority: P_ELEMENT_EDGE }
      );
    });

    const xSnap = computeAxisSnap(px, w, xTargets, sticky.current.vx);
    const ySnap = computeAxisSnap(py, h, yTargets, sticky.current.hy);
    return { xSnap, ySnap };
  };

  const handleDrag = (index: number, px: number, py: number) => {
    const { xSnap, ySnap } = resolveSnap(index, px, py);
    sticky.current = { vx: xSnap ? xSnap.guide : null, hy: ySnap ? ySnap.guide : null };
    // Pin the box on the target: offset = snapped - cursor (0 when free).
    setOffset({ index, x: xSnap ? xSnap.snapped - px : 0, y: ySnap ? ySnap.snapped - py : 0 });
    setGuides({ v: xSnap ? [xSnap.guide] : [], h: ySnap ? [ySnap.guide] : [] });
  };

  return (
    <div
      className="relative border border-gray-300 shadow-inner"
      style={{
        width: displayW,
        height: displayH,
        background: backgroundStyle(backgroundMode, gradientTopColor, gradientBottomColor),
      }}
    >
      {elements.map((el, index) => {
        const selected = index === selectedIndex;
        const off = offset?.index === index ? offset : null;
        return (
          <Rnd
            key={index}
            bounds="parent"
            size={{ width: el.region.w * scale, height: el.region.h * scale }}
            position={{ x: el.region.x * scale, y: el.region.y * scale }}
            dragPositionOffset={off ? { x: off.x, y: off.y } : undefined}
            onMouseDown={() => onSelect(index)}
            onDragStart={() => {
              sticky.current = { vx: null, hy: null };
            }}
            onDrag={(_e, d) => handleDrag(index, d.x, d.y)}
            onDragStop={(_e, d) => {
              const { xSnap, ySnap } = resolveSnap(index, d.x, d.y);
              onRegionChange(index, {
                x: Math.round((xSnap ? xSnap.snapped : d.x) / scale),
                y: Math.round((ySnap ? ySnap.snapped : d.y) / scale),
              });
              clearDrag();
            }}
            onResizeStop={(_e, _dir, ref, _delta, pos) =>
              onRegionChange(index, {
                w: Math.round(ref.offsetWidth / scale),
                h: Math.round(ref.offsetHeight / scale),
                x: Math.round(pos.x / scale),
                y: Math.round(pos.y / scale),
              })
            }
            className={`flex items-center justify-center overflow-hidden text-center text-[10px] leading-tight ${
              selected
                ? 'border-2 border-blue-600 bg-blue-600/10'
                : 'border border-dashed border-gray-500 bg-gray-500/10'
            }`}
          >
            <span className="pointer-events-none select-none px-1 text-gray-800">
              {el.type === 'text'
                ? `text: ${el.bind ?? '?'}`
                : el.bind === 'productImage'
                  ? '상품 사진'
                  : `이미지: ${(el.src && assetNames[el.src]) || el.src || '?'}`}
            </span>
          </Rnd>
        );
      })}

      {/* Smart alignment guides (rendered above elements). pointer-events-none so
          they never block drag/click. Magenta = photoshop-style guide color. */}
      {guides.v.map((x, i) => (
        <div
          key={`v${i}`}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-pink-500"
          style={{ left: x }}
        />
      ))}
      {guides.h.map((y, i) => (
        <div
          key={`h${i}`}
          className="pointer-events-none absolute left-0 right-0 h-px bg-pink-500"
          style={{ top: y }}
        />
      ))}
    </div>
  );
}
