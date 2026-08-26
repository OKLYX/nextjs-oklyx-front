'use client';

import { useState } from 'react';
import type { CategoryAttribute, CategoryNotice } from '@/domain/entities/MasterProductEntity';
import {
  derivedUnit,
  isPairRequired,
  pairMeasureAttributes,
  type MeasurePair,
} from './measureAttributes';
import { isOptionField, isOptionNotice } from './optionMetaFields';

interface CategoryMetaOverrideFieldsProps {
  attributes: CategoryAttribute[];
  notices: CategoryNotice[]; // backend-driven; only option-owned ones are rendered here
  attrValues: Record<string, string>; // this option's values
  noticeValues: Record<string, string>;
  onAttrChange: (name: string, value: string) => void;
  onNoticeChange: (key: string, value: string) => void;
  onMeasureUnit: (pair: MeasurePair, unit: string) => void; // 58 same signature
  disabled?: boolean;
  // 선택 채널이 옵션-소유 속성을 요구하지 않으면(hideCategoryAttrs) 속성 그리드 전체 숨김 + 안내만
  // (값은 보존). 고시(옵션-소유) 렌더는 유지.
  hideCategoryAttrs?: boolean;
}

// One attribute cell in the grid: a weight/volume pair (택1) or a single attribute.
type AttrCell = { kind: 'pair'; p: MeasurePair } | { kind: 'single'; a: CategoryAttribute };

/**
 * 옵션별 카테고리 필수 항목 입력 — 프레젠테이션 (렌더 전용).
 * File: src/app/dashboard/master-products/[id]/components/CategoryMetaOverrideFields.tsx
 *
 * ⚠️ **개당 용량/중량·수량** 은 옵션마다 물리적으로 다르므로 마스터가 아니라 **각 옵션에서 직접
 * 설정**한다(사용자 결정 2026-08-26). 이 컴포넌트는 옵션-소유 필드(isOptionField/isOptionNotice)만
 * 렌더한다 — 마스터 공통값·상속(placeholder=마스터값) 개념 없음. 58 CategoryMetaFields 와 별개이며
 * 계량 페어링 helper 만 공유한다.
 *
 * 고시 항목은 백엔드 notices 중 옵션-소유(isOptionNotice)만 노출(단일 input, 계량 페어 없음).
 * 기본은 **카테고리 필수(MANDATORY) 속성만** 노출하고, "상세입력" 체크 시 선택 속성 + 고시까지
 * **필수 항목 아래로** 펼친다(숨길 게 있을 때만 토글 노출). 저장 버튼 없음(부모 옵션폼이 검증·저장).
 *
 * 각 입력 셀은 flex-col + `mt-auto` 로 컨트롤을 하단에 고정 → 라벨 줄 수가 달라도(예: 계량 필드의
 * 긴 라벨 vs 짧은 라벨) 같은 행의 input 높이가 정렬된다.
 */
