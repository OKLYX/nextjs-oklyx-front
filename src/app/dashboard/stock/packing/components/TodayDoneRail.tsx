'use client';

import { Card } from '@/presentation/components/ui/Card';

/**
 * 오늘 처리한 것을 보여줄 오른쪽 레일 — **자리와 제목만** (FEATURE_2609_54 / PLAN D6).
 *
 * 🔴 무엇을 표시할지는 **아직 정해지지 않았다**(2026-09-16 사용자 확정: "목록 UI만, 내용은 추후").
 * 그래서 조회 API 도, 가짜 데이터도, 동작 없는 버튼도 두지 않는다 — 내용이 정해지면 이 파일에
 * props 를 더한다. 지금 채워 두면 "있는데 안 맞는 목록"이 된다.
 *
 * 🔴 조작 대상이 아니다(PLAN/D14): 키 경로가 없으므로 버튼도 두지 않는다. 목업의
 * `[송장 검색]` · `[전체 보기]` 는 넣지 않는다 — 누르면 아무 일도 없는 버튼을 만들지 않는다.
 *
 * **파일**: src/app/dashboard/stock/packing/components/TodayDoneRail.tsx
 * **쓰는 곳**: 포장 작업 화면의 「담는 중」 · 「송장 대기」 · 「닫힌 박스」 세 상태 모두 같은 자리.
 */
export function TodayDoneRail() {
  return (
    <Card title="오늘 완료">
      <p className="text-sm text-gray-500">아직 표시할 내용이 없습니다</p>
    </Card>
  );
}
