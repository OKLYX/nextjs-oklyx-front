'use client';

/**
 * 공용 확인 다이얼로그 — 확인/취소 · 성공 안내 팝업의 **유일한** 컴포넌트.
 *
 * **용도**: "삭제하시겠습니까?" 류의 확인창, 확인 버튼 하나만 있는 성공 안내창.
 * **파일**: src/presentation/components/ui/ConfirmDialog.tsx
 * (기존 `presentation/components/` 의 공용 확인 다이얼로그가 이 파일로 승계됐다 — git mv 이력 참고)
 *
 * **필수 규칙**
 * - 확인/취소 팝업을 새로 만들지 않는다. 이 컴포넌트를 쓴다.
 * - 껍데기(백드롭 · z-index · 접근성)는 `Modal` 이 소유한다. 여기서 다시 그리지 않는다.
 * - 모달 **안에서** 뜨는 확인창이면 `nested` 를 넘긴다. 넘기지 않으면 부모 모달과 같은 층에 깔린다.
 *
 * **사용 예제**
 * ```tsx
 * // 삭제 확인
 * <ConfirmDialog isOpen={isOpen} title="삭제 확인" message="정말 삭제하시겠습니까?"
 *                confirmText="삭제" onConfirm={remove} onCancel={close} isDangerous />
 *
 * // 진행 중 잠금 (버튼 비활성 + ESC·바깥 클릭 무시)
 * <ConfirmDialog isOpen={isOpen} title="삭제 확인" message={msg}
 *                onConfirm={remove} onCancel={close} isDangerous isLoading={isDeleting} />
 *
 * // 성공 안내 — onCancel 을 넘기지 않으면 확인 버튼 1개만 렌더된다
 * <ConfirmDialog isOpen={isOpen} title="등록 완료" message="상품이 등록되었습니다."
 *                confirmText="목록으로" onConfirm={goList} />
 * ```
 *
 * ⚠️ `isLoading` 중에는 ✕ · ESC 로 닫히지 않는다 (API 호출 중 이탈 방지).
 * ⚠️ 배경은 일반 팝업보다 짙다(`variant="alert"`) — 위층이라는 신호다. 폭도 좁다.
 * ❌ 이 파일에 폼·입력 필드를 넣지 않는다. 입력이 필요하면 `Modal` 을 직접 쓴다.
 */

import { ReactNode } from 'react';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  /** 없으면 확인 버튼 1개만 렌더된다 (성공 안내 다이얼로그) */
  onCancel?: () => void;
  /** `true` 면 확인 버튼이 빨강 (삭제 등 되돌릴 수 없는 동작) */
  isDangerous?: boolean;
  /** 진행 중 — 버튼 비활성 + ESC·바깥 클릭 무시 */
  isLoading?: boolean;
  /** 다른 모달 위에 뜨는 확인창이면 `true` */
  nested?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  isDangerous = false,
  isLoading = false,
  nested = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => (onCancel ?? onConfirm)()}
      title={title}
      variant="alert"
      nested={nested}
      disableClose={isLoading}
      footer={
        <>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-6 py-3 bg-gray-300 text-gray-700 font-semibold text-base rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-6 py-3 text-white font-semibold text-base rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="text-gray-600 text-lg">{message}</div>
    </Modal>
  );
}
