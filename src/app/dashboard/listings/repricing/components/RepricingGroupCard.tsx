'use client';

import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import type { RepricingGroup, RepricingRow } from '@/domain/entities/RepricingEntity';
import { RepricingTable, formatPercent } from './RepricingTable';
import type { RecentActionMap } from './rowActions';

/** 그룹 실행 배너. green = 전부 성공, amber = 부분 실패/중단, red = 요청 자체 실패 */
export interface RepricingBanner {
  text: string;
  tone: 'green' | 'amber' | 'red';
}

/** 실행 중인 동작. null = 대기 */
export type RepricingAction = 'RECALC' | 'PUSH' | 'OVERRIDE';

interface RepricingGroupCardProps {
  group: RepricingGroup;
  /** 이 그룹(판매자 × 채널)에 속한 행만 */
  rows: RepricingRow[];
  /** 선택된 optionId 목록(전 그룹 공통) */
  selected: number[];
  onToggle: (optionId: number) => void;
  onToggleAll: (optionIds: number[], checked: boolean) => void;
  /** 편집 중인 optionId 목록 = 저장하지 않은 입력값이 있는 행 */
  editing: number[];
  /** optionId → 입력칸 문자열(전 그룹 공통, 부모가 보유) */
  drafts: Record<number, string>;
  onDraftChange: (optionId: number, value: string) => void;
  onEditStart: (optionId: number, initial: string) => void;
  onEditCancel: (optionId: number) => void;
  onSaveRow: (row: RepricingRow, price: number) => void;
  onPushRow: (row: RepricingRow) => void;
  /** 방금 처리한 행의 결과(전 그룹 공통) */
  recent: RecentActionMap;
  /** listingIds = 중복 제거한 셀 목록, optionIds = 고른 옵션 그대로.
   *  unsavedCount = 저장하지 않은 입력값 수 — 재계산이 그 값을 덮는다는 것을 확인창이 말해야 한다 */
  onRecalculate: (listingIds: number[], optionIds: number[], unsavedCount: number) => void;
  onPush: (optionIds: number[]) => void;
  /** 이 그룹에서 실행 중인 동작. 다른 그룹은 계속 쓸 수 있다 */
  busy: RepricingAction | null;
  /** 실행 중인 행(행 단위 실행일 때만) */
  busyOptionId: number | null;
  banner: RepricingBanner | null;
}

const bannerClass = (tone: RepricingBanner['tone']) =>
  tone === 'green'
    ? 'bg-green-50 text-green-700'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';

/**
 * 판매자 × 채널 집계 카드 + 그 그룹의 옵션 표(FEATURE_2609_39 D11 + 2609_43 D3·D6·D7).
 * File: src/app/dashboard/listings/repricing/components/RepricingGroupCard.tsx
 *
 * 묶음 버튼이 카드 **안에** 있는 이유 = 묶음 실행 단위가 판매자 × 채널이기 때문이다(D11).
 * 🔴 묶음 버튼은 둘뿐이다(2609_43 D3·D5): [입력값 저장]은 없앴고, 저장은 행마다 한다.
 * 🔴 선택 안에 **저장하지 않은 입력값**이 있으면 [선택 마켓 반영]을 잠근다(D6) — 옛 값이 나가는 사고를 막는다.
 * 🔴 선택 수를 `상품 N · 옵션 M` 으로 항상 같이 보여준다: 상한 축이 다르다
 *    (재계산 = 상품 200개 / 마켓 반영 = 옵션 200개 — D11·D18).
 */
