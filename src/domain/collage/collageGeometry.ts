import type {
  CollageCell,
  CollageLayout,
  CollageProductView,
  CollageShape,
} from '@/domain/entities/CollageEntity';

/**
 * Thumbnail collage rules and geometry (FEATURE_2610_21) — pure functions for the editor screen.
 * File: src/domain/collage/collageGeometry.ts
 *
 * ⚠️ `shapesFor` · `initialLines` · `cellRects` · `minZoom` use the same formulas as the backend
 * `service/collage/CollageLayouts.java` — change both together. The real thumbnail is drawn by the server
 * (preview = server, D35).
 */

export const MIN_LINE = 0.1;
export const MIN_MAIN = 0.1;
export const MAX_MAIN = 0.9;
export const MAX_ZOOM = 4;
export const DEFAULT_GAP_COLOR = '#FFFFFF';

/** Shape names on screen (D30). */
export const SHAPE_LABEL: Record<CollageShape, string> = {
  ROW: '가로 한 줄',
  COLUMN: '세로 한 줄',
  LEFT_BIG: '왼쪽 큰 칸',
  TOP_BIG: '위쪽 큰 칸',
  TWO_ROWS: '두 줄',
};

/** One cell rectangle in pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A draggable boundary (D28): `main` = the big-cell edge, `line` = between cell `index` and `index + 1`. */
export interface Boundary {
  kind: 'main' | 'line';
  line: number;
  index: number;
  axis: 'x' | 'y';
  /** Hit box. */
  rect: Rect;
  /** Pixels that one whole ratio unit spans (line length minus its gaps, or total minus the gap for `main`). */
  span: number;
}

/** Shapes allowed for `n` photos (D30). */
export function shapesFor(n: number): CollageShape[] {
  if (n < 2) return [];
  if (n === 2) return ['ROW', 'COLUMN'];
  if (n === 3) return ['ROW', 'COLUMN', 'LEFT_BIG', 'TOP_BIG'];
  return ['ROW', 'COLUMN', 'LEFT_BIG', 'TOP_BIG', 'TWO_ROWS'];
}

const equal = (k: number): number[] => Array.from({ length: k }, () => 1 / k);

/** Initial line ratios (D47): every cell of a line the same size. */
export function initialLines(shape: CollageShape, n: number): number[][] {
  switch (shape) {
    case 'ROW':
    case 'COLUMN':
      return [equal(n)];
    case 'LEFT_BIG':
    case 'TOP_BIG':
      return [equal(n - 1)];
    case 'TWO_ROWS':
      return [equal(Math.ceil(n / 2)), equal(Math.floor(n / 2))];
  }
}

/** Initial big-cell ratio (D47): 0.5, null for ROW / COLUMN. */
export function initialMain(shape: CollageShape): number | null {
  return shape === 'ROW' || shape === 'COLUMN' ? null : 0.5;
}

/** A cell at its initial zoom and position (D33), on the cover photo (FEATURE_2610_32 D16). */
export function initialCell(productId: number): CollageCell {
  return { productId, zoom: 1, cx: 0.5, cy: 0.5, productImageId: null };
}

/** The first collage of a stage (D32): ROW, equal cells, gap 0, white gap, template on, ids in the given order. */
export function initialLayout(productIds: number[]): CollageLayout {
  return {
    shape: 'ROW',
    main: null,
    lines: initialLines('ROW', productIds.length),
    gap: 0,
    gapColor: DEFAULT_GAP_COLOR,
    useTemplate: true,
    cells: productIds.map(initialCell),
  };
}

/**
 * Shape change (D34): ratios and every cell's zoom/position back to initial, cell order kept; each cell keeps its
 * chosen photo (FEATURE_2610_32 D33).
 */
export function reshape(layout: CollageLayout, shape: CollageShape): CollageLayout {
  return {
    ...layout,
    shape,
    main: initialMain(shape),
    lines: initialLines(shape, layout.cells.length),
    cells: layout.cells.map((c) => ({ ...initialCell(c.productId), productImageId: c.productImageId })),
  };
}

/**
 * Photo URL (stored value) of one cell (FEATURE_2610_32 D15 · D17): the chosen photo while it is still in that
 * product's gallery, otherwise the cover photo; null = no photo (D18).
 */
export function cellPhotoUrl(cell: CollageCell, product: CollageProductView | undefined): string | null {
  if (!product) return null;
  const chosen =
    cell.productImageId == null
      ? undefined
      : product.images.find((i) => i.productImageId === cell.productImageId);
  return chosen?.imageUrl ?? product.imageUrl;
}

