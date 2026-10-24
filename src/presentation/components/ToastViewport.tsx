'use client';

import { useCallback, useEffect, useRef } from 'react';
import { CircleCheck, AlertCircle } from 'lucide-react';
import { TOAST_DURATION_MS, useToastStore, type ToastItem } from '@/infrastructure/stores/toastStore';
import { useToolPanelStore } from '@/infrastructure/stores/toolPanelStore';

/**
 * The **only** place that draws the web's short notices (toasts) (FEATURE_2609_77, UX D26 · D33).
 * File: src/presentation/components/ToastViewport.tsx
 *
 * **Required rules**
 * - Mounted **once**, in `dashboard/layout.tsx`. Screens do not mount it.
 * - Callers only call `toast.success` / `toast.error` (`toastStore.ts`).
 *
 * **Behaviour**
 * - Place: top right of the screen (under the top bar · left of the right tool bar). New notices stack below.
 *   Below 768px, while the tool bar is collapsed: 1rem from the right edge, at most `100vw − 2rem` wide
 *   (FEATURE_2610_31 D39).
 * - Time: success 3s · failure 6s (`TOAST_DURATION_MS`). A mouse over it or a finger on it pauses the timer;
 *   on leave it stays for the **remaining time**.
 * - Layer: `z-[70]` — visible above an open `ui/Modal` (z-50/z-[60]). Radix turns off the body's pointer-events
 *   while a modal is open, so the notice card gets `pointer-events-auto`.
 *
 * ⚠️ No close (✕) button — it is a notice that shows briefly and goes away (D26).
 * ❌ No `fixed inset-0` · `z-50` · `z-[60]` (`npm run lint:ui`).
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const railCollapsed = useToolPanelStore((s) => s.railCollapsed);
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed right-20 top-16 z-[70] flex w-80 max-w-[calc(100vw-6rem)] flex-col gap-2 ${
        railCollapsed ? 'max-md:right-4 max-md:max-w-[calc(100vw-2rem)]' : ''
      }`}
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
