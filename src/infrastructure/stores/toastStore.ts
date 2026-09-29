import { create } from 'zustand';

/**
 * 웹 공용 잠깐 알림(토스트) 목록 (FEATURE_2609_77, UX D26·D33).
 *
 * **용도**: 한 건 처리의 결과(성공·실패)를 화면 오른쪽 위에 잠깐 띄웠다가 지운다.
 * **파일**: src/infrastructure/stores/toastStore.ts
 * **그리는 곳**: `presentation/components/ToastViewport.tsx` 하나뿐 — `dashboard/layout.tsx` 가 한 번만 마운트한다.
 *
 * **사용 예제**
 * ```ts
 * import { toast } from '@/infrastructure/stores/toastStore';
 * toast.success('쿠팡 상품을 가져왔습니다.');            // 3초
 * toast.error(extractErrorMessage(e, '저장하지 못했습니다.')); // 6초
 * ```
 *
 * ⚠️ 표시 시간은 `TOAST_DURATION_MS` 한 곳에서만 정한다(성공 3초 · 실패 6초, D33).
 * ⚠️ 마우스를 올리거나 손가락을 대고 있는 동안에는 사라지지 않는다 — 타이머는 `ToastViewport` 가 소유한다.
 * ❌ 여러 건을 한 번에 처리한 건별 결과(발송처리 결과 표 등)를 이것으로 바꾸지 않는다(D31 예외).
 * ❌ `persist` 금지 — 새로고침하면 지나간 알림은 사라진다.
 */

export type ToastTone = 'success' | 'error';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

/** D33: 성공 3초 · 실패 6초. */
export const TOAST_DURATION_MS: Record<ToastTone, number> = {
  success: 3000,
  error: 6000,
};

interface ToastStore {
  toasts: ToastItem[];
  show: (tone: ToastTone, message: string) => void;
  dismiss: (id: number) => void;
}

let nextToastId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (tone, message) =>
    set((state) => ({ toasts: [...state.toasts, { id: nextToastId++, tone, message }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** 컴포넌트 밖(핸들러·유스케이스 호출 뒤)에서도 부를 수 있는 창구. */
export const toast = {
  success: (message: string) => useToastStore.getState().show('success', message),
  error: (message: string) => useToastStore.getState().show('error', message),
};
