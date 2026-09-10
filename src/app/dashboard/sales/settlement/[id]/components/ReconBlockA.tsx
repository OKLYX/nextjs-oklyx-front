'use client';

import type { ReconBlockA as BlockA } from '@/domain/entities/Settlement';
import {
  adjustmentLabel,
  adjustmentSign,
  formatMoney,
  formatSigned,
  isInformationalAdjustment,
} from '@/domain/entities/Settlement';

/**
 * 블록 A — <b>정산 상세 내역</b> (지급 묶음 단위, FEATURE_2609_30 / 05 Step 3 · PLAN D9 · D12).
 *
 * 검증식 `Σ라인 + Σ조정 == 쿠팡 지급액` 의 좌우변을 그대로 펼친다. 블록 B(라인 단위)와 위아래로 나누는
 * 이유는 사용자가 <b>어디에 문의할지</b> 알아야 하기 때문이다 — 통장 금액 차이는 플랫폼 정산팀,
 * 라인 차이는 상품·수수료 설정 쪽이다. 섞으면 둘 다 못 물어본다.
 *
 * 🔴 <b>표시 전용이다.</b> 금액을 여기서 다시 더하지 않는다 — 합계·차액·허용오차는 전부 서버(`SettlementReconciler`)가
 * 계산한 값이고, 화면이 따로 더하면 저장값과 다른 답이 나온다.
 * 🔴 `DEDUCTION` 의 ⓘ 문구(`guidance`)는 <b>서버 값을 그대로</b> 쓴다. 쿠팡이 사유를 주지 않으므로
 * 프론트가 추측 문구를 지어내면 리포트 전체를 못 믿게 된다(D13).
 * 🔴 판매 건 0건은 정상이다(D5-4) — 유보금 해제·채무 상환·광고비 정산은 판매 라인이 없다.
 *
 * 🔴 <b>`ourTotal == null` 이면 대조를 하지 않은 것이다</b>(FEATURE_2609_32 / PLAN 2609_32 D2·D3).
 * 추가정산·유보금은 라인을 일부러 귀속시키지 않아 계산하면 100% 차액 −전액이 나온다. 이때는
 * `OCLYX 집계` 행·차액 배지·허용오차를 <b>렌더하지 않는다</b> — 빈칸(`—`)으로 두면 "값을 못 불러왔다"로
 * 읽힌다. 아예 없는 항목이다. 쿠팡이 준 금액 구성(라인 합·조정 행·지급액)은 그대로 남긴다.
 * 🔴 판정은 `reconStatus` 문자열이 아니라 <b>값의 유무</b>로 한다 — 서버가 대조 대상 규칙을 바꿔도
 * 화면이 따로 판단하지 않는다.
 */
interface ReconBlockAProps {
  blockA: BlockA;
  /** "미분류 판매 건 N건 [보기]" — 블록 B 의 미분류 목록을 연다. */
  onShowUnmatched: () => void;
}

export function ReconBlockA({ blockA, onShowUnmatched }: ReconBlockAProps) {
  // 값이 없다 = 서버가 계산하지 않았다(D2). 상태 문자열로 다시 판단하지 않는다.
  const notReconciled = blockA.ourTotal == null;
  const pending = blockA.finalAmount == null;
  const matched =
    !pending && Math.abs(blockA.diff ?? 0) <= Math.abs(blockA.tolerance ?? 0);

  return (
    <section className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900">정산 상세 내역</h2>
        <p className="text-sm text-gray-500">쿠팡이 알려준 금액 구성입니다.</p>
      </div>

      <dl className="divide-y divide-gray-200 text-sm">
        <div className="flex items-center justify-between py-2">
          <dt className="text-gray-700">판매 건별 정산액 합계</dt>
          <dd className="font-medium text-gray-900">{formatMoney(blockA.lineTotal)}</dd>
        </div>

        {blockA.adjustments.map((adjustment, index) => {
          const informational = isInformationalAdjustment(adjustment.type);
          const signed = adjustment.amount == null
            ? null
            : adjustment.amount * (adjustmentSign(adjustment.type) === -1 ? -1 : 1);
          return (
            <div key={`${adjustment.type}-${index}`} className="py-2">
              <div className="flex items-center justify-between">
                <dt className="text-gray-700">
                  {adjustmentLabel(adjustment.type)}
                  {informational && (
                    // 🔴 PENDING_RELEASE·OTHER 는 이번 지급액이 아니라 정보성이라 검증식 합산에서 빠진다.
                    <span className="ml-2 text-xs text-gray-500">정보성 · 합계 제외</span>
                  )}
                </dt>
                <dd className={`font-medium ${informational ? 'text-gray-500' : 'text-gray-900'}`}>
                  {informational ? formatMoney(adjustment.amount) : formatSigned(signed)}
                </dd>
              </div>
              {adjustment.note && (
                <p className="mt-1 text-xs text-gray-500">{adjustment.note}</p>
              )}
              {/* 서버 소유 문구 — 그대로 출력한다(D13). */}
              {adjustment.guidance && (
                <p className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  ⓘ {adjustment.guidance}
                </p>
              )}
            </div>
          );
        })}

        {!notReconciled && (
          <div className="flex items-center justify-between py-2">
            <dt className="font-semibold text-gray-900">OCLYX 집계</dt>
            <dd className="font-semibold text-gray-900">{formatMoney(blockA.ourTotal)}</dd>
          </div>
        )}

        <div className="flex items-center justify-between py-2">
          <dt className="font-semibold text-gray-900">쿠팡 지급액</dt>
          <dd className="flex items-center gap-3">
            <span className="font-semibold text-gray-900">{formatMoney(blockA.finalAmount)}</span>
            {notReconciled ? null : pending ? (
              // 🔴 지급내역 미수신은 실패가 아니다 — 아직 채점할 답안지가 없는 상태다.
              <span className="px-2 py-1 text-xs rounded border bg-gray-50 text-gray-600 border-gray-200">
                ⏳ 지급내역 미수신
              </span>
            ) : matched ? (
              <span className="px-2 py-1 text-xs rounded border bg-green-50 text-green-700 border-green-200">
                ✅ 일치
              </span>
            ) : (
              <span className="px-2 py-1 text-xs rounded border bg-amber-50 text-amber-800 border-amber-200">
                ⚠ 차액 {formatSigned(blockA.diff)}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span>
          미분류 판매 건 {blockA.unmatchedCount.toLocaleString('ko-KR')}건{' '}
          <span className="text-gray-500">(합계에 포함)</span>
        </span>
        {blockA.unmatchedCount > 0 && (
          <button
            type="button"
            onClick={onShowUnmatched}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            보기
          </button>
        )}
        {!pending && !notReconciled && (
          <span className="ml-auto text-xs text-gray-500">
            허용오차 {formatMoney(blockA.tolerance)}원
          </span>
        )}
      </div>
    </section>
  );
}
