'use client';

import { useRef, useState } from 'react';
import type { TemplateElement, FontAsset, TemplateField } from '@/domain/entities/ThumbnailEntity';
import { AngleDial } from './AngleDial';

/**
 * Side panel that edits every property of the selected element EXCEPT position
 * (dragging on the canvas owns that — but numeric x/y/w/h inputs are provided
 * here for fine-tuning). The single source of truth is the editor's
 * `elements[]`; this panel emits patches via `onChange`.
 * File: src/app/dashboard/thumbnail-templates/components/ElementPropertyPanel.tsx
 */
interface ElementPropertyPanelProps {
  element: TemplateElement;
  fields: TemplateField[];
  fonts: FontAsset[];
  assetNames: Record<string, string>; // storageKey → display name for fixed images
  onChange: (patch: Partial<TemplateElement>) => void;
  onUploadFont: (file: File) => Promise<void>;
  onDelete: () => void;
}

const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const inputCls =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none';

export function ElementPropertyPanel({
  element,
  fields,
  fonts,
  assetNames,
  onChange,
  onUploadFont,
  onDelete,
}: ElementPropertyPanelProps) {
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFont, setIsUploadingFont] = useState(false);

  // The productImage base layer: read-only bind, cannot be deleted.
  const isProductBase = element.type === 'image' && element.bind === 'productImage';

  const setRegion = (patch: Partial<TemplateElement['region']>) =>
    onChange({ region: { ...element.region, ...patch } });
  const setAlign = (patch: Partial<TemplateElement['align']>) =>
    onChange({ align: { ...element.align, ...patch } });

  const handleFontFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (ext !== '.ttf' && ext !== '.otf') {
      alert('폰트는 .ttf 또는 .otf 파일만 업로드할 수 있습니다.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('폰트 파일은 5MB 이하만 업로드할 수 있습니다.');
      e.target.value = '';
      return;
    }
    setIsUploadingFont(true);
    try {
      await onUploadFont(file);
    } finally {
      setIsUploadingFont(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">요소 속성</h3>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{element.type}</span>
      </div>

      {/* bind — always read-only (element kind is fixed at creation). */}
      <div>
        <label className={labelCls}>데이터 필드</label>
        {element.type === 'text' ? (
          <p className={`${inputCls} bg-gray-50`}>
            {fields.find((f) => f.key === element.bind)?.label ?? element.bind}
          </p>
        ) : isProductBase ? (
          <p className={`${inputCls} bg-gray-50`}>상품 사진 (자동, 최하단)</p>
        ) : (
          <p className={`${inputCls} truncate bg-gray-50`}>
            고정 이미지: {(element.src && assetNames[element.src]) || element.src || '(없음)'}
          </p>
        )}
      </div>

      {/* alignment */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>수평 정렬</label>
          <select
            className={inputCls}
            value={element.align.h}
            onChange={(e) => setAlign({ h: e.target.value as TemplateElement['align']['h'] })}
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>수직 정렬</label>
          <select
            className={inputCls}
            value={element.align.v}
            onChange={(e) => setAlign({ v: e.target.value as TemplateElement['align']['v'] })}
          >
            <option value="top">top</option>
            <option value="center">center</option>
            <option value="bottom">bottom</option>
          </select>
        </div>
      </div>

      {/* position/size (numeric fine-tuning) */}
      <div>
        <label className={labelCls}>위치·크기 (x/y/w/h, 원본 px)</label>
        <div className="grid grid-cols-4 gap-2">
          <input type="number" className={inputCls} value={element.region.x} onChange={(e) => setRegion({ x: Number(e.target.value) })} />
          <input type="number" className={inputCls} value={element.region.y} onChange={(e) => setRegion({ y: Number(e.target.value) })} />
          <input type="number" className={inputCls} value={element.region.w} onChange={(e) => setRegion({ w: Number(e.target.value) })} />
          <input type="number" className={inputCls} value={element.region.h} onChange={(e) => setRegion({ h: Number(e.target.value) })} />
        </div>
      </div>

      {element.type === 'text' && (
        <>
          <div>
            <label className={labelCls}>폰트</label>
            <select
              className={inputCls}
              value={element.fontId ?? ''}
              onChange={(e) => onChange({ fontId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">(선택 안 함)</option>
              {fonts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.displayName} {f.source === 'BUNDLED' ? '(시스템)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fontInputRef.current?.click()}
              disabled={isUploadingFont}
              className="mt-2 rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {isUploadingFont ? '업로드 중...' : '폰트 업로드 (.ttf/.otf)'}
            </button>
            <input ref={fontInputRef} type="file" accept=".ttf,.otf" onChange={handleFontFile} hidden />
          </div>

          <div>
            <label className={labelCls}>색상{element.gradientColor != null ? ' (그라데이션 시작)' : ''}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-9 w-16 rounded border border-gray-300"
                value={element.color ?? '#000000'}
                onChange={(e) => onChange({ color: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={element.gradientColor != null}
                  onChange={(e) =>
                    onChange({ gradientColor: e.target.checked ? (element.gradientColor ?? '#ffffff') : null })
                  }
                />
                그라데이션
              </label>
              {element.gradientColor != null && (
                <input
                  type="color"
                  className="h-9 w-16 rounded border border-gray-300"
                  value={element.gradientColor}
                  onChange={(e) => onChange({ gradientColor: e.target.value })}
                />
              )}
            </div>
            {element.gradientColor != null && (
              <div className="mt-2 flex items-center gap-3">
                <AngleDial
                  value={element.gradientAngle ?? 0}
                  onChange={(deg) => onChange({ gradientAngle: deg })}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">각도(°)</label>
                  <input
                    type="number"
                    min={0}
                    max={360}
                    className={`${inputCls} w-24`}
                    value={element.gradientAngle ?? 0}
                    onChange={(e) => onChange({ gradientAngle: ((Number(e.target.value) || 0) % 360 + 360) % 360 })}
                  />
                  <span className="text-xs text-gray-500">0=위→아래, 90=왼→오른쪽</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>maxFontSize</label>
              <input type="number" className={inputCls} value={element.maxFontSize} onChange={(e) => onChange({ maxFontSize: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>minFontSize</label>
              <input type="number" className={inputCls} value={element.minFontSize} onChange={(e) => onChange({ minFontSize: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>maxLines</label>
              <input type="number" className={inputCls} value={element.maxLines} onChange={(e) => onChange({ maxLines: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>줄간격</label>
              <input
                type="number"
                min={1}
                max={1.6}
                step={0.1}
                className={inputCls}
                value={element.lineSpacing ?? 1.0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onChange({ lineSpacing: Number.isNaN(v) ? 1.0 : v });
                }}
              />
            </div>
          </div>

          {/* Glyph outline (stroke) — legibility over images. Width 0 = none. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>외곽선 색</label>
              <input
                type="color"
                className="h-9 w-16 rounded border border-gray-300"
                value={element.outlineColor ?? '#ffffff'}
                onChange={(e) => onChange({ outlineColor: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>외곽선 두께 (0=없음)</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={element.outlineWidth ?? 0}
                onChange={(e) => {
                  // Commit the displayed default color when enabling via width alone,
                  // otherwise a null color skips rendering (preview shows nothing).
                  const w = Math.max(0, Number(e.target.value) || 0);
                  onChange({
                    outlineWidth: w,
                    ...(w > 0 && element.outlineColor == null ? { outlineColor: '#ffffff' } : {}),
                  });
                }}
              />
            </div>
          </div>
        </>
      )}

      {element.type === 'image' && (
        <div>
          <label className={labelCls}>불투명도 (opacity): {element.opacity.toFixed(2)}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            className="w-full"
            value={element.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          />
        </div>
      )}

      {/* Element border box (any element type). Width 0 = none. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>테두리 색</label>
          <input
            type="color"
            className="h-9 w-16 rounded border border-gray-300"
            value={element.borderColor ?? '#000000'}
            onChange={(e) => onChange({ borderColor: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>테두리 두께 (0=없음)</label>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={element.borderWidth ?? 0}
            onChange={(e) => {
              // Commit the displayed default color when enabling via width alone,
              // otherwise a null color skips rendering (preview shows nothing).
              const w = Math.max(0, Number(e.target.value) || 0);
              onChange({
                borderWidth: w,
                ...(w > 0 && element.borderColor == null ? { borderColor: '#000000' } : {}),
              });
            }}
          />
        </div>
      </div>

      {/* The product-image base cannot be deleted. */}
      {!isProductBase && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          요소 삭제
        </button>
      )}
    </div>
  );
}
