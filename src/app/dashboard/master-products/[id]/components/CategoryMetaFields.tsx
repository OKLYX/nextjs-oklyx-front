'use client';

import { useState } from 'react';
import type { CategoryAttribute, CategoryNotice } from '@/domain/entities/MasterProductEntity';
import {
  applyNoticeRefAll,
  isNoticeRefAll,
  noticeGroupName,
  noticeGroupsOf,
  resolveNoticeGroup,
} from './noticeTemplates';
import {
  derivedUnit,
  isPairRequired,
  pairMeasureAttributes,
  type MeasurePair,
} from './measureAttributes';
import { isOptionField, isOptionNotice } from './optionMetaFields';
import { unitPlaceholder, unitSuffix } from './basicUnit';
import { Input } from '@/presentation/components/ui/Input';
import { Spinner } from '@/presentation/components/Spinner';
import type { ElevenstNotification } from '@/domain/entities/ElevenstNotice';
import type { EsmNotification } from '@/domain/entities/EsmNotice';
import { platformName } from '@/config/platforms';

/**
 * FEATURE_2610_13 / D97 · D109 and FEATURE_2610_26 / D45: the tabs shown when a switched-on 11st or Gmarket · Auction
 * channel exists — the 11st tab only with an 11st channel, the Gmarket · Auction tab only with an ESM channel.
 */
type MetaTab = 'ALL' | 'COUPANG' | 'ELEVENST' | 'ESM';
const META_TABS: { key: MetaTab; label: string }[] = [
  { key: 'ALL', label: '통합' },
  { key: 'COUPANG', label: platformName('COUPANG') },
  { key: 'ELEVENST', label: platformName('ELEVENST') },
  { key: 'ESM', label: platformName('ESM') },
];
/** D99: the gray line under a read-only shared field. */
const SHARED_NOTE = '공통 항목은 「통합」 에서 고칩니다';

const GROUP_ETC = '기타';

// Group notices by groupName (품목군), preserving first-seen order; null → "기타" (always last).
function groupNotices(notices: CategoryNotice[]): [string, CategoryNotice[]][] {
  const map = new Map<string, CategoryNotice[]>();
  for (const n of notices) {
    const g = n.groupName ?? GROUP_ETC;
    const list = map.get(g);
    if (list) list.push(n);
    else map.set(g, [n]);
  }
  // Array.prototype.sort is stable → insertion order preserved except 기타 pushed to the end.
  return [...map.entries()].sort((a, b) => {
    if (a[0] === GROUP_ETC) return 1;
    if (b[0] === GROUP_ETC) return -1;
    return 0;
  });
}

interface CategoryMetaFieldsProps {
  attributes: CategoryAttribute[];
  notices: CategoryNotice[]; // backend-driven notice schema for this category
  attrValues: Record<string, string>;
  noticeValues: Record<string, string>;
  onAttrChange: (name: string, value: string) => void;
  onNoticeChange: (key: string, value: string) => void;
  // Bulk replace of the whole notice map (used by the "전체 상세페이지 참조" toggle).
  onNoticeValuesChange: (next: Record<string, string>) => void;
  // Pick a weight/volume unit for a pair; the parent clears the other side's attr value.
  onMeasureUnit: (pair: MeasurePair, unit: string) => void;
  disabled?: boolean;
  onlyRequired: boolean;
  onOnlyRequiredChange: (only: boolean) => void;
  // "이 필드(카테고리 속성)를 요구하는 선택 채널이 없다" → 속성부 렌더/검증 스킵(값은 보존).
  // 의미는 "번들이라 숨김"(보편)이 아니라 "선택 채널 중 요구자 없음"(채널 정책) — 컨테이너에서 도출.
  hideCategoryAttrs?: boolean;
  // 상품정보제공고시 = 품목군(groupName) 셀렉션. 선택된 그룹만 표시·전송(사용자 하나 선택).
  // null 이면 실효 그룹(값 있는 그룹 → 첫 그룹)을 표시. 컨테이너가 소유·저장 시 그 그룹만 전송.
  noticeGroup?: string | null;
  onNoticeGroupChange?: (group: string) => void;
  /**
   * FEATURE_2610_13 / D97 · D109: given only when a switched-on 11st channel exists → 「통합」 · 「쿠팡」 · 「11번가」 tabs.
   * Absent together with `esmPreview` = the single-platform screen as before.
   */
  elevenstPreview?: { notification: ElevenstNotification | null; failed: boolean };
  /**
   * FEATURE_2610_26 / D45 · D46: given only when a switched-on Gmarket · Auction channel exists → the 「G마켓 · 옥션」 tab.
   * Absent = no such tab.
   */
  esmPreview?: { notification: EsmNotification | null; failed: boolean };
}

