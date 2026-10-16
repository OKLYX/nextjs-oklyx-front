'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { Claim, ClaimAction } from '@/domain/entities/ClaimEntity';

/**
 * Reason form for actions with `requires === 'REASON'` — reason code + reason text (FEATURE_2610_17 / D34 · D39).
 *
 * **Purpose**: the 11st [반품 거부] · [반품 보류] · [반품완료 보류] and 11st [교환 거부]. The panel
 * (`ClaimActionPanel`) opens it by `requires` only, so this form does not look at the claim type or platform.
 * **File**: src/app/dashboard/orders/claims/components/ClaimReasonForm.tsx
 *
 * 🔴 Forbidden
 * - A code→label constant — choices (values and labels) come from the server's `action.choices`.
 * - A text limit other than 1~200 characters (D39 ①); the server checks the same.
 *
 * ⚠️ The form owns the confirm (same as `ClaimRejectForm`): an irreversible action shows the confirm block
 * first and sends on the second press; a reversible one (the holds) sends on the first press.
 * ⚠️ `action.hint` is a server sentence shown under the text box (D34 · D39 ④) — show it as is.
 *
 * @example
 * <ClaimReasonForm key={openAction.action} claim={claim} action={openAction} isSending={isSending}
 *   onSubmit={(code, text) => void handleSubmit(openAction, code, text)} onCancel={closeAction} />
 */
interface ClaimReasonFormProps {
  claim: Claim;
  action: ClaimAction;
  isSending: boolean;
  /** Called once with the chosen code and the trimmed text. */
  onSubmit: (reasonCode: string, reasonText: string) => void;
  onCancel: () => void;
}

const MAX_REASON_LENGTH = 200;

export function ClaimReasonForm({ claim, action, isSending, onSubmit, onCancel }: ClaimReasonFormProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);

  const trimmed = text.trim();
  const isReady = selected != null && trimmed.length >= 1 && trimmed.length <= MAX_REASON_LENGTH;
  const selectedLabel = action.choices.find((c) => c.code === selected)?.label ?? '';

  return (
    <div>
      <p className="font-medium text-gray-900">{action.label}</p>

      <div className="mt-3 flex flex-col gap-2">
        {action.choices.map((choice) => (
          <label key={choice.code} className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="radio"
              name="reasonCode"
              value={choice.code}
              checked={selected === choice.code}
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

      <textarea
        value={text}
        maxLength={MAX_REASON_LENGTH}
        onChange={(e) => {
          setText(e.target.value);
          setConfirming(false);
        }}
        disabled={isSending}
        rows={3}
        placeholder="사유 글 (1~200자)"
        className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
      />
      {action.hint && <p className="mt-1 text-sm text-gray-500">{action.hint}</p>}

      {confirming && (
        <div className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="font-medium">
            {claim.itemName ?? '상품 정보 없음'} · 수량 {claim.quantity}개
          </p>
          <p className="mt-1">사유: {selectedLabel}</p>
          <p className="mt-1">{action.label}은(는) 되돌릴 수 없습니다.</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
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
            if (!isReady || selected == null) return;
            if (action.irreversible && !confirming) {
              setConfirming(true);
              return;
            }
            onSubmit(selected, trimmed);
          }}
          disabled={isSending || !isReady}
          className={`px-4 py-2 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
            action.irreversible
              ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
          }`}
        >
          {isSending ? <Spinner label="전송 중..." /> : action.label}
        </button>
      </div>
    </div>
  );
}
