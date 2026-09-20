'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 마스터 상세에서 마켓 식별자(상품 ID · 옵션 ID)를 클립보드로 복사하는 공용 버튼.
 * File: src/app/dashboard/master-products/[id]/components/CopyIdButton.tsx
 *
 * **용도**: WING 과 눈으로 대조하는 숫자 ID 옆에 붙여, 값만 정확히(공백·줄바꿈 없이) 복사한다.
 *
 * **사용처**
 * - 커버리지 매트릭스 「상품 ID」 열 (`CoverageMatrix.tsx`)
 * - 옵션×채널 표의 옵션 ID 칸
 *
 * **사용 예제**
 * ```tsx
 * <CopyIdButton value={cell.platformProductId} />
 * <CopyIdButton value={String(option.platformOptionId)} />
 * ```
 *
 * ⚠️ 복사 실패는 **조용히 넘긴다** — 클립보드 권한이 없는 브라우저가 있고, 이 버튼은
 *    보조 수단이라 에러 토스트를 띄울 만한 일이 아니다(값은 화면에 그대로 보인다).
 * ⚠️ 표 안에서 쓰이므로 행 클릭 핸들러로 이벤트가 새지 않도록 `stopPropagation` 한다.
 *
 * ❌ 인라인으로 다시 구현하지 말 것 — 같은 동작이 두 벌이 되면 한쪽만 고쳐진다
 *    (루트 CLAUDE.md 공통 Component 규칙).
 * ❌ `value` 를 가공(trim 외 포맷·접두사)하지 말 것 — 대조용 원문 그대로여야 한다.
 */
export function CopyIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard permission denied — stay silent on purpose.
      }
    },
    [value],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="복사"
      aria-label={`${value} 복사`}
      className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100"
    >
      {copied ? '복사됨' : '복사'}
    </button>
  );
}
