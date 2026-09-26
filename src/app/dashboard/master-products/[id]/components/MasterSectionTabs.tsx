'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type MasterSectionKey =
  | 'channelOptions'
  | 'basic'
  | 'images'
  | 'fieldValues'
  | 'tags'
  | 'suffix'
  | 'shipping';

export interface MasterSectionTab {
  key: MasterSectionKey;
  label: string;
  /** 현재값 한 줄 — 탭 툴팁으로 보인다. */
  summary?: string;
  content: ReactNode;
}

interface MasterSectionTabsProps {
  /** 보일 탭만 넘긴다(권한·로드 조건은 호출부가 거른다). 배열 순서 = 탭 순서. */
  tabs: MasterSectionTab[];
  /**
   * 밖에서 특정 탭으로 **보내는 신호**. 객체가 새로 올 때만 반응한다(같은 탭을 다시 지목해도 되도록
   * 부모가 매번 새 객체를 만든다). ⚠️ 초기값은 `undefined` — 객체를 처음부터 넘기면 마운트 때 그 탭이 켜진다.
   */
  openTab?: { key: MasterSectionKey; nonce: number };
}

/**
 * 마스터 상세에서 판매상품 목록(채널 매트릭스) **아래** 편집 섹션들의 탭 셸.
 * File: src/app/dashboard/master-products/[id]/components/MasterSectionTabs.tsx
 *
 * **용도**: 목록 아래 편집 섹션(채널별 옵션 · 상품 기본 정보 · 이미지 · 템플릿 필드값 · 배송 설정 ·
 * 등록상품명·태그 · 등록상품명 추가 문구)을 탭으로 보여 한 번에 하나만 보인다.
 * 「상품 기본 정보」는 하위 블록 4개를 한 탭에 세로로 펼치고, 「배송 설정」은 기본 택배/상자 + 전 채널 배송을 합친 탭이다.
 *
 * **필수 사용 규칙**:
 * - 목록 아래에 새 편집 패널을 추가할 때는 토글 섹션으로 쌓지 말고 이 탭에 항목을 추가한다.
 * - 첫 탭이 기본 선택이다. 활성 탭은 **컴포넌트 로컬** — store·localStorage 로 persist 하지 않는다.
 *
 * **마운트 규칙**:
 * | 상태 | 처리 | 이유 |
 * |---|---|---|
 * | 한 번도 안 본 탭 | 렌더하지 않는다 | lazy — 그 탭의 조회가 일어나지 않는다 |
 * | 지금 보는 탭 | 보인다 | — |
 * | 봤다가 떠난 탭 | **마운트 유지 + `hidden`** | 🔴 미저장 입력을 지킨다 |
 *
 * ❌ `{active === key && <Pane/>}` 로 갈아끼우지 말 것 — 탭을 옮겼다 오면 입력 중이던 값이 사라진다.
 * ❌ 탭 바를 sticky 로 고정하지 말 것 — 이 화면에서 고정하는 것은 페이지 머리말 하나뿐이다.
 * ❌ 탭 안에 다시 탭을 두지 말 것 — 「상품 기본 정보」 하위 블록은 한 탭에 펼쳐 보이는 것이 사용자 결정이다.
 *
 * @example
 * <MasterSectionTabs
 *   openTab={sectionOpenTab}
 *   tabs={[
 *     { key: 'basic', label: '상품 기본 정보', summary: basicSummary, content: <div>…</div> },
 *     { key: 'tags', label: '등록상품명 · 태그', summary: tagsSummary, content: <MasterTagsPanel … /> },
 *   ]}
 * />
 */
export function MasterSectionTabs({ tabs, openTab }: MasterSectionTabsProps) {
  const firstKey = tabs[0]?.key;
  const [active, setActive] = useState<MasterSectionKey | undefined>(firstKey);
  const [visited, setVisited] = useState<ReadonlySet<MasterSectionKey>>(
    new Set(firstKey ? [firstKey] : []),
  );

  const select = (key: MasterSectionKey) => {
    setActive(key);
    setVisited((prev) => (prev.has(key) ? prev : new Set([...prev, key])));
  };

  // 밖에서 보내는 신호. 🔴 effect 본문에서 setState 를 동기로 부르면 프로젝트 lint
  // (react-hooks/set-state-in-effect)가 error 로 막는다 — microtask 로 미룬다.
  useEffect(() => {
    if (openTab === undefined) return;
    const key = openTab.key;
    queueMicrotask(() => select(key));
  }, [openTab]);

  if (tabs.length === 0) return null;
  // The active tab may disappear (e.g. `master` not loaded yet) → fall back to the first visible one.
  const current = tabs.some((t) => t.key === active) ? active : tabs[0].key;

  return (
    <div className="rounded-lg bg-white shadow">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-200 px-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={current === t.key}
            title={t.summary}
            onClick={() => select(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              current === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t) =>
        t.key !== current && !visited.has(t.key) ? null : (
          // 🔴 조건부 && 로 갈아끼우지 말 것 — 언마운트되면 미저장 입력이 사라진다.
          <div key={t.key} role="tabpanel" hidden={current !== t.key}>
            {t.content}
          </div>
        ),
      )}
    </div>
  );
}
