'use client';

import type { SalesLine } from '@/domain/entities/SalesSummary';
import { formatMoney } from '@/domain/entities/SalesSummary';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';

/**
 * 판매 내역 — 이 채널의 매출이 <b>어느 주문에서</b> 나왔는지 (FEATURE_2609_34).
 *
 * 🔴 <b>이 목록이 이 화면의 답이다.</b> 위의 합계와 상품별 요약은 "얼마나·무엇이"를 말하지만, 그 숫자가
 * 어디서 왔는지는 여기서만 보인다 — 주문번호가 있어야 마켓 관리자 화면과 대조할 수 있다.
 *
 * 🔴 <b>취소·환불대기 라인을 기본값으로 숨기지 않는다.</b> 취소분은 유효수량에서 이미 빠져 있고(금액도
 * 그만큼 작다), 환불대기는 아직 확정이 아니라 매출에 남아 있다(D14) — 감추면 합계가 안 맞는 이유가
 * 화면에서 사라진다. 대신 <b>빨간 음영</b>으로 눈에 띄게 하고, 체크박스로 사용자가 직접 걷어낼 수 있게 한다.
 *
 * ⚠️ 체크박스는 <b>표시만</b> 거른다 — 위 요약 카드의 합계는 서버가 낸 값이라 그대로다. 그래서 걸러낸
 * 상태에서는 목록의 합이 카드와 다를 수 있다(의도된 것이고, 그래서 걸러낸 건수를 함께 보여준다).
 *
 * ⚠️ 금액은 서버가 집계와 같은 식으로 계산해 준 값이다 — 단가 × 수량을 화면에서 다시 곱하지 말 것.
 * ⚠️ 합계 줄을 만들지 않는다 — 위 요약이 서버가 계산한 합계다.
 *
 * 🔴 <b>`list-table-scroll` 을 쓰지 않는다</b>(사용자 요청 2026-09-10). 그 클래스는 표에 최소폭 736px 과
 * {@code white-space: nowrap} 을 걸어 상품명이 길면 표 전체가 가로로 밀린다. 여기서는 열 너비를 고정하고
 * (`table-fixed` + `colgroup`) <b>상품명만 두 줄까지 줄바꿈</b>해서 가로 스크롤 없이 한 화면에 담는다.
 * 숫자·날짜 칸은 각자 {@code whitespace-nowrap} 이라 쪼개지지 않는다.
 * 그래서 표면도 `TableCard`(가로 스크롤 포함)가 아니라 `Card` + `StateBlock` 조합을 쓴다.
 */
interface ChannelSaleRecordsProps {
  /** 필터 <b>전</b> 전체 목록. 걸러내기는 이 컴포넌트가 한다(체크박스 상태는 부모가 소유). */
  rows: SalesLine[];
  isLoading: boolean;
  error: string;
  /** 취소확정(환불완료) 행 숨기기. */
  hideCanceled: boolean;
  /** 취소처리중(환불대기) 행 숨기기. */
  hidePending: boolean;
  onHideCanceledChange: (next: boolean) => void;
  onHidePendingChange: (next: boolean) => void;
}

/** `2026-09-04T10:32:11` → `09-04 10:32`. 값이 없으면 `—`. */
function formatSoldAt(value: string | null): string {
  if (!value) return '—';
  const [date, time] = value.split('T');
  return `${date.slice(5)} ${(time ?? '').slice(0, 5)}`.trim();
}

