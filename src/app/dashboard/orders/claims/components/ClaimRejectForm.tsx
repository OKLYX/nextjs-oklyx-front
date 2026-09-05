'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { Claim, ClaimAction } from '@/domain/entities/ClaimEntity';

/**
 * 교환 거부 폼 — 거부 사유 선택 + 2단 확인 (FEATURE_2609_21 / 06 · PLAN §2 X2).
 *
 * **용도**: `requires === 'REJECT_CODE'` 인 액션 하나를 위한 입력이다. 패널(`ClaimActionPanel`)이
 * `requires` 로만 분기해 이 폼을 펼치므로, 여기서도 `claimType`·플랫폼을 보지 않는다.
 *
 * **파일**: `src/app/dashboard/orders/claims/components/ClaimRejectForm.tsx`
 *
 * 🔴 **금지 패턴**
 * - 거부 사유의 코드→라벨 상수(D19). 선택지는 값도 라벨도 서버가 `action.choices` 로 준다 —
 *   상수를 두는 순간 프론트가 쿠팡 지식을 갖고, 네이버가 다른 코드 집합을 쓰면 화면을 고쳐야 한다.
 *   (마켓 코드 문자열이 이 파일 어디에도 없어야 한다 — grep 으로 확인한다.)
 * - 자유 입력 사유란 — 쿠팡이 받지 않는다. 사용자가 적었는데 전송되지 않는 칸이 생긴다.
 * - 선택지 개수 가정 — 플랫폼이 5개를 줄 수도 있다. `map` 으로만 그린다.
 *
 * ⚠️ **확인은 이 폼이 소유한다**(06 Step 4). 패널은 `REJECT_CODE` 일 때 자기 확인 영역을 그리지
 * 않는다 — 둘 다 그리면 확인이 3단이 되고, 사유가 안 보이는 확인이 하나 낀다.
 * ⚠️ 권한 분기를 넣지 말 것 — 패널이 이미 ADMIN 게이트 안이다(03 Step 5).
 *
 * **사용 예제**:
 * <ClaimRejectForm
 *   key={openAction.action}          // 액션이 바뀌면 언마운트로 초기화
 *   claim={claim}
 *   action={openAction}
 *   isSending={isSending}
 *   onSubmit={(rejectCode) => void handleSubmit(openAction, rejectCode)}
 *   onCancel={closeAction}
 * />
 */
interface ClaimRejectFormProps {
  claim: Claim;
  /** 서버가 준 항목 그대로 — 라벨·선택지의 주인은 서버다(D18·D19). */
  action: ClaimAction;
  isSending: boolean;
  /** 확인의 [거부] 를 누른 뒤 1회만 호출된다. */
  onSubmit: (rejectCode: string) => void;
  onCancel: () => void;
}

export function ClaimRejectForm({
  claim,
  action,
  isSending,
  onSubmit,
  onCancel,
}: ClaimRejectFormProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // 확인 문구에 넣을 사유 문구도 서버 것이다 — 프론트가 짓지 않는다.
  const selectedLabel = action.choices.find((c) => c.code === selected)?.label ?? '';

  return (
    <div>
      <p className="font-medium text-gray-900">{action.label}</p>

      {/* 라디오로 낸다 — 선택지가 적을 때 드롭다운은 클릭을 하나 더 만들 뿐이다. */}
      <div className="mt-3 flex flex-col gap-2">
        {action.choices.map((choice) => (
          <label key={choice.code} className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="radio"
              name="rejectCode"
              value={choice.code}
              checked={selected === choice.code}
              // 사유를 바꾸면 확인을 접는다 — 확인 문구와 선택이 어긋난 채 남지 않게.
              onChange={() => {
                setSelected(choice.code);
                setConfirming(false);
              }}
              disabled={isSending}
              className="h-4 w-4"
            />
            {choice.label}
          </label>
        ))}
      </div>

      {/* 2단 확인(D10) — 교환 거부에는 확정되는 금액이 없어 그 자리를 선택한 사유가 대신한다. */}
      {confirming && (
        <div className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="font-medium">
            {claim.itemName ?? '상품 정보 없음'} · 수량 {claim.quantity}개
          </p>
          <p className="mt-1">사유: {selectedLabel}</p>
          <p className="mt-1">교환을 거부하면 되돌릴 수 없습니다.</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {/* 기본 포커스는 취소 — 되돌릴 수 없는 쪽에 엔터가 떨어지면 안 된다. */}
        <button
          autoFocus
          onClick={onCancel}
          disabled={isSending}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          취소
        </button>
        <button
          onClick={() => {
            if (selected == null) return;
            if (!confirming) {
              setConfirming(true);
              return;
            }
            onSubmit(selected);
          }}
          disabled={isSending || selected == null}
          className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed"
        >
          {isSending ? <Spinner label="전송 중..." /> : '거부'}
        </button>
      </div>
    </div>
  );
}
