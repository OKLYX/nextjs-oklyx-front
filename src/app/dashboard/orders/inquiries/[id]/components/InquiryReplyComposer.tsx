'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { InquiryReplyPayload, ReplyCapability } from '@/domain/entities/InquiryEntity';
import { useCarrierOptions } from '@/presentation/hooks/useCarrierOptions';

/**
 * Customer inquiry reply composer — sits under the thread (`InquiryThread`) bubbles (FEATURE_2609_23 / D5·D17).
 *
 * **Purpose**: decides only from the server's `replyCapability` whether to open the input, how many characters it
 * takes and whether to ask a confirm. The container sends (this component never calls a use case).
 *
 * **File**: `src/app/dashboard/orders/inquiries/[id]/components/InquiryReplyComposer.tsx`
 *
 * 🔴 **Forbidden patterns**
 * - `if (inquiryType === 'PRODUCT_QNA')` · `if (platform === 'COUPANG')` — one line of type or platform branching
 *   and this screen is rewritten the day Naver joins (D5).
 * - Hard-coded length constants — `minLength` · `maxLength` come from the server per type.
 * - A reason text map — `reason` is a finished sentence from the server.
 * - Saving the input to `localStorage` — out of scope (PLAN §8).
 *
 * ⚠️ No role branching — the container builds this component only inside the ADMIN gate (Step 5).
 * ⚠️ An irreversible send (`once`) is confirmed with `window.confirm` only — a notice drawn inline under the thread
 * looks as if the reply were already posted.
 * ⚠️ Characters are counted as `content.trim().length`, and the trimmed value is sent — the server checks
 * `@NotBlank` + the policy length, so a body of only spaces and line breaks is stopped here.
 *
 * The non-delivery form (FEATURE_2610_17 / D68): when the server says `form === 'NON_DELIVERY'` the composer draws
 * a reason select (`capability.reasons`), the detail text and — for the re-shipping reason 102 — a carrier
 * (`useCarrierOptions(platform)`) and an invoice number, and confirms with
 * 「11번가에 미도착 처리를 보냅니다. 되돌릴 수 없습니다.」. `platform` is only handed to the carrier hook.
 *
 * **Usage**:
 * <InquiryReplyComposer
 *   capability={inquiry.replyCapability}
 *   platform={inquiry.platform}
 *   isSending={isSending}
 *   isLocked={sendLocked}
 *   error={sendError}
 *   onSend={handleSend}
 * />
 */
interface InquiryReplyComposerProps {
  capability: ReplyCapability;
  /** The inquiry's marketplace — passed to the carrier list of the non-delivery form only. */
  platform: string;
  isSending: boolean;
  /** 전송 결과 불명(502) — 본문은 남기되 재전송을 막는다. 이미 전송됐을 수 있다(D17). */
  isLocked: boolean;
  /** '' 이면 배너 없음. 컴포저 최상단에 그린다. */
  error: string;
  onSend: (payload: InquiryReplyPayload) => Promise<void>;
}

const UNAVAILABLE_FALLBACK = '지금은 답변할 수 없습니다.';
/** D68: the re-shipping reason sends a carrier and an invoice number. */
const RESEND_REASON = '102';
const NON_DELIVERY_CONFIRM = '11번가에 미도착 처리를 보냅니다. 되돌릴 수 없습니다.';

export function InquiryReplyComposer({
  capability,
  platform,
  isSending,
  isLocked,
  error,
  onSend,
}: InquiryReplyComposerProps) {
  // 본문은 컴포저의 로컬 상태다 — 컨테이너는 전송 중 여부와 결과만 갖는다.
  const [content, setContent] = useState('');
  // Non-delivery form inputs (D68) — local like the body.
  const [reasonCode, setReasonCode] = useState('');
  const [carrierCode, setCarrierCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const isNonDelivery = capability.form === 'NON_DELIVERY';
  const { carriers } = useCarrierOptions(isNonDelivery ? platform : undefined);

  const banner = error ? (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {error}
    </div>
  ) : null;

  // 답변 불가는 서버 판정이다 — 입력창을 만들지 않고 서버 사유만 보여준다.
  if (!capability.canReply) {
    return (
      <div className="border-t border-gray-200 pt-4 space-y-3">
        {banner}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {capability.reason ?? UNAVAILABLE_FALLBACK}
        </div>
      </div>
    );
  }

  const trimmed = content.trim();
  const tooShort = trimmed.length < capability.minLength;
  const tooLong = trimmed.length > capability.maxLength;
  const isCountInvalid = tooShort || tooLong;
  const isResend = isNonDelivery && reasonCode === RESEND_REASON;
  const isNonDeliveryReady = !isNonDelivery
    || (reasonCode !== '' && (!isResend || (carrierCode !== '' && invoiceNumber.trim() !== '')));
  const canSubmit = !isCountInvalid && isNonDeliveryReady && !isSending && !isLocked;

  const handlePrimaryClick = () => {
    if (!canSubmit) return;
    // 되돌릴 수 없는 전송만 확인을 한 번 더 받는다(D17). `once=false` 는 그대로 전송한다.
    const question = isNonDelivery
      ? NON_DELIVERY_CONFIRM
      : `전송한 답변은 수정하거나 삭제할 수 없습니다.\n\n${trimmed}\n\n이대로 전송할까요?`;
    if (capability.once && !window.confirm(question)) {
      return;
    }
    void onSend(isNonDelivery
      ? { content: trimmed, reasonCode, ...(isResend ? { carrierCode, invoiceNumber: invoiceNumber.trim() } : {}) }
      : { content: trimmed });
  };

  return (
    <div className="border-t border-gray-200 pt-4 space-y-3">
      {banner}

      <h3 className="text-sm font-semibold text-gray-900">답변 작성</h3>

      {isNonDelivery && (
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
          disabled={isSending || isLocked}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
        >
          <option value="" disabled>처리 사유</option>
          {capability.reasons.map((reason) => (
            <option key={reason.code} value={reason.code}>{reason.label}</option>
          ))}
        </select>
      )}

      {isResend && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={carrierCode}
            onChange={(e) => setCarrierCode(e.target.value)}
            disabled={isSending || isLocked}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          >
            <option value="">택배사 선택</option>
            {carriers.map((carrier) => (
              <option key={carrier.deliveryCompanyCode} value={carrier.deliveryCompanyCode}>
                {carrier.carrierName}
              </option>
            ))}
          </select>
          <input
            type="text"
            maxLength={50}
            placeholder="송장번호"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            disabled={isSending || isLocked}
            className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
        </div>
      )}

      <textarea
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={isSending || isLocked}
        placeholder={isNonDelivery ? '상세 내용 (1~200자)' : '고객에게 보낼 답변을 입력하세요.'}
        className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 read-only:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${isCountInvalid ? 'text-red-600' : 'text-gray-500'}`}>
          {trimmed.length} / {capability.maxLength}
        </span>

        <button
          type="button"
          onClick={handlePrimaryClick}
          disabled={!canSubmit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSending ? <Spinner label="전송 중..." /> : '답변 전송'}
        </button>
      </div>
    </div>
  );
}
