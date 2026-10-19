'use client';

import { useRef, useState, type PointerEvent } from 'react';
import type { CollageLayout, CollageProductView } from '@/domain/entities/CollageEntity';
import {
  boundaries,
  cellRects,
  clamp,
  moveBoundary,
  photoBox,
  swapCells,
  type Boundary,
} from '@/domain/collage/collageGeometry';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';

export interface PhotoSize {
  w: number;
  h: number;
}

interface CollageCanvasProps {
  layout: CollageLayout;
  products: CollageProductView[];
  /** Display size in pixels (the collage's aspect ratio). */
  width: number;
  height: number;
  /** Natural photo sizes by product id (reported through `onPhotoSize`). */
  photoSizes: Record<number, PhotoSize>;
  onPhotoSize: (productId: number, size: PhotoSize) => void;
  /** true = shown dimmed for an inherited collage — no pointer handling. */
  readOnly?: boolean;
  selected?: number | null;
  onSelect?: (index: number) => void;
  onChange?: (layout: CollageLayout) => void;
}

type Drag =
  | { kind: 'pan'; index: number; x: number; y: number; start: CollageLayout; boxW: number; boxH: number }
  | { kind: 'bound'; boundary: Boundary; x: number; y: number; start: CollageLayout };

const HANDLE_HIT = 10;

/**
 * Collage editor surface (FEATURE_2610_21 D26 · D27 · D28 · D29 · D35) — browser pointer events only, no drag
 * library.
 * File: src/app/dashboard/master-products/[id]/collage/components/CollageCanvas.tsx
 *
 * | Gesture | Result |
 * |---|---|
 * | drag a photo and release inside its own cell | moves the photo (cx · cy, 0..1) |
 * | drag a photo and release over another cell | swaps the two cells (the pan of this drag is dropped) |
 * | drag a line between cells | resizes the two neighbouring cells (each ≥ 10% of the line) |
 * | drag the big-cell edge | resizes the big cell (10%..90%) |
 *
 * The photo is clipped to its cell (`overflow-hidden`); an empty part of a cell shows gray when the template is
 * used (the template background shows there) and white when it is not (D19 · D50). The real thumbnail is the
 * server preview.
 */
export function CollageCanvas({
  layout,
  products,
  width,
  height,
  photoSizes,
  onPhotoSize,
  readOnly = false,
  selected = null,
  onSelect,
  onChange,
}: CollageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const rects = cellRects(layout, width, height);
  const bounds = readOnly ? [] : boundaries(layout, width, height, HANDLE_HIT);
  const productById = new Map(products.map((p) => [p.productId, p]));

  const cellAt = (clientX: number, clientY: number): number | null => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return null;
    const x = clientX - box.left;
    const y = clientY - box.top;
    const index = rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    return index < 0 ? null : index;
  };

  const startPan = (e: PointerEvent<HTMLDivElement>, index: number) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect?.(index);
    const cell = layout.cells[index];
    const size = photoSizes[cell.productId];
    const r = rects[index];
    const box = size ? photoBox(cell, r.w, r.h, size.w, size.h) : null;
    dragRef.current = {
      kind: 'pan', index, x: e.clientX, y: e.clientY, start: layout, boxW: box?.w ?? 0, boxH: box?.h ?? 0,
    };
  };

  const startBound = (e: PointerEvent<HTMLDivElement>, boundary: Boundary) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind: 'bound', boundary, x: e.clientX, y: e.clientY, start: layout };
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !onChange) return;
    if (drag.kind === 'bound') {
      const delta = drag.boundary.axis === 'x' ? e.clientX - drag.x : e.clientY - drag.y;
      onChange(moveBoundary(layout, drag.boundary, drag.start, delta / drag.boundary.span));
      return;
    }
    const target = cellAt(e.clientX, e.clientY);
    setHover(target !== null && target !== drag.index ? target : null);
    if (drag.boxW <= 0 || drag.boxH <= 0) return;
    const startCell = drag.start.cells[drag.index];
    const cells = [...drag.start.cells];
    cells[drag.index] = {
      ...startCell,
      cx: clamp(startCell.cx - (e.clientX - drag.x) / drag.boxW, 0, 1),
      cy: clamp(startCell.cy - (e.clientY - drag.y) / drag.boxH, 0, 1),
    };
    onChange({ ...drag.start, cells });
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setHover(null);
    if (!drag || drag.kind !== 'pan' || !onChange) return;
    const target = cellAt(e.clientX, e.clientY);
    if (target !== null && target !== drag.index) {
      onChange(swapCells(drag.start, drag.index, target));
      onSelect?.(target);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative touch-none select-none"
      style={{ width, height, backgroundColor: layout.gapColor }}
    >
      {rects.map((r, i) => {
        const cell = layout.cells[i];
        if (!cell) return null;
        const product = productById.get(cell.productId);
        const size = photoSizes[cell.productId];
        const box = size ? photoBox(cell, r.w, r.h, size.w, size.h) : null;
        return (
          <div
            key={i}
            className={`absolute overflow-hidden ${layout.useTemplate ? 'bg-gray-100' : 'bg-white'} ${
              readOnly ? '' : 'cursor-grab'
            }`}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
            onPointerDown={(e) => startPan(e, i)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            {product?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveThumbUrl(product.imageUrl)}
                alt={product.productName}
                draggable={false}
                onLoad={(e) =>
                  onPhotoSize(cell.productId, { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                }
                className="pointer-events-none absolute max-w-none"
                style={box ? { left: box.x, top: box.y, width: box.w, height: box.h } : { opacity: 0 }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] text-gray-500">
                사진 없음 — {product?.productName ?? cell.productId}
              </div>
            )}
            {(selected === i || hover === i) && (
              <div
                className={`pointer-events-none absolute inset-0 border-2 ${
                  hover === i ? 'border-amber-500' : 'border-blue-500'
                }`}
              />
            )}
          </div>
        );
      })}
      {bounds.map((b, i) => (
        <div
          key={`b${i}`}
          className={`absolute z-10 ${b.axis === 'x' ? 'cursor-col-resize' : 'cursor-row-resize'} hover:bg-blue-500/30`}
          style={{ left: b.rect.x, top: b.rect.y, width: b.rect.w, height: b.rect.h }}
          onPointerDown={(e) => startBound(e, b)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      ))}
    </div>
  );
}
