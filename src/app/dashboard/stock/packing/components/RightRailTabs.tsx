'use client';

import type { ReactNode } from 'react';
import { Card } from '@/presentation/components/ui/Card';

export type RailTab = 'PENDING' | 'DONE';

/**
 * 포장 작업 화면 오른쪽 열(20rem) — 「작업 대상」 · 「오늘 완료」 탭 2개
 * (FEATURE_2609_55 / PLAN D5 · D6).
 *
 * **파일**: src/app/dashboard/stock/packing/components/RightRailTabs.tsx
 * **쓰는 곳**: 포장 작업 몰입 레이어의 「송장 대기」 · 「담는 중」 · 「닫힌 박스」 세 상태 모두 같은 자리.
 *
 * 🔴 상태는 페이지가 소유한다 — 탭 값도 `pendingPanel` 도 페이지가 만들어 넘긴다. 상태에 따라
 * 선택 표시·클릭 허용이 달라지기 때문이다(D7).
 * 🔴 탭 버튼 2개가 이 화면에서 **새로 생기는 유일한 클릭 대상**이다. 그래서 F10 이 있다(D6) —
 * 여기에 다른 버튼을 더하지 않는다. 키 경로 없는 조작을 만들지 않는 것이 이 화면의 규칙이다.
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
}

const TABS: [RailTab, string][] = [
  ['PENDING', '작업 대상'],
  ['DONE', '오늘 완료'],
];

export function RightRailTabs({ tab, onSelectTab, pendingPanel }: RightRailTabsProps) {
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
        {tab === 'PENDING' ? (
          pendingPanel
        ) : (
          /*
           * 🔴 무엇을 표시할지는 **아직 정해지지 않았다**(2026-09-16 사용자 확정: "목록 UI만, 내용은 추후").
           * 그래서 조회 API 도, 가짜 데이터도, 동작 없는 버튼도 두지 않는다 — 내용이 정해지면 이 파일에
           * props 를 더한다. 지금 채워 두면 "있는데 안 맞는 목록"이 된다.
           * 🔴 건수를 탭 라벨에 붙이지 않는다 — 셀 데이터가 없다(2609_54/D6 · D8).
           */
          <p className="text-sm text-gray-700">아직 표시할 내용이 없습니다</p>
        )}
      </div>
    </Card>
  );
}
