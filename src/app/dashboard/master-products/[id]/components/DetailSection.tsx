'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DetailSectionProps {
  title: string;
  summary?: ReactNode; // one-line current value, shown while collapsed
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * 마스터 상세의 공통 토글(접기) 섹션.
 * File: src/app/dashboard/master-products/[id]/components/DetailSection.tsx
 *
 * **용도**: 마스터 상세 한 페이지에 편집 패널을 세로로 쌓되, 기본은 전부 접어 두고
 * 필요한 항목만 펼쳐 그 안에서 바로 수정하게 한다(항목별 모달 금지 — 편집 지점이 흩어진다).
 *
 * **필수 사용 규칙**:
 * - 마스터 상세(`CoverageMatrix`)에 새 편집 패널을 추가할 때는 항상 이 컴포넌트로 감싼다.
 * - `summary` 에 현재값 한 줄을 넣어 접힌 상태에서도 상태를 읽을 수 있게 한다.
 * - 열림 상태는 **컴포넌트 로컬**이다. 전역 store·localStorage 로 persist 하지 않는다.
 *
 * ⚠️ **마운트 규칙**: 접힌 초기 상태에서는 children 을 렌더하지 않지만, **한 번 열린 뒤에는
 * 접어도 마운트를 유지**한다(`hasOpened`). 두 성질이 다 필요하다 —
 * ① 최초로 펼칠 때만 자식이 마운트되므로 자식의 초기 로드가 lazy 해지고,
 * ② 접었다 다시 펴도 **미저장 편집분이 날아가지 않는다**(언마운트되면 state 가 사라진다).
 * 접힌 동안에는 `hidden` 으로 감추기만 한다.
 *
 * ⚠️ shadcn 미도입 프로젝트 → 접기 UI 는 hand-rolled(`<button aria-expanded>` + 셰브론).
 * 아코디언 라이브러리를 추가하지 말 것.
 *
 * @example
 * <DetailSection title="기본 정보" summary={master.name}>
 *   <MasterBasicInfoPanel master={master} useCase={useCase} onSaved={handleSaved} />
 * </DetailSection>
 *
 * @example
 * <DetailSection title="태그" summary={`${tags.length}개`} defaultOpen>
 *   <MasterTagsPanel ... />
 * </DetailSection>
 */
export function DetailSection({ title, summary, defaultOpen = false, children }: DetailSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  // Once opened, children stay mounted (hidden) so unsaved edits survive a collapse.
  const [hasOpened, setHasOpened] = useState(defaultOpen);

  const toggle = () => {
    setIsOpen((prev) => !prev);
    setHasOpened(true);
  };

  return (
    <div className="rounded-lg bg-white shadow">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
        )}
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {!isOpen && summary != null && (
          <span className="ml-auto truncate text-xs text-gray-500">{summary}</span>
        )}
      </button>

      {hasOpened && (
        <div className={isOpen ? 'border-t border-gray-200' : 'hidden'}>{children}</div>
      )}
    </div>
  );
}
