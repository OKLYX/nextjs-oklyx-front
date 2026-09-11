'use client';

import type { ReconLineView } from '@/domain/entities/Settlement';
import { ReconLineTable } from './ReconLineTable';

/**
 * 이 지급 묶음이 <b>어떤 주문에 대한 정산인지</b> 그대로 펼친 목록 (FEATURE_2609_34).
 *
 * 🔴 아래 차이 리포트의 목록과 <b>같은 데이터</b>지만 성격이 다르다. 저쪽은 "왜 금액이 어긋났나"를 원인
 * 라벨로 좁혀 들어가는 드릴다운이고, 이쪽은 <b>묻지 않아도 보이는 전체 목록</b>이다 — 대사가 맞든 안 맞든
 * "이 돈이 어느 주문 값인가"는 언제나 답할 수 있어야 한다.
 *
 * 🔴 <b>비어 있을 때 이유를 밝힌다.</b> 라인은 쿠팡 <b>매출내역</b> 조회로만 들어오고, 지급내역만 받아 둔
 * 채널은 이 목록이 0건이다. 그냥 "없습니다" 라고만 하면 정산에 주문이 없다는 뜻으로 읽힌다.
 *
 * ⚠️ 표시 전용이다 — 조회·클립보드는 `PayoutDetailContainer` 가 소유한다.
 */
interface PayoutOrderListProps {
  lines: ReconLineView[];
  loading: boolean;
  error: string;
  onCopyIdentifiers: (line: ReconLineView) => void;
}

export function PayoutOrderList({
  lines,
  loading,
  error,
  onCopyIdentifiers,
}: PayoutOrderListProps) {
  const isEmpty = !loading && !error && lines.length === 0;

  return (
    <section className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-sm font-semibold text-gray-900">이 정산에 포함된 주문</h2>
        {!loading && !error && lines.length > 0 && (
          <span className="text-xs text-gray-500">
            {lines.length.toLocaleString('ko-KR')}건 · 인식일 기준
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="px-6 pb-6 text-sm text-gray-500">
          판매 내역이 아직 적재되지 않았습니다. 정산 화면의 [갱신]으로 매출내역을 불러오면 이 정산에
          포함된 주문이 여기 나옵니다.
          {/* 🔴 이 문장을 지우지 말 것 — 0건의 이유가 "주문이 없다"가 아니라 "아직 안 가져왔다"다. */}
        </div>
      ) : (
        <ReconLineTable
          lines={lines}
          loading={loading}
          error={error}
          onCopyIdentifiers={onCopyIdentifiers}
        />
      )}
    </section>
  );
}
