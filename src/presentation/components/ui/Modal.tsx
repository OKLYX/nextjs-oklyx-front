'use client';

/**
 * 공용 팝업 껍데기 — 백드롭 · 패널 · 닫기 동작 · 접근성을 한 곳에서 소유한다.
 *
 * **용도**: 모든 팝업(모달/다이얼로그)의 바깥 껍데기.
 * **파일**: src/presentation/components/ui/Modal.tsx
 *
 * **필수 규칙**
 * - 신규 팝업은 이 컴포넌트를 쓴다. `fixed inset-0` 백드롭을 새로 작성하지 않는다.
 * - 아직 교체되지 않은 기존 팝업 39개는 순차 이관 대상이다.
 * - z-index 는 이 컴포넌트가 소유한다. 호출부는 `nested` 여부만 넘기고 숫자를 쓰지 않는다.
 * - 본문 스크롤이 필요하면 `scrollBody` 를 쓴다. 직접 `overflow-y-auto` 를 쓰지 않는다
 *   (스크롤바 정책은 globals.css 의 `.modal-scroll-body` 가 소유한다).
 * - 투명도는 슬래시 문법(`bg-black/50`). `bg-opacity-*` 는 Tailwind v4 에서 제거됐다.
 *
 * **내부 구현**: `@radix-ui/react-dialog` (포커스 트랩 · ESC · 바깥 클릭 · body 스크롤 잠금 ·
 * `aria-*` 연결). Radix 타입은 호출부에 노출하지 않는다 — 나중에 직접 구현으로 바꿔도
 * 이 파일 하나만 교체하면 된다. 호출부는 기존 `isOpen` / `onClose` 인터페이스를 그대로 쓴다.
 *
 * **사용 예제**
 * ```tsx
 * <Modal isOpen={isOpen} onClose={close} title="상품 수정" size="lg"
 *        footer={<><button onClick={close}>취소</button><button onClick={save}>저장</button></>}>
 *   <ProductForm />
 * </Modal>
 *
 * // 다른 모달 위에 뜨는 팝업 (z-[60])
 * <Modal isOpen={isOpen} onClose={close} title="삭제 확인" nested>…</Modal>
 *
 * // 본문이 긴 팝업 — 본문만 스크롤된다
 * <Modal isOpen={isOpen} onClose={close} title="결과" size="xl" scrollBody>…</Modal>
 * ```
 *
 * ⚠️ 확인/취소 성격의 팝업은 이 컴포넌트를 직접 쓰지 말고 `ConfirmDialog` 를 쓴다.
 * ⚠️ `footer` 는 취소가 왼쪽, 확인이 오른쪽이다.
 * ❌ 호출부에서 `z-50` / `z-[60]` 같은 숫자를 직접 쓰지 않는다.
 * ❌ 호출부에서 Radix(`Dialog.Root` 등)를 직접 import 하지 않는다.
 */

import { CSSProperties, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const;

export type ModalSize = keyof typeof SIZE;

export interface ModalProps {
  /** 팝업 표시 여부 (기존 호출부 이름 유지) */
  isOpen: boolean;
  /** 닫기 요청 — ESC · 바깥 클릭 · 닫기 버튼 공통 */
  onClose: () => void;
  /** 패널 제목. `Dialog.Title` 로 항상 렌더된다 (ARIA 연결) */
  title: string;
  /** 최대 폭. 기본 `md` */
  size?: ModalSize;
  /** 하단 버튼 영역. 취소 왼쪽, 확인 오른쪽 */
  footer?: ReactNode;
  /** 바깥 클릭·ESC 로 닫히는지. 기본 `true`. API 호출 중에는 `false` 로 넘겨 이탈을 막는다 */
  closeOnOverlayClick?: boolean;
  /** 다른 모달 **위에** 뜨는 팝업이면 `true` → `z-[60]`. 기본 `false`(`z-50`) */
  nested?: boolean;
  /** 본문이 길어 본문만 스크롤해야 하면 `true` → `.modal-scroll-body` */
  scrollBody?: boolean;
  /** 결과 표처럼 내용에 따라 높이가 출렁이면 안 되는 팝업이면 `true` → 패널 높이를 85vh 로 고정 */
  fullHeight?: boolean;
  children: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  footer,
  closeOnOverlayClick = true,
  nested = false,
  scrollBody = false,
  fullHeight = false,
  children,
}: ModalProps) {
  const z = nested ? 'z-[60]' : 'z-50';
  // 패널은 항상 flex 세로 컬럼이다. 높이가 85vh 를 넘으면 본문이 줄고(min-h-0) 그 안의 스크롤 띠만 넘친다.
  const height = fullHeight ? 'h-[85vh]' : 'max-h-[85vh]';

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 bg-black/50 ${z}`} />
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${z} w-full ${SIZE[size]} mx-4 flex flex-col bg-white rounded-lg shadow-lg ${height}`}
          onEscapeKeyDown={(e) => {
            if (!closeOnOverlayClick) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (!closeOnOverlayClick) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (!closeOnOverlayClick) e.preventDefault();
          }}
        >
          <Dialog.Title className="shrink-0 text-lg font-semibold text-gray-900 p-6 pb-0">
            {title}
          </Dialog.Title>
          {/* `.modal-scroll-body` 는 패널 패딩(기본 p-8=2rem)을 전제한다. 이 패널은 p-6 이므로 1.5rem 으로 맞춘다. */}
          <div
            className={
              scrollBody ? 'modal-scroll-body flex-1 min-h-0 p-6' : 'flex flex-1 min-h-0 flex-col p-6'
            }
            style={scrollBody ? ({ '--modal-scroll-pad': '1.5rem' } as CSSProperties) : undefined}
          >
            {children}
          </div>
          {footer && <div className="shrink-0 flex gap-3 justify-end p-6 pt-0">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
