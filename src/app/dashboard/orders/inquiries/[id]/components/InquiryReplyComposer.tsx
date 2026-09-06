'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { ReplyCapability } from '@/domain/entities/InquiryEntity';

/**
 * 고객문의 답변 컴포저 — 스레드(`InquiryThread`) 말풍선 아래에 붙는다 (FEATURE_2609_23 / D5·D17).
 *
 * **용도**: 서버가 준 `replyCapability` 만 보고 입력창을 열지 말지, 몇 자까지 받을지, 2단 확인을
 * 걸지를 정한다. 전송 자체는 컨테이너가 한다(이 컴포넌트는 usecase 를 부르지 않는다).
 *
 * **파일**: `src/app/dashboard/orders/inquiries/[id]/components/InquiryReplyComposer.tsx`
 *
 * 🔴 **금지 패턴**
 * - `if (inquiryType === 'PRODUCT_QNA')` · `if (platform === 'COUPANG')` — 유형·플랫폼 분기가
 *   한 줄이라도 들어가면 네이버가 붙는 날 이 화면을 다시 짠다(D5).
 * - 길이 상수 하드코딩 — `minLength`·`maxLength` 는 서버가 유형별로 내려준다.
 * - 사유 문구 맵 — `reason` 은 서버가 완성한 문장이다.
 * - 입력값 `localStorage` 임시저장 — 범위 밖(PLAN §8).
 *
 * ⚠️ 권한 분기를 넣지 않는다 — 컨테이너가 ADMIN 게이트 안에서만 이 컴포넌트를 만든다(Step 5).
 * ⚠️ 글자수는 `content.trim().length` 로 센다. 전송도 trim 한 값을 보낸다 — 서버가 `@NotBlank` +
 * 정책 길이검증이라 공백·개행만 있는 본문은 여기서 막아야 한다.
 *
 * **사용 예제**:
 * <InquiryReplyComposer
 *   capability={inquiry.replyCapability}
 *   isSending={isSending}
 *   isLocked={sendLocked}
 *   error={sendError}
 *   onSend={handleSend}
 * />
 */
interface InquiryReplyComposerProps {
  capability: ReplyCapability;
  isSending: boolean;
  /** 전송 결과 불명(502) — 본문은 남기되 재전송을 막는다. 이미 전송됐을 수 있다(D17). */
  isLocked: boolean;
  /** '' 이면 배너 없음. 컴포저 최상단에 그린다. */
  error: string;
  onSend: (content: string) => Promise<void>;
}

const UNAVAILABLE_FALLBACK = '지금은 답변할 수 없습니다.';

export function InquiryReplyComposer({
  capability,
  isSending,
  isLocked,
  error,
  onSend,
}: InquiryReplyComposerProps) {
  // 본문·확인 단계는 컴포저의 로컬 상태다 — 컨테이너는 전송 중 여부와 결과만 갖는다.
  const [content, setContent] = useState('');
  const [confirming, setConfirming] = useState(false);

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
  const canSubmit = !isCountInvalid && !isSending && !isLocked;

  const handlePrimaryClick = () => {
    if (!canSubmit) return;
    // 되돌릴 수 없는 전송만 확인을 한 번 더 받는다(D17). `once=false` 는 그대로 전송한다.
    if (capability.once && !confirming) {
      setConfirming(true);
      return;
    }
    void onSend(trimmed);
  };

  return (
    <div className="border-t border-gray-200 pt-4 space-y-3">
      {banner}

      <h3 className="text-sm font-semibold text-gray-900">답변 작성</h3>

      <textarea
        rows={4}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          // 본문이 바뀌면 확인을 접는다 — 확인 화면에 보이던 글과 실제로 보낼 글이 어긋나지 않게.
          setConfirming(false);
        }}
        readOnly={isSending || isLocked}
        placeholder="고객에게 보낼 답변을 입력하세요."
        className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 read-only:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* 2단 확인 — 별도 모달을 만들지 않는다. 무엇을 확정하는지 본문 그대로 보여준다. */}
      {confirming && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">⚠️ 전송한 답변은 수정하거나 삭제할 수 없습니다.</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-red-900">{trimmed}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${isCountInvalid ? 'text-red-600' : 'text-gray-500'}`}>
          {trimmed.length} / {capability.maxLength}
        </span>

        <div className="flex items-center gap-2">
          {confirming && (
            /* 기본 포커스는 취소 — 되돌릴 수 없는 쪽에 엔터가 떨어지면 안 된다. 본문은 유지한다. */
            <button
              type="button"
              autoFocus
              onClick={() => setConfirming(false)}
              disabled={isSending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              취소
            </button>
          )}
          <button
            type="button"
            onClick={handlePrimaryClick}
            disabled={!canSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSending ? <Spinner label="전송 중..." /> : confirming ? '전송' : '답변 전송'}
          </button>
        </div>
      </div>
    </div>
  );
}
