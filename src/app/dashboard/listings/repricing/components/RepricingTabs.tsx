'use client';

/**
 * 판매가 관리 탭 — 「판매가 주의 물품」 · 「판매가 조정 내역」 (FEATURE_2609_43 / PLAN D9·D11).
 * File: src/app/dashboard/listings/repricing/components/RepricingTabs.tsx
 *
 * 🔴 탭은 **서버 축**이다: 두 탭이 부르는 API 자체가 다르다(`repricing/candidates` vs `price-history`).
 *    그래서 밑줄형 탭이고(`ClaimTypeTabs` 와 같은 모양), 탭을 옮길 때마다 그 탭이 자기 조회를 새로 한다 —
 *    한쪽 탭의 데이터를 다른 탭이 재사용하지 않는다.
 * 🔴 탭 개수 배지를 달지 않는다: 열지 않은 탭은 불러온 적이 없어 어떤 숫자를 써도 거짓말이 된다
 *    (`ClaimTypeTabs` 와 같은 이유).
 */

export type RepricingTab = 'ALERT' | 'HISTORY';

const LABEL: Record<RepricingTab, string> = {
  ALERT: '판매가 주의 물품',
  HISTORY: '판매가 조정 내역',
};

const TABS: RepricingTab[] = ['ALERT', 'HISTORY'];

interface RepricingTabsProps {
  value: RepricingTab;
  onChange: (tab: RepricingTab) => void;
  /** 조회·실행 중 이중 클릭을 막는다 */
  disabled: boolean;
}

export function RepricingTabs({ value, onChange, disabled }: RepricingTabsProps) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {TABS.map((tab) => {
        const isActive = value === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            disabled={disabled}
            // 비활성 탭도 `border-b-2 border-transparent` 를 유지한다 — 활성 탭에만 테두리를 주면
            // 탭을 옮길 때마다 버튼 높이가 2px 씩 튄다. `-mb-px` 가 아래 컨테이너 선을 가린다.
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed ${
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {LABEL[tab]}
          </button>
        );
      })}
    </div>
  );
}
