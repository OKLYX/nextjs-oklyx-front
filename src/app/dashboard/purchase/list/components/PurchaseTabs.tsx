'use client';

export type PurchaseTab = 'list' | 'completed';

interface PurchaseTabsProps {
  activeTab: PurchaseTab;
  onChange: (tab: PurchaseTab) => void;
}

const TABS: { key: PurchaseTab; label: string }[] = [
  { key: 'list', label: '구매목록' },
  { key: 'completed', label: '구매완료내역조회' },
];

// Toggle buttons switching between the active shopping list and the completed-purchase history.
export function PurchaseTabs({ activeTab, onChange }: PurchaseTabsProps) {
  return (
    <div className="flex gap-2">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              isActive
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
