'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';
import { Button } from '@/presentation/components/ui/Button';
import { PageContainer } from '@/presentation/components/PageContainer';

interface WideScreenOnlyProps {
  /** Text of the one button under the notice (「목록으로」 · 「뒤로」). */
  backLabel: string;
  /** Where the button goes. Without it the button goes back in the browser history. */
  backHref?: string;
  /** The editing screen, drawn at 768px and up. */
  children: ReactNode;
}

/**
 * Editing screen that works by dragging, drawn at 768px and up only (FEATURE_2610_31 D19).
 *
 * **Purpose**: below 768px the screen is replaced by one notice line and one button.
 * **File**: src/presentation/components/WideScreenOnly.tsx
 * **Used in**: thumbnail template editor (`thumbnail-templates/new` · `thumbnail-templates/[id]`) · collage
 * (`master-products/[id]/collage`).
 *
 * **Usage**:
 * ```tsx
 * <WideScreenOnly backLabel="목록으로" backHref={ROUTES.THUMBNAIL_TEMPLATES}>
 *   <TemplateEditor mode="new" />
 * </WideScreenOnly>
 *
 * <WideScreenOnly backLabel="뒤로">
 *   <CollageEditorContainer id={id} />
 * </WideScreenOnly>
 * ```
 *
 * ⚠️ Below 768px the children are dropped right after the first client render (the server always draws the
 *    children — `useIsMobile` is false on the server).
 * ⚠️ Server pages can render it — the props are strings and the children.
 * ❌ Do not use it for a screen that has no dragging — narrow screens get the responsive layout (D13 · D15).
 */
export function WideScreenOnly({ backLabel, backHref, children }: WideScreenOnlyProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  if (!isMobile) return <>{children}</>;
  return (
    <PageContainer>
      <div className="space-y-3">
        <p className="text-sm text-gray-700">이 화면은 넓은 화면(PC)에서 편집할 수 있습니다.</p>
        <Button variant="secondary" onClick={() => (backHref ? router.push(backHref) : router.back())}>
          {backLabel}
        </Button>
      </div>
    </PageContainer>
  );
}

/**
 * One notice line over a drag area, below 768px only (FEATURE_2610_31 D19).
 *
 * **File**: src/presentation/components/WideScreenOnly.tsx
 *
 * **Usage** (right above the area whose `draggable` is off below 768px):
 * ```tsx
 * const isMobile = useIsMobile();
 * <DragNotice />
 * <div draggable={!isMobile} onDragStart={start}>…</div>
 * ```
 *
 * ⚠️ `md:hidden` — nothing is drawn at 768px and up.
 */
export function DragNotice() {
  return <p className="mb-2 text-xs text-gray-500 md:hidden">끌어 넣기는 넓은 화면(PC)에서 할 수 있습니다.</p>;
}
