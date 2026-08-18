'use client';

import { useState } from 'react';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { BUILTIN_FIELD_KEYS } from '@/domain/entities/ThumbnailEntity';
import type { DetailBlock } from '@/domain/entities/DetailTemplateEntity';

// Reserved field keys auto-derive their value from the product (brandName/productName).
// Custom keys fall back to the template's defaultValue. Reused from the thumbnail model.
const BUILTIN_FIELD_LABELS: Record<string, string> = {
  brandName: '브랜드명',
  productName: '상품명',
};

const TYPE_LABELS: Record<DetailBlock['type'], string> = {
  text: '텍스트',
  spacer: '여백',
  imageZone: '이미지 존',
  asset: '고정 이미지',
};

interface BlockRowProps {
  block: DetailBlock;
  index: number;
  total: number;
  error?: string;
  onChange: (patch: Partial<DetailBlock>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

const labelCls = 'block text-xs font-medium text-gray-600';
const inputCls =
  'mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none';

export function BlockRow({
  block,
  index,
  total,
  error,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: BlockRowProps) {
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
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {index + 1}. {TYPE_LABELS[block.type]}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            aria-label="위로 이동"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            aria-label="아래로 이동"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            삭제
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {block.type === 'text' && (
          <>
            <label className="sm:col-span-2">
              <span className={labelCls}>필드키 (bind)</span>
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
                  필드키를 선택하세요
                </option>
                {BUILTIN_FIELD_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {BUILTIN_FIELD_LABELS[key]} ({key})
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
                  <span className={labelCls}>커스텀 필드키</span>
                  <input
                    type="text"
                    value={block.bind ?? ''}
                    onChange={(e) => onChange({ bind: e.target.value })}
                    className={inputCls}
                    placeholder="예: promoNote"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelCls}>기본값 (필수)</span>
                  <input
                    type="text"
                    value={block.defaultValue ?? ''}
                    onChange={(e) => onChange({ defaultValue: e.target.value })}
                    className={inputCls}
                  />
                </label>
              </>
            )}
            <label>
              <span className={labelCls}>정렬</span>
              <select
                value={block.align ?? 'left'}
                onChange={(e) => onChange({ align: e.target.value })}
                className={inputCls}
              >
                <option value="left">왼쪽</option>
                <option value="center">가운데</option>
                <option value="right">오른쪽</option>
              </select>
            </label>
            <label>
              <span className={labelCls}>너비(%)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={block.widthPercent ?? 100}
                onChange={(e) => onChange({ widthPercent: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
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
              <span className={labelCls}>존 ID (zoneId)</span>
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
            <label>
              <span className={labelCls}>정렬</span>
              <select
                value={block.align ?? 'center'}
                onChange={(e) => onChange({ align: e.target.value })}
                className={inputCls}
              >
                <option value="left">왼쪽</option>
                <option value="center">가운데</option>
                <option value="right">오른쪽</option>
              </select>
            </label>
            <label>
              <span className={labelCls}>너비(%)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={block.widthPercent ?? 100}
                onChange={(e) => onChange({ widthPercent: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
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
