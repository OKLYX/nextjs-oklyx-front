'use client';

import type { ReactNode } from 'react';
import { Card } from '@/presentation/components/ui/Card';

export type RailTab = 'PENDING' | 'DONE';

/**
 * 포장 작업 화면 오른쪽 열(20rem) — 「오늘 완료」 · 「작업 대상」 탭 2개
 * (FEATURE_2609_55 / PLAN D5 · D6). 🔁 2026-11-03 사용자 지시: 「오늘 완료」가 왼쪽이고 기본 탭이다.
 *
 * **파일**: src/app/dashboard/stock/packing/components/RightRailTabs.tsx
 * **쓰는 곳**: 포장 작업 몰입 레이어의 「송장 대기」 · 「담는 중」 · 「닫힌 박스」 세 상태 모두 같은 자리.
 *
 * 🔴 상태는 페이지가 소유한다 — 탭 값도 `pendingPanel` · `donePanel` 도 페이지가 만들어 넘긴다. 상태에 따라
 * 선택 표시·클릭 허용이 달라지기 때문이다(D7).
 * 🔴 The two tab buttons are the only click targets this part adds. That is why F10 exists (D6) — do not add other
 * buttons here. The screen's rule is no action without a key path, with one exception: clicking a 「오늘 완료」 row =
 * change the box of a completed parcel (FEATURE_2611_06 / D10) — mouse · touch only, an exception to the 2609_55
 * rule; a keyboard · scanner path is follow-up work.
 * 🔴 카드는 열 높이를 꽉 채우고(몰입 레이어가 뷰포트를 채운다) 탭 바는 위에 고정된다 —
 * 목록이 길면 **본문만** 스크롤한다. 탭 바가 같이 밀려 올라가면 F10 의 대상이 화면 밖으로 나간다.
 * 🔴 `[F10]` 라벨은 탭 바 줄 안에 직접 그린다. `Card` 의 `action` 은 `title` 이 있을 때만
 * 렌더되므로(`Card.tsx` `{title && (…)}`) 제목 없는 이 카드에서는 **오류 없이 조용히 사라진다.**
 */
interface RightRailTabsProps {
  tab: RailTab;
  onSelectTab: (tab: RailTab) => void;
  /** 「작업 대상」 탭 본문. 상태에 따라 선택 표시·클릭 허용이 달라서 페이지가 만들어 넘긴다 */
  pendingPanel: ReactNode;
  /** 「오늘 완료」 탭 본문 — 오늘 완료한 박스 목록(`TodayDoneList`) */
  donePanel: ReactNode;
}

const TABS: [RailTab, string][] = [
  ['DONE', '오늘 완료'],
  ['PENDING', '작업 대상'],
];

export function RightRailTabs({ tab, onSelectTab, pendingPanel, donePanel }: RightRailTabsProps) {
  return (
    <Card className="xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
      <div className="mb-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={(event) => {
                // 포커스를 남기면 다음 Enter 가 이 버튼을 다시 누른다.
                event.currentTarget.blur();
                onSelectTab(value);
              }}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
                tab === value
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-700 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* 키를 화면 라벨에 찍는 것은 2609_53 이 기능으로 둔 것이다 */}
        <span className="text-xs text-gray-700">[F10]</span>
      </div>
      <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        {tab === 'PENDING' ? pendingPanel : donePanel}
      </div>
    </Card>
  );
}
