'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type MasterSectionKey = 'basic' | 'images' | 'shipping' | 'channelOptions';

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
 * Tab shell of the edit sections **below** the listing list (channel matrix) on the master detail page.
 * File: src/app/dashboard/master-products/[id]/components/MasterSectionTabs.tsx
 *
 * **Use**: shows the edit sections below the list as 4 tabs (「상품 기본 정보」 · 「이미지」 · 「배송 설정」 · 「채널별 옵션 설정」),
 * one at a time. Each tab lays its sub-blocks out vertically — 「이미지」 = image pool + template field values +
 * thumbnail collage (2+ components only, FEATURE_2610_21), 「배송 설정」 = default carrier/box + all-channel
 * shipping, 「채널별 옵션 설정」 = option table + registration name·tags + extra text.
 *
 * **Required rules**:
 * - A new edit panel below the list is added as an item of these tabs, not stacked as a toggle section.
 * - The first tab is selected by default. The active tab is **component-local** — not persisted to a store or
 *   localStorage.
 *
 * **Mount rules**:
 * | State | Handling | Why |
 * |---|---|---|
 * | a tab never opened | not rendered | lazy — that tab's reads do not happen |
 * | the tab being viewed | visible | — |
 * | a tab opened then left | **stays mounted + `hidden`** | 🔴 keeps unsaved input |
 *
 * ❌ Do not swap with `{active === key && <Pane/>}` — moving to another tab and back loses the input in progress.
 * ❌ Do not make the tab bar sticky — the only fixed element on this screen is the page header.
 * ❌ Do not put tabs inside a tab — showing the sub-blocks spread out in one tab is the user's decision.
 *
 * @example
 * <MasterSectionTabs
 *   openTab={sectionOpenTab}
 *   tabs={[
 *     { key: 'basic', label: '상품 기본 정보', summary: basicSummary, content: <div>…</div> },
 *     { key: 'images', label: '이미지', summary: fieldValuesSummary, content: <div>…</div> },
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
