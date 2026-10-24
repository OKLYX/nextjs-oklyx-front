'use client';

import { Fragment } from 'react';
import type { ProductProfit } from '@/domain/entities/SalesSummary';
import { PROFIT_PENDING_HINT, formatMoney, formatProfit } from '@/domain/entities/SalesSummary';
import type { MasterSaving } from '@/domain/entities/PackingSavingsEntity';
import {
  SAVINGS_NO_RECORD_HINT,
  formatParcelCount,
  formatSaving,
  savingToneClass,
} from '@/domain/entities/PackingSavingsEntity';
import { Card } from '@/presentation/components/ui/Card';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { Button } from '@/presentation/components/ui/Button';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { SalesValueRow } from '../../components/SalesValueRow';

/** 정렬 가능한 축. 문자열 축(상품명)은 정렬하지 않는다 — 이 표의 질문은 "얼마 남나"다. */
export type ProductProfitSortKey = 'netQty' | 'grossSales' | 'estNetProfit';

interface ProductProfitTableProps {
  rows: ProductProfit[];
  /** 채널 컬럼 표시 여부 = `crossChannel === false`. */
  showChannel: boolean;
  /**
   * 마스터 상품별 포장 절약 (FEATURE_2609_41 / PLAN 2609_41 S16).
   * 🔴 없는 키 = <b>포장 기록 없음</b>이라 `—` 다 — `0원` 과 다른 상태다(S1).
   */
  savingsByMaster: Map<number, MasterSaving>;
  /** 펼쳐 옵션별 절약을 보고 있는 마스터. 🔴 `crossChannel === false` 면 항상 null 이다(S13). */
  expandedSavingsMasterId: number | null;
  onToggleSavings: (masterProductId: number) => void;
  sortKey: ProductProfitSortKey;
  sortDir: 'asc' | 'desc';
  loading: boolean;
  error: string;
  onSort: (key: ProductProfitSortKey) => void;
  onRetry: () => void;
}

const UNCATEGORIZED_HINT = '채널 옵션 연결이 없는 주문';

/** Sort choices of the narrow-screen card view (FEATURE_2610_31 D31) — the table's sortable column names. */
const SORT_LABELS: { key: ProductProfitSortKey; label: string }[] = [
  { key: 'netQty', label: '판매수량' },
  { key: 'grossSales', label: '매출액' },
  { key: 'estNetProfit', label: '순이익(추정)' },
];

/** 🔴 한 박스에 같은 상품의 옵션이 여러 개 담기면 중복해 세는 값이다 — 칸 툴팁으로 밝힌다. */
const PARCEL_COUNT_HINT = '이 상품이 담긴 박스 수입니다. 한 박스에 옵션이 여러 개 담기면 중복해 셉니다';

/**
 * 🔴 열을 추가하면 이 수를 같이 올린다 — 옵션별 절약 펼침 행의 `colSpan` 이 이 값을 먹는다.
 * (상품 · 판매수량 · 매출액 · 할인 · 수수료 · 순이익 · 포장 절약 · 박스 수)
 */
const BASE_COLUMN_COUNT = 8;

/**
 * 상품별 매출 표 (FEATURE_2609_30 / 04 Step 4).
 *
 * 🔴 `미분류` 행을 숨기지 않는다. 맨 아래 회색으로 남긴다 — 숨기면 이 목록의 합계가 판매자 요약과
 * 어긋나는 이유를 아무도 설명하지 못한다.
 *
 * 🔴 <b>포장 절약은 옵션 단위로 오는데 이 표의 행은 마스터 단위다</b>(PLAN 2609_41 S16) — 마스터 행에
 * 합계를 보이고 펼쳤을 때만 옵션별로 내린다. 절약 기록이 없는 마스터는 <b>펼침 자체를 막는다</b>
 * (빈 서랍을 열게 하지 않는다).
 *
 * 🔴 <b>채널별로 쪼갠 보기에서는 절약 열이 전부 `—` 다</b>(S13). 포장은 창고 행위라 채널로 나눌 수 없고,
 * 같은 절약을 채널 행마다 반복하면 합계가 부풀어 보인다. 안내 한 줄은 Container 가 표 위에 그린다.
 *
 * 🔴 <b>기존 손익 열의 계산은 바뀌지 않는다</b>(S6) — 절약은 옆에 붙는 별개 숫자다.
 *
 * ⚠️ 표시 전용이다. 정렬 상태·조회·펼침은 Container 가 소유한다(두 보기 방식이 같은 표를 재사용한다).
 */