export function RepricingGroupCard({
  group,
  rows,
  selected,
  onToggle,
  onToggleAll,
  editing,
  drafts,
  onDraftChange,
  onEditStart,
  onEditCancel,
  onSaveRow,
  onPushRow,
  recent,
  onRecalculate,
  onPush,
  busy,
  busyOptionId,
  banner,
}: RepricingGroupCardProps) {
  // 계산 불가 행만 묶음 실행에서 뺀다 — 직접 지정가는 반영 대상이고, 재계산에서만 서버가 건너뛴다(2609_43 D1·D2).
  const selectedRows = rows.filter(
    (r) => r.excluded !== 'UNCALCULABLE' && selected.includes(r.optionId),
  );
  const selectedOptionIds = selectedRows.map((r) => r.optionId);
  const selectedListingIds = Array.from(new Set(selectedRows.map((r) => r.listingId)));
  const hasSelection = selectedOptionIds.length > 0;

  // 🔴 저장하지 않은 입력값 = 편집 중인 행. 선택 안에 하나라도 있으면 묶음 반영을 막는다(D6).
  const unsavedCount = rows.filter((r) => editing.includes(r.optionId)).length;
  const unsavedSelectedCount = selectedRows.filter((r) => editing.includes(r.optionId)).length;

  const handledRows = rows.filter((r) => recent[r.optionId] != null);
  const savedCount = handledRows.filter((r) => recent[r.optionId].kind === 'SAVED').length;
  const pushedCount = handledRows.filter((r) => recent[r.optionId].kind === 'PUSHED').length;

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
          {handledRows.length > 0 && (
            <p className="text-sm text-gray-700">
              이번에 처리: 저장 {savedCount.toLocaleString('ko-KR')} · 반영{' '}
              {pushedCount.toLocaleString('ko-KR')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-gray-500">
            선택 상품 {selectedListingIds.length.toLocaleString('ko-KR')} · 옵션{' '}
            {selectedOptionIds.length.toLocaleString('ko-KR')}
            {unsavedCount > 0 && ` · 미저장 ${unsavedCount.toLocaleString('ko-KR')}`}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy != null || !hasSelection}
              onClick={() => onRecalculate(selectedListingIds, selectedOptionIds, unsavedCount)}
              className="flex items-center gap-1"
            >
              {busy === 'RECALC' ? <Spinner label="재계산 중..." /> : '선택 재계산'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy != null || !hasSelection || unsavedSelectedCount > 0}
              onClick={() => onPush(selectedOptionIds)}
              className="flex items-center gap-1"
            >
              {busy === 'PUSH' && busyOptionId == null ? (
                <Spinner label="반영 중..." />
              ) : (
                '선택 마켓 반영'
              )}
            </Button>
          </div>
          {unsavedSelectedCount > 0 && (
            <span className="text-xs text-red-600">
              저장하지 않은 입력값이 {unsavedSelectedCount.toLocaleString('ko-KR')}건 있습니다
            </span>
          )}
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
          editing={editing}
          drafts={drafts}
          onDraftChange={onDraftChange}
          onEditStart={onEditStart}
          onEditCancel={onEditCancel}
          onSaveRow={onSaveRow}
          onPushRow={onPushRow}
          recent={recent}
          targetMarginRate={group.targetMarginRate}
          disabled={busy != null}
          busyOptionId={busyOptionId}
        />
      </div>

      <p className="text-xs text-gray-500">
        「새 판매가」를 고칠 때 보이는 <span className="font-medium">예상 마진은 추정치</span>입니다 — 확정
        값은 [저장] 후 목록을 다시 불러온 숫자입니다. 저장해도{' '}
        <span className="font-medium">마켓에는 반영되지 않고</span>, 그 행의 [마켓 반영]을 눌러야 실제
        판매가가 바뀝니다. 직접 지정가가 아닌 옵션은 다음 재계산 때 공식값으로 되돌아갑니다.
      </p>

      <p className="text-xs text-gray-500">
        이 마진은 <span className="font-medium">지금 팔면</span> 기준(현재 원가·택배비·박스비)입니다.
        매출 화면의 순이익은 <span className="font-medium">팔린 것</span> 기준이라 숫자가 다릅니다.
      </p>
    </Card>
  );
}