/** Photo change of one cell (FEATURE_2610_32 D18): the new photo at zoom 1 · centre. null = the cover photo. */
export function withCellPhoto(
  layout: CollageLayout,
  index: number,
  productImageId: number | null,
): CollageLayout {
  const cells = layout.cells.map((c, i) =>
    i === index ? { ...initialCell(c.productId), productImageId } : c,
  );
  return { ...layout, cells };
}

/** Swap two cells (D27) — the whole entry moves with its photo (zoom and position included). */
export function swapCells(layout: CollageLayout, a: number, b: number): CollageLayout {
  const cells = [...layout.cells];
  [cells[a], cells[b]] = [cells[b], cells[a]];
  return { ...layout, cells };
}

/** {start, size} per ratio along one line — cumulative rounding, the last cell ends at the line end. */
function segments(start: number, length: number, ratios: number[], gapPx: number): [number, number][] {
  const k = ratios.length;
  const avail = length - gapPx * (k - 1);
  const total = ratios.reduce((s, r) => s + r, 0);
  const out: [number, number][] = [];
  let cumulative = 0;
  let prevEnd = 0;
  for (let i = 0; i < k; i++) {
    cumulative += ratios[i];
    const end = i === k - 1 ? avail : Math.round((avail * cumulative) / total);
    out.push([start + prevEnd + i * gapPx, end - prevEnd]);
    prevEnd = end;
  }
  return out;
}

const splitX = (x: number, y: number, w: number, h: number, ratios: number[], gapPx: number): Rect[] =>
  segments(x, w, ratios, gapPx).map(([sx, sw]) => ({ x: sx, y, w: sw, h }));

const splitY = (x: number, y: number, w: number, h: number, ratios: number[], gapPx: number): Rect[] =>
  segments(y, h, ratios, gapPx).map(([sy, sh]) => ({ x, y: sy, w, h: sh }));

/** Gap in pixels (D44): round(gap × short side). */
export function gapPixels(layout: CollageLayout, width: number, height: number): number {
  return Math.round(layout.gap * Math.min(width, height));
}

/** Cell rectangles in cell order (D47) — same formula as the server. */
export function cellRects(layout: CollageLayout, width: number, height: number): Rect[] {
  const gapPx = gapPixels(layout, width, height);
  const lines = layout.lines;
  const main = layout.main ?? 0.5;
  switch (layout.shape) {
    case 'ROW':
      return splitX(0, 0, width, height, lines[0], gapPx);
    case 'COLUMN':
      return splitY(0, 0, width, height, lines[0], gapPx);
    case 'LEFT_BIG': {
      const bigW = Math.round((width - gapPx) * main);
      const x = bigW + gapPx;
      return [{ x: 0, y: 0, w: bigW, h: height }, ...splitY(x, 0, width - x, height, lines[0], gapPx)];
    }
    case 'TOP_BIG': {
      const bigH = Math.round((height - gapPx) * main);
      const y = bigH + gapPx;
      return [{ x: 0, y: 0, w: width, h: bigH }, ...splitX(0, y, width, height - y, lines[0], gapPx)];
    }
    case 'TWO_ROWS': {
      const topH = Math.round((height - gapPx) * main);
      const y = topH + gapPx;
      return [...splitX(0, 0, width, topH, lines[0], gapPx), ...splitX(0, y, width, height - y, lines[1], gapPx)];
    }
  }
}