export function ChannelSaleRecords({
  rows,
  isLoading,
  error,
  hideCanceled,
  hidePending,
  onHideCanceledChange,
  onHidePendingChange,
}: ChannelSaleRecordsProps) {
  // 필터는 파생값이다 — 걸러낸 목록을 state 로 들면 원본이 바뀔 때마다 동기화해야 한다.
  const visible = rows.filter(
    (row) => !(hideCanceled && row.cancelQty > 0) && !(hidePending && row.holdQty > 0)
  );
  const hiddenCount = rows.length - visible.length;

  const filters = (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs">
      <label className="flex items-center gap-1.5 text-gray-700">
        <input
          type="checkbox"
          checked={hideCanceled}
          onChange={(e) => onHideCanceledChange(e.target.checked)}
          className="rounded border-gray-300"
        />
        취소확정(환불완료) 제거
      </label>
      <label className="flex items-center gap-1.5 text-gray-700">
        <input
          type="checkbox"
          checked={hidePending}
          onChange={(e) => onHidePendingChange(e.target.checked)}
          className="rounded border-gray-300"
        />
        취소처리중(환불대기) 제거
      </label>
      {hiddenCount > 0 && (
        // 🔴 걸러낸 건수를 밝힌다 — 밝히지 않으면 목록 합계가 위 카드와 왜 다른지 알 수 없다.
        <span className="text-gray-500">{hiddenCount.toLocaleString('ko-KR')}건 숨김</span>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card padded={false}>
        <StateBlock variant="loading" message="불러오는 중..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card padded={false}>
        <StateBlock variant="error" message={error} />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card padded={false}>
        <StateBlock variant="empty" message="이 기간에 이 채널에서 판매된 주문이 없습니다." />
      </Card>
    );
  }

  return (
    <Card padded={false} className="overflow-hidden">
      {filters}
      {visible.length === 0 ? (
        <StateBlock variant="empty" message="걸러낸 조건에 맞는 주문이 없습니다." />
      ) : (
        <table className="w-full table-fixed text-sm">
          {/* 🔴 상품 칸은 다른 칸의 약 2배다 — 상품명이 길어서 가로 스크롤을 만들던 자리라 여기만 넓힌다. */}
          <colgroup>
            <col className="w-[11%]" />
            <col className="w-[16%]" />
            <col className="w-[27%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">판매일</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">주문번호</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">상품</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">취소 | 판매수량</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">단가</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">매출액</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">할인</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visible.map((row) => (
              // 🔴 취소가 걸린 행은 빨간 음영 — 금액이 0 이거나 빠질 수 있는 행이라 한눈에 갈려야 한다.
              <tr
                key={row.orderLineId}
                className={`align-top ${
                  row.cancelQty > 0 || row.holdQty > 0
                    ? 'bg-red-50 hover:bg-red-100'
                    : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                  {formatSoldAt(row.orderedAt)}
                </td>
                <td className="px-4 py-2 text-gray-700 tabular-nums whitespace-nowrap">
                  {row.externalOrderId}
                </td>
                {/* 🔴 두 줄까지만 보이고 넘치면 말줄임이다 — 세 줄짜리 상품명 하나가 표 전체 높이를 흔들지
                  않게. 잘린 이름은 `title` 로 전문을 준다. */}
                <td className="px-4 py-2 text-gray-700">
                  <span className="line-clamp-2 break-words" title={row.itemName ?? undefined}>
                    {row.itemName ?? '—'}
                    {row.masterProductName == null && (
                      <span
                        className="ml-1 text-gray-400"
                        title="채널 옵션에 연결되지 않은 주문입니다. 매출에는 포함됩니다"
                      >
                        (상품 미연결)
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <span
                    className={row.cancelQty > 0 ? 'font-semibold text-red-600' : 'text-gray-400'}
                    title="취소가 확정된 수량입니다. 매출액에서는 이미 빠져 있습니다"
                  >
                    {row.cancelQty.toLocaleString('ko-KR')}
                  </span>
                  <span className="mx-1 text-gray-300">|</span>
                  <span className="text-gray-700">{row.netQty.toLocaleString('ko-KR')}</span>
                  {row.holdQty > 0 && (
                    <span
                      className="ml-1 text-xs text-red-500"
                      title="환불대기 수량입니다. 아직 확정이 아니라 매출액에 남아 있습니다"
                    >
                      (대기 {row.holdQty})
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-gray-500 whitespace-nowrap">
                  {formatMoney(row.unitPrice)}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                  {formatMoney(row.grossSales)}
                </td>
                <td className="px-4 py-2 text-right text-gray-500 whitespace-nowrap">
                  {formatMoney(row.discount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
