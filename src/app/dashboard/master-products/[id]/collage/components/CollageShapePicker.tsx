'use client';

import type { CollageShape } from '@/domain/entities/CollageEntity';
import { SHAPE_LABEL, cellRects, initialLines, initialMain } from '@/domain/collage/collageGeometry';

interface CollageShapePickerProps {
  shapes: CollageShape[];
  count: number;
  value: CollageShape;
  disabled: boolean;
  onPick: (shape: CollageShape) => void;
}

const THUMB_W = 64;
const THUMB_H = 48;

/**
 * Shape choice with a small preview per shape (FEATURE_2610_21 D25 · D30).
 * File: src/app/dashboard/master-products/[id]/collage/components/CollageShapePicker.tsx
 */
export function CollageShapePicker({ shapes, count, value, disabled, onPick }: CollageShapePickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {shapes.map((shape) => {
        const rects = cellRects(
          {
            shape,
            main: initialMain(shape),
            lines: initialLines(shape, count),
            gap: 0,
            gapColor: '#FFFFFF',
            useTemplate: true,
            cells: [],
          },
          THUMB_W,
          THUMB_H,
        );
        return (
          <button
            key={shape}
            type="button"
            disabled={disabled}
            onClick={() => onPick(shape)}
            className={`flex flex-col items-center gap-1 rounded border p-2 text-xs disabled:opacity-50 ${
              value === shape ? 'border-blue-600 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="relative block bg-gray-100" style={{ width: THUMB_W, height: THUMB_H }}>
              {rects.map((r, i) => (
                <span
                  key={i}
                  className="absolute border border-white bg-gray-300"
                  style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                />
              ))}
            </span>
            {SHAPE_LABEL[shape]}
          </button>
        );
      })}
    </div>
  );
}