/**
 * 카테고리 필수속성 / 상품정보제공고시 입력 — 프레젠테이션 (렌더 전용, fetch/save 없음).
 * File: src/app/dashboard/master-products/[id]/components/CategoryMetaFields.tsx
 *
 * 값(attrValues/noticeValues)은 부모(상세 컨테이너 또는 추가 모달)가 소유하고 콜백으로 위임한다.
 * 고시 항목은 **백엔드 notices(CategoryNotice[])** 가 결정한다 — 유형 select 없음. notices 를
 * groupName 으로 묶어 소제목으로 렌더하고, notice.required 로 필수 여부를 표시한다. 속성의 중량/용량
 * 페어는 그대로 유지(attribute 쪽). 검증(computeMissingRequired)은 여기 없다 — 부모 게이트가 공유
 * 헬퍼로 수행.
 */
export function CategoryMetaFields({
  attributes,
  notices,
  attrValues,
  noticeValues,
  onAttrChange,
  onNoticeChange,
  onNoticeValuesChange,
  onMeasureUnit,
  disabled = false,
  onlyRequired,
  onOnlyRequiredChange,
  hideCategoryAttrs = false,
  noticeGroup = null,
  onNoticeGroupChange,
  elevenstPreview,
  esmPreview,
}: CategoryMetaFieldsProps) {
  // Display-only unit pick per pair; the actual value lives in the parent's attrValues.
  const [measureUnit, setMeasureUnit] = useState<Record<string, string>>({});
  const [metaTab, setMetaTab] = useState<MetaTab>('ALL');
  const tabbed = elevenstPreview != null || esmPreview != null;
  const tabs = META_TABS.filter(
    (t) => (t.key !== 'ELEVENST' || elevenstPreview != null) && (t.key !== 'ESM' || esmPreview != null),
  );
  const notification = elevenstPreview?.notification ?? null;
  const esmNotification = esmPreview?.notification ?? null;
  // Coupang items another shown platform also reads (shared) — the union over the 11st and Gmarket · Auction previews.
  // null = a shown preview is not known yet / failed → no tags, nothing read-only.
  const shared =
    (elevenstPreview != null && notification == null) || (esmPreview != null && esmNotification == null)
      ? null
      : new Set([...(notification?.usedCoupangItems ?? []), ...(esmNotification?.usedCoupangItems ?? [])]);
  const ownLines = notification ? notification.lines.filter((l) => l.ownKey != null) : [];
  const esmOwnLines = esmNotification ? esmNotification.lines.filter((l) => l.ownKey != null) : [];
  // D109 (b) · (c): 「통합」 shows notices only and owns the group select; the Coupang tab shows the attributes too.
  const showAttributes = !tabbed || metaTab === 'COUPANG';
  const coupangView = tabbed && metaTab === 'COUPANG';

  // Master owns only the non-option fields; 개당 용량/중량·수량 은 각 옵션에서 설정한다
  // (CategoryMetaOverrideFields). 여기선 그 필드들을 표시/검증하지 않는다.
  const masterAttributes = attributes.filter((a) => !isOptionField(a.name));
  const masterNotices = notices.filter((n) => !isOptionNotice(n));
  // 상품정보제공고시 = 품목군 셀렉션: 여러 품목군 중 하나를 골라 그 그룹만 표시·전송한다.
  const noticeGroupNames = noticeGroupsOf(masterNotices);
  const activeNoticeGroup = resolveNoticeGroup(masterNotices, noticeValues, noticeGroup);
  const activeGroupNotices = masterNotices.filter((n) => noticeGroupName(n) === activeNoticeGroup);
  const refAll = isNoticeRefAll(activeGroupNotices, noticeValues); // "전체 상세페이지 참조" 활성 여부(선택 그룹)
  const { pairs, singles } = pairMeasureAttributes(masterAttributes);

  // Current unit for a pair: explicit choice wins, else inferred from existing values.
  const unitOf = (p: MeasurePair): string =>
    measureUnit[p.base] !== undefined ? measureUnit[p.base] : derivedUnit(p, attrValues);

  const requiredCount =
    (hideCategoryAttrs
      ? 0
      : singles.filter((a) => a.required).length + pairs.filter(isPairRequired).length) +
    activeGroupNotices.filter((n) => n.required).length;
  const visibleSingles = onlyRequired ? singles.filter((a) => a.required) : singles;
  const visiblePairs = onlyRequired ? pairs.filter(isPairRequired) : pairs;
  // Only the selected group's notices render (and are submitted).
  const visibleNotices = onlyRequired
    ? activeGroupNotices.filter((n) => n.required)
    : activeGroupNotices;
  const noticeGroups = groupNotices(visibleNotices);

  // Record the display choice and let the parent clear the other side's value.
  const pickMeasureUnit = (p: MeasurePair, unit: string) => {
    setMeasureUnit((prev) => ({ ...prev, [p.base]: unit }));
    onMeasureUnit(p, unit);
  };

  const renderTag = (platform: string) => (
    <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] font-normal text-gray-500">{platform}</span>
  );

  // D99: on the 11st tab every item shows the value 11st receives; only 11st-only items are editable.
  const elevenstView = (
    <div className="mb-4 space-y-3">
      {elevenstPreview?.failed ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">11번가 고시 미리보기를 불러오지 못했습니다.</p>
      ) : notification == null ? (
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-600">
            11번가 고시 유형: <span className="font-medium text-gray-900">{notification.typeName}</span>
            <span className="ml-1 text-gray-400">(쿠팡 품목군으로 정해집니다)</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notification.lines.map((line) => (
              <div key={line.code}>
                <label className="mb-1 block text-xs font-medium text-gray-600">{line.name}</label>
                {line.ownKey != null ? (
                  <input
                    type="text"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                    value={noticeValues[line.ownKey] ?? ''}
                    placeholder="비우면 「상품 상세페이지 참조」"
                    onChange={(e) => onNoticeChange(line.ownKey as string, e.target.value)}
                    disabled={disabled}
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                      value={line.value}
                      disabled
                      readOnly
                    />
                    <p className="mt-1 text-[11px] text-gray-400">{SHARED_NOTE}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // FEATURE_2610_26 / D46: on the Gmarket · Auction tab every item shows the value ESM receives; only ESM-only items
  // (D17 「주문후 예상 배송기간」) are editable.
  const esmView = (
    <div className="mb-4 space-y-3">
      {esmPreview?.failed ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">G마켓 · 옥션 고시 미리보기를 불러오지 못했습니다.</p>
      ) : esmNotification == null ? (
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-600">
            G마켓 · 옥션 고시 유형: <span className="font-medium text-gray-900">{esmNotification.groupName}</span>
            <span className="ml-1 text-gray-400">(쿠팡 품목군으로 정해집니다)</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {esmNotification.lines.map((line) => (
              <div key={line.code}>
                <label className="mb-1 block text-xs font-medium text-gray-600">{line.name}</label>
                {line.ownKey != null ? (
                  <input
                    type="text"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                    value={noticeValues[line.ownKey] ?? ''}
                    placeholder="비우면 「상품 상세페이지 참조」"
                    onChange={(e) => onNoticeChange(line.ownKey as string, e.target.value)}
                    disabled={disabled}
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                      value={line.value}
                      disabled
                      readOnly
                    />
                    <p className="mt-1 text-[11px] text-gray-400">{SHARED_NOTE}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">카테고리 필수속성 / 상품정보제공고시</h3>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={onlyRequired}
            onChange={(e) => onOnlyRequiredChange(e.target.checked)}
          />
          필수 항목만 보기{requiredCount > 0 && <span className="text-gray-400">({requiredCount})</span>}
        </label>
      </div>

      {tabbed && (
        <div className="mb-3 flex gap-1 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMetaTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
                metaTab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 필수속성 (backend-driven). 중량/용량 페어는 택1 컨트롤로 묶어 렌더.
          선택 채널이 이 속성을 요구하지 않으면(hideCategoryAttrs) 속성부는 숨기고 안내만(값은 보존). */}
      {!showAttributes ? null : hideCategoryAttrs ? (
        <p className="mb-4 rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
          혼합구성(여러 상품) 상품은 쿠팡에 수량/용량/중량 등 속성을 보내지 않습니다(옵션명으로 표현).
        </p>
      ) : (
        (visibleSingles.length > 0 || visiblePairs.length > 0) && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePairs.map((p) => {
            const unit = unitOf(p);
            const activeName = unit === '용량' ? p.volume.name : p.weight.name;
            // 미선택이면 undefined (override 페어와 동일 — activeName 의 weight 폴백을 쓰지 않는다).
            const activeAttr = unit === '용량' ? p.volume : unit === '중량' ? p.weight : undefined;
            return (
              <div key={p.base}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {p.base || '중량/용량'}
                  {isPairRequired(p) && <span className="text-red-600"> *</span>}
                  <span className="ml-1 font-normal text-gray-400">(중량·용량 중 택1)</span>
                </label>
                <div className="flex gap-2">
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
                    placeholder={unit ? unitPlaceholder(activeAttr) || '값 입력' : '구분 먼저 선택'}
                    value={unit ? (attrValues[activeName] ?? '') : ''}
                    onChange={(e) => onAttrChange(activeName, e.target.value)}
                    disabled={disabled || !unit}
                  />
                </div>
              </div>
            );
          })}
          {visibleSingles.map((a) => (
            <div key={a.name}>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {a.name}
                {unitSuffix(a) && <span className="ml-1 font-normal text-gray-400">{unitSuffix(a)}</span>}
                {a.required && <span className="text-red-600"> *</span>}
              </label>
              {a.inputType === 'SELECT' ? (
                <select
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
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
                <Input
                  type={a.inputType === 'NUMBER' ? 'number' : 'text'}
                  size="sm"
                  placeholder={unitPlaceholder(a)}
                  value={attrValues[a.name] ?? ''}
                  onChange={(e) => onAttrChange(a.name, e.target.value)}
                  disabled={disabled}
                />
              )}
            </div>
          ))}
        </div>
        )
      )}

      {/* 상품정보제공고시: 카테고리가 여러 품목군을 줄 수 있어 품목군을 하나 선택해 그 그룹만
          입력·전송한다(선택된 그룹만 마켓에 전송). */}
      {tabbed && metaTab === 'ELEVENST' ? elevenstView : tabbed && metaTab === 'ESM' ? esmView : (
      <div className="mb-4 border-t border-gray-100 pt-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-semibold text-gray-700">상품정보제공고시</h4>
            {noticeGroupNames.length > 0 && (
              <select
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 disabled:bg-gray-100"
                value={activeNoticeGroup}
                onChange={(e) => onNoticeGroupChange?.(e.target.value)}
                disabled={disabled || !onNoticeGroupChange || coupangView}
                aria-label="상품정보제공고시 품목군 선택"
              >
                {noticeGroupNames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
          </div>
          {activeGroupNotices.length > 0 && !coupangView && (
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={refAll}
                onChange={(e) =>
                  onNoticeValuesChange(
                    applyNoticeRefAll(activeGroupNotices, noticeValues, e.target.checked),
                  )
                }
                disabled={disabled}
              />
              전체 상품 상세페이지 참조
            </label>
          )}
        </div>

        {masterNotices.length === 0 ? (
          <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
            이 카테고리에는 입력할 상품정보제공고시 항목이 없습니다.
          </p>
        ) : noticeGroups.length === 0 ? (
          // "필수 항목만 보기"(기본 켜짐)로 전부 걸러진 경우 — 빈 자리로 두면 고장처럼 보인다.
          <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
            이 품목군에는 필수 항목이 없습니다. 「필수 항목만 보기」를 끄면 선택 항목을 입력할 수 있습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {noticeGroups.map(([group, groupNoticeList]) => (
              <div key={group}>
                <p className="mb-2 text-[11px] font-medium text-gray-500">{group}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupNoticeList.map((n) => (
                    <div key={n.key}>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        {n.label}
                        {n.required && <span className="text-red-600"> *</span>}
                        {tabbed && metaTab === 'ALL' && shared != null && !shared.has(n.key) && renderTag(platformName('COUPANG'))}
                      </label>
                      <input
                        type="text"
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                        value={noticeValues[n.key] ?? ''}
                        onChange={(e) => onNoticeChange(n.key, e.target.value)}
                        disabled={disabled || refAll || (coupangView && shared?.has(n.key) === true)}
                      />
                      {/* D99: on the Coupang tab a shared item is edited in 「통합」 only. */}
                      {coupangView && shared?.has(n.key) === true && (
                        <p className="mt-1 text-[11px] text-gray-400">{SHARED_NOTE}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* D97 · D100: the 11st-only items of the 11st type, stored under ELEVENST:{code} (D101). */}
        {tabbed && metaTab === 'ALL' && ownLines.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ownLines.map((line) => (
              <div key={line.code}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {line.name}
                  {renderTag(platformName('ELEVENST'))}
                </label>
                <input
                  type="text"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                  value={noticeValues[line.ownKey as string] ?? ''}
                  placeholder="비우면 「상품 상세페이지 참조」"
                  onChange={(e) => onNoticeChange(line.ownKey as string, e.target.value)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        )}

        {/* FEATURE_2610_26 / D17: the Gmarket · Auction-only items of the ESM group, stored under ESM:{code}. */}
        {tabbed && metaTab === 'ALL' && esmOwnLines.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {esmOwnLines.map((line) => (
              <div key={line.code}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {line.name}
                  {renderTag(platformName('ESM'))}
                </label>
                <input
                  type="text"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                  value={noticeValues[line.ownKey as string] ?? ''}
                  placeholder="비우면 「상품 상세페이지 참조」"
                  onChange={(e) => onNoticeChange(line.ownKey as string, e.target.value)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </>
  );
}