export function ProductProfitTable({
  rows,
  showChannel,
  savingsByMaster,
  expandedSavingsMasterId,
  onToggleSavings,
  sortKey,
  sortDir,
  loading,
  error,
  onSort,
  onRetry,
}: ProductProfitTableProps) {
  if (error) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <Button
          type="button"
          onClick={onRetry}
        >
          다시 시도
        </Button>
      </Card>
    );
  }

  const sortMark = (key: ProductProfitSortKey) =>
    sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  const columnCount = BASE_COLUMN_COUNT + (showChannel ? 1 : 0);
  // 🔴 채널별 보기에서는 절약을 아예 내지 않는다(S13) — 행마다 같은 값을 반복하면 합계가 부풀어 보인다.
  const savingOf = (row: ProductProfit): MasterSaving | undefined =>
    showChannel || row.masterProductId == null
      ? undefined
      : savingsByMaster.get(row.masterProductId);

  // Option savings of one master — under the table row and inside the narrow-screen card. Narrow-screen cards
  // (FEATURE_2610_31 D14 · D25): the app's option line — 「└ 옵션」, the saving and 「N박스」.
  const optionSavings = (saving: MasterSaving) => (
    <DataCardSwitch
      placement="nested"
      renderCards={() =>
        saving.options.map((option) => (
          <DataCard
            key={option.masterOptionId ?? option.masterOptionName}
            body={
              <div className="flex items-center gap-3 text-[13px]">
                <span className="min-w-0 flex-1 text-gray-900">└ {option.masterOptionName ?? '(옵션명 없음)'}</span>
                <span className={savingToneClass(option.totalSaving)}>{formatSaving(option.totalSaving)}</span>
                <span className="text-gray-500" title={PARCEL_COUNT_HINT}>
                  {formatParcelCount(option.parcelCount)}박스
                </span>
              </div>
            }
          />
        ))
      }
    >
      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr className="text-gray-500">
            <th className="px-3 py-2 text-left font-medium">옵션</th>
            <th className="px-3 py-2 text-right font-medium">포장 절약</th>
            <th className="px-3 py-2 text-right font-medium" title={PARCEL_COUNT_HINT}>
              박스 수
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {saving.options.map((option) => (
            <tr key={option.masterOptionId ?? option.masterOptionName}>
              <td className="px-3 py-2 text-gray-700">└ {option.masterOptionName ?? '(옵션명 없음)'}</td>
              <td className={`px-3 py-2 text-right ${savingToneClass(option.totalSaving)}`}>
                {formatSaving(option.totalSaving)}
              </td>
              <td className="px-3 py-2 text-right text-gray-500">{formatParcelCount(option.parcelCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataCardSwitch>
  );

  // Narrow-screen cards (FEATURE_2610_31 D14 · D31 · D33): the app's product sales card — 「▸ name」 (gray for the
  // uncategorized row), the uncategorized line, 「채널 …」 in the channel view, then 「판매수량」 · 「매출액」 · 「할인」 ·
  // 「수수료(추정)」 · 「순이익(추정)」 · 「포장 절약」 · 「박스 수」 lines; a tap on an expandable card opens the option savings
  // inside it. The sort select and the direction button sit above the cards.
  const renderCards = () =>
    rows.map((row) => {
      const saving = savingOf(row);
      const expandable = saving != null && saving.options.length > 0;
      const isExpanded = expandable && expandedSavingsMasterId === saving.masterProductId;
      const channel = row.accountAlias?.trim()
        ? row.accountAlias
        : row.accountId != null
          ? `채널 #${row.accountId}`
          : '-';
      return (
        <DataCard
          key={`${row.masterProductId ?? 'uncategorized'}:${row.accountId ?? 'all'}`}
          onClick={saving && expandable ? () => onToggleSavings(saving.masterProductId) : undefined}
          title={
            <span className={`font-semibold ${row.uncategorized ? 'text-gray-500' : ''}`}>
              {expandable ? (isExpanded ? '▾ ' : '▸ ') : ''}
              {row.masterProductName}
            </span>
          }
          body={
            <div className="space-y-0.5">
              {row.uncategorized && <p className="text-xs text-gray-500">{UNCATEGORIZED_HINT}</p>}
              {showChannel && <p className="text-xs text-gray-500">채널 {channel}</p>}
              <div className="pt-1" />
              <SalesValueRow label="판매수량" value={row.netQty.toLocaleString('ko-KR')} />
              <SalesValueRow label="매출액" value={formatMoney(row.grossSales)} bold />
              <SalesValueRow label="할인" value={formatMoney(row.discount)} />
              <SalesValueRow label="수수료(추정)" value={formatMoney(row.estFee)} />
              <SalesValueRow
                label="순이익(추정)"
                value={formatProfit(row)}
                hint={row.costBasisReady ? undefined : PROFIT_PENDING_HINT}
              />
              {!showChannel && (
                <>
                  <SalesValueRow
                    label="포장 절약"
                    sub="포장한 날 기준"
                    value={formatSaving(saving?.totalSaving)}
                    tone={savingToneClass(saving?.totalSaving)}
                    hint={
                      saving
                        ? '포장한 날 기준입니다. 왼쪽 손익은 주문일 기준이라 기간이 덮는 주문이 다릅니다'
                        : SAVINGS_NO_RECORD_HINT
                    }
                  />
                  <SalesValueRow
                    label="박스 수"
                    value={formatParcelCount(saving?.parcelCount)}
                    hint={saving ? PARCEL_COUNT_HINT : SAVINGS_NO_RECORD_HINT}
                  />
                </>
              )}
            </div>
          }
          expansion={isExpanded && saving ? optionSavings(saving) : undefined}
        />
      );
    });

  return (
    <TableCard
      isLoading={loading && rows.length === 0}
      isEmpty={rows.length === 0}
      emptyMessage="해당 기간에 판매된 주문이 없습니다."
      renderCards={renderCards}
      cardsToolbar={
        <div className="flex items-center gap-2 max-md:flex-wrap">
          <select
            aria-label="정렬"
            value={sortKey}
            onChange={(e) => onSort(e.target.value as ProductProfitSortKey)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            {SORT_LABELS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={() => onSort(sortKey)}>
            {sortDir === 'desc' ? '▼' : '▲'}
          </Button>
        </div>
      }
    >
      {loading && rows.length > 0 && (
        <div className="px-6 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
          조회 중...
        </div>
      )}
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품</th>
            {showChannel && (
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">채널</th>
            )}
            <th
              onClick={() => onSort('netQty')}
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer select-none"
            >
              판매수량{sortMark('netQty')}
            </th>
            <th
              onClick={() => onSort('grossSales')}
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer select-none"
            >
              매출액{sortMark('grossSales')}
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">할인</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              수수료(추정)
            </th>
            <th
              onClick={() => onSort('estNetProfit')}
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer select-none"
            >
              순이익(추정){sortMark('estNetProfit')}
            </th>
            {/* 🔴 포장 절약은 손익과 다른 기준일(포장 완료일)이다(S7) — 헤더가 그 사실을 달고 있어야 한다. */}
            <th
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900"
              title="포장한 날 기준입니다. 왼쪽 손익은 주문일 기준이라 기간이 덮는 주문이 다릅니다"
            >
              포장 절약
              <span className="block text-[11px] font-normal text-gray-500">포장한 날 기준</span>
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900" title={PARCEL_COUNT_HINT}>
              박스 수
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => {
            const saving = savingOf(row);
            // 🔴 절약이 없는 마스터는 펼침 자체를 막는다 — 빈 서랍을 열게 하지 않는다.
            const expandable = saving != null && saving.options.length > 0;
            const isExpanded = expandable && expandedSavingsMasterId === saving.masterProductId;
            return (
              <Fragment key={`${row.masterProductId ?? 'uncategorized'}:${row.accountId ?? 'all'}`}>
            <tr
              onClick={saving && expandable ? () => onToggleSavings(saving.masterProductId) : undefined}
              className={`${row.uncategorized ? 'bg-gray-50 text-gray-500' : ''} ${
                expandable ? 'cursor-pointer hover:bg-gray-50' : ''
              }`}
            >
              <td
                className="px-6 py-3 text-sm"
                title={row.uncategorized ? UNCATEGORIZED_HINT : undefined}
              >
                {expandable && <span className="mr-1 text-gray-400">{isExpanded ? '▾' : '▸'}</span>}
                {row.masterProductName}
              </td>
              {showChannel && (
                <td className="px-6 py-3 text-sm text-gray-700">
                  {row.accountAlias?.trim()
                    ? row.accountAlias
                    : row.accountId != null
                      ? `채널 #${row.accountId}`
                      : '-'}
                </td>
              )}
              <td className="px-6 py-3 text-sm text-right">{row.netQty.toLocaleString('ko-KR')}</td>
              <td className="px-6 py-3 text-sm text-right font-semibold">
                {formatMoney(row.grossSales)}
              </td>
              <td className="px-6 py-3 text-sm text-right text-gray-500">
                {formatMoney(row.discount)}
              </td>
              <td className="px-6 py-3 text-sm text-right text-gray-500">
                {formatMoney(row.estFee)}
              </td>
              <td
                className="px-6 py-3 text-sm text-right"
                title={row.costBasisReady ? undefined : PROFIT_PENDING_HINT}
              >
                {formatProfit(row)}
              </td>
              {/* 🔴 기록이 없으면 `0원` 이 아니라 `—` 다(S1) — 0 은 "절약을 못 했다"로 읽힌다. */}
              <td
                className={`px-6 py-3 text-sm text-right ${savingToneClass(saving?.totalSaving)}`}
                title={saving ? undefined : SAVINGS_NO_RECORD_HINT}
              >
                {formatSaving(saving?.totalSaving)}
              </td>
              <td
                className="px-6 py-3 text-sm text-right text-gray-500"
                title={saving ? PARCEL_COUNT_HINT : SAVINGS_NO_RECORD_HINT}
              >
                {formatParcelCount(saving?.parcelCount)}
              </td>
            </tr>
            {/* 🔴 절약은 옵션 단위라 마스터 행에는 합계만 보이고, 펼쳤을 때만 옵션별로 내린다(S16). */}
            {isExpanded && saving && (
              <tr className="bg-gray-50">
                <td colSpan={columnCount} className="px-6 py-3">
                  {optionSavings(saving)}
                </td>
              </tr>
            )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
