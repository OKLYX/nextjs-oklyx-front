'use client';

import { useCallback, useEffect, useRef } from 'react';
import { CircleCheck, AlertCircle } from 'lucide-react';
import { TOAST_DURATION_MS, useToastStore, type ToastItem } from '@/infrastructure/stores/toastStore';

/**
 * 웹 공용 잠깐 알림(토스트)을 그리는 **유일한** 자리 (FEATURE_2609_77, UX D26·D33).
 * File: src/presentation/components/ToastViewport.tsx
 *
 * **필수 규칙**
 * - `dashboard/layout.tsx` 에서 **한 번만** 마운트한다. 화면마다 두지 않는다.
 * - 알림을 띄우는 쪽은 `toast.success` / `toast.error`(`toastStore.ts`)만 부른다.
 *
 * **동작**
 * - 자리: 화면 오른쪽 위(상단바 아래 · 오른쪽 도구 툴바 왼쪽). 새 알림이 아래에 쌓인다.
 * - 시간: 성공 3초 · 실패 6초(`TOAST_DURATION_MS`). 마우스를 올리거나 손가락을 대고 있으면 멈추고,
 *   떼면 **남은 시간**만큼 더 떠 있다.
 * - 층: `z-[70]` — 열린 `ui/Modal`(z-50/z-[60]) 위에서도 보인다. Radix 가 모달이 열리면 body 의
 *   pointer-events 를 끄므로 알림 카드에 `pointer-events-auto` 를 준다.
 *
 * ⚠️ 닫기(✕) 버튼은 두지 않는다 — 잠깐 떴다 사라지는 알림이다(D26).
 * ❌ `fixed inset-0` · `z-50` · `z-[60]` 금지(`npm run lint:ui`).
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-20 top-16 z-[70] flex w-80 max-w-[calc(100vw-6rem)] flex-col gap-2"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const remainingRef = useRef(TOAST_DURATION_MS[item.tone]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => dismiss(item.id), remainingRef.current);
  }, [dismiss, item.id]);

  const pause = () => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
  };

  const resume = () => {
    if (timerRef.current !== null) return;
    start();
  };

  useEffect(() => {
    start();
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [start]);

  const isError = item.tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      onPointerEnter={pause}
      onPointerLeave={resume}
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
        isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
      }`}
    >
      {isError ? (
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
      ) : (
        <CircleCheck size={16} className="mt-0.5 shrink-0" />
      )}
      <p className="min-w-0 break-words">{item.message}</p>
    </div>
  );
}
