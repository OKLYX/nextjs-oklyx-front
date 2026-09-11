'use client';

import type { PayoutSummary } from '@/domain/entities/Settlement';
import {
  formatMoney,
  payoutStatusLabel,
  settlementTypeLabel,
} from '@/domain/entities/Settlement';

/**
 * 채널 행 아래에 붙는 "이 기간 매출에 대한 정산" 목록 (FEATURE_2609_34).
 *
 * 🔴 <b>축이 다르다.</b> 매출은 판매일, 정산은 매출인식월이다. 그래서 목록은 <b>인식월로 묶고</b> 월 머리표를
 * 반드시 보여준다 — 머리표가 없으면 "9월 매출을 보는데 왜 8월 정산이 뜨나"가 된다. 조회 기간이 여러 달이면
 * 달마다 그룹이 하나씩 생긴다.
 *
 * 🔴 <b>합계를 그리지 않는다.</b> 한 달치 정산의 합은 그 달 매출과 축이 달라(판매일 vs 인식월) 나란히 두면
 * 사용자가 두 숫자를 뺀다. 건별 금액과 상세 링크까지가 이 목록의 역할이다.
 *
 * ⚠️ 표시 전용이다. 조회는 컨테이너가 <b>화면당 1회</b> 하고 여기로 내려준다(통합 매출은 판매자 단위,
 * 채널별 매출은 화면 단위) — 채널마다 부르면 채널 수만큼 요청이 나간다. 두 탭이 이 컴포넌트를 공유하므로
 * `sales/components/` 에 둔다.
 *
 * **사용 예**:
 * ```tsx
 * <ChannelPayoutList payouts={payoutsOfThisChannel} onOpen={(id) => router.push(...)} />
 * ```
 */
interface ChannelPayoutListProps {
  /** 이미 <b>이 채널 것만</b> 걸러진 목록. 정렬(인식월 ↓, 지급일 ↑)은 서버가 보장한다. */
  payouts: PayoutSummary[];
  isLoading: boolean;
  error: string;
  onOpen: (payoutId: number) => void;
}

/** 인식월별 묶음. 서버 정렬을 그대로 쓰므로 월 순서·월 안의 순서가 응답 순서와 같다. */
function groupByMonth(payouts: PayoutSummary[]): { month: string; rows: PayoutSummary[] }[] {
  const groups: { month: string; rows: PayoutSummary[] }[] = [];
  for (const payout of payouts) {
    const month = payout.revenueRecognitionMonth ?? '—';
    const last = groups[groups.length - 1];
    if (last && last.month === month) {
      last.rows.push(payout);
    } else {
      groups.push({ month, rows: [payout] });
    }
  }
  return groups;
}

/**
 * 대사 상태 한 줄.
 *
 * 🔴 `PENDING` 을 경고색으로 칠하지 않는다 — 아직 대조할 판매 내역이 없다는 뜻이지 금액이 틀렸다는 뜻이
 * 아니다. 이 구분이 없으면 정상 입금 전건이 경고로 뜬다(이 화면이 실제로 그랬다).
 */
function reconNote(payout: PayoutSummary): { text: string; className: string } {
  switch (payout.reconStatus) {
    case 'RECONCILED':
      return { text: '금액 일치', className: 'text-green-700' };
    case 'UNRECONCILED':
      return { text: '금액 차이', className: 'text-orange-600' };
    case 'AMOUNT_ONLY':
      return { text: '금액만 기록', className: 'text-gray-500' };
    default:
      return {
        text: payout.finalAmount == null ? '지급내역 대기' : '대사 전',
        className: 'text-gray-500',
      };
  }
}

/** `2026-08` → `2026년 8월`. 값이 없으면 원문 그대로 둔다(모르는 모양을 지어내지 않는다). */
function monthLabel(month: string): string {
  const parsed = /^(\d{4})-(\d{2})$/.exec(month);
  return parsed ? `${parsed[1]}년 ${Number(parsed[2])}월` : month;
}

export function ChannelPayoutList({ payouts, isLoading, error, onOpen }: ChannelPayoutListProps) {
  if (isLoading) {
    return <div className="h-5 w-64 bg-gray-200 rounded animate-pulse" />;
  }

  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }

  if (payouts.length === 0) {
    // 🔴 "정산이 없다"가 아니라 "아직 없다"로 쓴다 — 판매 직후에는 없는 것이 정상이다(축이 다르다).
    return (
      <p className="text-xs text-gray-500">
        이 기간 매출에 대한 정산이 아직 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {groupByMonth(payouts).map((group) => (
        <div key={group.month}>
          <p className="text-xs font-medium text-gray-500">{monthLabel(group.month)} 매출분</p>
          <ul className="mt-1 space-y-1">
            {group.rows.map((payout) => {
              const recon = reconNote(payout);
              return (
                <li key={payout.payoutId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-gray-700">{settlementTypeLabel(payout.settlementType)}</span>
                  <span className="text-gray-900 tabular-nums">
                    {formatMoney(payout.finalAmount)}원
                  </span>
                  {/* 🔴 날짜는 `settlementDate` 다 — `finalSettlementDate` 는 지급내역 API 가 주지 않아
                      항상 비어 있다(2026-09-11 문서 확인). 그걸 쓰면 날짜가 영영 안 보인다. */}
                  <span className="text-gray-500">
                    지급 {payoutStatusLabel(payout.status)}
                    {payout.settlementDate ? ` ${payout.settlementDate.slice(5)}` : ''}
                  </span>
                  <span className={recon.className}>{recon.text}</span>
                  <button
                    type="button"
                    onClick={() => onOpen(payout.payoutId)}
                    className="text-blue-700 hover:underline"
                  >
                    상세 →
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
