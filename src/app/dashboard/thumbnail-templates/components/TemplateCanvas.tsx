'use client';

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
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onRegionChange: (index: number, region: Partial<TemplateElement['region']>) => void;
}

const GRAY = '#808080'; // matches backend Color(0x80,0x80,0x80)

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
  selectedIndex,
  onSelect,
  onRegionChange,
}: TemplateCanvasProps) {
  const displayW = canvasWidth * scale;
  const displayH = canvasHeight * scale;

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
        return (
          <Rnd
            key={index}
            bounds="parent"
            size={{ width: el.region.w * scale, height: el.region.h * scale }}
            position={{ x: el.region.x * scale, y: el.region.y * scale }}
            onMouseDown={() => onSelect(index)}
            onDragStop={(_e, d) =>
              onRegionChange(index, {
                x: Math.round(d.x / scale),
                y: Math.round(d.y / scale),
              })
            }
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
              {el.type}: {el.type === 'text' ? el.bind ?? '?' : el.bind ?? el.src ?? 'image'}
            </span>
          </Rnd>
        );
      })}
    </div>
  );
}