export function CategoryMetaOverrideFields({
  attributes,
  notices,
  attrValues,
  noticeValues,
  onAttrChange,
  onNoticeChange,
  onMeasureUnit,
  disabled = false,
  hideCategoryAttrs = false,
}: CategoryMetaOverrideFieldsProps) {
  // Display-only unit pick per pair; the actual value lives in the parent's attrValues.
  const [measureUnit, setMeasureUnit] = useState<Record<string, string>>({});
  // 상세입력: 기본은 카테고리 필수(MANDATORY) 항목만, 체크하면 선택 항목(옵션 속성·고시)까지 노출.
  const [showAll, setShowAll] = useState(false);

  // Only option-owned fields (용량/중량/수량). Filter attributes before pairing so pairs
  // and singles both come from the option layer. hideCategoryAttrs → 속성부 전체 숨김(빈 목록).
  const optionAttributes = hideCategoryAttrs ? [] : attributes.filter((a) => isOptionField(a.name));
  const { pairs, singles } = pairMeasureAttributes(optionAttributes);
  const requiredPairs = pairs.filter(isPairRequired);
  const optionalPairs = pairs.filter((p) => !isPairRequired(p));
  const requiredSingles = singles.filter((a) => a.required);
  const optionalSingles = singles.filter((a) => !a.required);
  const noticeFields = notices.filter(isOptionNotice);
  const visibleNoticeFields = showAll ? noticeFields : []; // notices have no required flag → detail only

  // Required cells (개당/수량) go in the top grid; the optional ones (상세입력) go in a separate
  // grid BELOW so they don't fill the same rows to the right of the required fields.
  const requiredCells: AttrCell[] = [
    ...requiredPairs.map((p): AttrCell => ({ kind: 'pair', p })),
    ...requiredSingles.map((a): AttrCell => ({ kind: 'single', a })),
  ];
  const optionalCells: AttrCell[] = showAll
    ? [
        ...optionalPairs.map((p): AttrCell => ({ kind: 'pair', p })),
        ...optionalSingles.map((a): AttrCell => ({ kind: 'single', a })),
      ]
    : [];

  const hasNoticeFields = visibleNoticeFields.length > 0;
  const hasAnyOption = pairs.length > 0 || singles.length > 0 || noticeFields.length > 0;
  // Is there anything hidden behind 상세입력? (optional attrs or any notice fields)
  const hasOptional =
    optionalPairs.length > 0 || optionalSingles.length > 0 || noticeFields.length > 0;

  // Current unit for a pair: explicit choice wins, else inferred from this option's values.
  const unitOf = (p: MeasurePair): string =>
    measureUnit[p.base] !== undefined ? measureUnit[p.base] : derivedUnit(p, attrValues);

  // Record the display choice and let the parent clear the other side's value.
  const pickMeasureUnit = (p: MeasurePair, unit: string) => {
    setMeasureUnit((prev) => ({ ...prev, [p.base]: unit }));
    onMeasureUnit(p, unit);
  };

  // One attribute cell (pair 택1 or single). flex-col + mt-auto pins the control to the bottom
  // so uneven label heights still align inputs across a grid row.
  const renderAttrCell = (cell: AttrCell) => {
    if (cell.kind === 'pair') {
      const p = cell.p;
      const unit = unitOf(p);
      const activeName = unit === '용량' ? p.volume.name : p.weight.name;
      return (
        <div key={`p-${p.base}`} className="flex flex-col">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {p.base || '중량/용량'}
            {isPairRequired(p) && <span className="text-red-600"> *</span>}
            <span className="ml-1 font-normal text-gray-400">(중량·용량 중 택1)</span>
          </label>
          <div className="mt-auto flex gap-2">
            <select
              className="w-24 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={unit}
              onChange={(e) => pickMeasureUnit(p, e.target.value)}
              disabled={disabled}
            >
              <option value="">구분</option>
              <option value="중량">중량</option>
              <option value="용량">용량</option>
            </select>
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
              placeholder={unit === '용량' ? '예: 500mL' : unit === '중량' ? '예: 500g' : '구분 먼저 선택'}
              value={unit ? (attrValues[activeName] ?? '') : ''}
              onChange={(e) => onAttrChange(activeName, e.target.value)}
              disabled={disabled || !unit}
            />
          </div>
        </div>
      );
    }
    const a = cell.a;
    return (
      <div key={`a-${a.name}`} className="flex flex-col">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          {a.name}
          {a.required && <span className="text-red-600"> *</span>}
        </label>
        {a.inputType === 'SELECT' ? (
          <select
            className="mt-auto w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            value={attrValues[a.name] ?? ''}
            onChange={(e) => onAttrChange(a.name, e.target.value)}
            disabled={disabled}
          >
            <option value="">선택</option>
            {a.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={a.inputType === 'NUMBER' ? 'number' : 'text'}
            className="mt-auto w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            placeholder="값 입력"
            value={attrValues[a.name] ?? ''}
            onChange={(e) => onAttrChange(a.name, e.target.value)}
            disabled={disabled}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 선택 채널이 속성을 요구하지 않으면(혼합구성) 속성 그리드 대신 안내만(값은 보존). */}
      {hideCategoryAttrs && (
        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
          혼합구성(여러 상품) 상품은 쿠팡에 수량/용량/중량 등 속성을 보내지 않습니다(옵션명으로 표현).
        </p>
      )}

      {/* 상세입력 토글: 기본은 필수(MANDATORY)만, 체크 시 선택 항목까지. 숨길 게 있을 때만 노출. */}
      {hasOptional && (
        <div className="flex justify-end">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              disabled={disabled}
            />
            상세입력 (선택 항목 포함)
          </label>
        </div>
      )}

      {/* 필수속성(개당 용량/중량·수량) — 상단 그리드. 셀은 flex-col + mt-auto 로 input 하단 정렬. */}
      {requiredCells.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {requiredCells.map(renderAttrCell)}
        </div>
      )}

      {/* 상세입력 = 선택 속성. 별도 그리드라 필수 항목 '아래' 행부터 시작한다. */}
      {optionalCells.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-[11px] text-gray-400">상세 항목 (선택)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {optionalCells.map(renderAttrCell)}
          </div>
        </div>
      )}

      {/* 상품정보제공고시 (상세입력에서만). 옵션-소유 고시만 단일 input 으로. */}
      {showAll && hasNoticeFields && (
        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs text-gray-500">상품정보제공고시 (옵션 소유)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleNoticeFields.map((n) => (
              <div key={n.key} className="flex flex-col">
                <label className="mb-1 block text-xs font-medium text-gray-600">{n.label}</label>
                <input
                  type="text"
                  className="mt-auto w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  placeholder="값 입력"
                  value={noticeValues[n.key] ?? ''}
                  onChange={(e) => onNoticeChange(n.key, e.target.value)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 빈 상태 안내. hideCategoryAttrs 면 속성 없음이 정상 → 위 안내로 대체(중복 방지). */}
      {hideCategoryAttrs ? null : !hasAnyOption ? (
        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
          이 카테고리에는 옵션별로 설정할 항목이 없습니다.
        </p>
      ) : !showAll && requiredCells.length === 0 ? (
        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
          필수 항목이 없습니다. 상세입력을 체크하면 선택 항목이 표시됩니다.
        </p>
      ) : null}
    </div>
  );
}
