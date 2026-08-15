'use client';

import type { TemplateElement, TemplateField } from '@/domain/entities/ThumbnailEntity';

/**
 * Layer (z-order) panel. Overlap on the canvas = array order (WYSIWYG): the later
 * an element sits in `elements[]`, the higher it renders. This list shows overlay
 * elements top-first (array end → list top) with ▲(forward)/▼(backward) reorder
 * buttons. The productImage base is pinned as the bottom row and is not reorderable.
 * File: src/app/dashboard/thumbnail-templates/components/LayerListPanel.tsx
 */
interface LayerListPanelProps {
  elements: TemplateElement[];
  fields: TemplateField[];
  assetNames: Record<string, string>; // storageKey → display name for fixed images
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMove: (index: number, dir: 1 | -1) => void;
}

function elementLabel(el: TemplateElement, fields: TemplateField[], assetNames: Record<string, string>): string {
  if (el.type === 'image' && el.bind === 'productImage') return '상품 사진';
  if (el.type === 'text') return fields.find((f) => f.key === el.bind)?.label ?? el.bind ?? '텍스트';
  return (el.src && assetNames[el.src]) || el.src || '이미지';
}

const rowCls = (selected: boolean) =>
  `flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm ${
    selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-800'
  }`;

const moveBtnCls = 'rounded border border-gray-300 px-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-30';

export function LayerListPanel({ elements, fields, assetNames, selectedIndex, onSelect, onMove }: LayerListPanelProps) {
  // Overlay indices (everything above the base at index 0), top-first.
  const overlayIndices = elements.map((_, i) => i).filter((i) => i >= 1).reverse();
  const lastIndex = elements.length - 1;

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">레이어 순서</h3>
      <div className="space-y-1.5">
        {overlayIndices.map((index) => {
          const el = elements[index];
          return (
            <div key={index} className={rowCls(index === selectedIndex)}>
              <button type="button" onClick={() => onSelect(index)} className="min-w-0 flex-1 truncate text-left">
                {elementLabel(el, fields, assetNames)}
              </button>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={index === lastIndex}
                  title="앞으로"
                  className={moveBtnCls}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 1}
                  title="뒤로"
                  className={moveBtnCls}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
        {/* Product-image base: always bottom, not reorderable. */}
        {elements.length > 0 && (
          <button
            type="button"
            onClick={() => onSelect(0)}
            className={`${rowCls(selectedIndex === 0)} w-full text-left`}
          >
            <span className="min-w-0 flex-1 truncate">상품 사진 (자동, 최하단)</span>
          </button>
        )}
      </div>
    </div>
  );
}
