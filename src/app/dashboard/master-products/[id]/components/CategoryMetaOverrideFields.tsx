'use client';

import { useState } from 'react';
import type { CategoryAttribute, CategoryNotice } from '@/domain/entities/MasterProductEntity';
import {
  axisOfAttrName,
  derivedUnit,
  hasMeasureAttr,
  isPairRequired,
  pairMeasureAttributes,
  type MeasurePair,
} from './measureAttributes';
import { isMeasureNotice } from './optionNoticeCompose';
import {
  MEASURE_UNITS_BY_AXIS,
  isAmountInput,
  joinMeasured,
  normalizeAmount,
  splitMeasured,
} from './netContentUnit';
import { isOptionField, isOptionNotice, isTotalQuantityName } from './optionMetaFields';
import { noticeGroupName } from './noticeTemplates';
import { unitPlaceholder, unitSuffix } from './basicUnit';

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
  // 선택된 품목군(실효). 이 그룹의 고시만 노출·검증 대상(96 ⑨/⑩ 과 같은 규칙)
  noticeGroup?: string | null;
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
 * 고시 항목은 백엔드 notices 중 옵션-소유(isOptionNotice)만, 그리고 **선택된 품목군(noticeGroup)의
 * 것만** 노출한다(단일 input, 계량 페어 없음). 품목군끼리 고시 key 를 공유하므로 좁히지 않으면 같은
 * key 가 중복 렌더된다.
 * 필수(MANDATORY) 속성과 **필수 고시는 상세입력 토글과 무관하게 항상 노출**하고, "상세입력" 체크 시
 * 선택 속성 + 선택 고시를 **필수 항목 아래로** 펼친다(숨길 게 있을 때만 토글 노출).
 * 저장 버튼 없음(부모 옵션폼이 검증·저장).
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
  noticeGroup = null,
}: CategoryMetaOverrideFieldsProps) {
  // Display-only unit pick per pair; the actual value lives in the parent's attrValues.
  const [measureUnit, setMeasureUnit] = useState<Record<string, string>>({});
  // 계량 숫자칸의 **타이핑 중간 상태**만 담는 표시용 draft(`23.` 처럼 저장값에 남길 수 없는 형태).
  // 저장값은 언제나 정규화된 숫자(`23`)이며, draft 는 그 숫자와 다시 이어질 때만 화면에 쓰인다
  // (부모 값이 자동채움 등으로 바뀌면 draft 는 버려진다).
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
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
  const allOptionNotices = notices.filter(isOptionNotice);
  // 품목군끼리 고시 key 를 공유한다 → 선택 그룹으로 좁히지 않으면 같은 key 가 중복 렌더된다.
  // 그룹이 없는 스키마('' / null)면 좁히지 않는다.
  const noticeFields = noticeGroup
    ? allOptionNotices.filter((n) => noticeGroupName(n) === noticeGroup)
    : allOptionNotices;
  const requiredNoticeFields = noticeFields.filter((n) => n.required);
  const optionalNoticeFields = noticeFields.filter((n) => !n.required);
  // 필수 고시는 토글과 무관하게 항상 노출(속성과 같은 규칙). 선택 고시만 상세입력 뒤.
  const visibleNoticeFields = showAll ? noticeFields : requiredNoticeFields;

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
  // 계량 고시(`포장단위별 …용량(중량),수량`)는 **개당 계량값 + 수량으로 만든 파생 문자열**이라
  // 손으로 고치지 않는다(읽기 전용). 판정 기준은 자동채움과 **같은 함수**(hasMeasureAttr) —
  // 조합 소스가 없는 카테고리·혼합구성(AB)에서는 조합이 불가하므로 그대로 입력 필드로 둔다.
  const autoMeasureNotice = !hideCategoryAttrs && hasMeasureAttr(attributes);
  const hasAnyOption = pairs.length > 0 || singles.length > 0 || noticeFields.length > 0;
  // Is there anything hidden behind 상세입력? (optional attrs or any notice fields)
  const hasOptional =
    optionalPairs.length > 0 || optionalSingles.length > 0 || optionalNoticeFields.length > 0;

  // Current unit for a pair: explicit choice wins, else inferred from this option's values.
  const unitOf = (p: MeasurePair): string =>
    measureUnit[p.base] !== undefined ? measureUnit[p.base] : derivedUnit(p, attrValues);

  // Record the display choice and let the parent clear the other side's value.
  const pickMeasureUnit = (p: MeasurePair, unit: string) => {
    setMeasureUnit((prev) => ({ ...prev, [p.base]: unit }));
    onMeasureUnit(p, unit);
  };

  /**
   * 계량 입력 = **숫자 입력칸 + 단위 select**(사용자 결정 2026-08-30). 저장값은 둘을 합친
   * `320g` 한 문자열이다 — 백엔드 `CoupangListingAdapter.withUnit` 이 숫자만이면 카테고리
   * 기본 단위를 붙여버리므로(96 ④) 단위가 값에 들어 있어야 `500kg` 이 `500g` 으로 바뀌지 않는다.
   *
   * ⚠️ 단위 목록은 축별 `MEASURE_UNITS_BY_AXIS`(= 물품 폼 select 와 같은 표) 에서만 온다.
   * ⚠️ 저장값을 숫자+단위로 못 쪼개면(레거시 자유입력) 원문 텍스트 입력으로 폴백한다 —
   * 숫자칸에 빈 값을 보이면 화면과 저장값이 어긋난다.
   */
  const renderMeasureInput = (
    name: string,
    axis: '중량' | '용량',
    attr: CategoryAttribute | undefined,
  ) => {
    const raw = attrValues[name] ?? '';
    const { amount, unit: valueUnit, parsed } = splitMeasured(raw);
    const units = MEASURE_UNITS_BY_AXIS[axis];
    if (!parsed) {
      return (
        <input
          type="text"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
          title="숫자와 단위로 나눌 수 없는 값입니다. 숫자만 남기면 단위를 선택할 수 있습니다."
          value={raw}
          onChange={(e) => onAttrChange(name, e.target.value)}
          disabled={disabled}
        />
      );
    }
    // 단위 미지정이면 카테고리 기본 단위(basicUnit)를 후보로. 목록에 없으면 미선택.
    const fallback = (attr?.basicUnit ?? '').trim().toLowerCase();
    const selected = valueUnit || (units.includes(fallback) ? fallback : '');
    // draft 는 "같은 숫자 + 끝 소수점" 일 때만 유효 — 그 외에는 부모(저장) 값이 이긴다.
    const draft = amountDraft[name];
    const shownAmount = draft !== undefined && normalizeAmount(draft) === amount ? draft : amount;
    return (
      <>
        <input
          type="text"
          inputMode="decimal"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
          placeholder="숫자만 (예: 200, 23.9)"
          value={shownAmount}
          onChange={(e) => {
            const next = e.target.value;
            if (!isAmountInput(next)) return; // 숫자·소수점 외 입력은 무시(값 유지)
            setAmountDraft((prev) => ({ ...prev, [name]: next }));
            onAttrChange(name, joinMeasured(normalizeAmount(next), selected));
          }}
          disabled={disabled}
        />
        <select
          className="w-20 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          value={selected}
          onChange={(e) => onAttrChange(name, joinMeasured(amount, e.target.value))}
          disabled={disabled}
        >
          <option value="">단위</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </>
    );
  };

  // One attribute cell (pair 택1 or single). flex-col + mt-auto pins the control to the bottom
  // so uneven label heights still align inputs across a grid row.
  const renderAttrCell = (cell: AttrCell) => {
    if (cell.kind === 'pair') {
      const p = cell.p;
      const unit = unitOf(p);
      const activeName = unit === '용량' ? p.volume.name : p.weight.name;
      // 단위 표시용. activeName 과 의도적으로 다르다 — activeName 은 미선택('')일 때 weight 로
      // 폴백하지만(값 저장 대상이 필요), 여기선 미선택이면 undefined 여야 한다(구분도 안 골랐는데
      // `g` 를 보이면 거짓 안내).
      const activeAttr = unit === '용량' ? p.volume : unit === '중량' ? p.weight : undefined;
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
            {unit === '중량' || unit === '용량' ? (
              renderMeasureInput(activeName, unit, activeAttr)
            ) : (
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                placeholder="구분 먼저 선택"
                value=""
                onChange={() => undefined}
                disabled
              />
            )}
          </div>
        </div>
      );
    }
    const a = cell.a;
    // 수량(`수량`·`총 수량`)은 **구성상품 수량 합**이 SSOT 라 여기서 직접 고치지 않는다
    // (위 구성상품 수량 칸에서만 바꾼다). 판정은 자동채움과 **같은 술어**(isTotalQuantityName) —
    // 갈라지면 "잠겼는데 아무도 안 채우는" 칸이 생긴다. ⚠️ `개당 수량` 은 도출 불가라 제외된다.
    const autoQty = isTotalQuantityName(a.name);
    return (
      <div key={`a-${a.name}`} className="flex flex-col">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          {a.name}
          {unitSuffix(a) && <span className="ml-1 font-normal text-gray-400">{unitSuffix(a)}</span>}
          {a.required && <span className="text-red-600"> *</span>}
          {autoQty && (
            <span className="ml-1 font-normal text-gray-400">(구성상품 수량에서 자동)</span>
          )}
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
        ) : axisOfAttrName(a.name) ? (
          // 짝 없는 계량 속성(예: `내용량`)도 숫자 + 단위 select 로 받는다(페어와 같은 규칙).
          <div className="mt-auto flex gap-2">
            {renderMeasureInput(a.name, axisOfAttrName(a.name) as '중량' | '용량', a)}
          </div>
        ) : (
          <input
            type={a.inputType === 'NUMBER' ? 'number' : 'text'}
            className="mt-auto w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
            placeholder={autoQty ? '위 구성상품 수량에서 자동' : unitPlaceholder(a) || '값 입력'}
            title={
              autoQty ? '구성상품 수량 합으로 자동 계산됩니다. 위 구성상품 수량을 수정하세요.' : undefined
            }
            value={attrValues[a.name] ?? ''}
            onChange={(e) => onAttrChange(a.name, e.target.value)}
            disabled={disabled || autoQty}
            readOnly={autoQty}
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

      {/* 상품정보제공고시. 옵션-소유 + 선택 품목군만 단일 input 으로. 필수 고시는 항상, 선택 고시는 상세입력에서. */}
      {hasNoticeFields && (
        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs text-gray-500">상품정보제공고시 (옵션 소유)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleNoticeFields.map((n) => {
              const auto = autoMeasureNotice && isMeasureNotice(n.key);
              return (
                <div key={n.key} className="flex flex-col">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {n.label}
                    {n.required && <span className="text-red-600"> *</span>}
                    {auto && (
                      <span className="ml-1 font-normal text-gray-400">(개당·수량에서 자동)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    className="mt-auto w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder={auto ? '개당 값을 입력하면 자동으로 채워집니다' : '값 입력'}
                    title={auto ? '개당 용량/중량과 수량으로 자동 조합됩니다. 값을 바꾸려면 위 항목을 수정하세요.' : undefined}
                    value={noticeValues[n.key] ?? ''}
                    onChange={(e) => onNoticeChange(n.key, e.target.value)}
                    disabled={disabled || auto}
                    readOnly={auto}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 빈 상태 안내. hideCategoryAttrs 면 속성 없음이 정상 → 위 안내로 대체(중복 방지). */}
      {hideCategoryAttrs ? null : !hasAnyOption ? (
        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
          이 카테고리에는 옵션별로 설정할 항목이 없습니다.
        </p>
      ) : !showAll && requiredCells.length === 0 && requiredNoticeFields.length === 0 ? (
        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
          필수 항목이 없습니다. 상세입력을 체크하면 선택 항목이 표시됩니다.
        </p>
      ) : null}
    </div>
  );
}
