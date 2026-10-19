'use client';

import type { ReconBlockA as BlockA } from '@/domain/entities/Settlement';
import { Card } from '@/presentation/components/ui/Card';
import {
  adjustmentLabel,
  adjustmentSign,
  formatMoney,
  formatSigned,
  isInformationalAdjustment,
  marketName,
  withSubjectParticle,
} from '@/domain/entities/Settlement';

/**
 * Block A — <b>settlement detail</b> (per payout, FEATURE_2609_30 / 05 Step 3 · PLAN D9 · D12).
 *
 * Lays out both sides of `Σ lines + Σ adjustments == {market} paid amount` as they are. It is split from block B
 * (per line) because the user has to know <b>where to ask</b> — a bank-amount difference goes to the platform's
 * settlement team, a line difference to the product · commission settings. Mixed, neither can be asked.
 *
 * 🔴 <b>Display only.</b> No amount is summed again here — totals, differences and tolerance are all computed by the
 * server (`SettlementReconciler`); adding on screen gives a different answer from the stored values.
 * 🔴 The `DEDUCTION` ⓘ text (`guidance`) is <b>the server's value as is</b>. The market gives no reason, so a
 * guessed text invented here would make the whole report untrustworthy (D13).
 * 🔴 Zero sale lines is normal (D5-4) — reserve releases, debt repayments and ad settlements carry no lines.
 *
 * 🔴 <b>`ourTotal == null` means no comparison was made</b> (FEATURE_2609_32 / PLAN 2609_32 D2 · D3). Additional and
 * reserve payouts deliberately carry no attributed lines, so computing would give a 100% "diff −full amount" — and
 * an 11st payout has no platform total at all (FEATURE_2610_20 / D29). Then the 「OCLYX 집계」 row, the diff badge and
 * the tolerance are <b>not rendered</b> — a blank (`—`) would read as "failed to load"; the items simply do not
 * exist. The amount breakdown the market gave (line sum · adjustments · paid amount) stays.
 * 🔴 The decision uses <b>whether the value exists</b>, not the `reconStatus` string — if the server changes which
 * payouts are compared, the screen does not decide on its own.
 *
 * The 「{market}」 words use the payout channel's market name (`platform`, FEATURE_2610_20 / D14).
 */
interface ReconBlockAProps {
  blockA: BlockA;
  /** The payout channel's platform — names the market in the texts (D14). */
  platform: string | null;
  /** "미분류 판매 건 N건 [보기]" — 블록 B 의 미분류 목록을 연다. */
  onShowUnmatched: () => void;
}

export function ReconBlockA({ blockA, platform, onShowUnmatched }: ReconBlockAProps) {
  // 값이 없다 = 서버가 계산하지 않았다(D2). 상태 문자열로 다시 판단하지 않는다.
  const notReconciled = blockA.ourTotal == null;
  const pending = blockA.finalAmount == null;
  const matched =
    !pending && Math.abs(blockA.diff ?? 0) <= Math.abs(blockA.tolerance ?? 0);

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900">정산 상세 내역</h2>
        <p className="text-sm text-gray-500">
          {withSubjectParticle(marketName(platform))} 알려준 금액 구성입니다.
        </p>
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
          <dt className="font-semibold text-gray-900">{marketName(platform)} 지급액</dt>
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
    </Card>
  );
}
