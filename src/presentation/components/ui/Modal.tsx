'use client';

/**
 * 공용 팝업 껍데기 — 백드롭 · 패널 · 3영역 레이아웃 · 닫기 동작 · 접근성을 한 곳에서 소유한다.
 *
 * **용도**: 모든 팝업(모달/다이얼로그)의 바깥 껍데기.
 * **파일**: src/presentation/components/ui/Modal.tsx
 *
 * **구조 — 항상 3영역이다. 호출부가 고르지 않는다.**
 * ```
 * ┌─────────────────────────────┐
 * │ 제목                     ✕ │ ← 고정 (스크롤되지 않는다)
 * ├─────────────────────────────┤
 * │ 본문                        │ ← 내용이 넘치면 여기만 스크롤
 * ├─────────────────────────────┤
 * │              [취소] [저장] │ ← 고정 (footer 를 넘길 때만)
 * └─────────────────────────────┘
 * ```
 *
 * **크기**
 * - 가로 = 전 팝업 공통 `--modal-content-w`. 알림/확인(`variant="alert"`)만 `--modal-alert-w`.
 *   호출부가 고르는 knob 은 없다(옛 `size` prop 제거, 2026-09-11) — 폭이 갈라지면 화면마다
 *   다른 팝업처럼 보인다.
 * - 세로 = **내용만큼** 늘어나고, 화면 높이에서 상하 마진을 뺀 값에서 멈춘 뒤 본문만 스크롤된다.
 * - ⚠️ 마진은 **네 변이 같은 값**(`--modal-margin`, `PageContainer` 의 `p-4 md:p-6` 과 같은 축)이다.
 *   팝업은 화면보다 커지지 않는다.
 *
 * **닫기 — 기본은 ✕ 와 ESC 뿐이다.**
 * - 바깥 음영 클릭은 **기본 비활성**. 필요하면 `closeOnOverlayClick` 로 켠다. 실수로 날리는
 *   사고의 1번 원인이라 opt-in 이다.
 * - `isDirty` 를 넘기면 **닫기 경로 전부**(✕ · ESC · 바깥 클릭)가 확인 다이얼로그를 거친다.
 *   ⚠️ 한 경로만 막으면 나머지로 그대로 날아간다 — 세 경로를 따로 다루지 말 것.
 * - ⚠️ `Modal` 은 children 이 무엇인지 모르므로 **입력 여부를 스스로 알 수 없다.** 호출부가
 *   `isDirty` 를 계산해 넘긴다 (예: `name.trim() !== '' || items.length > 0`).
 *
 * **배경**
 * - 일반 팝업 = 음영(`bg-black/50`), 알림(`variant="alert"`) = 더 짙은 음영(`bg-black/70`).
 * - ⚠️ 알림 배경을 불투명 검정으로 만들지 말 것 — 알림은 **아래 팝업에 대한 질문**이라
 *   그 팝업이 보여야 무엇을 잃는지 판단할 수 있다.
 *
 * **사용 예제**
 * ```tsx
 * <Modal isOpen={isOpen} onClose={close} title="상품 수정"
 *        footer={<><Button variant="secondary" onClick={close}>취소</Button>
 *                  <Button onClick={save}>저장</Button></>}>
 *   <ProductForm />
 * </Modal>
 *
 * // 입력이 있으면 닫기 전에 확인
 * <Modal isOpen={isOpen} onClose={close} title="채널 추가" isDirty={name !== ''}>…</Modal>
 *
 * // 다른 모달 위에 뜨는 팝업
 * <Modal isOpen={isOpen} onClose={close} title="이미지 선택" nested>…</Modal>
 * ```
 *
 * ⚠️ 확인/취소 성격의 팝업은 이 컴포넌트를 직접 쓰지 말고 `ConfirmDialog` 를 쓴다.
 * ⚠️ `footer` 는 취소가 왼쪽, 확인이 오른쪽이다.
 * ❌ 호출부에서 `fixed inset-0` 백드롭을 새로 작성하지 않는다.
 * ❌ 호출부에서 `z-50` / `z-[60]` 같은 숫자를 직접 쓰지 않는다.
 * ❌ 호출부에서 본문에 `overflow-y-auto` 를 직접 걸지 않는다 — 본문 스크롤은 이 컴포넌트가 소유한다.
 *   (알려진 예외 1곳 = `ShipmentConfirmModal`. 본문 **안에서** 칩 줄을 고정하고 그 아래 표만
 *   스크롤해야 해서[PLAN 2609_12 D6] 자체 스크롤 밴드를 유지한다. 그 경우 바깥 본문은 넘치지
 *   않으므로 스크롤이 생기지 않는다. 새 팝업에서 이 패턴을 복제하지 말 것.)
 * ❌ 호출부에서 Radix(`Dialog.Root` 등)를 직접 import 하지 않는다.
 */

