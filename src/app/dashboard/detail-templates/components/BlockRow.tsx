'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { BUILTIN_FIELD_KEYS } from '@/domain/entities/ThumbnailEntity';
import type { DetailBlock } from '@/domain/entities/DetailTemplateEntity';
import type { FontAsset } from '@/domain/entities/FontEntity';

// Reserved field keys auto-derive their value from the product (brandName/productName).
// Custom keys fall back to the template's defaultValue. Reused from the thumbnail model.
const BUILTIN_FIELD_LABELS: Record<string, string> = {
  brandName: '브랜드명',
  productName: '상품명',
};

const TYPE_LABELS: Record<DetailBlock['type'], string> = {
  text: '텍스트',
  spacer: '여백',
  imageZone: '이미지',
  asset: '고정 이미지',
};

// Declarative text-style controls (mirrors backend 19 registry).
// Adding a new attribute = one entry here; never a hardcoded JSX field.
interface StyleControl {
  key: string; // textStyle map key (same as backend registry key)
  label: string;
  kind: 'number' | 'color' | 'bool' | 'select';
  min?: number; // kind='number' only
  max?: number;
  def?: string; // value prefilled when the control is activated (number/color)
  icon?: ReactNode; // kind='bool': shown as a Word-style toggle button glyph
  options?: { value: string; label: string; disabled?: boolean }[]; // kind='select' only
}

const ALIGN_OPTIONS: { value: string; label: string; icon: ReactNode }[] = [
  { value: 'left', label: '왼쪽', icon: <AlignLeft size={16} /> },
  { value: 'center', label: '가운데', icon: <AlignCenter size={16} /> },
  { value: 'right', label: '오른쪽', icon: <AlignRight size={16} /> },
];

// Font options come from the tenant font library, so the descriptor list is built per render.
// Adding a new style attribute is still one entry here.
// ⚠️ The stored fontFamily value is the FontAsset id as a string ("12"), never a CSS stack —
// the backend parses it as an id and drops anything else.
const buildTextStyleControls = (fonts: FontAsset[]): StyleControl[] => [
  {
    key: 'fontFamily',
    label: '폰트',
    kind: 'select',
    options: fonts.map((f) => ({
      value: String(f.id),
      // System fonts are labelled '(시스템)' exactly like the thumbnail editor.
      // Fonts unusable in a detail page stay listed but disabled, so the reason is visible.
      label: `${f.displayName}${f.source === 'BUNDLED' ? ' (시스템)' : ''}${
        !f.webUrl && !f.webStack ? ' — 상세 미지원' : ''
      }`,
      disabled: !f.webUrl && !f.webStack,
    })),
  },
  { key: 'fontSize', label: '크기', kind: 'number', min: 8, max: 200, def: '16' },
  { key: 'color', label: '색상', kind: 'color' },
  { key: 'bold', label: '굵게', kind: 'bool', icon: <Bold size={16} /> },
  { key: 'italic', label: '기울임', kind: 'bool', icon: <Italic size={16} /> },
];

interface BlockRowProps {
  block: DetailBlock;
  index: number;
  error?: string;
  fonts: FontAsset[]; // tenant font library (font select options)
  fontsLoading: boolean;
  previewText?: string | null; // preview-only override (null = show block default), editor-managed
  onPreviewTextChange?: (value: string | null) => void;
  onChange: (patch: Partial<DetailBlock>) => void;
  onDelete: () => void;
}

const labelCls = 'block text-xs font-medium text-gray-600';
const inputCls =
  'mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none';

