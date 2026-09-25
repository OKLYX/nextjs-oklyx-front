'use client';

// 🔴 `useRef` 는 쓰지 않는다 — 아래 openTab effect 가 ref 없이 끝난다(그 이유는 docstring).
import { useEffect, useState, type ReactNode } from 'react';

export type BasicTabKey = 'basic' | 'category' | 'meta' | 'options' | 'images';

const TABS: { key: BasicTabKey; label: string }[] = [
  { key: 'basic', label: '기본 정보' },
  { key: 'category', label: '표준 카테고리' },
  { key: 'meta', label: '필수속성 · 고시' },
  { key: 'options', label: '옵션' },
  { key: 'images', label: '이미지' },
];

interface BasicInfoTabsProps {
  /** 탭별 내용. 키가 빠지면 그 탭은 그리지 않는다. */
  panes: Partial<Record<BasicTabKey, ReactNode>>;
  /**
   * 밖에서 특정 탭으로 **보내는 신호**. 객체가 새로 올 때만 반응한다(같은 탭을 다시 지목해도 되도록
   * 부모가 클릭마다 새 객체를 만든다 — `nonce` 는 그 사실을 읽는 사람에게 알리는 표식이다).
   * ⚠️ 닫지는 않는다 — `DetailSection.openSignal` 과 같은 성격이다.
   * ⚠️ 초기값은 `undefined` 여야 한다. 객체를 처음부터 넘기면 마운트 때 그 탭이 켜진다.
   */
  openTab?: { key: BasicTabKey; nonce: number };
}

/**
 * 마스터 상세 「상품 기본 정보」 **전용** 탭 셸 (2609_73).
 * File: src/app/dashboard/master-products/[id]/components/BasicInfoTabs.tsx
 *
 * **용도**: 한 토글(`DetailSection` 「상품 기본 정보」) 안에 세로로 쌓여 있던 블록 5개
 * (기본 정보 · 표준 카테고리 · 필수속성/고시 · 옵션 · 이미지)를 탭 5개로 바꿔 **한 번에 하나만**
 * 보이게 한다. 페이지 높이가 「블록 5개 합계」에서 「가장 긴 블록 하나」로 줄어든다.
 *
 * **마운트 규칙** — `DetailSection` 과 **같은 규칙**이다. 셋이 다 필요하다:
 * | 상태 | 처리 | 이유 |
 * |---|---|---|
 * | 한 번도 안 본 탭 | 렌더하지 않는다 | lazy — 그 탭의 조회가 일어나지 않는다 |
 * | 지금 보는 탭 | 보인다 | — |
 * | 봤다가 떠난 탭 | **마운트 유지 + `hidden`** | 🔴 미저장 입력을 지킨다 |
 *
 * ⚠️ **비활성 탭을 언마운트하지 말 것** — `{active === key && <Pane/>}` 로 갈아끼우면 필수속성을
 * 절반 입력하고 옵션 탭을 봤다가 돌아왔을 때 **빈 칸**이다. 겉의 `DetailSection` 이 접었다 펴도
 * 미저장 입력을 지키려고 일부러 마운트를 유지하는데(`hasOpened`), 탭이 언마운트하면 그 보호가
 * 탭 전환에서 조용히 뚫린다. 저장소의 다른 탭 둘(`DetailEditorTabs` 의 `&&`,
 * `MetaPlatformTabs` 의 `<div key={active}>` remount)은 **따르지 말아야 할** 선례다.
 *
 * ⚠️ **이것을 다른 화면의 공통 탭으로 승격하지 말 것.** 저장소에 탭 구현이 이미 셋 있고
 * (`DetailEditorTabs` · `MetaPlatformTabs` · `PurchaseTabs`), 이 셸만 **마운트 유지**가 필수라
 * 요구가 다르다. 공통화는 네 곳의 요구가 같아진 것을 확인한 뒤에 할 일이다.
 *
 * ⚠️ `openTab` 은 **여는 신호 전용**이다(닫지 않는다). 값을 `useRef` 로 들고 다니지 말 것 —
 * 렌더 중 ref 쓰기는 프로젝트 lint(`react-hooks/refs`)가 **error** 로 막는다. 부모는 [옵션 수정]
 * 을 누를 때만 새 객체를 만들므로 **객체 identity 자체가 이미 nonce 역할**을 한다 → 의존성은
 * `[openTab]` 하나면 끝난다.
 *
 * @example
 * <BasicInfoTabs
 *   openTab={basicOpenTab}
 *   panes={{ basic: <MasterBasicInfoPanel … />, options: <div>…</div> }}
 * />
 */
export function BasicInfoTabs({ panes, openTab }: BasicInfoTabsProps) {
  const [active, setActive] = useState<BasicTabKey>('basic');
  const [visited, setVisited] = useState<ReadonlySet<BasicTabKey>>(new Set(['basic']));

  const select = (key: BasicTabKey) => {
    setActive(key);
    setVisited((prev) => (prev.has(key) ? prev : new Set([...prev, key])));
  };

  // 밖에서 보내는 신호. 🔴 effect 본문에서 setState 를 동기로 부르면 프로젝트 lint
  // (react-hooks/set-state-in-effect)가 error 로 막는다 — DetailSection 과 같이 microtask 로 미룬다.
  useEffect(() => {
    if (openTab === undefined) return;
    const key = openTab.key;
    queueMicrotask(() => select(key));
  }, [openTab]);

  return (
    <div>
      {/* 탭 바. 🔴 고정(sticky)하지 않는다 — 이 화면에서 고정하는 것은 페이지 머리말 하나뿐이다. */}
      <div className="flex gap-1 border-b border-gray-200 px-2">
        {TABS.filter((t) => panes[t.key] !== undefined).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => select(t.key)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
              active === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {TABS.map((t) =>
        panes[t.key] === undefined || !visited.has(t.key) ? null : (
          // 🔴 조건부 && 로 갈아끼우지 말 것 — 언마운트되면 미저장 입력이 사라진다.
          <div key={t.key} hidden={active !== t.key}>
            {panes[t.key]}
          </div>
        ),
      )}
    </div>
  );
}