/** Lowest zoom (D33): the whole photo fits the cell, relative to zoom 1 = covers the cell. */
export function minZoom(cellW: number, cellH: number, photoW: number, photoH: number): number {
  const cover = Math.max(cellW / photoW, cellH / photoH);
  const contain = Math.min(cellW / photoW, cellH / photoH);
  return contain / cover;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Where the photo sits inside its cell (D26 · D33): size = cover × zoom (zoom clamped to [minZoom, 4]), photo
 * point (cx, cy) (clamped to 0..1) at the cell centre. Returned box is relative to the cell's top-left corner.
 */
export function photoBox(cell: CollageCell, cellW: number, cellH: number, photoW: number, photoH: number): Rect {
  const cover = Math.max(cellW / photoW, cellH / photoH);
  const zoom = clamp(cell.zoom, minZoom(cellW, cellH, photoW, photoH), MAX_ZOOM);
  const w = photoW * cover * zoom;
  const h = photoH * cover * zoom;
  return {
    x: cellW / 2 - clamp(cell.cx, 0, 1) * w,
    y: cellH / 2 - clamp(cell.cy, 0, 1) * h,
    w,
    h,
  };
}

/** Draggable boundaries of a layout (D28); hit boxes are `hit` pixels wide, centred on the gap. */
export function boundaries(layout: CollageLayout, width: number, height: number, hit: number): Boundary[] {
  const gapPx = gapPixels(layout, width, height);
  const rects = cellRects(layout, width, height);
  const out: Boundary[] = [];
  const vertical = (x: number, y: number, h: number) => ({ x: x - hit / 2, y, w: hit, h });
  const horizontal = (x: number, y: number, w: number) => ({ x, y: y - hit / 2, w, h: hit });
  const lineBounds = (line: number, from: number, count: number, axis: 'x' | 'y', length: number) => {
    for (let i = 0; i < count - 1; i++) {
      const a = rects[from + i];
      const rect =
        axis === 'x' ? vertical(a.x + a.w + gapPx / 2, a.y, a.h) : horizontal(a.x, a.y + a.h + gapPx / 2, a.w);
      out.push({ kind: 'line', line, index: i, axis, rect, span: length - gapPx * (count - 1) });
    }
  };
  const n = layout.cells.length;
  switch (layout.shape) {
    case 'ROW':
      lineBounds(0, 0, n, 'x', width);
      break;
    case 'COLUMN':
      lineBounds(0, 0, n, 'y', height);
      break;
    case 'LEFT_BIG': {
      const big = rects[0];
      out.push({
        kind: 'main', line: 0, index: 0, axis: 'x',
        rect: vertical(big.w + gapPx / 2, 0, height), span: width - gapPx,
      });
      lineBounds(0, 1, n - 1, 'y', height);
      break;
    }
    case 'TOP_BIG': {
      const big = rects[0];
      out.push({
        kind: 'main', line: 0, index: 0, axis: 'y',
        rect: horizontal(0, big.h + gapPx / 2, width), span: height - gapPx,
      });
      lineBounds(0, 1, n - 1, 'x', width);
      break;
    }
    case 'TWO_ROWS': {
      const top = layout.lines[0].length;
      out.push({
        kind: 'main', line: 0, index: 0, axis: 'y',
        rect: horizontal(0, rects[0].h + gapPx / 2, width), span: height - gapPx,
      });
      lineBounds(0, 0, top, 'x', width);
      lineBounds(1, top, n - top, 'x', width);
      break;
    }
  }
  return out;
}

/**
 * Moves a boundary by `deltaRatio` (D28 · D34): `main` stays within 0.1..0.9; a line boundary moves size between
 * the two neighbouring cells, neither below 0.1 of the line.
 */
export function moveBoundary(
  layout: CollageLayout,
  boundary: Boundary,
  start: CollageLayout,
  deltaRatio: number,
): CollageLayout {
  if (boundary.kind === 'main') {
    return { ...layout, main: clamp((start.main ?? 0.5) + deltaRatio, MIN_MAIN, MAX_MAIN) };
  }
  const line = start.lines[boundary.line];
  const pair = line[boundary.index] + line[boundary.index + 1];
  const a = clamp(line[boundary.index] + deltaRatio, MIN_LINE, pair - MIN_LINE);
  const nextLine = [...line];
  nextLine[boundary.index] = a;
  nextLine[boundary.index + 1] = pair - a;
  const lines = start.lines.map((l, i) => (i === boundary.line ? nextLine : l));
  return { ...layout, lines };
}

/** Collage pixel size for a preview target (D39): template on → product-photo slot, otherwise the canvas. */
export function collageSize(
  useTemplate: boolean,
  target: { canvasWidth: number; canvasHeight: number; slotWidth: number | null; slotHeight: number | null },
): { width: number; height: number } {
  if (useTemplate && target.slotWidth && target.slotHeight) {
    return { width: target.slotWidth, height: target.slotHeight };
  }
  return { width: target.canvasWidth, height: target.canvasHeight };
}

/**
 * Whether the master can have a collage (D3) — 2+ components, the same rule as the backend
 * `MasterProductService.isBundle`. The screen only uses it to hide the entry points; save and preview are
 * judged by the server.
 */
export function isCollageMaster(master: { components: unknown[] }): boolean {
  return master.components.length >= 2;
}
