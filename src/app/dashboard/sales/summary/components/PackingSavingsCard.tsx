'use client';

import type { SavingsSummary } from '@/domain/entities/PackingSavingsEntity';
import {
  SAVINGS_BASIS_NOTICE,
  SAVINGS_OVERLAP_NOTICE,
  SAVINGS_PROFIT_NOTICE,
  formatSaving,
  savingToneClass,
} from '@/domain/entities/PackingSavingsEntity';
import { Card } from '@/presentation/components/ui/Card';

interface PackingSavingsCardProps {
  /** 조회 전·실패 시 null. */
  summary: SavingsSummary | null;
  isLoading: boolean;
  error: string;
}

/**
 * 이 기간에 포장으로 아낀 금액 (FEATURE_2609_41 / PLAN 2609_41 S6 · S7 · S10 · S14).
 *
 * 🔴 <b>기준일이 같은 화면의 매출과 다르다</b>(S7) — 여기는 포장한 날, 매출은 주문일이다.
 * `SAVINGS_BASIS_NOTICE` 를 지우면 사용자가 두 숫자를 같은 기간으로 읽는다.
 * 🔴 문구에 「매출 인식일」을 쓰지 말 것 — 매출 화면이 자르는 축은 주문일이다.
 *
 * 🔴 <b>재활용과 합포장을 더하지 않는다</b>(S10). 재활용 상자로 합포장한 박스는 양쪽에 모두 들어가
 * 둘의 합이 전체보다 커진다 — 두 값은 나란히 놓기만 하고 합계 칸을 만들지 않는다.
 *
 * 🔴 <b>「추정 순이익에 더해집니다」는 순이익이 실제로 뜨는 행에만 맞는 말이다</b>(S6) — 원가 기준이 없어
 * 손익이 `—` 인 행이 섞여 있으므로 문구를 「순이익이 계산된 상품에 한해」로 한정한다.
 *
 * ⚠️ 표시 전용이다. 조회·기간은 Container 가 소유한다(매출과 같은 `PeriodFilter` 를 쓴다, S8).
 */
export function PackingSavingsCard({ summary, isLoading, error }: PackingSavingsCardProps) {
  if (error) {
    return (
      <Card title="포장 절약">
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card title="포장 절약">
        <p className="text-sm text-gray-500">
          {isLoading ? '불러오는 중...' : '포장 절약을 불러오지 못했습니다.'}
        </p>
      </Card>
    );
  }

  // 🔴 「기록 없음」과 「절약 0」은 다른 상태다(S1). 집계할 박스가 아예 없으면 0원 카드를 그리지 않는다.
  const hasRecord = summary.parcelCount > 0 || summary.missingBasisCount > 0;

  if (!hasRecord) {
    return (
      <Card title="포장 절약" className="space-y-2">
        <p className="text-sm text-gray-500">이 기간에는 포장 기록이 없습니다.</p>
        <p className="text-xs text-gray-500">{SAVINGS_BASIS_NOTICE}</p>
      </Card>
    );
  }

  return (
    <Card title="포장 절약" className="space-y-4">
      {isLoading && <p className="text-xs text-gray-500">조회 중...</p>}

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-gray-500">이 기간 아낀 금액</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${savingToneClass(summary.totalSaving)}`}
          >
            {formatSaving(summary.totalSaving)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            박스 {summary.parcelCount.toLocaleString('ko-KR')}건 기준
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <dt className="text-xs text-gray-500">상자</dt>
            <dd className={`text-base font-semibold tabular-nums ${savingToneClass(summary.boxSaving)}`}>
              {formatSaving(summary.boxSaving)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">택배비</dt>
            <dd
              className={`text-base font-semibold tabular-nums ${savingToneClass(summary.deliverySaving)}`}
              title="무료배송 박스에서만 납니다. 유료배송은 받는 배송비와 상쇄돼 절약이 0입니다"
            >
              {formatSaving(summary.deliverySaving)}
            </dd>
          </div>
        </dl>
      </div>

      {/* 🔴 두 줄을 더한 값을 만들지 말 것 — 겹치는 박스가 있어 전체보다 커진다(S10). */}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-baseline justify-between rounded-lg bg-gray-50 px-3 py-2">
          <dt className="text-sm text-gray-700">
            재활용 상자 사용
            <span className="ml-2 text-xs text-gray-500">
              {summary.recycledParcelCount.toLocaleString('ko-KR')}박스
            </span>
          </dt>
          <dd className={`text-sm font-semibold tabular-nums ${savingToneClass(summary.recycledSaving)}`}>
            {formatSaving(summary.recycledSaving)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between rounded-lg bg-gray-50 px-3 py-2">
          <dt className="text-sm text-gray-700">
            합포장
            <span className="ml-2 text-xs text-gray-500">
              {summary.consolidatedParcelCount.toLocaleString('ko-KR')}박스
            </span>
          </dt>
          <dd
            className={`text-sm font-semibold tabular-nums ${savingToneClass(summary.consolidatedSaving)}`}
          >
            {formatSaving(summary.consolidatedSaving)}
          </dd>
        </div>
      </dl>

      <div className="space-y-1 text-xs text-gray-500">
        <p>{SAVINGS_OVERLAP_NOTICE}</p>
        <p>⚠ {SAVINGS_BASIS_NOTICE}</p>
        <p>{SAVINGS_PROFIT_NOTICE}</p>
        {/* 🔴 0 이면 아예 그리지 않는다 — 없는 문제를 매번 읽게 하지 않는다. */}
        {summary.missingBasisCount > 0 && (
          <p className="text-amber-700">
            ⚠ 계산 근거가 없는 박스 {summary.missingBasisCount.toLocaleString('ko-KR')}건은 합계에서
            빠져 있습니다.
          </p>
        )}
        {/* 🔴 위 경고와 다른 숫자다 — 이쪽은 택배비 절약만 빠지고 상자 절약은 합계에 남아 있다(S3). */}
        {summary.missingShippingFeeCount > 0 && (
          <p className="text-amber-700">
            ⚠ 배송비 기록이 없어 택배비 절약을 못 센 박스{' '}
            {summary.missingShippingFeeCount.toLocaleString('ko-KR')}건이 있습니다. 그 박스의 상자
            절약은 합계에 들어가 있습니다.
          </p>
        )}
        {/* 음수도 합계에 그대로 들어간다(S12) — 빼면 "상자를 비싸게 쓴 것"이 영원히 안 보인다. */}
        {summary.negativeParcelCount > 0 && (
          <p>
            상자를 계산보다 비싸게 쓴 박스 {summary.negativeParcelCount.toLocaleString('ko-KR')}건이
            합계에 포함돼 있습니다.
          </p>
        )}
      </div>
    </Card>
  );
}
