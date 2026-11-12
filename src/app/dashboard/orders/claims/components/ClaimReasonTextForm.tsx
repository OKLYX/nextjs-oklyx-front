'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { ClaimAction } from '@/domain/entities/ClaimEntity';

/**
 * Text form for actions with `requires === 'REASON_TEXT'` — reason text only (FEATURE_2611_23 / D78 · R56).
 *
 * **Purpose**: the LotteON [반품 보류 해제] · [교환 보류 해제]. The panel (`ClaimActionPanel`) opens it by `requires`
 * only, so this form does not look at the claim type, the platform or the action code.
 * **File**: src/app/dashboard/orders/claims/components/ClaimReasonTextForm.tsx
 *
 * 🔴 Forbidden
 * - A reason-code choice — this action has none; the panel sends `reasonText` without `rejectCode`.
 * - A text limit other than 1~200 characters (D78); the server checks the same.
 *
 * ⚠️ No two-step confirm — the actions using it are reversible (R56).
 * ⚠️ `action.hint` is a server sentence shown under the text box — show it as is.
 *
 * @example
 * <ClaimReasonTextForm key={openAction.action} action={openAction} isSending={isSending}
 *   onSubmit={(text) => void handleSubmit(openAction, undefined, text)} onCancel={() => setOpenAction(null)} />
 */
interface ClaimReasonTextFormProps {
  action: ClaimAction;
  isSending: boolean;
  /** Called once with the trimmed text. */
  onSubmit: (reasonText: string) => void;
  onCancel: () => void;
}

const MAX_REASON_LENGTH = 200;

export function ClaimReasonTextForm({ action, isSending, onSubmit, onCancel }: ClaimReasonTextFormProps) {
  const [text, setText] = useState('');

  const trimmed = text.trim();
  const isReady = trimmed.length >= 1 && trimmed.length <= MAX_REASON_LENGTH;

  return (
    <div>
      <p className="font-medium text-gray-900">{action.label}</p>

      <textarea
        value={text}
        maxLength={MAX_REASON_LENGTH}
        onChange={(e) => setText(e.target.value)}
        disabled={isSending}
        rows={3}
        placeholder="사유 글 (1~200자)"
        className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
      />
      {action.hint && <p className="mt-1 text-sm text-gray-500">{action.hint}</p>}

      <div className="mt-4 flex items-center gap-2 max-md:flex-wrap">
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
            if (!isReady) return;
            onSubmit(trimmed);
          }}
          disabled={isSending || !isReady}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isSending ? <Spinner label="전송 중..." /> : '보내기'}
        </button>
      </div>
    </div>
  );
}
