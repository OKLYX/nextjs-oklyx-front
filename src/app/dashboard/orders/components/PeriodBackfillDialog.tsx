'use client';

import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';

/**
 * 빈 달을 조회했을 때 "쿠팡에서 불러올까요?"를 묻는 확인 다이얼로그 (FEATURE_2609_10, PLAN D2)
 *
 * **용도**: 월 옵션으로 조회한 결과가 0건일 때 1회 노출. 승낙하면 그 달을 계정 단위로 백필한다.
 * **파일**: src/app/dashboard/orders/components/PeriodBackfillDialog.tsx
 *
 * ⚠️ 확인 UI 는 공통 `PopupDialogModal` 을 재사용한다(프로젝트 규칙: 확인 모달 신규 작성 금지).
 *    이 컴포넌트는 문구·버튼 라벨을 이 기능에 고정하는 얇은 래퍼일 뿐이다.
 * ⚠️ 두 번째 보조 문구(취소 내역 고지)는 PLAN D4 의 고지다 — 지우지 말 것.
 * ⚠️ `최근 2주` 에서는 절대 열리지 않는다(호출부 `isMonthPeriod` 가드, PLAN D1).
 *
 * @param open        표시 여부
 * @param periodLabel 대상 기간 라벨 ('2026년 8월')
 * @param onConfirm   [불러오기] — 백필 시작
 * @param onCancel    [닫기] — 아무것도 하지 않음(세션 내 재질문은 호출부가 억제)
 */
interface PeriodBackfillDialogProps {
  open: boolean;
  periodLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PeriodBackfillDialog({
  open,
  periodLabel,
  onConfirm,
  onCancel,
}: PeriodBackfillDialogProps) {
  return (
    <PopupDialogModal
      isOpen={open}
      title={`${periodLabel} 주문 데이터가 없습니다`}
      message={
        <div className="space-y-3">
          <p>쿠팡에서 이 기간의 주문을 불러올까요? 계정 수에 따라 수십 초가 걸릴 수 있습니다.</p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>· 이미 불러온 주문은 중복되지 않습니다.</li>
            <li>· 이 기간의 취소 내역은 일부 반영되지 않을 수 있습니다.</li>
          </ul>
        </div>
      }
      confirmText="불러오기"
      cancelText="닫기"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