import { CSSProperties, ReactNode, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export type ModalVariant = 'content' | 'alert';

export interface ModalProps {
  /** 팝업 표시 여부 (기존 호출부 이름 유지) */
  isOpen: boolean;
  /** 닫기 — ✕ · ESC · (켰다면) 바깥 클릭 공통. `isDirty` 면 확인을 거친 뒤 호출된다 */
  onClose: () => void;
  /** 패널 제목. `Dialog.Title` 로 항상 렌더된다 (ARIA 연결) */
  title: string;
  /** 하단 버튼 영역. 취소 왼쪽, 확인 오른쪽. 없으면 푸터 밴드 자체를 그리지 않는다 */
  footer?: ReactNode;
  /** `alert` = 확인/경고용. 폭이 좁고 배경이 더 짙다. 기본 `content` */
  variant?: ModalVariant;
  /** 바깥 음영 클릭으로 닫히는지. **기본 `false`** — 실수로 닫혀 입력이 날아가는 걸 막는다 */
  closeOnOverlayClick?: boolean;
  /** 작성 중인 입력이 있는지. `true` 면 모든 닫기 경로가 확인 다이얼로그를 거친다 */
  isDirty?: boolean;
  /** ESC 로도 닫히지 않게 한다. API 호출 중처럼 **중단되면 안 되는** 구간에만 쓴다 */
  disableClose?: boolean;
  /** 다른 모달 **위에** 뜨는 팝업이면 `true` → `z-[60]`. 기본 `false`(`z-50`) */
  nested?: boolean;
  /** 내용에 따라 높이가 출렁이면 안 되는 팝업이면 `true` → 패널을 최대 높이로 고정 */
  fullHeight?: boolean;
  children: ReactNode;
}

/** 네 변 공통 마진 · 폭 2종은 globals.css 의 변수 한 곳이 소유한다. */
function panelStyle(variant: ModalVariant, fullHeight: boolean): CSSProperties {
  const width = variant === 'alert' ? 'var(--modal-alert-w)' : 'var(--modal-content-w)';
  const bound = 'calc(100dvh - 2 * var(--modal-margin))';
  return {
    width: `min(${width}, calc(100vw - 2 * var(--modal-margin)))`,
    maxHeight: bound,
    ...(fullHeight ? { height: bound } : null),
  };
}

export function Modal({
  isOpen,
  onClose,
  title,
  footer,
  variant = 'content',
  closeOnOverlayClick = false,
  isDirty = false,
  disableClose = false,
  nested = false,
  fullHeight = false,
  children,
}: ModalProps) {
  const [confirmingClose, setConfirmingClose] = useState(false);
  const z = nested ? 'z-[60]' : 'z-50';
  const overlay = variant === 'alert' ? 'bg-black/70' : 'bg-black/50';

  // 닫기 경로는 ✕ · ESC · 바깥 클릭 셋뿐이고, 전부 이 함수를 지난다.
  const requestClose = () => {
    if (disableClose) return;
    if (isDirty) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  const discardAndClose = () => {
    setConfirmingClose(false);
    onClose();
  };

  return (
    <>
      <Dialog.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={`fixed inset-0 ${overlay} ${z}`} />
          <Dialog.Content
            aria-describedby={undefined}
            style={panelStyle(variant, fullHeight)}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${z} flex flex-col rounded-lg bg-white shadow-lg`}
            onEscapeKeyDown={(e) => {
              // 확인 다이얼로그가 떠 있으면 그쪽이 ESC 를 받는다.
              if (disableClose || confirmingClose) e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              if (!closeOnOverlayClick || confirmingClose) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (!closeOnOverlayClick || confirmingClose) e.preventDefault();
            }}
          >
            {/* 헤더 — 항상 보인다 */}
            <div className="flex shrink-0 items-start justify-between gap-4 p-6 pb-4">
              <Dialog.Title className="text-lg font-semibold text-gray-900">{title}</Dialog.Title>
              {!disableClose && (
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="닫기"
                  className="-m-1 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 본문 — 넘치는 만큼만 여기서 스크롤된다 */}
            <div
              className="modal-scroll-body flex min-h-0 flex-1 flex-col px-6"
              style={{ '--modal-scroll-pad': '1.5rem' } as CSSProperties}
            >
              {children}
            </div>

            {footer && (
              <div className="flex shrink-0 justify-end gap-3 p-6 pt-4">{footer}</div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 작성 중 닫기 확인. `ConfirmDialog` 를 쓰면 순환 import 가 되므로 여기서 직접 조립한다.
          ⚠️ **반드시 조건부 렌더**다 — 항상 렌더하면 자기 자신을 무한히 만들어 스택이 터진다.
          이 확인창은 `isDirty` 를 넘기지 않으므로 재귀는 여기서 멈춘다. */}
      {confirmingClose && (
      <Modal
        isOpen
        onClose={() => setConfirmingClose(false)}
        title="작성 취소"
        variant="alert"
        nested
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmingClose(false)}
              className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
            >
              계속 작성
            </button>
            <button
              type="button"
              onClick={discardAndClose}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              닫기
            </button>
          </>
        }
      >
        <p className="text-gray-600">작성 중인 내용이 저장되지 않고 사라집니다. 닫으시겠습니까?</p>
      </Modal>
      )}
    </>
  );
}
