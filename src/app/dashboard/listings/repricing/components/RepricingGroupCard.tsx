'use client';

import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import type { RepricingGroup, RepricingRow } from '@/domain/entities/RepricingEntity';
import { RepricingTable, formatPercent } from './RepricingTable';

/** 그룹 실행 배너. green = 전부 성공, amber = 부분 실패/중단, red = 요청 자체 실패 */
export interface RepricingBanner {
  text: string;
  tone: 'green' | 'amber' | 'red';
}

/** 실행 중인 동작. null = 대기 */
export type RepricingAction = 'RECALC' | 'PUSH';

interface RepricingGroupCardProps {
  group: RepricingGroup;
  /** 이 그룹(판매자 × 채널)에 속한 행만 */
  rows: RepricingRow[];
  /** 선택된 optionId 목록(전 그룹 공통) */
  selected: number[];
  onToggle: (optionId: number) => void;
  onToggleAll: (optionIds: number[], checked: boolean) => void;
  /** listingIds = 중복 제거한 셀 목록, optionIds = 고른 옵션 그대로 */
  onRecalculate: (listingIds: number[], optionIds: number[]) => void;
  onPush: (optionIds: number[]) => void;
  /** 이 그룹에서 실행 중인 동작. 다른 그룹은 계속 쓸 수 있다 */
  busy: RepricingAction | null;
  banner: RepricingBanner | null;
}

const bannerClass = (tone: RepricingBanner['tone']) =>
  tone === 'green'
    ? 'bg-green-50 text-green-700'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';

/**
 * 판매자 × 채널 집계 카드 + 그 그룹의 옵션 표(FEATURE_2609_39 / PLAN D11).
 * File: src/app/dashboard/listings/repricing/components/RepricingGroupCard.tsx
 *
 * 실행 버튼이 카드 **안에** 있는 이유 = 실행 단위가 판매자 × 채널이기 때문이다(D11).
 * 🔴 선택 수를 `상품 N · 옵션 M` 으로 항상 같이 보여준다: 상한 축이 다르다
 *    (재계산 = 상품 200개 / 마켓 반영 = 옵션 200개 — D11·D18).
 */
export function RepricingGroupCard({
  group,
  rows,
  selected,
  onToggle,
  onToggleAll,
  onRecalculate,
  onPush,
  busy,
  banner,
}: RepricingGroupCardProps) {
  const selectedRows = rows.filter((r) => r.excluded == null && selected.includes(r.optionId));
  const selectedOptionIds = selectedRows.map((r) => r.optionId);
  const selectedListingIds = Array.from(new Set(selectedRows.map((r) => r.listingId)));
  const hasSelection = selectedOptionIds.length > 0;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {group.sellerName} · {group.platform}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            대상 {group.optionCount.toLocaleString('ko-KR')}건 · 대응 필요{' '}
            {group.belowCount.toLocaleString('ko-KR')}건(직접 지정{' '}
            {group.belowManualCount.toLocaleString('ko-KR')}건) · 미반영{' '}
            {group.pendingPushCount.toLocaleString('ko-KR')}건
          </p>
          <p className="text-sm text-gray-600">목표 마진율 {formatPercent(group.targetMarginRate)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-gray-500">
            선택 상품 {selectedListingIds.length.toLocaleString('ko-KR')} · 옵션{' '}
            {selectedOptionIds.length.toLocaleString('ko-KR')}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy != null || !hasSelection}
              onClick={() => onRecalculate(selectedListingIds, selectedOptionIds)}
              className="flex items-center gap-1"
            >
              {busy === 'RECALC' ? <Spinner label="재계산 중..." /> : '선택 재계산'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy != null || !hasSelection}
              onClick={() => onPush(selectedOptionIds)}
              className="flex items-center gap-1"
            >
              {busy === 'PUSH' ? <Spinner label="반영 중..." /> : '선택 마켓 반영'}
            </Button>
          </div>
        </div>
      </div>

      {banner && (
        <p className={`rounded px-3 py-2 text-sm ${bannerClass(banner.tone)}`}>{banner.text}</p>
      )}

      <div className="list-table-scroll">
        <RepricingTable
          rows={rows}
          selected={selected}
          onToggle={onToggle}
          onToggleAll={onToggleAll}
          disabled={busy != null}
        />
      </div>

      <p className="text-xs text-gray-500">
        이 마진은 <span className="font-medium">지금 팔면</span> 기준(현재 원가·택배비·박스비)입니다.
        매출 화면의 순이익은 <span className="font-medium">팔린 것</span> 기준이라 숫자가 다릅니다.
      </p>
    </Card>
  );
}