export function BlockRow({
  block,
  index,
  error,
  fonts,
  fontsLoading,
  previewText,
  onPreviewTextChange,
  onChange,
  onDelete,
}: BlockRowProps) {
  const controls = useMemo(() => buildTextStyleControls(fonts), [fonts]);
  const isBuiltinBind = (BUILTIN_FIELD_KEYS as readonly string[]).includes(block.bind ?? '');
  // "직접 입력" chosen but key not yet typed: bind is empty so the value can't be
  // derived from data alone, hence a local flag distinguishing it from the placeholder.
  const [customChosen, setCustomChosen] = useState(false);
  const bindValue = isBuiltinBind
    ? (block.bind as string)
    : block.bind
      ? 'custom'
      : customChosen
        ? 'custom'
        : '';
  const isCustom = bindValue === 'custom';

  // Immutable update of textStyle: empty/null removes the key (inherit), else sets it.
  const setStyle = (key: string, value: string | null) => {
    const next = { ...(block.textStyle ?? {}) };
    if (value === null || value === '') delete next[key];
    else next[key] = value;
    onChange({ textStyle: Object.keys(next).length ? next : null });
  };

  // Default preview text = defaultValue, else the bind label (브랜드명/상품명), else the raw bind.
  const previewDefault =
    block.defaultValue || (block.bind ? (BUILTIN_FIELD_LABELS[block.bind] ?? block.bind) : '') || '';

  // Word-style alignment toggle (shared by text/imageZone). `fallback` = default when unset.
  const alignControl = (fallback: string) => (
    <div>
      <span className={labelCls}>정렬</span>
      <div className="mt-1 flex gap-1">
        {ALIGN_OPTIONS.map((a) => {
          const active = (block.align ?? fallback) === a.value;
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => onChange({ align: a.value })}
              aria-pressed={active}
              aria-label={a.label}
              title={a.label}
              className={`flex h-8 w-8 items-center justify-center rounded border ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {a.icon}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Width stepper: −/+ in 10% steps, clamped to 50–100 (default 100).
  const widthControl = () => {
    const value = block.widthPercent ?? 100;
    const setWidth = (v: number) => onChange({ widthPercent: Math.max(50, Math.min(100, v)) });
    return (
      <div>
        <span className={labelCls}>너비(%)</span>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWidth(value - 10)}
            disabled={value <= 50}
            aria-label="너비 감소"
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            −
          </button>
          <span className="w-12 text-center text-sm text-gray-900">{value}%</span>
          <button
            type="button"
            onClick={() => setWidth(value + 10)}
            disabled={value >= 100}
            aria-label="너비 증가"
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {index + 1}. {TYPE_LABELS[block.type]}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          삭제
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {block.type === 'text' && (
          <>
            <label className="sm:col-span-2">
              <span className={labelCls}>텍스트 타입 설정</span>
              <select
                value={bindValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'custom') {
                    setCustomChosen(true);
                    onChange({ bind: '' });
                  } else if (v === '') {
                    setCustomChosen(false);
                    onChange({ bind: '' });
                  } else {
                    setCustomChosen(false);
                    onChange({ bind: v, defaultValue: null });
                  }
                }}
                className={inputCls}
              >
                <option value="" disabled>
                  텍스트 타입을 선택하세요
                </option>
                {BUILTIN_FIELD_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {BUILTIN_FIELD_LABELS[key]}
                  </option>
                ))}
                <option value="custom">직접 입력</option>
              </select>
            </label>
            {isBuiltinBind && (
              <p className="text-xs text-gray-400 sm:col-span-2">
                값은 적용 시 상품 정보에서 자동으로 채워집니다(템플릿 기본값 없음).
              </p>
            )}
            {isCustom && (
              <>
                <label className="sm:col-span-2">
                  <span className={labelCls}>텍스트 항목 이름</span>
                  <input
                    type="text"
                    value={block.bind ?? ''}
                    onChange={(e) => onChange({ bind: e.target.value })}
                    className={inputCls}
                    placeholder="예: promoNote"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelCls}>기본값 입력 (필수)</span>
                  <input
                    type="text"
                    value={block.defaultValue ?? ''}
                    onChange={(e) => onChange({ defaultValue: e.target.value })}
                    className={inputCls}
                  />
                </label>
              </>
            )}
            {alignControl('left')}
            {widthControl()}
            <div className="sm:col-span-2">
              <span className={labelCls}>텍스트 스타일</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {controls.map((c) => {
                  const current = block.textStyle?.[c.key];
                  if (c.kind === 'number') {
                    // No checkbox: the input shows the default (c.def) and only stores an
                    // override once the user changes it (empty clears back to inherit).
                    return (
                      <input
                        key={c.key}
                        type="number"
                        min={c.min}
                        max={c.max}
                        value={current ?? c.def ?? ''}
                        onChange={(e) =>
                          setStyle(c.key, e.target.value === '' ? null : String(Number(e.target.value)))
                        }
                        className="h-8 w-16 rounded border border-gray-300 px-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                        aria-label={c.label}
                        title={c.label}
                      />
                    );
                  }
                  if (c.kind === 'color') {
                    // No checkbox: the default text color is black, so show the picker at #000000
                    // and only store an override once the user actually changes it.
                    return (
                      <input
                        key={c.key}
                        type="color"
                        value={current ?? '#000000'}
                        onChange={(e) => setStyle(c.key, e.target.value)}
                        className="color-swatch-fill h-8 w-16 rounded border border-gray-300"
                        aria-label={c.label}
                        title={c.label}
                      />
                    );
                  }
                  if (c.kind === 'select') {
                    // '' = 지정 안 함 → key 제거(기본 폰트 상속). 값은 FontAsset id 문자열.
                    return (
                      <select
                        key={c.key}
                        value={current ?? ''}
                        onChange={(e) => setStyle(c.key, e.target.value === '' ? null : e.target.value)}
                        disabled={fontsLoading}
                        className="h-8 max-w-40 rounded border border-gray-300 px-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                        aria-label={c.label}
                        title={c.label}
                      >
                        <option value="">기본 폰트</option>
                        {(c.options ?? []).map((o) => (
                          <option key={o.value} value={o.value} disabled={o.disabled}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    );
                  }
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setStyle(c.key, current != null ? null : 'true')}
                      aria-pressed={current != null}
                      aria-label={c.label}
                      title={c.label}
                      className={`flex h-8 w-8 items-center justify-center rounded border ${
                        current != null
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {c.icon ?? c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {!isCustom && (
              <label className="sm:col-span-2">
                <span className={labelCls}>미리보기 텍스트</span>
                <textarea
                  value={previewText ?? previewDefault}
                  onChange={(e) => onPreviewTextChange?.(e.target.value)}
                  className={`${inputCls} resize-y`}
                  rows={2}
                  placeholder="미리보기 전용 (저장되지 않음)"
                />
              </label>
            )}
          </>
        )}

        {block.type === 'spacer' && (
          <label>
            <span className={labelCls}>세로 여백(px)</span>
            <input
              type="number"
              min={1}
              max={600}
              value={block.heightPx ?? 24}
              onChange={(e) => onChange({ heightPx: Number(e.target.value) })}
              className={inputCls}
            />
          </label>
        )}

        {block.type === 'imageZone' && (
          <>
            <label className="sm:col-span-2">
              <span className={labelCls}>이미지 영역 이름</span>
              <input
                type="text"
                value={block.bind ?? ''}
                onChange={(e) => onChange({ bind: e.target.value })}
                className={inputCls}
                placeholder="예: main"
              />
              <span className="mt-1 block text-xs text-gray-400">
                이 존의 이미지는 마스터별로 업로드됩니다(상세 편집기). 여기선 존 정의만.
              </span>
            </label>
            {alignControl('center')}
            {widthControl()}
          </>
        )}

        {block.type === 'asset' && (
          <div className="flex items-center gap-3 sm:col-span-2">
            {block.src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveThumbUrl(block.src)}
                alt="asset"
                className="h-16 w-16 rounded border border-gray-200 object-cover"
              />
            )}
            <div>
              <span className={labelCls}>고정 이미지 (읽기전용)</span>
              <p className="mt-1 break-all text-xs text-gray-500">{block.src ?? '(없음)'}</p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
